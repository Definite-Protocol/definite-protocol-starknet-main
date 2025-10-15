import React from 'react';
import { Zap } from 'lucide-react';
import { useMultiChainWallet } from '../hooks/useMultiChainWallet';

interface ChainSwitcherProps {
  className?: string;
  variant?: 'default' | 'compact';
}

const ChainSwitcher: React.FC<ChainSwitcherProps> = ({
  className = '',
  variant = 'default'
}) => {
  const {
    isStarknetConnected
  } = useMultiChainWallet();

  // Don't show if not connected
  if (!isStarknetConnected) {
    return null;
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-1 bg-white border border-black rounded-lg p-1 shadow-md ${className}`}>
        <div className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded bg-purple-600 text-white shadow-md">
          <Zap size={14} />
          <span>Starknet</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-black rounded-xl p-4 shadow-lg ${className}`}>
      <div className="mb-3">
        <h3 className="text-black font-semibold text-sm">Active Chain</h3>
        <p className="text-black text-opacity-60 text-xs">Starknet Layer 2</p>
      </div>

      <div className="w-full flex items-center justify-between p-3 border rounded-lg bg-purple-50 border-purple-600 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-600">
            <Zap className="text-white" size={20} />
          </div>
          <div className="text-left">
            <div className="text-black font-medium text-sm">Starknet</div>
            <div className="text-black text-opacity-60 text-xs">Layer 2 Scaling</div>
          </div>
        </div>
        <div className="px-2 py-1 bg-purple-600 text-white text-xs font-medium rounded">
          Active
        </div>
      </div>

      <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-2">
          <div className="text-blue-600 text-xs">ℹ️</div>
          <div className="text-blue-800 text-xs">
            All transactions are processed on Starknet Layer 2 for fast and low-cost operations.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChainSwitcher;

