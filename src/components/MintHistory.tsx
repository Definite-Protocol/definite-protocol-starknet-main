import React, { useState, useMemo } from 'react';
import { Clock, ArrowUpRight, ArrowDownLeft, Filter } from 'lucide-react';

interface MintHistoryEntry {
  id?: string;
  timestamp: number;
  type: 'MINT' | 'REDEEM';
  algoAmount?: number; // Deprecated - use collateralAmount
  collateralAmount?: number; // New field name
  hstrkAmount: number;
  ratio: number;
  txHash?: string;
  transactionHash?: string; // Alternative field name
  status: 'completed' | 'pending' | 'failed';
}

interface MintHistoryProps {
  transactions: MintHistoryEntry[];
  isLoading?: boolean;
}

const formatAmount = (amount: number, decimals: number = 18): string => {
  if (isNaN(amount) || amount === null || amount === undefined) return '0.00';
  return (amount / Math.pow(10, decimals)).toFixed(2);
};

const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

const MintHistory: React.FC<MintHistoryProps> = ({ transactions, isLoading = false }) => {
  const [filter, setFilter] = useState<'ALL' | 'MINT' | 'REDEEM'>('ALL');
  const [showAll, setShowAll] = useState(false);

  // Use only real transactions - no mock data
  const allTransactions = transactions;

  const filteredTransactions = useMemo(() => {
    // Create a copy to avoid mutating original array
    let filtered = [...allTransactions];

    if (filter !== 'ALL') {
      filtered = filtered.filter(tx => tx.type === filter);
    }

    // Sort by timestamp (newest first) - sort mutates array, so we already copied above
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    // Limit to 10 items unless showAll is true
    if (!showAll) {
      filtered = filtered.slice(0, 10);
    }

    return filtered;
  }, [allTransactions, filter, showAll]);

  const stats = useMemo(() => {
    const totalMints = allTransactions.filter(tx => tx.type === 'MINT').length;
    const totalRedeems = allTransactions.filter(tx => tx.type === 'REDEEM').length;
    const totalVolume = allTransactions.reduce((sum, tx) => {
      const amount = tx.collateralAmount || tx.algoAmount || 0;
      return sum + amount;
    }, 0);

    return {
      totalMints,
      totalRedeems,
      totalVolume: formatAmount(totalVolume),
      totalTransactions: allTransactions.length
    };
  }, [allTransactions]);

  if (isLoading) {
    return (
      <div className="bg-white border border-black rounded-lg p-6 shadow-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-black rounded-lg p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-black text-lg font-medium">Transaction History</h3>
        <div className="flex items-center space-x-2">
          <Filter size={16} className="text-black text-opacity-60" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'ALL' | 'MINT' | 'REDEEM')}
            className="bg-white border border-black rounded px-2 py-1 text-sm text-black"
          >
            <option value="ALL">All</option>
            <option value="MINT">Mint</option>
            <option value="REDEEM">Redeem</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-50 border border-black rounded-lg p-3 text-center">
          <div className="text-black text-opacity-60 text-xs">Total Txns</div>
          <div className="text-black text-sm font-medium">{stats.totalTransactions}</div>
        </div>
        <div className="bg-gray-50 border border-black rounded-lg p-3 text-center">
          <div className="text-black text-opacity-60 text-xs">Mints</div>
          <div className="text-black text-sm font-medium">{stats.totalMints}</div>
        </div>
        <div className="bg-gray-50 border border-black rounded-lg p-3 text-center">
          <div className="text-black text-opacity-60 text-xs">Redeems</div>
          <div className="text-black text-sm font-medium">{stats.totalRedeems}</div>
        </div>
        <div className="bg-gray-50 border border-black rounded-lg p-3 text-center">
          <div className="text-black text-opacity-60 text-xs">Volume</div>
          <div className="text-black text-sm font-medium">{stats.totalVolume}</div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="mx-auto text-black text-opacity-40 mb-2" size={32} />
            <div className="text-black text-opacity-60 text-sm">No transactions found</div>
            <div className="text-black text-opacity-40 text-xs">
              {filter !== 'ALL' ? `No ${filter.toLowerCase()} transactions` : 'Start minting to see your history'}
            </div>
          </div>
        ) : (
          filteredTransactions.map((tx, index) => {
            const collateralAmount = tx.collateralAmount || tx.algoAmount || 0;
            const txHash = tx.txHash || tx.transactionHash;
            // Use timestamp + index for unique key to avoid duplicates
            const txId = tx.id || (txHash ? `${txHash}-${tx.timestamp}` : `tx-${tx.timestamp}-${index}`);

            return (
              <div
                key={txId}
                className="bg-gray-50 border border-black rounded-lg p-4 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      tx.type === 'MINT'
                        ? 'bg-green-100 border border-green-300'
                        : 'bg-red-100 border border-red-300'
                    }`}>
                      {tx.type === 'MINT' ? (
                        <ArrowUpRight className="text-green-600" size={16} />
                      ) : (
                        <ArrowDownLeft className="text-red-600" size={16} />
                      )}
                    </div>
                    <div>
                      <div className="text-black text-sm font-medium">
                        {tx.type === 'MINT' ? 'Minted' : 'Redeemed'}
                      </div>
                      <div className="text-black text-opacity-60 text-xs">
                        {formatTimeAgo(tx.timestamp)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-black text-sm font-medium">
                      {tx.type === 'MINT'
                        ? `+${formatAmount(tx.hstrkAmount)} hSTRK`
                        : `+${formatAmount(collateralAmount)} STRK`
                      }
                    </div>
                    <div className="text-black text-opacity-60 text-xs">
                      {tx.type === 'MINT'
                        ? `${formatAmount(collateralAmount)} STRK`
                        : `${formatAmount(tx.hstrkAmount)} hSTRK`
                      }
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-black text-opacity-60 text-xs">Ratio</div>
                    <div className="text-black text-sm font-medium">
                      {(tx.ratio || 1.0).toFixed(4)}
                    </div>
                  </div>

                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    tx.status === 'completed'
                      ? 'bg-green-100 text-green-800 border border-green-300'
                      : tx.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}>
                    {tx.status}
                  </div>
                </div>

                {txHash && (
                  <div className="mt-2 pt-2 border-t border-black border-opacity-10">
                    <div className="text-black text-opacity-60 text-xs">
                      Tx: {txHash.substring(0, 8)}...{txHash.substring(txHash.length - 8)}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Show More Button */}
      {allTransactions.length > 10 && !showAll && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(true)}
            className="bg-white border border-black text-black px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Show All {allTransactions.length} Transactions
          </button>
        </div>
      )}

      {showAll && allTransactions.length > 10 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(false)}
            className="bg-white border border-black text-black px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Show Less
          </button>
        </div>
      )}
    </div>
  );
};

export default MintHistory;
