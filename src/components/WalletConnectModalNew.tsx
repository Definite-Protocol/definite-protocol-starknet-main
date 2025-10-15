/**
 * Wallet Connect Modal - StarknetKit Implementation
 * Following official StarknetKit documentation exactly
 */

'use client';

import React from 'react';
import {
  Connector,
  useAccount,
  useConnect,
  useDisconnect,
} from '@starknet-react/core';
import { StarknetkitConnector, useStarknetkitConnectModal } from 'starknetkit';
import { X, Wallet, LogOut, Copy, ExternalLink, CheckCircle } from 'lucide-react';

interface WalletConnectModalNewProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletConnectModalNew: React.FC<WalletConnectModalNewProps> = ({
  isOpen,
  onClose,
}) => {
  const { disconnect } = useDisconnect();
  const { connect, connectors } = useConnect();
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: connectors as StarknetkitConnector[],
  });
  const { address } = useAccount();

  const [copied, setCopied] = React.useState(false);

  // Connect wallet - exactly as per documentation
  async function connectWallet() {
    const { connector } = await starknetkitConnectModal();
    if (!connector) {
      return;
    }
    await connect({ connector: connector as Connector });
    onClose();
  }

  // Disconnect wallet
  function handleDisconnect() {
    disconnect();
    onClose();
  }

  // Copy address to clipboard
  function copyAddress() {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // View on explorer
  function viewOnExplorer() {
    if (address) {
      const explorerUrl = `https://sepolia.starkscan.co/contract/${address}`;
      window.open(explorerUrl, '_blank');
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-black to-gray-800 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Wallet size={24} />
              <h2 className="text-xl font-bold">
                {address ? 'Wallet Connected' : 'Connect Wallet'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {!address ? (
            // Not connected - show connect button
            <div className="space-y-4">
              <p className="text-gray-600 text-sm">
                Connect your Starknet wallet to start using the protocol.
              </p>

              <button
                onClick={connectWallet}
                className="w-full bg-gradient-to-r from-black to-gray-800 text-white py-4 px-6 rounded-xl font-semibold hover:from-gray-800 hover:to-black transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <Wallet size={20} />
                <span>Connect Wallet</span>
              </button>

              <div className="text-xs text-gray-500 text-center">
                Supports ArgentX and Braavos
              </div>
            </div>
          ) : (
            // Connected - show wallet info
            <div className="space-y-4">
              {/* Address Display */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-2">Connected Address</div>
                <div className="font-mono text-sm break-all">
                  {address}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={copyAddress}
                  className="flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 px-4 rounded-xl transition-colors"
                >
                  {copied ? (
                    <>
                      <CheckCircle size={16} className="text-green-600" />
                      <span className="text-sm">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span className="text-sm">Copy</span>
                    </>
                  )}
                </button>

                <button
                  onClick={viewOnExplorer}
                  className="flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 px-4 rounded-xl transition-colors"
                >
                  <ExternalLink size={16} />
                  <span className="text-sm">Explorer</span>
                </button>
              </div>

              {/* Disconnect Button */}
              <button
                onClick={handleDisconnect}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 px-6 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
              >
                <LogOut size={18} />
                <span>Disconnect</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 text-center">
          <p className="text-xs text-gray-500">
            Powered by{' '}
            <a
              href="https://www.starknetkit.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-black hover:underline font-semibold"
            >
              StarknetKit
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default WalletConnectModalNew;

