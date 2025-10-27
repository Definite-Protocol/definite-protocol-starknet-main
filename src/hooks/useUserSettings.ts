/**
 * User Settings Hook
 * Manages user preferences with localStorage persistence
 */

import { useState, useEffect, useCallback } from 'react';
import { userSettingsService, UserSettings, Currency, RiskTolerance } from '../services/userSettingsService';
import { logger } from '../utils/logger';

interface UseUserSettingsReturn {
  settings: UserSettings;
  loading: boolean;
  saving: boolean;
  error: string | null;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  saveSettings: () => Promise<void>;
  resetSettings: () => void;
}

export const useUserSettings = (userAddress: string | null): UseUserSettingsReturn => {
  const [settings, setSettings] = useState<UserSettings>(userSettingsService.getDefaultSettings());
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userAddress) {
      setSettings(userSettingsService.getDefaultSettings());
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const loadedSettings = userSettingsService.loadSettings(userAddress);
      setSettings(loadedSettings);
      logger.info('Settings loaded for user', { userAddress });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
      setError(errorMessage);
      logger.error('Failed to load settings', err as Error);
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  const updateSettings = useCallback((newSettings: Partial<UserSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      
      if (!userSettingsService.validateSettings(updated)) {
        logger.error('Invalid settings update attempted', { newSettings });
        return prev;
      }
      
      return updated;
    });
  }, []);

  const saveSettings = useCallback(async () => {
    if (!userAddress) {
      setError('No user address provided');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      userSettingsService.saveSettings(userAddress, settings);
      logger.info('Settings saved successfully', { userAddress, settings });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
      setError(errorMessage);
      logger.error('Failed to save settings', err as Error);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [userAddress, settings]);

  const resetSettings = useCallback(() => {
    const defaults = userSettingsService.getDefaultSettings();
    setSettings(defaults);
    logger.info('Settings reset to defaults');
  }, []);

  return {
    settings,
    loading,
    saving,
    error,
    updateSettings,
    saveSettings,
    resetSettings
  };
};

export default useUserSettings;

