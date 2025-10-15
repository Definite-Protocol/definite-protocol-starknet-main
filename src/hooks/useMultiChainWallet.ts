/**
 * Multi-Chain Wallet Hook
 * Unified wallet management for Starknet and Bitcoin
 * Production-ready with comprehensive error handling
 */

import { useState, useEffect, useCallback } from 'react';
import { MultiChainWalletService, WalletInfo, ChainType } from '../services/multiChainWalletService';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

interface User {
  id: string;
  wallet_address: string;
  address: string;
  chain_type: ChainType;
  created_at: string;
  updated_at: string;
}

interface MultiChainWalletState {
  starknetWallet: WalletInfo | null;
  activeChain: ChainType;
  user: User | null;
  isConnecting: boolean;
  error: string | null;
}

export const useMultiChainWallet = () => {
  const [state, setState] = useState<MultiChainWalletState>({
    starknetWallet: null,
    activeChain: 'starknet',
    user: null,
    isConnecting: false,
    error: null
  });

  // Generate authentication message
  const generateAuthMessage = (): string => {
    const timestamp = Date.now();
    // Keep message short for Braavos compatibility
    return `Definite ${timestamp.toString().slice(-6)}`;
  };

  // Create local user fallback
  const createLocalUser = useCallback((walletAddress: string, chainType: ChainType, signature: string) => {
    const localUser = {
      id: `local_${chainType}_${walletAddress.toLowerCase()}`,
      wallet_address: walletAddress.toLowerCase(),
      address: walletAddress,
      chain_type: chainType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      signature
    };

    localStorage.setItem(`user_${chainType}_${walletAddress.toLowerCase()}`, JSON.stringify(localUser));
    return localUser;
  }, []);

  // Check Supabase availability
  const [isSupabaseAvailable, setIsSupabaseAvailable] = useState<boolean | null>(null);

  const checkSupabaseAvailability = useCallback(async (): Promise<boolean> => {
    if (isSupabaseAvailable !== null) return isSupabaseAvailable;

    try {
      const { error } = await supabase.from('users').select('count').limit(1);
      const available = !error || !error.message?.includes('Supabase not configured');
      setIsSupabaseAvailable(available);
      return available;
    } catch (error) {
      const err = error as Error;
      logger.warn('Supabase availability check failed', { error: err.message });
      setIsSupabaseAvailable(false);
      return false;
    }
  }, [isSupabaseAvailable]);

  // Create or get user (signature is optional)
  const createOrGetUser = useCallback(async (walletAddress: string, chainType: ChainType, signature?: string) => {
    const existingLocalUser = localStorage.getItem(`user_${chainType}_${walletAddress.toLowerCase()}`);
    if (existingLocalUser) {
      try {
        return JSON.parse(existingLocalUser);
      } catch (error) {
        const err = error as Error;
        logger.warn('Failed to parse local user data', { error: err.message });
      }
    }

    const supabaseAvailable = await checkSupabaseAvailability();
    if (!supabaseAvailable) {
      return createLocalUser(walletAddress, chainType, signature || '');
    }

    try {
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletAddress.toLowerCase())
        .eq('chain_type', chainType)
        .single();

      if (existingUser && !fetchError) return existingUser;

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          chain_type: chainType,
          email: `${walletAddress.toLowerCase()}@wallet.user`,
          full_name: `${chainType.toUpperCase()} User ${walletAddress.slice(-4)}`,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        return createLocalUser(walletAddress, chainType, signature || '');
      }

      return newUser;
    } catch (error) {
      logger.error('Database operation failed', error as Error);
      return createLocalUser(walletAddress, chainType, signature || '');
    }
  }, [checkSupabaseAvailability, createLocalUser]);

  // Connect Starknet wallet
  const connectStarknetWallet = useCallback(async (walletType: 'argentx' | 'braavos' = 'argentx'): Promise<boolean> => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      logger.info('Connecting Starknet wallet', { walletType });

      const walletInfo = await MultiChainWalletService.connectStarknetWallet(walletType);
      if (!walletInfo) {
        throw new Error(`Failed to connect ${walletType} wallet`);
      }

      // Check network (don't force switch, just warn)
      try {
        if (walletInfo.account) {
          const chainId = await walletInfo.account.getChainId();
          const SEPOLIA_TESTNET_CHAIN_ID = '0x534e5f5345504f4c4941';

          if (chainId !== SEPOLIA_TESTNET_CHAIN_ID) {
            logger.warn('Wallet is not on Sepolia Testnet', {
              currentChainId: chainId,
              expectedChainId: SEPOLIA_TESTNET_CHAIN_ID
            });
            // Don't throw error, just warn - user will see network warning banner
          } else {
            logger.info('Wallet is on correct network (Sepolia Testnet)');
          }
        }
      } catch (networkError) {
        logger.warn('Could not check network', { error: networkError });
        // Continue anyway
      }

      // Update state first (wallet is connected)
      setState(prev => ({
        ...prev,
        starknetWallet: walletInfo,
        activeChain: 'starknet',
        isConnecting: false,
        error: null
      }));

      // Store in localStorage
      localStorage.setItem('connectedStarknetWallet', walletInfo.address);
      localStorage.setItem('starknetWalletType', walletType);

      // Try to sign message for authentication (optional)
      let signature: string[] | null = null;
      try {
        const message = generateAuthMessage();
        signature = await MultiChainWalletService.signStarknetMessage(message);

        if (signature) {
          localStorage.setItem('starknetSignature', signature.join(','));
          logger.info('Message signed successfully');
        } else {
          logger.warn('Message signing was skipped or cancelled');
        }
      } catch (signError) {
        const err = signError as Error;
        logger.warn('Message signing failed, continuing without signature', {
          error: err?.message || 'Unknown error'
        });
        // Continue without signature - wallet is still connected
      }

      // Create or get user (works with or without signature)
      try {
        const user = await createOrGetUser(
          walletInfo.address,
          'starknet',
          signature ? signature.join(',') : undefined
        );
        if (user) {
          setState(prev => ({ ...prev, user }));
          logger.info('User created/retrieved successfully');
        }
      } catch (userError) {
        const err = userError as Error;
        logger.warn('User creation failed, continuing without user', {
          error: err?.message || 'Unknown error'
        });
        // Continue without user - wallet is still connected
      }

      // Emit event
      window.dispatchEvent(new CustomEvent('starknetWalletConnected', {
        detail: { wallet: walletInfo, walletType, timestamp: Date.now() }
      }));

      logger.info('Starknet wallet connected', { address: walletInfo.address });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect Starknet wallet';
      setState(prev => ({ ...prev, isConnecting: false, error: errorMessage }));
      logger.error('Starknet wallet connection failed', error as Error);
      return false;
    }
  }, [createOrGetUser]);



  // Disconnect Starknet wallet
  const disconnectStarknetWallet = useCallback(async (): Promise<void> => {
    try {
      await MultiChainWalletService.disconnectStarknetWallet();
      setState(prev => ({ ...prev, starknetWallet: null, user: null }));
      localStorage.removeItem('connectedStarknetWallet');
      localStorage.removeItem('starknetWalletType');
      localStorage.removeItem('starknetSignature');
      logger.info('Starknet wallet disconnected');
    } catch (error) {
      logger.error('Error disconnecting Starknet wallet', error as Error);
    }
  }, []);

  // Disconnect all wallets
  const disconnectAll = useCallback(async (): Promise<void> => {
    await disconnectStarknetWallet();
  }, [disconnectStarknetWallet]);

  // Switch active chain
  const switchChain = useCallback((chain: ChainType) => {
    MultiChainWalletService.setActiveChain(chain);
    setState(prev => ({ ...prev, activeChain: chain }));
    logger.info('Active chain switched', { chain });
  }, []);

  // Check for existing connections on mount
  useEffect(() => {
    const checkExistingConnections = async () => {
      // Clear any old Bitcoin wallet data (Bitcoin support removed)
      localStorage.removeItem('connectedBitcoinWallet');
      localStorage.removeItem('bitcoinSignature');

      // Only reconnect Starknet wallet
      const savedStarknetAddress = localStorage.getItem('connectedStarknetWallet');
      const savedStarknetType = localStorage.getItem('starknetWalletType') as 'argentx' | 'braavos';

      if (savedStarknetAddress && savedStarknetType) {
        try {
          await connectStarknetWallet(savedStarknetType);
        } catch (error) {
          const err = error as Error;
          logger.warn('Failed to reconnect Starknet wallet', { error: err.message });
          localStorage.removeItem('connectedStarknetWallet');
          localStorage.removeItem('starknetWalletType');
        }
      }
    };

    checkExistingConnections();
  }, [connectStarknetWallet]);

  return {
    // State
    starknetWallet: state.starknetWallet,
    activeChain: state.activeChain,
    user: state.user,
    isConnecting: state.isConnecting,
    error: state.error,

    // Actions
    connectStarknetWallet,
    disconnectStarknetWallet,
    disconnectAll,
    switchChain,

    // Computed
    isStarknetConnected: !!state.starknetWallet,
    isAnyConnected: !!state.starknetWallet,
    activeWallet: state.starknetWallet
  };
};

