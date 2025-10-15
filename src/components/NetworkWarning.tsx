/**
 * Network Warning Component
 * Shows a warning banner when user is on wrong network
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useMultiChainWallet } from '../hooks/useMultiChainWallet';
import { logger } from '../utils/logger';

const NetworkWarning: React.FC = () => {
  const { starknetWallet, isStarknetConnected } = useMultiChainWallet();
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [currentNetwork, setCurrentNetwork] = useState<string>('');
  const [isDismissed, setIsDismissed] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    const checkNetwork = async () => {
      if (!isStarknetConnected || !starknetWallet) {
        setIsWrongNetwork(false);
        return;
      }

      try {
        // Get chain ID from wallet account
        if (!starknetWallet.account) {
          logger.warn('Wallet account not available');
          return;
        }

        const chainId = await starknetWallet.account.getChainId();

        // Normalize chain ID (remove 0x prefix and convert to lowercase)
        const normalizedChainId = chainId.toLowerCase().replace('0x', '');

        // Sepolia Testnet chain IDs (multiple formats)
        const SEPOLIA_CHAIN_IDS = [
          '534e5f5345504f4c4941', // SN_SEPOLIA (hex without 0x)
          '0x534e5f5345504f4c4941', // SN_SEPOLIA (hex with 0x)
          '534e_5345504f4c4941', // Alternative format
        ];

        const isSepoliaTestnet = SEPOLIA_CHAIN_IDS.some(id =>
          id.toLowerCase().replace('0x', '') === normalizedChainId
        );

        if (!isSepoliaTestnet) {
          setIsWrongNetwork(true);

          // Determine network name from chain ID
          const normalizedWithPrefix = '0x' + normalizedChainId;

          if (normalizedChainId === '534e5f4d41494e' || normalizedWithPrefix === '0x534e5f4d41494e') {
            setCurrentNetwork('Starknet Mainnet');
          } else if (normalizedChainId === '534e5f474f45524c49' || normalizedWithPrefix === '0x534e5f474f45524c49') {
            setCurrentNetwork('Starknet Goerli Testnet');
          } else {
            setCurrentNetwork(`Unknown Network (${chainId})`);
          }

          logger.warn('Wrong network detected', {
            chainId,
            normalizedChainId,
            expected: 'SN_SEPOLIA (0x534e5f5345504f4c4941)'
          });
        } else {
          setIsWrongNetwork(false);
          setIsDismissed(false);
          logger.info('Correct network detected', { chainId: 'SN_SEPOLIA' });
        }
      } catch (error) {
        logger.error('Failed to check network', error as Error);
      }
    };

    checkNetwork();

    // Check network every 5 seconds
    const interval = setInterval(checkNetwork, 5000);

    return () => clearInterval(interval);
  }, [isStarknetConnected, starknetWallet]);

  const handleSwitchNetwork = async () => {
    setIsSwitching(true);
    try {
      // Get wallet from window
      const windowWithStarknet = window as {
        starknet?: {
          request?: (args: { type: string; params: { chainId: string } }) => Promise<boolean>;
        };
      };

      if (windowWithStarknet.starknet?.request) {
        // Try to switch network using wallet_switchStarknetChain
        await windowWithStarknet.starknet.request({
          type: 'wallet_switchStarknetChain',
          params: {
            chainId: '0x534e5f5345504f4c4941' // SN_SEPOLIA
          }
        });
        logger.info('Network switch requested');
      } else {
        // Fallback: show manual instruction
        alert('Please manually switch to Starknet Sepolia Testnet in your wallet settings.');
      }
    } catch (error) {
      logger.error('Failed to switch network', error as Error);
      // Show manual instruction
      alert('Please manually switch to Starknet Sepolia Testnet in your wallet settings.');
    } finally {
      setIsSwitching(false);
    }
  };

  if (!isWrongNetwork || isDismissed) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle size={24} className="flex-shrink-0 animate-pulse" />
            <div>
              <p className="font-semibold text-sm">Wrong Network Detected</p>
              <p className="text-xs opacity-90">
                You're currently on <strong>{currentNetwork}</strong>. Please switch to <strong>Starknet Sepolia Testnet</strong> in your wallet.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSwitchNetwork}
              disabled={isSwitching}
              className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold text-sm hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSwitching ? 'Switching...' : 'Switch Network'}
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="ml-2 p-1 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
              aria-label="Dismiss"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkWarning;

