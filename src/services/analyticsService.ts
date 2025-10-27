/**
 * Analytics Service
 * Aggregates and analyzes protocol-wide data
 * Real blockchain data - NO MOCKS
 */

import { starknetHstrkService } from './starknetHstrkService';
import { logger } from '../utils/logger';

export interface ProtocolMetrics {
  totalValueLocked: number;
  totalUsers: number;
  totalTransactions: number;
  averageApy: number;
}

export interface TVLDataPoint {
  date: string;
  value: number;
}

export interface UserMetrics {
  activeUsers: number;
  newUsers: number;
  totalUsers: number;
}

class AnalyticsService {
  private metricsCache: ProtocolMetrics | null = null;
  private cacheExpiry: number = 300000;
  private lastCacheUpdate: number = 0;

  async getProtocolMetrics(): Promise<ProtocolMetrics> {
    try {
      const now = Date.now();
      if (this.metricsCache && (now - this.lastCacheUpdate) < this.cacheExpiry) {
        logger.debug('Returning cached protocol metrics');
        return this.metricsCache;
      }

      logger.info('Fetching protocol metrics from blockchain...');

      const stats = await starknetHstrkService.getProtocolStats();
      
      const totalValueLocked = Number(stats.totalDeposits) / 1e18;
      const totalSupply = Number(stats.totalMinted) / 1e18;

      const allTransactions = this.getAllTransactionsFromStorage();
      const uniqueUsers = this.getUniqueUsers(allTransactions);
      
      const averageApy = this.calculateAverageAPY(totalValueLocked, totalSupply);

      const metrics: ProtocolMetrics = {
        totalValueLocked,
        totalUsers: uniqueUsers.size,
        totalTransactions: allTransactions.length,
        averageApy
      };

      this.metricsCache = metrics;
      this.lastCacheUpdate = now;

      logger.info('Protocol metrics fetched successfully', metrics);
      return metrics;
    } catch (error) {
      logger.error('Failed to fetch protocol metrics', error as Error);
      throw error;
    }
  }

  async getTVLHistory(days: number = 30): Promise<TVLDataPoint[]> {
    try {
      logger.info(`Fetching TVL history for last ${days} days...`);

      const allTransactions = this.getAllTransactionsFromStorage();
      
      if (allTransactions.length === 0) {
        return [];
      }

      const sortedTxs = allTransactions.sort((a, b) => a.timestamp - b.timestamp);
      
      const tvlByDate = new Map<string, number>();
      let cumulativeTVL = 0;

      sortedTxs.forEach(tx => {
        const date = new Date(tx.timestamp).toLocaleDateString();
        const amount = parseFloat(tx.collateralAmount || '0') / 1e18;
        
        if (tx.type === 'MINT') {
          cumulativeTVL += amount;
        } else if (tx.type === 'REDEEM') {
          cumulativeTVL -= amount;
        }
        
        tvlByDate.set(date, cumulativeTVL);
      });

      const history: TVLDataPoint[] = Array.from(tvlByDate.entries()).map(([date, value]) => ({
        date,
        value
      }));

      const recentHistory = history.slice(-days);
      
      logger.info(`TVL history fetched: ${recentHistory.length} data points`);
      return recentHistory;
    } catch (error) {
      logger.error('Failed to fetch TVL history', error as Error);
      return [];
    }
  }

  async getUserMetrics(): Promise<UserMetrics> {
    try {
      logger.info('Calculating user metrics...');

      const allTransactions = this.getAllTransactionsFromStorage();
      const uniqueUsers = this.getUniqueUsers(allTransactions);

      const now = Date.now();
      const last30Days = now - (30 * 24 * 60 * 60 * 1000);
      const last7Days = now - (7 * 24 * 60 * 60 * 1000);

      const recentTxs = allTransactions.filter(tx => tx.timestamp >= last30Days);
      const activeUsers = this.getUniqueUsers(recentTxs);

      const newUserTxs = allTransactions.filter(tx => tx.timestamp >= last7Days);
      const newUsers = this.getUniqueUsers(newUserTxs);

      const metrics: UserMetrics = {
        activeUsers: activeUsers.size,
        newUsers: newUsers.size,
        totalUsers: uniqueUsers.size
      };

      logger.info('User metrics calculated', metrics);
      return metrics;
    } catch (error) {
      logger.error('Failed to calculate user metrics', error as Error);
      throw error;
    }
  }

  private getAllTransactionsFromStorage(): any[] {
    try {
      const allTxs: any[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('starknet_transactions_')) {
          const txsJson = localStorage.getItem(key);
          if (txsJson) {
            try {
              const txs = JSON.parse(txsJson);
              if (Array.isArray(txs)) {
                allTxs.push(...txs);
              }
            } catch (parseError) {
              logger.warn(`Failed to parse transactions for key ${key}`, parseError as Error);
            }
          }
        }
      }
      
      return allTxs;
    } catch (error) {
      logger.error('Failed to get all transactions from storage', error as Error);
      return [];
    }
  }

  private getUniqueUsers(transactions: any[]): Set<string> {
    const users = new Set<string>();
    transactions.forEach(tx => {
      if (tx.userAddress) {
        users.add(tx.userAddress.toLowerCase());
      }
    });
    return users;
  }

  private calculateAverageAPY(tvl: number, totalSupply: number): number {
    if (tvl === 0 || totalSupply === 0) return 0;
    
    const exchangeRate = totalSupply / tvl;
    const apy = ((exchangeRate - 1) * 100);
    
    return Math.max(0, Math.min(100, apy));
  }

  clearCache(): void {
    this.metricsCache = null;
    this.lastCacheUpdate = 0;
    logger.info('Analytics cache cleared');
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;

