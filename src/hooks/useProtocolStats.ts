/**
 * Protocol Stats Hook
 * Real-time protocol statistics from blockchain
 * NO MOCKS - Real data only
 */

import { useState, useEffect, useCallback } from 'react';
import { analyticsService, ProtocolMetrics } from '../services/analyticsService';
import { logger } from '../utils/logger';

interface UseProtocolStatsReturn {
  metrics: ProtocolMetrics | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useProtocolStats = (autoRefreshInterval: number = 30000): UseProtocolStatsReturn => {
  const [metrics, setMetrics] = useState<ProtocolMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      logger.info('Fetching protocol metrics...');
      const data = await analyticsService.getProtocolMetrics();
      
      setMetrics(data);
      logger.info('Protocol metrics loaded successfully', data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch protocol metrics';
      setError(errorMessage);
      logger.error('Failed to fetch protocol metrics', err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();

    if (autoRefreshInterval > 0) {
      const interval = setInterval(fetchMetrics, autoRefreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchMetrics, autoRefreshInterval]);

  const refresh = useCallback(async () => {
    analyticsService.clearCache();
    await fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    refresh
  };
};

export default useProtocolStats;

