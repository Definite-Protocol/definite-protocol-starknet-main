/**
 * Starknet hSTRK Hook
 * Protocol operations for hSTRK on Starknet
 * Production-ready with comprehensive state management
 */

import { useState, useEffect, useCallback } from 'react';
import { starknetHstrkService, MintQuote, RedeemQuote, Position, Balances } from '../services/starknetHstrkService';
import { useAccount, useProvider } from '@starknet-react/core';
import { logger } from '../utils/logger';
import { Account } from 'starknet';

interface TransactionState {
  isProcessing: boolean;
  txHash: string | null;
  error: string | null;
}

export const useStarknetHSTRK = () => {
  const { address, isConnected, account, connector } = useAccount();
  const { provider } = useProvider();

  // Get account - try multiple sources
  const [walletAccount, setWalletAccount] = useState<Account | null>(null);

  useEffect(() => {
    const getAccount = async () => {
      logger.info('Getting account...', {
        isConnected,
        hasAccount: !!account,
        hasAddress: !!address,
        hasConnector: !!connector,
        hasProvider: !!provider,
        accountAddress: account?.address,
        connectedAddress: address
      });

      if (!isConnected || !address) {
        setWalletAccount(null);
        return;
      }

      // Strategy 1: Use account from useAccount hook if available
      if (account && account.address) {
        logger.info('✅ Strategy 1: Using account from useAccount hook');
        setWalletAccount(account as Account);
        return;
      }

      // Strategy 2: Get account from connector
      if (connector && provider) {
        try {
          logger.info('Strategy 2: Fetching account from connector...');
          const connectorAccount = await connector.account(provider);

          if (connectorAccount && connectorAccount.address) {
            logger.info('✅ Strategy 2: Got account from connector');
            setWalletAccount(connectorAccount as Account);
            return;
          }
        } catch (err) {
          logger.warn('Strategy 2 failed:', err);
        }
      }

      // Strategy 3: Get account from window.starknet (last resort)
      if (typeof window !== 'undefined') {
        try {
          logger.info('Strategy 3: Trying window.starknet...');
          const win = window as any;

          // Try different wallet sources
          const sources = [
            { name: 'argentX', obj: win.starknet_argentX },
            { name: 'braavos', obj: win.starknet_braavos },
            { name: 'starknet', obj: win.starknet }
          ];

          for (const source of sources) {
            if (source.obj?.account?.address) {
              logger.info(`✅ Strategy 3: Using account from ${source.name}`);
              setWalletAccount(source.obj.account);
              return;
            }
          }

          // Try enabling wallet
          if (win.starknet && !win.starknet.account) {
            logger.info('Strategy 3: Enabling wallet...');
            await win.starknet.enable();
            if (win.starknet.account?.address) {
              logger.info('✅ Strategy 3: Got account after enable');
              setWalletAccount(win.starknet.account);
              return;
            }
          }
        } catch (err) {
          logger.warn('Strategy 3 failed:', err);
        }
      }

      logger.error('❌ All strategies failed - no account available');
      setWalletAccount(null);
    };

    getAccount();
  }, [isConnected, account, address, connector, provider]);

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
    logger.info('Mint requested:', {
      hasWalletAccount: !!walletAccount,
      walletAccountAddress: walletAccount?.address,
      isConnected,
      connectedAddress: address,
      hasAccount: !!account,
      accountAddress: account?.address,
      amount: collateralAmount
    });

    if (!walletAccount) {
      const errorMsg = `Wallet not ready. isConnected: ${isConnected}, hasAccount: ${!!account}, hasAddress: ${!!account?.address}`;
      logger.error(errorMsg);
      throw new Error('Starknet wallet not connected. Please wait for wallet to initialize or reconnect.');
    }

    logger.info('Starting mint...', {
      walletAccountAddress: walletAccount.address,
      connectedAddress: address,
      amount: collateralAmount
    });

    setMintState({ isProcessing: true, txHash: null, error: null });

    try {
      const amountBigInt = BigInt(Math.floor(collateralAmount * 1_000_000_000_000_000_000));

      logger.info('Calling mint service...', {
        amount: collateralAmount,
        amountBigInt: amountBigInt.toString(),
        walletAddress: walletAccount.address
      });

      const result = await starknetHstrkService.mint(walletAccount, amountBigInt);

      logger.info('Mint successful!', {
        txHash: result.transactionHash,
        amount: collateralAmount
      });

      // Transaction is saved by the service, no need to save here

      setMintState({
        isProcessing: false,
        txHash: result.transactionHash,
        error: null
      });

      await loadUserData();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Mint failed';
      logger.error('Mint failed', { error: err, message: errorMessage });
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
