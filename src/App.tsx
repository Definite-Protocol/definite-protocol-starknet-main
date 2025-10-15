import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { TrendingUp, PieChart, Activity, ArrowUpRight, ArrowDownLeft, Menu, X, LogOut, AlertCircle, Home } from 'lucide-react';
import YieldPerformanceChart from './components/YieldPerformanceChart';
import TVLChart from './components/TVLChart';
import WalletConnectModalNew from './components/WalletConnectModalNew';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import NetworkWarning from './components/NetworkWarning';
import { useWallet } from './hooks/useWallet';
import { pragmaOracleService } from './services/pragmaOracleService';
import { riskManagementService } from './services/riskManagementService';
import { starknetHstrkService } from './services/starknetHstrkService';
import { ChartDataPoint } from './types';

import MintPage from './pages/MintPage';
import TestPage from './pages/TestPage';

// Import images
import definiteLogo from './assets/seffaf-logo-definite.png';
import backgroundImage from './assets/G1jmfEXWAAAmYh6.jpeg';
import background2Image from './assets/background-2.png';

// Types
interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface StepProps {
  number: number;
  title: string;
  description: string;
  isLast?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface LandingPageProps {}

// Animated Counter Component
const AnimatedCounter: React.FC<{ target: number; suffix?: string; prefix?: string }> = ({ target, suffix = '', prefix = '' }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const increment = target / 100;
      const interval = setInterval(() => {
        setCount(prev => {
          const next = prev + increment;
          if (next >= target) {
            clearInterval(interval);
            return target;
          }
          return next;
        });
      }, 20);
      return () => clearInterval(interval);
    }, 100);
    return () => clearTimeout(timer);
  }, [target]);

  return <span>{prefix}{Math.round(count)}{suffix}</span>;
};

// Metric Card Component
const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, isPositive }) => (
  <div className="bg-white backdrop-blur-sm p-6 border border-black hover:bg-gray-50 transition-all duration-300 hover:scale-105 rounded-2xl shadow-lg hover:shadow-xl">
    <h3 className="text-black text-opacity-80 text-sm mb-2">{title}</h3>
    <div className="text-2xl font-normal text-black mb-1">{value}</div>
    <div className={`text-sm flex items-center ${isPositive ? 'text-green-300' : 'text-red-300'}`}>
      {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
      <span className="ml-1">{change}</span>
    </div>
  </div>
);

// Feature Card Component
const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => (
  <div className="bg-white backdrop-blur-sm p-8 border border-black hover:bg-gray-50 transition-all duration-300 group hover:scale-105 rounded-2xl shadow-lg hover:shadow-xl">
    <div className="text-black mb-4 group-hover:scale-110 transition-transform duration-300">
      {icon}
    </div>
    <h3 className="text-xl font-normal text-black mb-3">{title}</h3>
    <p className="text-black text-opacity-80 leading-relaxed">{description}</p>
  </div>
);

// Step Component
const Step: React.FC<StepProps> = ({ number, title, description, isLast = false }) => (
  <div className="flex items-start">
    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-white to-gray-100 rounded-full flex items-center justify-center mr-4 relative shadow-lg">
      <span className="text-black font-normal">{number}</span>
      {!isLast && (
        <div className="absolute top-12 left-1/2 transform -translate-x-1/2 w-0.5 h-16 bg-white bg-opacity-30"></div>
      )}
    </div>
    <div className="pt-2">
      <h3 className="text-xl font-normal text-black mb-2">{title}</h3>
      <p className="text-black text-opacity-80">{description}</p>
    </div>
  </div>
);

// Types for Analytics
interface AnalyticsStats {
  totalValueLocked: number;
  totalUsers: number;
  totalTransactions: number;
  averageApy?: number;
}

// Enterprise Analytics Component
const EnterpriseAnalytics: React.FC = () => {
  // Mock data for now - will be replaced with real Starknet data
  const stats: AnalyticsStats = {
    totalValueLocked: 0,
    totalUsers: 0,
    totalTransactions: 0,
    averageApy: 0
  };
  const tvlHistory: ChartDataPoint[] = [];
  const collateralHistory: ChartDataPoint[] = [];

  return (
    <div className="min-h-screen p-6 pt-0 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-normal text-black">Analytics</h1>
            <p className="text-black text-opacity-80">Protocol performance and metrics</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricCard
            title="Total TVL"
            value={`$${stats.totalValueLocked.toLocaleString()}`}
            change="+15.2%"
            isPositive={true}
          />
          <MetricCard
            title="Average APY"
            value={`${stats.averageApy || 0}%`}
            change="+2.1%"
            isPositive={true}
          />
          <MetricCard
            title="Total Users"
            value={`${stats.totalUsers}`}
            change="+8.5%"
            isPositive={true}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white backdrop-blur-sm p-6 border border-black rounded-2xl shadow-lg">
            <h3 className="text-xl font-normal text-black mb-4">TVL History</h3>
            {tvlHistory.length > 0 ? (
              <TVLChart data={tvlHistory} />
            ) : (
              <div className="text-black text-opacity-60">Loading TVL data...</div>
            )}
          </div>
          <div className="bg-white backdrop-blur-sm p-6 border border-black rounded-2xl shadow-lg">
            <h3 className="text-xl font-normal text-black mb-4">Collateral Analysis</h3>
            {collateralHistory.length > 0 ? (
              <div className="text-black text-opacity-80">
                Collateral data visualization would go here
              </div>
            ) : (
              <div className="text-white text-opacity-60">Loading collateral data...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Types for Landing Page
interface PortfolioData {
  totalValue: number;
  totalDeposited: number;
  totalYield: number;
}

interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  timestamp: number;
}

interface LandingStats {
  totalValueLocked: number;
  totalUsers: number;
  averageApy?: number;
}

// Landing Page Component
const LandingPage: React.FC<LandingPageProps> = () => {
  const navigate = useNavigate();
  const { address, isConnected, disconnect: disconnectFn } = useWallet();
  const user = address ? { address } : null;

  // Wrap disconnect to handle onClick properly
  const disconnect = React.useCallback(() => {
    disconnectFn();
  }, [disconnectFn]);

  // State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [processingTransaction, setProcessingTransaction] = useState(false);

  // Mock data - memoized to prevent re-renders
  const portfolio = React.useMemo<PortfolioData>(() => ({
    totalValue: 0,
    totalDeposited: 0,
    totalYield: 0
  }), []);

  const yieldPerformanceData = React.useMemo<ChartDataPoint[]>(() => [], []);
  const transactions = React.useMemo<Transaction[]>(() => [], []);
  const portfolioLoading = false;

  const stats = React.useMemo<LandingStats>(() => ({
    totalValueLocked: 0,
    totalUsers: 0,
    averageApy: 0
  }), []);

  const tvlHistory = React.useMemo<ChartDataPoint[]>(() => [], []);

  // Enterprise-grade deposit/withdraw handlers
  const deposit = React.useCallback(async () => {
    // Will be implemented with real Starknet integration
  }, []);

  const withdraw = React.useCallback(async () => {
    // Will be implemented with real Starknet integration
  }, []);

  // Enterprise-grade portfolio metrics calculation
  const portfolioMetrics = React.useMemo(() => {
    if (!portfolio || portfolioLoading) return null;

    return {
      totalValue: portfolio.totalValue,
      totalYield: portfolio.totalYield,
      riskScore: 0,
      transactionCount: transactions.length
    };
  }, [portfolio, portfolioLoading, transactions]);

  // Enterprise-grade transaction handler
  const handleQuickDeposit = React.useCallback(async () => {
    if (!depositAmount || processingTransaction) return;

    try {
      setProcessingTransaction(true);
      await deposit();
      setDepositAmount('');
    } catch (error) {
      console.error('Deposit failed:', error);
    } finally {
      setProcessingTransaction(false);
    }
  }, [depositAmount, processingTransaction, deposit]);

  // Enterprise-grade withdrawal handler
  const handleQuickWithdraw = React.useCallback(async () => {
    if (!withdrawAmount || processingTransaction) return;

    try {
      setProcessingTransaction(true);
      await withdraw();
      setWithdrawAmount('');
    } catch (error) {
      console.error('Withdrawal failed:', error);
    } finally {
      setProcessingTransaction(false);
    }
  }, [withdrawAmount, processingTransaction, withdraw]);



  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="absolute top-0 w-full z-50 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="bg-white border border-black rounded-2xl p-3 shadow-lg w-24 h-24 flex items-center justify-center">
            <img src={definiteLogo} alt="Definite Protocol" className="h-18 w-18" />
          </div>

          <div className="hidden md:flex items-center space-x-6">
            <nav className="flex items-center space-x-6">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-black hover:text-gray-600 transition-colors font-normal px-3 py-2 rounded-lg hover:bg-gray-50 border border-black"
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate('/mint')}
                className="text-black hover:text-gray-600 transition-colors font-normal px-3 py-2 rounded-lg hover:bg-gray-50 border border-black"
              >
                Mint
              </button>
              <button
                onClick={() => navigate('/analytics')}
                className="text-black hover:text-gray-600 transition-colors font-normal px-3 py-2 rounded-lg hover:bg-gray-50 border border-black"
              >
                Analytics
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="text-black hover:text-gray-600 transition-colors font-normal px-3 py-2 rounded-lg hover:bg-gray-50 border border-black"
              >
                Settings
              </button>
            </nav>

            <div className="h-6 w-px bg-gray-300"></div>

            {isConnected ? (
              <div className="flex items-center space-x-3">
                <div className="text-black text-sm bg-gray-100 px-3 py-1 rounded-full">
                  {user?.address?.slice(0, 8)}...
                </div>
                <button
                  onClick={disconnect}
                  className="bg-white hover:bg-gray-50 text-black px-6 py-3 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border border-black flex items-center space-x-2"
                >
                  <LogOut size={16} />
                  <span>Disconnect</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setWalletModalOpen(true)}
                className="bg-white hover:bg-gray-50 text-black px-6 py-2 font-normal rounded-xl transition-all duration-300 border-2 border-black hover:border-gray-600 relative overflow-hidden shadow-lg"
                style={{
                  backgroundImage: `url(${background2Image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              >
                <span className="relative z-10">Connect Wallet</span>
              </button>
            )}
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-black"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white bg-opacity-95 backdrop-blur-sm p-6 border-t border-black shadow-lg">
            <div className="space-y-3">
              <button
                onClick={() => {
                  navigate('/dashboard');
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left text-black hover:text-gray-600 transition-colors py-2 px-3 rounded-lg hover:bg-gray-50 border border-black"
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  navigate('/mint');
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left text-black hover:text-gray-600 transition-colors py-2 px-3 rounded-lg hover:bg-gray-50 border border-black"
              >
                Mint
              </button>
              <button
                onClick={() => {
                  navigate('/analytics');
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left text-black hover:text-gray-600 transition-colors py-2 px-3 rounded-lg hover:bg-gray-50 border border-black"
              >
                Analytics
              </button>
              <button
                onClick={() => {
                  navigate('/settings');
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left text-black hover:text-gray-600 transition-colors py-2 px-3 rounded-lg hover:bg-gray-50 border border-black"
              >
                Settings
              </button>

              <div className="h-px bg-gray-300 my-3"></div>

              {isConnected ? (
                <button
                  onClick={disconnect}
                  className="flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-black px-4 py-2 rounded-xl transition-all duration-300 w-full border border-gray-300 hover:border-gray-400"
                >
                  <LogOut size={16} />
                  <span>Disconnect</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setWalletModalOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="block bg-white hover:bg-gray-50 text-black px-4 py-2 font-normal rounded-xl transition-all duration-300 w-full border-2 border-black hover:border-gray-600 relative overflow-hidden shadow-lg"
                  style={{
                    backgroundImage: `url(${background2Image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                >
                  <span className="relative z-10">Connect Wallet</span>
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center px-6 overflow-hidden pt-32 md:pt-36">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${backgroundImage})`
          }}
        ></div>

        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="flex justify-start items-center">
            {/* Content */}
            <div className="space-y-8 text-left max-w-4xl w-full">
              {/* Main Title Card */}
              <div className="bg-white border border-black rounded-3xl p-8 shadow-lg">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl text-black leading-tight tracking-tight">
                  Delta-Neutral
                  <br />
                  <span className="text-black">Hedge System</span>
                </h1>
              </div>

              {/* Description Card */}
              <div className="bg-white border border-black rounded-3xl p-6 shadow-lg max-w-xl">
                <p className="text-lg sm:text-xl text-black text-opacity-90 leading-relaxed font-light mb-4">
                  Experience advanced yield generation that automates DeFi strategy, enhances capital efficiency and delivers stable returns - all seamlessly integrated with capital protection.
                </p>
                <div className="text-sm text-black text-opacity-70 font-mono tracking-wider">
                  EARN STABLE YIELDS OF 8-50% APY ON STRKRAND
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4">
                <button
                  onClick={() => isConnected ? navigate('/dashboard') : setWalletModalOpen(true)}
                  className="group bg-white hover:bg-gray-50 text-black px-16 py-4 font-normal text-lg rounded-3xl transition-all duration-500 flex items-center justify-center hover:scale-110 active:scale-95 min-w-[320px] shadow-2xl transform hover:-translate-y-1 border border-black"
                >
                  Launch App
                </button>
              </div>

              {/* Enterprise Portfolio Metrics Card */}
              {isConnected && portfolioMetrics && (
                <div className="bg-white border border-black rounded-3xl p-6 shadow-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <MetricCard
                      title="Portfolio Value"
                      value={`$${portfolioMetrics.totalValue.toLocaleString()}`}
                      change="+12.5%"
                      isPositive={true}
                    />
                    <MetricCard
                      title="Total Yield"
                      value={`$${portfolioMetrics.totalYield.toLocaleString()}`}
                      change="+8.2%"
                      isPositive={true}
                    />
                  </div>
                </div>
              )}

              {/* Live APY Display Card */}
              <div className="bg-white border border-black rounded-3xl p-6 max-w-xs shadow-lg">
                <div className="text-black text-opacity-60 text-sm mb-1 font-mono tracking-wide">CURRENT APY</div>
                <div className="text-3xl font-normal text-black mb-2">
                  <AnimatedCounter target={stats.averageApy || 24.7} suffix="%" />
                </div>
                <div className="text-black text-xs flex items-center font-mono">
                  <TrendingUp size={14} />
                  <span className="ml-1">+2.3% FROM LAST WEEK</span>
                </div>
              </div>

              {/* Enterprise Quick Actions Card */}
              {isConnected && (
                <div className="bg-white border border-black rounded-3xl p-6 shadow-lg">
                  <div className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Amount to deposit"
                      className="w-full px-4 py-3 bg-white border border-black text-black placeholder-gray-500 focus:outline-none focus:border-opacity-60 rounded-xl transition-all duration-300 focus:scale-105"
                    />
                    <button
                      onClick={handleQuickDeposit}
                      disabled={processingTransaction || !depositAmount}
                      className="w-full mt-2 bg-white hover:bg-gray-50 disabled:bg-gray-200 text-black px-4 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg border border-black"
                    >
                      {processingTransaction ? 'Processing...' : 'Quick Deposit'}
                    </button>
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Amount to withdraw"
                      className="w-full px-4 py-3 bg-white border border-black text-black placeholder-gray-500 focus:outline-none focus:border-opacity-60 rounded-xl transition-all duration-300 focus:scale-105"
                    />
                    <button
                      onClick={handleQuickWithdraw}
                      disabled={processingTransaction || !withdrawAmount}
                      className="w-full mt-2 bg-white hover:bg-gray-50 disabled:bg-gray-200 text-black px-4 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg border border-black"
                    >
                      {processingTransaction ? 'Processing...' : 'Quick Withdraw'}
                    </button>
                  </div>
                  </div>
                </div>
              )}
            </div>



          </div>
        </div>
      </section>

      {/* Divider Line */}
      <div className="w-full h-px bg-black"></div>

      {/* Enterprise Features Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-normal text-black mb-6">Enterprise-Grade Features</h2>
            <p className="text-xl text-black text-opacity-80 max-w-3xl mx-auto">
              Advanced DeFi infrastructure built for institutional and professional traders
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Activity size={32} />}
              title="Real-Time Analytics"
              description="Monitor your portfolio performance with enterprise-grade analytics and risk metrics in real-time."
            />
            <FeatureCard
              icon={<PieChart size={32} />}
              title="Portfolio Optimization"
              description="Automated rebalancing and delta-neutral strategies to maximize yield while minimizing risk."
            />
            <FeatureCard
              icon={<TrendingUp size={32} />}
              title="Yield Farming"
              description="Access to multiple yield farming strategies with automated compounding and reinvestment."
            />
          </div>
        </div>
      </section>

      {/* Enterprise How It Works Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-normal text-black mb-6">How It Works</h2>
            <p className="text-xl text-black text-opacity-80 max-w-3xl mx-auto">
              Simple steps to start earning with enterprise-grade DeFi strategies
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Step
              number={1}
              title="Connect Wallet"
              description="Connect your Strkrand wallet using Pera, Defly, or Lute wallet for secure access."
            />
            <Step
              number={2}
              title="Deposit Assets"
              description="Deposit STRK or other supported assets to start earning yield through automated strategies."
            />
            <Step
              number={3}
              title="Earn Rewards"
              description="Watch your portfolio grow with automated yield farming and delta-neutral hedging strategies."
              isLast={true}
            />
          </div>
        </div>
      </section>

      {/* Enterprise Portfolio Dashboard Preview */}
      {isConnected && portfolio && (
        <section className="py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-normal text-white mb-6">Your Portfolio</h2>
              <p className="text-xl text-white text-opacity-80">
                Real-time portfolio performance and analytics
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <MetricCard
                title="Total Value"
                value={`$${portfolio.totalValue.toLocaleString()}`}
                change="+12.5%"
                isPositive={true}
              />
              <MetricCard
                title="Total Yield"
                value={`$${portfolio.totalYield.toLocaleString()}`}
                change="+8.2%"
                isPositive={true}
              />
              <MetricCard
                title="Risk Score"
                value="0/100"
                change="-2.1%"
                isPositive={false}
              />
              <MetricCard
                title="Transactions"
                value={`${transactions.length}`}
                change="+5"
                isPositive={true}
              />
            </div>

            {/* Enterprise Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white bg-opacity-10 backdrop-blur-sm p-6 border border-white border-opacity-20">
                <h3 className="text-xl font-normal text-white mb-4">Yield Performance</h3>
                {yieldPerformanceData.length > 0 && (
                  <YieldPerformanceChart data={yieldPerformanceData} />
                )}
              </div>
              <div className="bg-white bg-opacity-10 backdrop-blur-sm p-6 border border-white border-opacity-20">
                <h3 className="text-xl font-normal text-white mb-4">TVL History</h3>
                {tvlHistory && (
                  <TVLChart data={tvlHistory} />
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <WalletConnectModalNew
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </div>
  );
};

// Enterprise Dashboard Component
const EnterpriseDashboard: React.FC = () => {
  const { starknetWallet, disconnectStarknetWallet: disconnectFn } = useWallet();
  const user = starknetWallet ? { address: starknetWallet.address } : null;

  // Wrap disconnect to handle onClick properly
  const disconnect = React.useCallback(() => {
    disconnectFn();
  }, [disconnectFn]);

  // State
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [processingTransaction, setProcessingTransaction] = useState(false);

  // Mock data - memoized
  const portfolio = React.useMemo<PortfolioData>(() => ({
    totalValue: 0,
    totalDeposited: 0,
    totalYield: 0
  }), []);

  const yieldPerformanceData = React.useMemo<ChartDataPoint[]>(() => [], []);
  const transactions = React.useMemo<Transaction[]>(() => [], []);
  const portfolioLoading = false;
  const portfolioError = null;

  const tvlHistory = React.useMemo<ChartDataPoint[]>(() => [], []);
  const collateralHistory = React.useMemo<ChartDataPoint[]>(() => [], []);
  const protocolLoading = false;

  // Enterprise-grade deposit/withdraw handlers
  const deposit = React.useCallback(async () => {
    // Will be implemented with real Starknet integration
  }, []);

  const withdraw = React.useCallback(async () => {
    // Will be implemented with real Starknet integration
  }, []);

  // Enterprise-grade transaction handlers
  const handleDeposit = React.useCallback(async () => {
    if (!depositAmount || processingTransaction) return;
    try {
      setProcessingTransaction(true);
      await deposit();
      setDepositAmount('');
    } catch (error) {
      console.error('Deposit failed:', error);
    } finally {
      setProcessingTransaction(false);
    }
  }, [depositAmount, processingTransaction, deposit]);

  const handleWithdraw = React.useCallback(async () => {
    if (!withdrawAmount || processingTransaction) return;
    try {
      setProcessingTransaction(true);
      await withdraw();
      setWithdrawAmount('');
    } catch (error) {
      console.error('Withdrawal failed:', error);
    } finally {
      setProcessingTransaction(false);
    }
  }, [withdrawAmount, processingTransaction, withdraw]);

  if (portfolioLoading || protocolLoading) {
    return <LoadingSpinner />;
  }

  if (portfolioError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">Error: {portfolioError}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 pt-0 relative z-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-normal text-black">Enterprise Dashboard</h1>
            <p className="text-black text-opacity-80">
              Welcome back, {user?.address ? `${user.address.slice(0, 8)}...` : 'User'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-black text-opacity-60">
              Wallet: Connected
            </div>
            <button
              onClick={disconnect}
              className="bg-white hover:bg-gray-50 text-black px-6 py-3 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border border-black flex items-center space-x-2"
            >
              <LogOut size={16} />
              <span>Disconnect</span>
            </button>
          </div>
        </div>

        {/* Portfolio Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Value"
            value={`$${portfolio.totalValue.toLocaleString()}`}
            change="+12.5%"
            isPositive={true}
          />
          <MetricCard
            title="Total Yield"
            value={`$${portfolio.totalYield.toLocaleString()}`}
            change="+8.2%"
            isPositive={true}
          />
          <MetricCard
            title="Risk Score"
            value="0/100"
            change="-2.1%"
            isPositive={false}
          />
          <MetricCard
            title="Transactions"
            value={`${transactions?.length || 0}`}
            change="+5"
            isPositive={true}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white backdrop-blur-sm p-6 border border-black rounded-2xl shadow-lg">
            <h3 className="text-xl font-normal text-black mb-4">Yield Performance</h3>
            {yieldPerformanceData ? (
              <YieldPerformanceChart data={yieldPerformanceData} />
            ) : (
              <div className="text-black text-opacity-60">No data available</div>
            )}
          </div>
          <div className="bg-white backdrop-blur-sm p-6 border border-black rounded-2xl shadow-lg">
            <h3 className="text-xl font-normal text-black mb-4">TVL History</h3>
            {tvlHistory ? (
              <TVLChart data={tvlHistory} />
            ) : (
              <div className="text-black text-opacity-60">No data available</div>
            )}
          </div>
        </div>

        {/* Transaction Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white backdrop-blur-sm p-6 border border-black rounded-2xl shadow-lg">
            <h3 className="text-xl font-normal text-black mb-4">Deposit</h3>
            <div className="space-y-4">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Amount to deposit"
                className="w-full px-4 py-3 bg-white border border-black text-black placeholder-gray-500 focus:outline-none focus:border-opacity-60 rounded-xl transition-all duration-300 focus:scale-105"
              />
              <button
                onClick={handleDeposit}
                disabled={processingTransaction || !depositAmount}
                className="w-full bg-white hover:bg-gray-50 disabled:bg-gray-200 text-black px-4 py-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg border border-black"
              >
                {processingTransaction ? 'Processing...' : 'Deposit'}
              </button>
            </div>
          </div>
          <div className="bg-white backdrop-blur-sm p-6 border border-black rounded-2xl shadow-lg">
            <h3 className="text-xl font-normal text-black mb-4">Withdraw</h3>
            <div className="space-y-4">
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Amount to withdraw"
                className="w-full px-4 py-3 bg-white border border-black text-black placeholder-gray-500 focus:outline-none focus:border-opacity-60 rounded-xl transition-all duration-300 focus:scale-105"
              />
              <button
                onClick={handleWithdraw}
                disabled={processingTransaction || !withdrawAmount}
                className="w-full bg-white hover:bg-gray-50 disabled:bg-gray-200 text-black px-4 py-4 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg border border-black"
              >
                {processingTransaction ? 'Processing...' : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>

        {/* Collateral History */}
        {collateralHistory && (
          <div className="mt-8 bg-white bg-opacity-10 backdrop-blur-sm p-6 border border-white border-opacity-20">
            <h3 className="text-xl font-normal text-white mb-4">Collateral History</h3>
            <div className="text-white text-opacity-80">
              Historical collateral data visualization would go here
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Dashboard Component with Enterprise Integration
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { isStarknetConnected: isConnected, disconnectStarknetWallet: disconnectFn } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Wrap disconnect to handle onClick properly
  const disconnect = React.useCallback(() => {
    disconnectFn();
  }, [disconnectFn]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center py-12">
          <div className="bg-white backdrop-blur-sm p-8 max-w-md mx-auto border border-black rounded-2xl shadow-lg">
            <AlertCircle className="text-black mx-auto mb-4" size={48} />
            <h2 className="text-2xl text-black mb-4">Wallet Connection Required</h2>
            <p className="text-black text-opacity-70 mb-6">
              Please connect your wallet to access your dashboard and portfolio.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setWalletModalOpen(true)}
                className="w-full bg-gradient-to-r from-[#6e6aff] to-[#8b5cf6] hover:from-[#5b57e6] hover:to-[#7c3aed] text-white px-6 py-4 font-normal rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-purple-500/25"
              >
                Connect Wallet
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full border-2 border-black text-black px-6 py-4 font-normal rounded-xl transition-all duration-300 hover:bg-gray-50 transform hover:scale-105"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
        <WalletConnectModalNew
          isOpen={walletModalOpen}
          onClose={() => setWalletModalOpen(false)}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${background2Image})` }}
    >
      {/* Background Overlay for better content visibility */}
      <div className="absolute inset-0 bg-white bg-opacity-30"></div>
      {/* Navigation */}
      <nav className="absolute top-0 w-full z-50 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="bg-white border border-black rounded-2xl p-3 shadow-lg w-24 h-24 flex items-center justify-center">
            <img src={definiteLogo} alt="Definite Protocol" className="h-18 w-18" />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 bg-white hover:bg-gray-50 text-black px-4 py-2 rounded-2xl transition-colors border border-black"
            >
              <Home size={16} />
              <span>Back to Home</span>
            </button>
            <button
              className="text-black bg-white border border-black px-3 py-2 rounded-md"
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate('/mint')}
              className="text-black hover:text-opacity-80 transition-colors border border-black px-3 py-2 rounded-md"
            >
              Mint
            </button>
            <button
              onClick={() => navigate('/analytics')}
              className="text-black hover:text-opacity-80 transition-colors border border-black px-3 py-2 rounded-md"
            >
              Analytics
            </button>
            <button
              onClick={() => isConnected ? disconnect() : setWalletModalOpen(true)}
              className="bg-white text-black px-6 py-3 font-normal border-2 border-black rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl relative overflow-hidden flex items-center"
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
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-black p-2 bg-white rounded-lg border border-black"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 bg-white backdrop-blur-sm p-4 border border-black rounded-lg shadow-lg">
            <div className="space-y-4">
              <button
                className="block w-full text-left text-black bg-white border border-black py-2 px-3 rounded"
              >
                Dashboard
              </button>
              <button
                onClick={() => {navigate('/mint'); setIsMenuOpen(false);}}
                className="block w-full text-left text-black hover:text-opacity-80 transition-colors py-2 border border-black px-3 rounded"
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
                onClick={() => isConnected ? disconnect() : setWalletModalOpen(true)}
                className="flex items-center space-x-2 w-full text-left text-black bg-white border border-black py-2 px-3 rounded"
              >
                {isConnected ? (
                  <>
                    <LogOut size={16} />
                    <span>Disconnect</span>
                  </>
                ) : (
                  <span>Connect Wallet</span>
                )}
              </button>
            </div>
          </div>
        )}
      </nav>

      <div className="pt-2 relative z-10">
        <EnterpriseDashboard />
      </div>

      <WalletConnectModalNew
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </div>
  );
};

// Analytics Component - Use Enterprise Analytics
const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const { isStarknetConnected: isConnected, disconnectStarknetWallet: disconnectFn } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Wrap disconnect to handle onClick properly
  const disconnect = React.useCallback(() => {
    disconnectFn();
  }, [disconnectFn]);

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${background2Image})` }}
    >
      {/* Background Overlay for better content visibility */}
      <div className="absolute inset-0 bg-white bg-opacity-30"></div>
      {/* Navigation */}
      <nav className="absolute top-0 w-full z-50 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="bg-white border border-black rounded-2xl p-3 shadow-lg w-24 h-24 flex items-center justify-center">
            <img src={definiteLogo} alt="Definite Protocol" className="h-18 w-18" />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
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
              onClick={() => navigate('/mint')}
              className="text-black hover:text-opacity-80 transition-colors border border-black px-3 py-2 rounded-md"
            >
              Mint
            </button>
            <button
              className="text-black bg-white border border-black px-3 py-2 rounded-md"
            >
              Analytics
            </button>
            <button
              onClick={() => isConnected ? disconnect() : setWalletModalOpen(true)}
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
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-black p-2 bg-white rounded-lg border border-black"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
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
                onClick={() => {navigate('/mint'); setIsMenuOpen(false);}}
                className="block w-full text-left text-black hover:text-opacity-80 transition-colors py-2 border border-black px-3 rounded"
              >
                Mint
              </button>
              <button
                className="block w-full text-left text-black bg-white border border-black py-2 px-3 rounded"
              >
                Analytics
              </button>
              <button
                onClick={() => isConnected ? disconnect() : setWalletModalOpen(true)}
                className="flex items-center space-x-2 w-full text-left text-black bg-white border border-black py-2 px-3 rounded"
              >
                {isConnected ? (
                  <>
                    <LogOut size={16} />
                    <span>Disconnect</span>
                  </>
                ) : (
                  <span>Connect Wallet</span>
                )}
              </button>
            </div>
          </div>
        )}
      </nav>

      <div className="pt-2 relative z-10">
        <EnterpriseAnalytics />
      </div>

      <WalletConnectModalNew
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
      />
    </div>
  );
};

// Settings Component
const Settings: React.FC = () => {
  const navigate = useNavigate();
  return (
  <div className="min-h-screen bg-white p-6">
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-normal text-black">Settings</h1>
          <p className="text-black text-opacity-80">Manage your preferences</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="text-black text-opacity-60 hover:text-black transition-colors"
        >
          ← Back to Home
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white backdrop-blur-sm p-6 border border-black rounded-2xl shadow-lg">
          <h3 className="text-xl font-normal text-black mb-4">Account Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-black mb-2">Email Notifications</label>
              <div className="flex items-center">
                <input type="checkbox" className="mr-3" defaultChecked />
                <span className="text-black text-opacity-80">Receive yield payments notifications</span>
              </div>
            </div>
            <div>
              <label className="block text-black mb-2">Preferred Currency</label>
              <select className="bg-white border border-black px-4 py-2 text-black rounded-xl">
                <option value="USD">USD</option>
                <option value="STRK">STRK</option>
                <option value="BTC">BTC</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white backdrop-blur-sm p-6 border border-black rounded-2xl shadow-lg">
          <h3 className="text-xl font-normal text-black mb-4">Risk Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-black mb-2">Risk Tolerance</label>
              <select className="bg-white border border-black px-4 py-2 text-black rounded-xl">
                <option value="conservative">Conservative</option>
                <option value="moderate">Moderate</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>
            <div>
              <label className="block text-white mb-2">Auto-rebalancing</label>
              <div className="flex items-center">
                <input type="checkbox" className="mr-3" defaultChecked />
                <span className="text-white text-opacity-80">Enable automatic portfolio rebalancing</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

// Main App Component
function App() {
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // Initialize services on app start
  useEffect(() => {
    let initialized = false;

    const initializeServices = async () => {
      if (initialized) return;
      initialized = true;

      try {
        // Initialize Oracle Service
        await pragmaOracleService.initialize();

        // Initialize Risk Management Service
        await riskManagementService.initialize();

        // Initialize hSTRK Service
        await starknetHstrkService.initialize();

        console.log('✅ All services initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize services:', error);
      }
    };

    initializeServices();
  }, []);



  return (
    <ErrorBoundary>
      <div style={{background: '#000000'}}>
        {/* Network Warning Banner */}
        <NetworkWarning />

        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/mint" element={<MintPage />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/test" element={<TestPage />} />
        </Routes>

        <WalletConnectModalNew
          isOpen={walletModalOpen}
          onClose={() => setWalletModalOpen(false)}
        />
      </div>
    </ErrorBoundary>
  );
}

export default App;