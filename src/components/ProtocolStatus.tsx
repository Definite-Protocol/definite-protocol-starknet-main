import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, Loader } from 'lucide-react';
import { useStarknetHSTRK } from '../hooks/useStarknetHSTRK';
import { useMultiChainWallet } from '../hooks/useMultiChainWallet';

const ProtocolStatus: React.FC = () => {
  const { isStarknetConnected: isConnected, starknetWallet: wallet } = useMultiChainWallet();
  const {
    strkBalance,
    hstrkBalance,
    collateralBalance,
    position,
    loading,
    balances
  } = useStarknetHSTRK();

  const [protocolInfo, setProtocolInfo] = useState<Record<string, unknown> | null>(null);

  // Mock config for now (will be replaced with real protocol config)
  const config = {
    liquidationThreshold: 1.5,
    minCollateralRatio: 1.5,
    minimumDeposit: 1000000n, // 1 STRK in smallest unit
    collateralRatio: 1.5,
    exitFeeRate: 0.001, // 0.1%
    hstrkAssetId: 0
  };

  // Format helper - 18 decimals for STRK and hSTRK - 1 decimal place
  const formatAmount = (amount: number | bigint | undefined) => {
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

  useEffect(() => {
    // Check if protocol initializer is available
    const windowWithProtocol = window as unknown as Record<string, unknown>;
    if (windowWithProtocol.ProtocolInitializer) {
      const protocolInitializer = windowWithProtocol.ProtocolInitializer as Record<string, unknown>;
      if (typeof protocolInitializer.getStatus === 'function') {
        (protocolInitializer.getStatus as () => Promise<Record<string, unknown>>)().then((status: Record<string, unknown>) => {
          setProtocolInfo(status);
        });
      }
    }
  }, []);

  if (!isConnected) {
    return (
      <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 mb-6">
        <div className="flex items-center space-x-3">
          <AlertCircle className="text-yellow-400" size={20} />
          <div>
            <div className="text-yellow-400 font-medium">Wallet Not Connected</div>
            <div className="text-yellow-300 text-sm">Connect your Starknet wallet to view protocol status</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Wallet Status */}
      <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <CheckCircle className="text-green-400" size={20} />
          <div>
            <div className="text-green-400 font-medium">Wallet Connected</div>
            <div className="text-green-300 text-sm">
              {wallet?.address.substring(0, 8)}...{wallet?.address.substring(-8)}
            </div>
          </div>
        </div>
      </div>

      {/* Balance Information */}
      <div className="bg-gray-900/20 border border-gray-700 rounded-lg p-4">
        <h3 className="text-white font-medium mb-3">Account Balances</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">STRK Balance:</span>
            <span className="text-white font-mono">
              {loading ? (
                <Loader className="animate-spin" size={16} />
              ) : (
                `${formatAmount(balances?.strk)} STRK`
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">hSTRK Balance:</span>
            <span className="text-white font-mono">
              {loading ? (
                <Loader className="animate-spin" size={16} />
              ) : (
                `${formatAmount(balances?.hstrk)} hSTRK`
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Position Information */}
      {position && (
        <div className="bg-gray-900/20 border border-gray-700 rounded-lg p-4">
          <h3 className="text-white font-medium mb-3">Your Position</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">STRK Deposited:</span>
              <span className="text-white">{formatAmount(position.collateralAmount)} STRK</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">hSTRK Minted:</span>
              <span className="text-white">{formatAmount(position.hstrkAmount)} hSTRK</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Collateral Ratio:</span>
              <span className={`${
                position.collateralizationRatio > config.liquidationThreshold
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}>
                {(position.collateralizationRatio * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Health Factor:</span>
              <span className={`${
                position.healthFactor > 1 
                  ? 'text-green-400' 
                  : 'text-red-400'
              }`}>
                {position.healthFactor.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Protocol Configuration */}
      <div className="bg-gray-900/20 border border-gray-700 rounded-lg p-4">
        <h3 className="text-white font-medium mb-3">Protocol Configuration</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Minimum Deposit:</span>
            <span className="text-white">{formatAmount(config.minimumDeposit)} STRK</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Collateral Ratio:</span>
            <span className="text-white">{(config.collateralRatio * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Liquidation Threshold:</span>
            <span className="text-white">{(config.liquidationThreshold * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Exit Fee:</span>
            <span className="text-white">{(config.exitFeeRate * 100).toFixed(1)}%</span>
          </div>
          {config.hstrkAssetId > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">hSTRK Asset ID:</span>
              <span className="text-white">{config.hstrkAssetId}</span>
            </div>
          )}
        </div>
      </div>

      {/* Protocol Status */}
      {protocolInfo && (
        <div className={`border rounded-lg p-4 ${
          protocolInfo.isInitialized 
            ? 'bg-green-900/20 border-green-700' 
            : 'bg-red-900/20 border-red-700'
        }`}>
          <div className="flex items-center space-x-3">
            {protocolInfo.isInitialized ? (
              <CheckCircle className="text-green-400" size={20} />
            ) : (
              <AlertCircle className="text-red-400" size={20} />
            )}
            <div>
              <div className={`font-medium ${
                protocolInfo.isInitialized ? 'text-green-400' : 'text-red-400'
              }`}>
                Protocol {protocolInfo.isInitialized ? 'Initialized' : 'Not Initialized'}
              </div>
              <div className={`text-sm ${
                protocolInfo.isInitialized ? 'text-green-300' : 'text-red-300'
              }`}>
                {protocolInfo.isInitialized 
                  ? 'Protocol is ready for use'
                  : 'Run ProtocolInitializer.initialize() in console'
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Demo Mode Notice */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <Info className="text-blue-400" size={20} />
          <div>
            <div className="text-blue-400 font-medium">Demo Mode Active</div>
            <div className="text-blue-300 text-sm">
              Transactions are simulated using localStorage. Real blockchain integration available.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProtocolStatus;
