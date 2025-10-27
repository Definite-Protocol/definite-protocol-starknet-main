/**
 * Analytics Hook
 * Historical data and analytics
 * Real blockchain data - NO MOCKS
 */

import { useState, useEffect, useCallback } from 'react';
import { analyticsService, TVLDataPoint, UserMetrics } from '../services/analyticsService';
import { logger } from '../utils/logger';

export type TimeRange = '7d' | '30d' | '90d' | 'all';

interface UseAnalyticsReturn {
  tvlHistory: TVLDataPoint[];
  userMetrics: UserMetrics | null;
  loading: boolean;
  error: string | null;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  refresh: () => Promise<void>;
}

export const useAnalytics = (initialTimeRange: TimeRange = '30d'): UseAnalyticsReturn => {
  const [tvlHistory, setTvlHistory] = useState<TVLDataPoint[]>([]);
  const [userMetrics, setUserMetrics] = useState<UserMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange);

  const getDaysFromRange = (range: TimeRange): number => {
    switch (range) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case 'all': return 365;
      default: return 30;
    }
  };

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      logger.info('Fetching analytics data...', { timeRange });
      
      const days = getDaysFromRange(timeRange);
      
      const [tvlData, userMetricsData] = await Promise.all([
        analyticsService.getTVLHistory(days),
        analyticsService.getUserMetrics()
      ]);
      
      setTvlHistory(tvlData);
      setUserMetrics(userMetricsData);
      
      logger.info('Analytics data loaded successfully', {
        tvlDataPoints: tvlData.length,
        userMetrics: userMetricsData
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics';
      setError(errorMessage);
      logger.error('Failed to fetch analytics', err as Error);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const refresh = useCallback(async () => {
    analyticsService.clearCache();
    await fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    tvlHistory,
    userMetrics,
    loading,
    error,
    timeRange,
    setTimeRange,
    refresh
  };
};

export default useAnalytics;

