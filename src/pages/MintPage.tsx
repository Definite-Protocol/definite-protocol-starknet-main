import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, Settings, RotateCcw, AlertCircle, CheckCircle, Loader, Info, Menu, X, LogOut, Home, Bitcoin, CreditCard } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { useStarknetHSTRK } from '../hooks/useStarknetHSTRK';
import WalletConnectModalNew from '../components/WalletConnectModalNew';

// Import images
import definiteLogo from '../assets/seffaf-logo-definite.png';
import mintBackground from '../assets/mint-2.png';
import background2Image from '../assets/background-2.png';

// Import components
import MintChart from '../components/MintChart';
import MintHistory from '../components/MintHistory';
import ChainSwitcher from '../components/ChainSwitcher';
import ChipiPayModal from '../components/ChipiPayModal';

interface MintPageProps {
  // No longer needed with React Router
}

const MintPage: React.FC<MintPageProps> = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('MINT');
  const [depositAmount, setDepositAmount] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [slippage, setSlippage] = useState('1');
  const [showSettings, setShowSettings] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [chipiPayModalOpen, setChipiPayModalOpen] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const { isConnected: isStarknetConnected, address, disconnect: disconnectStarknetWallet } = useWallet();
  const starknetWallet = address ? { address } : null;
  const {
    balances,
    position,
    mintQuote,
    redeemQuote,
    loading,
    error,
    mintState,
    redeemState,
    getMintQuote,
    getRedeemQuote,
    mintHSTRK,
    redeemHSTRK,
    getProtocolConfig,
    canMint,
    canRedeem,
    minimumDeposit,
    collateralBalance,
    hstrkBalance,
    transactionHistory
  } = useStarknetHSTRK();

  // Alias for compatibility
  const isConnected = isStarknetConnected;
  const wallet = starknetWallet;
  const disconnectWallet = disconnectStarknetWallet;

  // Format helpers (deprecated - use formatBalance instead)
  const formatAmount = (amount: number | bigint) => {
    if (typeof amount === 'bigint') {
      return (Number(amount) / 1e18).toFixed(1);
    }
    return (amount / 1e18).toFixed(1);
  };

  // Format balance with 18 decimals (for STRK and hSTRK) - 1 decimal place
  const formatBalance = (amount: bigint | number | undefined): string => {
    if (!amount) return '0.0';

    // Handle BigInt separately
    if (typeof amount === 'bigint') {
      if (amount === 0n) return '0.0';
      return (Number(amount) / 1e18).toFixed(1);
    }

    // Handle number
    if (amount === 0) return '0.0';
    return (amount / 1e18).toFixed(1);
  };

  const tabs = ['MINT', 'REDEEM', 'DETAILS'];
  const config = getProtocolConfig();

  // Update quotes when amounts change
  useEffect(() => {
    if (activeTab === 'MINT' && depositAmount) {
      const collateralAmount = parseFloat(depositAmount);
      if (collateralAmount > 0) {
        getMintQuote(collateralAmount);
      }
    } else if (activeTab === 'REDEEM' && depositAmount) {
      const hstrkAmount = parseFloat(depositAmount);
      if (hstrkAmount > 0) {
        getRedeemQuote(hstrkAmount);
      }
    }
  }, [depositAmount, slippage, activeTab, getMintQuote, getRedeemQuote]);

  // Update receive amount based on quotes
  useEffect(() => {
    if (activeTab === 'MINT' && mintQuote) {
      setReceiveAmount((Number(mintQuote.hstrkAmount) / 1e18).toFixed(1));
    } else if (activeTab === 'REDEEM' && redeemQuote) {
      setReceiveAmount((Number(redeemQuote.collateralReturned) / 1e18).toFixed(1));
    }
  }, [mintQuote, redeemQuote, activeTab]);

  const handleDepositChange = (value: string) => {
    setDepositAmount(value);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setDepositAmount('');
    setReceiveAmount('');
  };

  // Process transaction history for charts and history components
  const processTransactionHistory = () => {
    // Use transaction history from hook
    const allTransactions = transactionHistory || [];

    // Generate chart data with cumulative values
    let cumulativeStrk = 0;
    let cumulativeHstrk = 0;

    const chartData = allTransactions.map((tx) => {
      const algoAmount = typeof tx.algoAmount === 'string' ? parseFloat(tx.algoAmount) : tx.algoAmount;
      const hstrkAmount = typeof tx.hstrkAmount === 'string' ? parseFloat(tx.hstrkAmount) : tx.hstrkAmount;

      if (tx.type === 'MINT') {
        cumulativeStrk += algoAmount;
        cumulativeHstrk += hstrkAmount;
      } else {
        cumulativeStrk -= hstrkAmount; // When redeeming, we get back STRK
        cumulativeHstrk -= algoAmount; // When redeeming, we give hSTRK
      }

      return {
        timestamp: tx.timestamp,
        algoAmount: algoAmount,
        hstrkAmount: hstrkAmount,
        ratio: tx.ratio,
        cumulativeStrk: cumulativeStrk / 1e18, // Convert to STRK
        cumulativeHstrk: cumulativeHstrk / 1e18 // Convert to hSTRK
      };
    }).reverse(); // Reverse to get chronological order for chart

    return {
      transactions: allTransactions,
      chartData: chartData,
      currentRatio: chartData.length > 0 ? chartData[chartData.length - 1].ratio : 1.0
    };
  };

  const handleMint = async () => {
    console.log('🔍 handleMint called - isConnected:', isConnected);
    console.log('🔍 handleMint called - depositAmount:', depositAmount);
    console.log('🔍 handleMint called - wallet:', wallet);
    console.log('🔍 handleMint called - canMint:', canMint);
    console.log('🔍 handleMint called - position:', position);
    console.log('🔍 handleMint called - loading:', loading);
    console.log('🔍 handleMint called - mintState:', mintState);

    if (!isConnected || !depositAmount) {
      console.log('❌ handleMint early return - not connected or no deposit amount');
      return;
    }

    try {
      const collateralAmount = parseFloat(depositAmount);
      console.log('🔍 handleMint - calculated collateralAmount:', collateralAmount);

      if (collateralAmount < 0.001) {
        setNotification({
          type: 'error',
          message: `Minimum deposit is 0.001 STRK`
        });
        return;
      }

      setNotification({
        type: 'info',
        message: 'Processing mint transaction...'
      });

      const result = await mintHSTRK(collateralAmount);

      setNotification({
        type: 'success',
        message: `Successfully minted hSTRK! TX: ${result.transactionHash?.slice(0, 10)}...`
        });
      setDepositAmount('');
      setReceiveAmount('');
    } catch (error: unknown) {
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Mint transaction failed'
      });
    }
  };

  const handleRedeem = async () => {
    console.log('🔍 handleRedeem called - isConnected:', isConnected);
    console.log('🔍 handleRedeem called - depositAmount:', depositAmount);

    if (!isConnected || !depositAmount) return;

    try {
      const hstrkAmount = parseFloat(depositAmount);
      console.log('🔍 handleRedeem - parsed hstrkAmount:', hstrkAmount);
      console.log('🔍 handleRedeem - balances:', balances);

      const currentHstrkBalance = balances?.hstrk ? Number(balances.hstrk) / 1e18 : 0;
      console.log('🔍 handleRedeem - currentHstrkBalance:', currentHstrkBalance);

      if (hstrkAmount > currentHstrkBalance) {
        setNotification({
          type: 'error',
          message: 'Insufficient hSTRK balance'
        });
        return;
      }

      setNotification({
        type: 'info',
        message: 'Processing redeem transaction...'
      });

      console.log('🔍 handleRedeem - calling redeemHSTRK with:', hstrkAmount);
      const result = await redeemHSTRK(hstrkAmount);
      console.log('🔍 handleRedeem - result:', result);

      setNotification({
        type: 'success',
        message: `Successfully redeemed STRK! TX: ${result.transactionHash?.slice(0, 10)}...`
      });
      setDepositAmount('');
      setReceiveAmount('');
    } catch (error: unknown) {
      console.error('❌ handleRedeem error:', error);
      setNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Redeem transaction failed'
      });
    }
  };

  const clearNotification = () => {
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    if (notification) {
      clearNotification();
    }
  }, [notification]);

  return (
    <div
      className="min-h-screen text-black relative"
      style={{
        backgroundImage: `url(${mintBackground})`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Navigation */}
      <nav className="absolute top-0 w-full z-50 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="bg-white border border-black rounded-2xl p-3 shadow-lg w-24 h-24 flex items-center justify-center">
            <img
              src={definiteLogo}
              alt="Definite Protocol"
              className="h-18 w-18"
            />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 bg-white hover:bg-gray-50 text-black px-4 py-2 rounded-2xl transition-colors border border-black"
            >
              <Home size={16} />
              <span>Back to Home</span>
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-black hover:text-opacity-80 transition-colors border border-black px-3 py-2 rounded-md"
            >
              Dashboard
            </button>
            <button
              className="text-black bg-white border border-black px-3 py-2 rounded-md"
            >
              Mint
            </button>
            <button
              onClick={() => navigate('/analytics')}
              className="text-black hover:text-opacity-80 transition-colors border border-black px-3 py-2 rounded-md"
            >
              Analytics
            </button>

            {/* New Feature Buttons */}
            <button
              onClick={() => setChipiPayModalOpen(true)}
              className="flex items-center space-x-2 bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-2 rounded-lg transition-colors border border-purple-600"
              title="Buy/Sell USDC with Chipi Pay"
            >
              <CreditCard size={16} />
              <span>Buy/Sell</span>
            </button>

            <button
              onClick={() => isConnected ? disconnectWallet() : setWalletModalOpen(true)}
              className="bg-white text-black px-6 py-3 font-normal border-2 border-black rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl relative overflow-hidden flex items-center"
              style={!isConnected ? {
                backgroundImage: `url(${background2Image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              } : {}}
            >
              {isConnected ? (
                <>
                  <LogOut size={16} className="mr-2" />
                  <span className="relative z-10">Disconnect</span>
                </>
              ) : (
                <span className="relative z-10">Connect Wallet</span>
              )}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-black"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 bg-white backdrop-blur-sm p-4 border border-black rounded-lg shadow-lg">
            <div className="space-y-4">
              <button
                onClick={() => {navigate('/dashboard'); setIsMenuOpen(false);}}
                className="block w-full text-left text-black hover:text-opacity-80 transition-colors py-2 border border-black px-3 rounded"
              >
                Dashboard
              </button>
              <button
                className="block w-full text-left text-black bg-white border border-black py-2 px-3 rounded"
              >
                Mint
              </button>
              <button
                onClick={() => {navigate('/analytics'); setIsMenuOpen(false);}}
                className="block w-full text-left text-black hover:text-opacity-80 transition-colors py-2 border border-black px-3 rounded"
              >
                Analytics
              </button>
              <button
                onClick={() => isConnected ? disconnectWallet() : setWalletModalOpen(true)}
                className="w-full bg-white text-black px-6 py-3 font-semibold border-2 border-black btn-fill relative overflow-hidden shadow-lg flex items-center justify-center space-x-2"
                style={!isConnected ? {
                  backgroundImage: `url(${background2Image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                } : {}}
              >
                {isConnected ? (
                  <>
                    <LogOut size={16} className="relative z-10" />
                    <span className="relative z-10">Disconnect</span>
                  </>
                ) : (
                  <span className="relative z-10">Connect Wallet</span>
                )}
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Notification */}
      {notification && (
        <div className="fixed top-20 right-4 z-50 max-w-sm">
          <div className={`p-4 rounded-lg shadow-lg flex items-center space-x-3 ${
            notification.type === 'success' ? 'bg-green-900 border border-green-700' :
            notification.type === 'error' ? 'bg-red-900 border border-red-700' :
            'bg-blue-900 border border-blue-700'
          }`}>
            {notification.type === 'success' && <CheckCircle className="text-green-400" size={20} />}
            {notification.type === 'error' && <AlertCircle className="text-red-400" size={20} />}
            {notification.type === 'info' && <Loader className="text-blue-400 animate-spin" size={20} />}
            <span className="text-sm">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Global Error Display */}
      {error && (
        <div className="fixed top-32 right-4 z-50 max-w-sm">
          <div className="p-4 rounded-lg shadow-lg flex items-center space-x-3 bg-white border border-red-500">
            <AlertCircle className="text-red-500" size={20} />
            <span className="text-sm text-black">{error}</span>
          </div>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto p-6 pt-48">
        {activeTab === 'DETAILS' && (
          // Details Tab Content
          <div className="space-y-6">
            {/* Wallet Status */}
            {isConnected ? (
              <div className="bg-white border border-green-500 rounded-lg p-4 shadow-lg">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="text-green-500" size={20} />
                  <div>
                    <div className="text-black font-medium">Wallet Connected</div>
                    <div className="text-black text-opacity-60 text-sm">
                      {wallet?.address.substring(0, 8)}...{wallet?.address.substring(-8)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-yellow-500 rounded-lg p-4 shadow-lg">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="text-yellow-600" size={20} />
                  <div>
                    <div className="text-black font-medium">Wallet Not Connected</div>
                    <div className="text-black text-opacity-80 text-sm font-medium">Connect your Strkrand wallet to continue</div>
                  </div>
                </div>
              </div>
            )}

            {/* Balance Information */}
            {isConnected && (
              <div className="bg-white border border-black rounded-lg p-4 shadow-lg">
                <h3 className="text-black text-lg font-medium mb-4">Account Balances</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-black text-opacity-60">STRK Balance</span>
                    <span className="text-black font-mono">
                      {loading ? (
                        <Loader className="animate-spin" size={16} />
                      ) : (
                        `${formatBalance(balances?.strk)} STRK`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-black text-opacity-60">hSTRK Balance</span>
                    <span className="text-black font-mono">
                      {loading ? (
                        <Loader className="animate-spin" size={16} />
                      ) : (
                        `${formatBalance(balances?.hstrk)} hSTRK`
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Position Overview */}
            {position && position.hstrkAmount > 0n && (
              <div className="bg-white border border-black rounded-lg p-4 shadow-lg">
                <h3 className="text-black text-lg font-medium mb-4">Your Position</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-black text-opacity-60">STRK Deposited</span>
                    <span className="text-black font-mono">{formatBalance(position.collateralAmount)} STRK</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-black text-opacity-60">hSTRK Minted</span>
                    <span className="text-black font-mono">{formatBalance(position.hstrkAmount)} hSTRK</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-black text-opacity-60">Collateral Ratio</span>
                    <span className={`font-mono ${position.collateralizationRatio > config.liquidationThreshold ? 'text-green-600' : 'text-red-600'}`}>
                      {(position.collateralizationRatio).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-black text-opacity-60">Health Factor</span>
                    <span className={`font-mono ${position.healthFactor > 1 ? 'text-green-600' : 'text-red-600'}`}>
                      {position.healthFactor.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Chain Switcher */}
            <ChainSwitcher className="mb-6" />

            {/* Protocol Stats */}
            <div className="bg-white border border-black rounded-lg p-4 shadow-lg">
              <h3 className="text-black text-lg font-medium mb-4">Protocol Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-black text-opacity-60">Minimum Deposit</span>
                  <span className="text-black font-mono">{(config.minimumDeposit / 1e18).toFixed(1)} STRK</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black text-opacity-60">Collateral Ratio</span>
                  <span className="text-black font-mono">{(config.collateralRatio * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black text-opacity-60">Liquidation Threshold</span>
                  <span className="text-black font-mono">{(config.liquidationThreshold * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black text-opacity-60">Entry Fee</span>
                  <span className="text-black font-mono">{(config.entryFee * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black text-opacity-60">Exit Fee</span>
                  <span className="text-black font-mono">{(config.exitFee * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Risk Information */}
            <div className="bg-white border border-black rounded-lg p-4 shadow-lg">
              <h3 className="text-black text-lg font-medium mb-4">Risk Information</h3>
              <div className="space-y-3 text-sm">
                <div className="text-black text-opacity-80">
                  <strong className="text-black">Delta-Neutral Strategy:</strong> hSTRK maintains exposure to STRK while hedging against price volatility through synthetic short positions.
                </div>
                <div className="text-black text-opacity-80">
                  <strong className="text-black">Liquidation Risk:</strong> If your collateral ratio falls below {(config.liquidationThreshold * 100).toFixed(0)}%, your position may be liquidated.
                </div>
                <div className="text-black text-opacity-80">
                  <strong className="text-black">Smart Contract Risk:</strong> This protocol is experimental. Only deposit funds you can afford to lose.
                </div>
              </div>
            </div>

            {/* Demo Mode Notice */}
            <div className="bg-white border border-blue-500 rounded-lg p-4 shadow-lg">
              <div className="flex items-center space-x-3">
                <Info className="text-blue-600" size={20} />
                <div>
                  <div className="text-black font-medium">Demo Mode Active</div>
                  <div className="text-black text-opacity-80 text-sm">
                    Transactions are simulated using localStorage. Real blockchain integration available.
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-black text-opacity-60">
                To initialize the protocol: Open browser console and run <code className="bg-gray-200 text-black px-1 rounded">ProtocolInitializer.initialize()</code>
              </div>
            </div>

            {/* Mint Performance Chart */}
            {(() => {
              const historyData = processTransactionHistory();
              return (
                <MintChart
                  mintHistory={historyData.chartData}
                  currentRatio={historyData.currentRatio}
                />
              );
            })()}

            {/* Transaction History */}
            {(() => {
              const historyData = processTransactionHistory();
              return (
                <MintHistory
                  transactions={historyData.transactions}
                  isLoading={loading}
                />
              );
            })()}
          </div>
        )}

        {activeTab !== 'DETAILS' && (
          // Mint/Redeem Tab Content
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 max-w-none w-full">
            {/* Left Column - Trading Interface */}
            <div className="space-y-6">
        {/* Header Tabs */}
        <div className="bg-white border border-black rounded-2xl p-2 mb-8 shadow-lg">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={`flex-1 py-3 px-6 text-sm font-medium transition-all duration-200 rounded-xl relative ${
                  activeTab === tab
                    ? 'bg-black text-white shadow-md'
                    : 'text-black hover:bg-gray-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Deposit Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <div className="text-black text-opacity-60 text-sm">
              {activeTab === 'MINT' ? 'DEPOSIT' : 'REDEEM'}
            </div>
            <div className="text-black text-opacity-60 text-sm font-mono">
              Balance: {
                activeTab === 'MINT'
                  ? formatBalance(balances?.strk)
                  : formatBalance(balances?.hstrk)
              } {activeTab === 'MINT' ? 'STRK' : 'hSTRK'}
            </div>
          </div>

          <div className="relative border border-black rounded-lg p-4 bg-white shadow-lg">
            <div className="flex items-center justify-between">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => handleDepositChange(e.target.value)}
                placeholder="0.0"
                className="bg-transparent text-2xl text-black outline-none flex-1 placeholder-gray-500"
                disabled={loading || mintState.isProcessing || redeemState.isProcessing}
              />
              <div className="text-black text-opacity-60 text-sm">
                {activeTab === 'MINT' ? 'STRK' : 'hSTRK'}
              </div>
            </div>
            {activeTab === 'MINT' && (
              <div className="text-xs text-gray-500 mt-2">
                Minimum: {(minimumDeposit / 1_000_000).toFixed(2)} STRK
              </div>
            )}
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center mb-6">
          <button className="bg-white hover:bg-gray-50 p-3 rounded-lg transition-colors border border-black shadow-lg">
            <ArrowUpDown className="text-black" size={20} />
          </button>
        </div>

        {/* Receive Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <div className="text-black text-opacity-60 text-sm">RECEIVE</div>
            <div className="text-black text-opacity-60 text-sm font-mono">
              Balance: {
                activeTab === 'MINT'
                  ? formatBalance(balances?.hstrk)
                  : formatBalance(balances?.strk)
              } {activeTab === 'MINT' ? 'hSTRK' : 'STRK'}
            </div>
          </div>

          <div className="relative border border-black rounded-lg p-4 bg-white shadow-lg">
            <div className="flex items-center justify-between">
              <input
                type="number"
                value={receiveAmount}
                readOnly
                placeholder="0.0"
                className="bg-transparent text-2xl text-black outline-none flex-1 placeholder-gray-500"
              />
              <div className="text-black text-opacity-60 text-sm">
                {activeTab === 'MINT' ? 'hSTRK' : 'STRK'}
              </div>
            </div>
            {activeTab === 'REDEEM' && redeemQuote && (
              <div className="text-xs text-gray-500 mt-2">
                Exit fee: {(Number(redeemQuote.fee) / 1e18).toFixed(1)} STRK
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={(e) => {
            console.log('🔍 Button clicked!');
            console.log('🔍 Debug info:', {
              isConnected,
              depositAmount,
              loading,
              canMint,
              canRedeem,
              mintState,
              redeemState,
              position,
              activeTab,
              'Check 1 - isConnected': isConnected,
              'Check 2 - depositAmount': depositAmount,
              'Check 3 - loading': loading,
              'Check 4 - mintState.isProcessing': mintState.isProcessing,
              'Check 5 - redeemState.isProcessing': redeemState.isProcessing,
              'Check 6 - canMint (MINT tab)': canMint,
              'Check 7 - canRedeem (REDEEM tab)': canRedeem,
              'Final disabled state': !isConnected ||
                !depositAmount ||
                loading ||
                mintState.isProcessing ||
                redeemState.isProcessing ||
                (activeTab === 'MINT' && !canMint) ||
                (activeTab === 'REDEEM' && !canRedeem)
            });

            if (activeTab === 'MINT') {
              handleMint();
            } else {
              handleRedeem();
            }
          }}
          disabled={false}
          className={`w-full py-4 px-6 rounded-lg font-normal text-black mb-6 flex items-center justify-center transition-all border shadow-lg ${
            isConnected && depositAmount && !loading && !mintState.isProcessing && !redeemState.isProcessing
              ? 'bg-white hover:bg-gray-50 border-black'
              : 'bg-gray-200 cursor-not-allowed border-gray-400'
          }`}
        >
          {(mintState.isProcessing || redeemState.isProcessing) && (
            <Loader className="animate-spin mr-2" size={16} />
          )}
          {activeTab === 'MINT' ? 'MINT hSTRK' : 'REDEEM STRK'}
          <span className="ml-2">&gt;&gt;</span>
        </button>

        {/* Wallet Connection Warning */}
        {!isConnected && (
          <div className="bg-white border border-yellow-500 rounded-lg p-4 mb-6 shadow-lg">
            <div className="flex items-center space-x-2">
              <AlertCircle className="text-yellow-600" size={16} />
              <span className="text-black font-medium text-sm">Connect your wallet to continue</span>
            </div>
          </div>
        )}



        {/* Details */}
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center py-2">
            <div className="text-gray-400 text-sm">// EXCHANGE RATE</div>
            <div className="text-gray-300 text-sm">
              {activeTab === 'MINT' && mintQuote
                ? `1 STRK = ${(Number(mintQuote.hstrkAmount) / Number(mintQuote.collateralAmount)).toFixed(4)} hSTRK`
                : activeTab === 'REDEEM' && redeemQuote
                ? `1 hSTRK = ${(Number(redeemQuote.collateralReturned) / Number(redeemQuote.hstrkAmount)).toFixed(4)} STRK`
                : '1:1'
              }
            </div>
          </div>

          <div className="flex justify-between items-center py-2">
            <div className="text-black text-opacity-60 text-sm">SLIPPAGE</div>
            <div className="flex items-center">
              <span className="text-black text-sm mr-2">{slippage}%</span>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-black hover:text-black text-opacity-80"
              >
                <Settings size={16} />
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="bg-white border border-black rounded-lg p-4 shadow-lg">
              <div className="text-sm text-black text-opacity-60 mb-2">Slippage Tolerance</div>
              <div className="flex space-x-2">
                {['0.5', '1', '2', '5'].map((value) => (
                  <button
                    key={value}
                    onClick={() => setSlippage(value)}
                    className={`px-3 py-1 rounded text-sm ${
                      slippage === value
                        ? 'bg-black text-white'
                        : 'bg-gray-200 text-black hover:bg-gray-300'
                    }`}
                  >
                    {value}%
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                className="w-full mt-2 bg-white border border-black rounded px-3 py-2 text-sm text-black"
                placeholder="Custom %"
              />
            </div>
          )}

          {(mintQuote || redeemQuote) && (
            <div className="flex justify-between items-center py-2">
              <div className="text-gray-400 text-sm">// FEE</div>
              <div className="text-gray-300 text-sm">
                {activeTab === 'MINT' && mintQuote
                  ? `${(Number(mintQuote.fee) / 1e18).toFixed(1)} STRK`
                  : activeTab === 'REDEEM' && redeemQuote
                  ? `${(Number(redeemQuote.fee) / 1e18).toFixed(1)} STRK`
                  : '--'
                }
              </div>
            </div>
          )}

          <div className="border-t border-gray-800 pt-4">
            <div className="flex justify-between items-center py-2">
              <div className="text-gray-400 text-sm">// COLLATERAL RATIO</div>
              <div className="text-gray-300 text-sm">{(config.collateralRatio * 100).toFixed(0)}%</div>
            </div>

            <div className="flex justify-between items-center py-2">
              <div className="text-gray-400 text-sm">// LIQUIDATION THRESHOLD</div>
              <div className="text-gray-300 text-sm">{(config.liquidationThreshold * 100).toFixed(0)}%</div>
            </div>

            {activeTab === 'REDEEM' && (
              <div className="flex justify-between items-center py-2">
                <div className="text-gray-400 text-sm">// EXIT FEE</div>
                <div className="text-gray-300 text-sm">{(config.exitFeeRate * 100).toFixed(1)}%</div>
              </div>
            )}
          </div>
        </div>

        {/* History Section */}
        <div className="border-t border-gray-800 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white text-lg font-medium">History</h3>
            <div className="text-gray-400 text-sm">
              // {activeTab === 'MINT' ? 'MINTS' : 'REDEEMS'}
            </div>
          </div>

          {(() => {
            // TODO: Implement transaction history from Starknet events
            const history = { mints: [], redeems: [] };
            const relevantHistory = activeTab === 'MINT' ? history.mints : history.redeems;

            if (relevantHistory.length === 0) {
              return (
                <div className="text-center py-8">
                  <RotateCcw className="text-gray-600 mx-auto mb-3" size={24} />
                  <div className="text-gray-500 text-sm">
                    No {activeTab.toLowerCase()} history yet
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {relevantHistory.slice(0, 5).map((tx: Record<string, unknown>, index: number) => (
                  <div key={index} className="bg-white border border-black rounded-lg p-3 shadow-lg">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <div>
                          <div className="text-sm text-black">
                            {activeTab === 'MINT'
                              ? `Minted ${formatAmount(Number(tx.hstrkAmount) || 0)} hSTRK`
                              : `Redeemed ${formatAmount(Number(tx.collateralAmount) || 0)} STRK`
                            }
                          </div>
                          <div className="text-xs text-black text-opacity-60">
                            {new Date(String(tx.timestamp)).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-black text-opacity-80">
                          {activeTab === 'MINT'
                            ? `${formatAmount(Number(tx.collateralAmount) || 0)} STRK`
                            : `${formatAmount(Number(tx.hstrkAmount) || 0)} hSTRK`
                          }
                        </div>
                        <div className="text-xs text-gray-500">
                          {String(tx.txId).substring(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {relevantHistory.length > 5 && (
                  <div className="text-center">
                    <button className="text-black text-sm hover:underline border border-black px-3 py-1 rounded bg-white hover:bg-gray-50">
                      View all {relevantHistory.length} transactions
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
            </div>

            {/* Right Column - Chart */}
            <div className="space-y-6">
              <div className="bg-white border border-black rounded-3xl p-6 shadow-lg">
                <h3 className="text-xl font-medium text-black mb-4">Mint History Chart</h3>
                {(() => {
                  const historyData = processTransactionHistory();
                  return (
                    <MintChart
                      mintHistory={historyData.chartData}
                      currentRatio={historyData.currentRatio}
                    />
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wallet Connect Modal */}
      <WalletConnectModalNew
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />

      {/* Chipi Pay Modal */}
      <ChipiPayModal
        isOpen={chipiPayModalOpen}
        onClose={() => setChipiPayModalOpen(false)}
      />
    </div>
  );
};

export default MintPage;