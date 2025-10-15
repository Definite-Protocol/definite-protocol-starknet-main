/**
 * Starknet hSTRK Hook
 * Protocol operations for hSTRK on Starknet
 * Production-ready with comprehensive state management
 */

import { useState, useEffect, useCallback } from 'react';
import { starknetHstrkService, MintQuote, RedeemQuote, Position, Balances } from '../services/starknetHstrkService';
import { useAccount } from '@starknet-react/core';
import { logger } from '../utils/logger';
import { Account } from 'starknet';

interface TransactionState {
  isProcessing: boolean;
  txHash: string | null;
  error: string | null;
}

export const useStarknetHSTRK = () => {
  const { address, isConnected, account } = useAccount();

  // Get account from connected wallet using get-starknet
  const [walletAccount, setWalletAccount] = useState<Account | null>(null);

  useEffect(() => {
    const getAccount = async () => {
      if (isConnected && address && typeof window !== 'undefined') {
        try {
          const win = window as any;

          // Try different wallet injections
          const walletSources = [
            { name: 'starknet_argentX', obj: win.starknet_argentX },
            { name: 'starknet_braavos', obj: win.starknet_braavos },
            { name: 'starknet', obj: win.starknet },
          ];

          // SIMPLE FIX: Just use the wallet's account object as-is
          // Don't manipulate it - the wallet knows best
          for (const source of walletSources) {
            if (source.obj && source.obj.account) {
              const acc = source.obj.account;

              logger.info(`Found wallet account from ${source.name}:`, {
                accountAddress: acc.address,
                addressType: typeof acc.address,
                addressDefined: !!acc.address,
                connectedAddress: address,
                hasProvider: !!source.obj.provider,
                accountKeys: Object.keys(acc),
                accountType: acc.constructor?.name
              });

              // Validate account has address
              if (!acc.address) {
                logger.error(`Account from ${source.name} has no address!`);
                continue; // Try next source
              }

              setWalletAccount(acc);
              logger.info(`✅ Using wallet account from ${source.name}`);
              return;
            }
          }

          // Last resort: try to enable wallet
          if (win.starknet) {
            try {
              logger.info('Attempting to enable wallet...');
              await win.starknet.enable();

              if (win.starknet.account) {
                const acc = win.starknet.account;

                logger.info('Wallet enabled, using account:', {
                  accountAddress: acc.address,
                  connectedAddress: address
                });

                setWalletAccount(acc);
                logger.info('✅ Using wallet account after enable');
                return;
              }
            } catch (enableErr) {
              logger.warn('Failed to enable wallet', enableErr);
            }
          }

          logger.warn('No wallet account found - will try to use account from useAccount hook');
        } catch (err) {
          logger.error('Failed to get wallet account', err);
        }
      } else {
        setWalletAccount(null);
      }
    };
    getAccount();
  }, [isConnected, address]);

  // Fallback: Use account from useAccount hook if wallet account not found
  useEffect(() => {
    if (isConnected && account && !walletAccount) {
      logger.info('Using account from useAccount hook as fallback:', {
        accountAddress: account.address,
        addressType: typeof account.address,
        addressDefined: !!account.address,
        connectedAddress: address,
        accountKeys: Object.keys(account),
        accountType: account.constructor?.name
      });

      // Validate account has address
      if (!account.address) {
        logger.error('Account from useAccount hook has no address!');
        return;
      }

      setWalletAccount(account as Account);
      logger.info('✅ Using account from useAccount hook');
    }
  }, [isConnected, account, walletAccount, address]);

  // State
  const [balances, setBalances] = useState<Balances>({
    strk: 0n,
    hstrk: 0n,
    collateral: 0n
  });
  const [position, setPosition] = useState<Position | null>(null);
  const [mintQuote, setMintQuote] = useState<MintQuote | null>(null);
  const [redeemQuote, setRedeemQuote] = useState<RedeemQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mintState, setMintState] = useState<TransactionState>({
    isProcessing: false,
    txHash: null,
    error: null
  });

  const [redeemState, setRedeemState] = useState<TransactionState>({
    isProcessing: false,
    txHash: null,
    error: null
  });

  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);

  // Load user data when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      loadUserData();
    } else {
      // Reset state when disconnected
      setBalances({ strk: 0n, hstrk: 0n, collateral: 0n });
      setPosition(null);
      setMintQuote(null);
      setRedeemQuote(null);
    }
  }, [isConnected, address]);

  // Load user data
  const loadUserData = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      console.log('🔄 Loading user data...', { address });

      const [balancesData, positionData, historyData] = await Promise.all([
        starknetHstrkService.getBalances(address),
        starknetHstrkService.getPosition(address),
        starknetHstrkService.getUserTransactionHistory(address)
      ]);

      console.log('🔄 User data loaded', {
        balances: balancesData,
        position: positionData,
        historyCount: historyData.length,
        history: historyData
      });

      setBalances(balancesData);
      setPosition(positionData);
      setTransactionHistory(historyData);

      console.log('🔄 State updated', { transactionHistoryLength: historyData.length });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load user data';
      setError(errorMessage);
      logger.error('Failed to load user data', { error: err });
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Get mint quote
  const getMintQuote = useCallback(async (collateralAmount: number) => {
    try {
      const amountBigInt = BigInt(Math.floor(collateralAmount * 1_000_000_000_000_000_000));
      const quote = await starknetHstrkService.getMintQuote(amountBigInt);
      setMintQuote(quote);
      return quote;
    } catch (err) {
      logger.error('Failed to get mint quote', { error: err });
      return null;
    }
  }, []);

  // Get redeem quote
  const getRedeemQuote = useCallback(async (hstrkAmount: number) => {
    try {
      const amountBigInt = BigInt(Math.floor(hstrkAmount * 1_000_000_000_000_000_000));
      const quote = await starknetHstrkService.getRedeemQuote(amountBigInt);
      setRedeemQuote(quote);
      return quote;
    } catch (err) {
      logger.error('Failed to get redeem quote', { error: err });
      return null;
    }
  }, []);

  // Mint hSTRK
  const mintHSTRK = useCallback(async (collateralAmount: number) => {
    if (!walletAccount) {
      throw new Error('Starknet wallet not connected');
    }

    logger.info('Starting mint...', {
      walletAccountAddress: walletAccount.address,
      connectedAddress: address,
      amount: collateralAmount
    });

    setMintState({ isProcessing: true, txHash: null, error: null });

    try {
      const amountBigInt = BigInt(Math.floor(collateralAmount * 1_000_000_000_000_000_000));
      const result = await starknetHstrkService.mint(walletAccount, amountBigInt);

      setMintState({
        isProcessing: false,
        txHash: result.transactionHash,
        error: null
      });

      await loadUserData();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Mint failed';
      setMintState({
        isProcessing: false,
        txHash: null,
        error: errorMessage
      });
      throw err;
    }
  }, [walletAccount, loadUserData]);

  // Redeem hSTRK
  const redeemHSTRK = useCallback(async (hstrkAmount: number) => {
    if (!walletAccount) {
      throw new Error('Starknet wallet not connected');
    }

    setRedeemState({ isProcessing: true, txHash: null, error: null });

    try {
      const amountBigInt = BigInt(Math.floor(hstrkAmount * 1_000_000_000_000_000_000));
      const result = await starknetHstrkService.redeem(walletAccount, amountBigInt);

      setRedeemState({
        isProcessing: false,
        txHash: result.transactionHash,
        error: null
      });

      await loadUserData();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Redeem failed';
      setRedeemState({
        isProcessing: false,
        txHash: null,
        error: errorMessage
      });
      throw err;
    }
  }, [walletAccount, loadUserData]);

  // Get protocol configuration
  const getProtocolConfig = useCallback(() => {
    return {
      collateralRatio: 1.5,
      liquidationThreshold: 1.2,
      minimumDeposit: 1_000_000, // 1 STRK
      entryFee: 0.001, // 0.1%
      exitFee: 0.001, // 0.1%
      maxSlippage: 0.05 // 5%
    };
  }, []);

  return {
    balances,
    strkBalance: balances.strk,
    hstrkBalance: balances.hstrk,
    collateralBalance: balances.collateral,
    position,
    healthFactor: position?.healthFactor || 0,
    canMint: position?.canMint || false,
    canRedeem: position?.canRedeem || false,
    minimumDeposit: 1_000_000, // 1 STRK
    mintQuote,
    redeemQuote,
    getMintQuote,
    getRedeemQuote,
    mintHSTRK,
    redeemHSTRK,
    getProtocolConfig,
    loading,
    error,
    mintState,
    redeemState,
    loadUserData,
    transactionHistory
  };
};

export default useStarknetHSTRK;
