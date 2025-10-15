import React, { useState } from 'react';
import { Menu, X, BarChart3, Coins, Home, Wallet } from 'lucide-react';
import { useMultiChainWallet } from '../hooks/useMultiChainWallet';
import WalletConnectModal from './WalletConnectModal';

// Import logo
import definiteLogo from '../assets/seffaf-logo-definite.png';

const Navigation: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const {
    isStarknetConnected,
    starknetWallet,
    disconnectStarknetWallet
  } = useMultiChainWallet();

  // Starknet only
  const isConnected = isStarknetConnected;
  const wallet = starknetWallet;
  const disconnectWallet = disconnectStarknetWallet;

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home, current: window.location.pathname === '/' },
    { name: 'Mint', href: '/mint', icon: Coins, current: window.location.pathname === '/mint' },
    { name: 'Analytics', href: '/analytics', icon: BarChart3, current: window.location.pathname === '/analytics' },
  ];

  const handleNavigation = (href: string) => {
    // Sayfa yönlendirmesi
    if (href === '/') {
      window.location.href = '/';
    } else if (href === '/mint') {
      window.location.href = '/mint';
    } else if (href === '/analytics') {
      window.location.href = '/analytics';
    } else {
      window.location.href = href;
    }
  };

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-black bg-opacity-90 backdrop-blur-xl border-b border-white border-opacity-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <img src={definiteLogo} alt="Definite Protocol" className="h-36 w-36" />
              <div className="text-white font-bold text-2xl leading-tight">Definite Protocol</div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.name}
                      onClick={() => handleNavigation(item.href)}
                      className={`px-3 py-2 text-sm font-medium transition-colors flex items-center space-x-2 ${
                        item.current
                          ? 'text-white bg-[#6e6aff] bg-opacity-20 rounded-md'
                          : 'text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10 rounded-md'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Desktop Wallet Section */}
            <div className="hidden md:flex items-center space-x-4">
              {isConnected && wallet ? (
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="flex items-center space-x-2">
                      <div className="text-white text-sm font-medium">
                        {`${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}
                      </div>
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-600 text-white">
                        Starknet
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {wallet.walletType === 'argentx' && 'ArgentX'}
                      {wallet.walletType === 'braavos' && 'Braavos'}
                    </div>
                  </div>
                  <button
                    onClick={disconnectWallet}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-medium transition-colors rounded-md"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsWalletModalOpen(true)}
                  className="bg-[#6e6aff] hover:bg-[#5b57e6] text-white px-4 py-2 text-sm font-medium transition-colors rounded-md"
                >
                  Connect Wallet
                </button>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-300 hover:text-white p-2"
              >
                {isMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-black bg-opacity-95 border-t border-white border-opacity-10">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      handleNavigation(item.href);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-base font-medium transition-colors flex items-center ${
                      item.current
                        ? 'text-white bg-[#6e6aff] bg-opacity-20'
                        : 'text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </button>
                );
              })}
              
              {/* Mobile Wallet Connection */}
              <div className="border-t border-white border-opacity-10 pt-3 mt-3">
                {isConnected && wallet ? (
                  <div className="px-3 py-2">
                    <div className="text-white text-sm mb-2 flex items-center justify-between">
                      <div className="flex items-center">
                        <Wallet className="w-4 h-4 mr-2" />
                        {`${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}
                      </div>
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-600 text-white">
                        Starknet
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mb-3">
                      {wallet.walletType === 'argentx' && 'ArgentX Wallet'}
                      {wallet.walletType === 'braavos' && 'Braavos Wallet'}
                    </div>

                    <button
                      onClick={() => {
                        disconnectWallet();
                        setIsMenuOpen(false);
                      }}
                      className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-medium transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setIsWalletModalOpen(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full mx-3 bg-[#6e6aff] hover:bg-[#5b57e6] text-white px-4 py-2 text-sm font-medium transition-colors"
                  >
                    Connect Wallet
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Wallet Connect Modal */}
      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
      />
    </>
  );
};

export default Navigation;