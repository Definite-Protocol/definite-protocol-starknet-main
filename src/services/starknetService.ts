/**
 * Starknet Service - Core blockchain interaction layer
 * Replaces StrkrandService with Starknet functionality
 * 
 * Features:
 * - Account management and balance queries
 * - Transaction building and execution
 * - Contract interaction
 * - Network status monitoring
 * - Price feed integration
 */

import {
  RpcProvider,
  Account,
  Contract,
  constants,
  validateAndParseAddress,
  Call,
  GetTransactionReceiptResponse
} from 'starknet';
import { logger, measurePerformance } from '../utils/logger';
import { errorHandler, ErrorType } from '../utils/errorHandler';

export interface StarknetConfig {
  rpcUrl: string;
  chainId: string;
  network: 'mainnet' | 'sepolia' | 'devnet';
}

export interface TransactionResult {
  txHash: string;
  success: boolean;
  error?: string;
}

export interface AccountInfo {
  address: string;
  balance: bigint;
  nonce: number;
}

export class StarknetService {
  private static provider: RpcProvider | null = null;
  private static config: StarknetConfig;
  private static isInitialized = false;

  static initialize(customConfig?: Partial<StarknetConfig>) {
    try {
      // Default to Sepolia testnet with RPC 0.9 for Braavos compatibility
      this.config = {
        rpcUrl: customConfig?.rpcUrl || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_9',
        chainId: customConfig?.chainId || constants.StarknetChainId.SN_SEPOLIA,
        network: customConfig?.network || 'sepolia',
        ...customConfig
      };

      this.provider = new RpcProvider({
        nodeUrl: this.config.rpcUrl,
      });

      this.isInitialized = true;

      logger.info('StarknetService initialized successfully', {
        network: this.config.network,
        rpcUrl: this.config.rpcUrl,
        chainId: this.config.chainId
      });

      // Perform initial health check
      this.performHealthCheck();

    } catch (error) {
      const appError = errorHandler.handleError(
        error as Error,
        { operation: 'StarknetService.initialize' },
        ErrorType.BLOCKCHAIN_ERROR
      );
      logger.error('Failed to initialize StarknetService', error as Error);
      throw appError;
    }
  }

  static getProvider(): RpcProvider {
    if (!this.provider || !this.isInitialized) {
      this.initialize();
    }
    return this.provider!;
  }

  static async performHealthCheck(): Promise<boolean> {
    try {
      const provider = this.getProvider();
      const blockNumber = await provider.getBlockNumber();
      
      logger.info('Starknet health check passed', {
        blockNumber,
        network: this.config.network
      });

      return true;
    } catch (error) {
      logger.error('Starknet health check failed', error as Error);
      return false;
    }
  }

  static async getNetworkStatus(): Promise<Record<string, unknown>> {
    return measurePerformance(
      'getNetworkStatus',
      async () => {
        const provider = this.getProvider();
        const blockNumber = await provider.getBlockNumber();
        const chainId = await provider.getChainId();

        return {
          blockNumber,
          chainId,
          network: this.config.network,
          healthy: true
        };
      }
    );
  }

  static async getAccountInfo(address: string): Promise<AccountInfo> {
    return measurePerformance(
      'getAccountInfo',
      async () => {
        try {
          const validAddress = validateAndParseAddress(address);
          const provider = this.getProvider();

          // Get ETH balance (native token on Starknet)
          const ethTokenAddress = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
          
          const { abi: erc20Abi } = await provider.getClassAt(ethTokenAddress);
          const ethContract = new Contract(erc20Abi, ethTokenAddress, provider);
          
          const balanceResult = await ethContract.balanceOf(validAddress);
          const balance = balanceResult.balance ? balanceResult.balance.low : 0n;

          // Get nonce
          const nonce = await provider.getNonceForAddress(validAddress);

          logger.debug('Account information retrieved', {
            address: validAddress,
            balance: balance.toString(),
            nonce
          });

          return {
            address: validAddress,
            balance,
            nonce: Number(nonce)
          };
        } catch (error) {
          logger.error('Error getting account info', error as Error);
          throw errorHandler.handleError(
            error as Error,
            {
              operation: 'getAccountInfo',
              additionalData: { address }
            },
            ErrorType.BLOCKCHAIN_ERROR
          );
        }
      }
    );
  }

  static async getBalance(address: string, tokenAddress?: string): Promise<bigint> {
    try {
      const validAddress = validateAndParseAddress(address);
      const provider = this.getProvider();

      // Default to ETH token if no token address provided
      const token = tokenAddress || '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
      
      const { abi: erc20Abi } = await provider.getClassAt(token);
      const contract = new Contract(erc20Abi, token, provider);
      
      const result = await contract.balanceOf(validAddress);
      const balance = result.balance ? result.balance.low : 0n;

      return balance;
    } catch (error) {
      logger.error('Error getting balance', error as Error);
      return 0n;
    }
  }

  static async waitForTransaction(txHash: string, retryInterval: number = 5000): Promise<GetTransactionReceiptResponse> {
    const provider = this.getProvider();
    
    logger.info('Waiting for transaction confirmation', { txHash });

    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max wait

    while (attempts < maxAttempts) {
      try {
        const receipt = await provider.getTransactionReceipt(txHash);
        
        if ('execution_status' in receipt && receipt.execution_status === 'SUCCEEDED') {
          logger.info('Transaction confirmed', {
            txHash,
            status: receipt.execution_status
          });
          return receipt;
        } else if ('execution_status' in receipt && receipt.execution_status === 'REVERTED') {
          throw new Error(`Transaction reverted: ${txHash}`);
        }
      } catch (error) {
        // Transaction not found yet, continue waiting
        const err = error as Error;
        if (err.message?.includes('Transaction hash not found')) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, retryInterval));
          continue;
        }
        throw error;
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }

    throw new Error(`Transaction confirmation timeout: ${txHash}`);
  }

  static async executeTransaction(
    account: Account,
    calls: Call | Call[]
  ): Promise<TransactionResult> {
    try {
      const callsArray = Array.isArray(calls) ? calls : [calls];
      
      logger.info('Executing transaction', { 
        callsCount: callsArray.length,
        account: account.address 
      });

      const result = await account.execute(callsArray);
      
      logger.info('Transaction submitted', { 
        txHash: result.transaction_hash 
      });

      await this.waitForTransaction(result.transaction_hash);

      return {
        txHash: result.transaction_hash,
        success: true
      };
    } catch (error) {
      logger.error('Transaction execution failed', error as Error);
      return {
        txHash: '',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  static async getStrkPrice(): Promise<number> {
    try {
      // In production, this would integrate with Pragma Oracle or other price feeds
      // For now, return a mock price
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=starknet&vs_currencies=usd');
      const data = await response.json();
      return data.starknet?.usd || 0.5;
    } catch (error) {
      logger.warn('Failed to fetch STRK price, using fallback', { error: (error as Error).message });
      return 0.5; // Fallback price
    }
  }

  static isValidAddress(address: string): boolean {
    try {
      validateAndParseAddress(address);
      return true;
    } catch {
      return false;
    }
  }

  static formatAddress(address: string): string {
    try {
      return validateAndParseAddress(address);
    } catch {
      return address;
    }
  }
}

