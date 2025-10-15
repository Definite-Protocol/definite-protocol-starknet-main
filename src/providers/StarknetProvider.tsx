/**
 * Starknet Provider
 * Enterprise-grade wallet connection using StarknetKit + starknet-react
 * Following official StarknetKit documentation
 */

import React from 'react';
import { StarknetConfig, publicProvider, voyager } from '@starknet-react/core';
import { mainnet, sepolia } from '@starknet-react/chains';
import { InjectedConnector } from 'starknetkit/injected';
import type { Connector } from '@starknet-react/core';

interface StarknetProviderProps {
  children: React.ReactNode;
}

export function StarknetProvider({ children }: StarknetProviderProps) {
  // Configure connectors exactly as per StarknetKit documentation
  const connectors = [
    new InjectedConnector({
      options: { id: 'argentX', name: 'Ready Wallet (formerly Argent)' },
    }),
    new InjectedConnector({
      options: { id: 'braavos', name: 'Braavos' },
    }),
  ];

  return (
    <StarknetConfig
      chains={[mainnet, sepolia]}
      provider={publicProvider()}
      connectors={connectors as Connector[]}
      explorer={voyager}
      autoConnect={true}
    >
      {children}
    </StarknetConfig>
  );
}

export default StarknetProvider;

