/**
 * Wallet Hook - StarknetKit Wrapper
 * Enterprise-grade wallet connection using StarknetKit
 * Provides backward compatibility with old useMultiChainWallet API
 */

import { useAccount, useDisconnect } from '@starknet-react/core';
import { useCallback } from 'react';

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { disconnect: disconnectFn } = useDisconnect();

  // Wrap disconnect to handle the mutation function properly
  const disconnect = useCallback(() => {
    disconnectFn();
  }, [disconnectFn]);

  return {
    // New StarknetKit API
    address,
    isConnected,
    disconnect,

    // Backward compatibility with old useMultiChainWallet API
    isStarknetConnected: isConnected,
    starknetWallet: address ? { address } : null,
    disconnectStarknetWallet: disconnect,
  };
}

export default useWallet;

