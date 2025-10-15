import React, { useState } from 'react';
import { X, Wallet, AlertCircle, CheckCircle, Download, Shield } from 'lucide-react';
import { useMultiChainWallet } from '../hooks/useMultiChainWallet';

// Import wallet logos
import argentXLogo from '../assets/argentx-logo.png';
import braavosLogo from '../assets/braavos-wallet-logo.png';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type WalletType = 'argentx' | 'braavos' | 'xverse';
type ConnectionStep = 'select' | 'connecting' | 'success' | 'error';

interface WalletOption {
  id: WalletType;
  name: string;
  description: string;
  features: string[];
  logo?: string;
  icon: React.FC<{ size?: number | string; className?: string }>;
  available: boolean;
  downloadUrl: string;
  recommended: boolean;
  chain: 'Starknet';
}

const WalletConnectModal: React.FC<WalletConnectModalProps> = ({ isOpen, onClose }) => {
  const { connectStarknetWallet, isConnecting, error } = useMultiChainWallet();
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);
  const [connectionStep, setConnectionStep] = useState<ConnectionStep>('select');

  if (!isOpen) return null;

  const handleWalletConnect = async (walletType: WalletType) => {
    setSelectedWallet(walletType);
    setConnectionStep('connecting');

    try {
      let success = false;

      if (walletType === 'argentx' || walletType === 'braavos') {
        success = await connectStarknetWallet(walletType);
      }

      if (success) {
        setConnectionStep('success');
        setTimeout(() => {
          onClose();
          setConnectionStep('select');
          setSelectedWallet(null);
        }, 1500);
      } else {
        setConnectionStep('error');
      }
    } catch (err) {
      console.error('Wallet connection error:', err);
      setConnectionStep('error');
    }
  };

  const resetModal = () => {
    setConnectionStep('select');
    setSelectedWallet(null);
  };

  const walletOptions: WalletOption[] = [
    {
      id: 'argentx',
      name: 'ArgentX',
      description: 'Most Popular Starknet Wallet',
      features: ['Account Abstraction', 'Mobile & Web', 'Secure', 'Gas Sponsorship'],
      logo: argentXLogo,
      icon: Wallet,
      available: true,
      downloadUrl: 'https://www.argent.xyz/argent-x/',
      recommended: true,
      chain: 'Starknet'
    },
    {
      id: 'braavos' as WalletType,
      name: 'Braavos',
      description: 'Advanced Starknet Wallet',
      features: ['Hardware Support', 'Multi-Sig', 'Account Abstraction', 'Secure'],
      logo: braavosLogo,
      icon: Shield,
      available: true,
      downloadUrl: 'https://braavos.app/',
      recommended: false,
      chain: 'Starknet'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-75 backdrop-blur-sm"
        onClick={() => {
          onClose();
          resetModal();
        }}
      />

      {/* Modal */}
      <div className="relative bg-white backdrop-blur-xl p-8 max-w-lg w-full border border-black rounded-xl shadow-2xl">
        {/* Close button */}
        <button
          onClick={() => {
            onClose();
            resetModal();
          }}
          className="absolute top-4 right-4 text-black text-opacity-60 hover:text-opacity-100 transition-colors z-10"
        >
          <X size={24} />
        </button>

        {connectionStep === 'select' && (
          <>
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-white border border-black rounded-xl flex items-center justify-center mr-4">
                  <Wallet className="text-black" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl text-black font-bold">Connect Wallet</h2>
                  <p className="text-black text-opacity-60 text-sm">Choose your Starknet wallet to continue</p>
                </div>
              </div>
              <div className="bg-black h-1 w-full rounded-full opacity-20"></div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg flex items-start">
                <AlertCircle className="text-red-600 mr-3 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <span className="text-red-700 text-sm">{error}</span>
                </div>
              </div>
            )}

            {/* Wallet Options */}
            <div className="space-y-3">
              {walletOptions.map((wallet) => {
                return (
                  <div key={wallet.id} className="relative">
                    <button
                      onClick={() => handleWalletConnect(wallet.id)}
                      disabled={isConnecting || !wallet.available}
                      className={`w-full p-4 border rounded-xl transition-all duration-200 group ${
                        wallet.available
                          ? 'bg-white border-black hover:bg-gray-50 hover:scale-[1.02]'
                          : 'bg-gray-200 border-gray-400 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className="w-14 h-14 bg-white border border-black rounded-xl flex items-center justify-center mr-4 shadow-lg p-1.5 overflow-hidden">
                          {wallet.logo ? (
                            <img
                              src={wallet.logo}
                              alt={wallet.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <wallet.icon size={36} className="text-purple-600" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center mb-1">
                            <span className="text-black font-semibold text-lg">{wallet.name}</span>
                            {wallet.recommended && (
                              <span className="ml-2 px-2 py-1 bg-black bg-opacity-10 text-black text-xs font-medium rounded-full">
                                Recommended
                              </span>
                            )}
                            <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                              {wallet.chain}
                            </span>
                          </div>
                          <p className="text-black text-opacity-60 text-sm mb-2">{wallet.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {wallet.features.map((feature, index) => (
                              <span key={index} className="px-2 py-1 bg-black bg-opacity-10 text-black text-opacity-80 text-xs rounded-md">
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col items-center space-y-2">
                          {wallet.available ? (
                            <CheckCircle size={20} className="text-green-600" />
                          ) : (
                            <a
                              href={wallet.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center space-x-1 text-black hover:text-gray-700 text-xs transition-colors"
                            >
                              <Download size={16} />
                              <span>Install</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Security Notice */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-start space-x-3">
                <Shield className="text-green-600 mt-0.5" size={20} />
                <div>
                  <h4 className="text-black font-medium text-sm mb-1">Security Notice</h4>
                  <div className="text-black text-opacity-60 text-xs space-y-1">
                    <p>• Your wallet is used only for authentication and transaction signing</p>
                    <p>• No transactions will be made without your explicit approval</p>
                    <p>• You can disconnect at any time from the navigation menu</p>
                    <p>• Your private keys never leave your wallet</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Network Notice */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-3">
                <AlertCircle className="text-blue-600 mt-0.5" size={20} />
                <div>
                  <h4 className="text-black font-medium text-sm mb-1">Network Configuration</h4>
                  <div className="text-black text-opacity-60 text-xs space-y-1">
                    <p>• <strong>Required Network:</strong> <strong>Starknet Sepolia Testnet</strong></p>
                    <p>• All operations are on Starknet Sepolia Testnet</p>
                    <p>• You can switch networks in your wallet extension settings</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Connecting State */}
        {connectionStep === 'connecting' && selectedWallet && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-white border border-black rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Wallet className="text-black" size={32} />
            </div>
            <h3 className="text-xl text-black font-semibold mb-2">Connecting to {walletOptions.find(w => w.id === selectedWallet)?.name}</h3>
            <p className="text-black text-opacity-60 mb-6">Please approve the connection in your wallet</p>
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
              <span className="text-black text-sm">Waiting for approval...</span>
            </div>
            <button
              onClick={resetModal}
              className="mt-6 text-black text-opacity-60 hover:text-opacity-100 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Success State */}
        {connectionStep === 'success' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="text-white" size={32} />
            </div>
            <h3 className="text-xl text-black font-semibold mb-2">Successfully Connected!</h3>
            <p className="text-black text-opacity-60 mb-4">Your wallet is now connected to Definite Protocol</p>

            {/* Network Reminder */}
            {selectedWallet && (selectedWallet === 'argentx' || selectedWallet === 'braavos') && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-left">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="text-blue-600 mt-0.5 flex-shrink-0" size={16} />
                  <div className="text-xs text-black text-opacity-70">
                    <strong>Important:</strong> Please ensure your wallet is on <strong>Starknet Sepolia Testnet</strong> to use the protocol.
                  </div>
                </div>
              </div>
            )}

            <div className="animate-pulse text-black text-sm">Redirecting...</div>
          </div>
        )}

        {/* Error State */}
        {connectionStep === 'error' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-white" size={32} />
            </div>
            <h3 className="text-xl text-black font-semibold mb-2">Connection Failed</h3>
            <p className="text-black text-opacity-60 mb-6">
              {error || 'Unable to connect to wallet. Please try again.'}
            </p>
            <div className="space-y-3">
              <button
                onClick={resetModal}
                className="w-full bg-white hover:bg-gray-50 text-black border border-black px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  onClose();
                  resetModal();
                }}
                className="w-full text-black text-opacity-60 hover:text-opacity-100 px-6 py-2 text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}


      </div>
    </div>
  );
};

export default WalletConnectModal;