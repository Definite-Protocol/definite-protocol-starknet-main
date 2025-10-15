/**
 * Starknet Wallet Service
 * Wallet management for Starknet network only
 *
 * Features:
 * - Starknet wallet connection (ArgentX, Braavos)
 * - Account management
 * - Transaction signing
 * - Wallet state management
 */

import { AccountInterface, Call } from 'starknet';
import { StarknetService } from './starknetService';
import { logger } from '../utils/logger';
import { errorHandler, ErrorType } from '../utils/errorHandler';

export type WalletType = 'argentx' | 'braavos';
export type ChainType = 'starknet';

export interface WalletInfo {
  address: string;
  chainType: ChainType;
  walletType: WalletType;
  publicKey?: string;
  account?: AccountInterface;
}

export interface MultiChainWalletState {
  starknetWallet: WalletInfo | null;
  activeChain: ChainType;
}

interface StarknetWindowObject {
  enable: () => Promise<string[] | { accounts: string[] }>;
  account?: AccountInterface;
  selectedAddress?: string;
  isConnected?: boolean;
  provider?: unknown;
  on?: (event: string, callback: (data: unknown) => void) => void;
  off?: (event: string, callback: (data: unknown) => void) => void;
}

interface WindowWithStarknet extends Window {
  starknet?: StarknetWindowObject;
  starknet_argentX?: StarknetWindowObject;
  starknet_braavos?: StarknetWindowObject;
}

export class MultiChainWalletService {
  private static starknetConnection: StarknetWindowObject | null = null;
  private static walletState: MultiChainWalletState = {
    starknetWallet: null,
    activeChain: 'starknet'
  };

  // Starknet Wallet Methods
  static async connectStarknetWallet(walletType: 'argentx' | 'braavos' = 'argentx'): Promise<WalletInfo | null> {
    try {
      logger.info('Connecting Starknet wallet', { walletType });

      // Check if wallet extension is installed
      const windowWithStarknet = window as WindowWithStarknet;
      const windowStarknet = windowWithStarknet.starknet;
      const windowStarknetArgentX = windowWithStarknet.starknet_argentX;
      const windowStarknetBraavos = windowWithStarknet.starknet_braavos;

      let selectedWallet = null;

      if (walletType === 'argentx') {
        selectedWallet = windowStarknetArgentX || windowStarknet;
        if (!selectedWallet) {
          throw new Error('ArgentX wallet extension is not installed. Please install it from https://www.argent.xyz/argent-x/');
        }
      } else {
        selectedWallet = windowStarknetBraavos || windowStarknet;
        if (!selectedWallet) {
          throw new Error('Braavos wallet extension is not installed. Please install it from https://braavos.app/');
        }
      }

      // Request wallet connection using the wallet's enable method
      logger.info('Requesting wallet connection...');

      let accounts: string[] = [];
      try {
        // Try to enable the wallet
        const enableResult = await selectedWallet.enable();

        logger.info('Enable result received', {
          type: typeof enableResult,
          isArray: Array.isArray(enableResult),
          result: enableResult
        });

        if (Array.isArray(enableResult)) {
          accounts = enableResult;
        } else if (enableResult && typeof enableResult === 'object') {
          // Some wallets return an object with accounts
          const resultObj = enableResult as { accounts?: string[] };
          accounts = resultObj.accounts || [];
        }

        logger.info('Wallet enabled successfully', {
          accountCount: accounts.length,
          accounts: accounts
        });
      } catch (enableError) {
        const err = enableError as Error;
        logger.error('Failed to enable wallet', err);

        if (err?.message?.includes('User abort')) {
          throw new Error('Connection cancelled by user');
        }
        throw new Error('Failed to connect wallet. Please make sure your wallet is unlocked.');
      }

      // Get the account address - try multiple sources
      let address = accounts[0] || selectedWallet.selectedAddress;

      logger.info('Address extraction attempt 1', {
        fromAccounts: accounts[0],
        fromSelectedAddress: selectedWallet.selectedAddress,
        currentAddress: address
      });

      // If still no address, try to get from account
      if (!address && selectedWallet.account) {
        address = selectedWallet.account.address;
        logger.info('Address extraction attempt 2', {
          fromAccount: address
        });
      }

      // Last resort: check if wallet is connected and has isConnected property
      if (!address && selectedWallet.isConnected) {
        // Try to get address from wallet object itself
        const walletObj = selectedWallet as unknown as { address?: string };
        address = walletObj.address;
        logger.info('Address extraction attempt 3', {
          fromWalletObject: address
        });
      }

      logger.info('Final address check', { address });

      if (!address) {
        logger.warn('All address extraction methods failed', {
          walletKeys: Object.keys(selectedWallet),
          hasAccount: !!selectedWallet.account,
          hasSelectedAddress: !!selectedWallet.selectedAddress,
          isConnected: selectedWallet.isConnected
        });
        throw new Error('No account address available');
      }

      // Create Account instance using the wallet's provider
      const provider = selectedWallet.provider;
      if (!provider) {
        throw new Error('Wallet provider not available');
      }

      // Use the wallet's account directly
      const account: AccountInterface | undefined = selectedWallet.account;

      this.starknetConnection = selectedWallet;

      const walletInfo: WalletInfo = {
        address,
        chainType: 'starknet',
        walletType,
        account
      };

      this.walletState.starknetWallet = walletInfo;
      this.walletState.activeChain = 'starknet';

      // Get chain ID for logging
      let chainId = 'unknown';
      try {
        if (account) {
          chainId = await account.getChainId();
        }
      } catch (e) {
        logger.warn('Could not get chain ID', { error: e });
      }

      logger.info('Starknet wallet connected successfully', {
        address,
        walletType,
        chainId
      });

      // Listen for account changes
      if (selectedWallet.on) {
        selectedWallet.on('accountsChanged', (data: unknown) => {
          const newAccounts = data as string[];
          if (newAccounts && newAccounts.length > 0) {
            logger.info('Starknet account changed', { newAccount: newAccounts[0] });
            this.handleStarknetAccountChange(newAccounts[0]);
          } else {
            logger.warn('Account disconnected');
            this.disconnectStarknetWallet();
          }
        });

        selectedWallet.on('networkChanged', (data: unknown) => {
          const network = data as string;
          logger.info('Starknet network changed', { network });
        });
      }

      return walletInfo;
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to connect Starknet wallet', err);

      throw errorHandler.handleError(
        err,
        {
          operation: 'connectStarknetWallet',
          additionalData: { walletType }
        },
        ErrorType.WALLET_ERROR
      );
    }
  }

  static async disconnectStarknetWallet(): Promise<void> {
    try {
      if (this.starknetConnection) {
        // Remove event listeners
        if (this.starknetConnection.off) {
          this.starknetConnection.off('accountsChanged', () => {});
          this.starknetConnection.off('networkChanged', () => {});
        }
        this.starknetConnection = null;
      }
      this.walletState.starknetWallet = null;
      logger.info('Starknet wallet disconnected');
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to disconnect Starknet wallet', err);
    }
  }

  static async disconnectAll(): Promise<void> {
    await this.disconnectStarknetWallet();
    logger.info('All wallets disconnected');
  }

  static getStarknetWallet(): WalletInfo | null {
    return this.walletState.starknetWallet;
  }

  static getActiveWallet(): WalletInfo | null {
    return this.walletState.starknetWallet;
  }

  static setActiveChain(chain: ChainType): void {
    this.walletState.activeChain = chain;
    logger.info('Active chain changed', { chain });
  }

  static getActiveChain(): ChainType {
    return this.walletState.activeChain;
  }

  static isStarknetConnected(): boolean {
    return this.walletState.starknetWallet !== null;
  }

  static isAnyWalletConnected(): boolean {
    return this.isStarknetConnected();
  }

  static async executeStarknetTransaction(calls: Call | Call[]): Promise<string | null> {
    try {
      const wallet = this.walletState.starknetWallet;
      
      if (!wallet || !wallet.account) {
        throw new Error('No Starknet wallet connected');
      }

      const callsArray = Array.isArray(calls) ? calls : [calls];
      
      logger.info('Executing Starknet transaction', {
        callsCount: callsArray.length
      });

      const result = await wallet.account.execute(callsArray);
      
      logger.info('Starknet transaction submitted', {
        txHash: result.transaction_hash
      });

      return result.transaction_hash;
    } catch (error) {
      logger.error('Failed to execute Starknet transaction', error as Error);
      return null;
    }
  }

  static async signStarknetMessage(message: string): Promise<string[] | null> {
    try {
      const wallet = this.walletState.starknetWallet;
      
      if (!wallet || !wallet.account) {
        throw new Error('No Starknet wallet connected');
      }

      const typedData = {
        types: {
          StarkNetDomain: [
            { name: 'name', type: 'felt' },
            { name: 'version', type: 'felt' },
            { name: 'chainId', type: 'felt' }
          ],
          Message: [{ name: 'message', type: 'felt' }]
        },
        primaryType: 'Message',
        domain: {
          name: 'Definite Protocol',
          version: '1',
          chainId: await StarknetService.getProvider().getChainId()
        },
        message: {
          message
        }
      };

      const signature = await wallet.account.signMessage(typedData);

      logger.info('Message signed', { signature });

      // Convert Signature to string array
      if (Array.isArray(signature)) {
        return signature;
      }
      return null;
    } catch (error) {
      logger.error('Failed to sign message', error as Error);
      return null;
    }
  }

  private static handleStarknetAccountChange(newAddress: string): void {
    if (this.walletState.starknetWallet) {
      this.walletState.starknetWallet.address = newAddress;
      
      // Emit custom event for React components to listen
      window.dispatchEvent(new CustomEvent('starknetAccountChanged', {
        detail: { address: newAddress }
      }));
    }
  }

  static getWalletState(): MultiChainWalletState {
    return { ...this.walletState };
  }

  static async getStarknetBalance(tokenAddress?: string): Promise<bigint> {
    const wallet = this.walletState.starknetWallet;
    if (!wallet) return 0n;

    return await StarknetService.getBalance(wallet.address, tokenAddress);
  }

}

