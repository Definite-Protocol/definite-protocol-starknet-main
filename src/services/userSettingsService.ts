/**
 * User Settings Service
 * Manages user preferences and settings
 * Uses localStorage for persistence
 */

import { logger } from '../utils/logger';

export type Currency = 'USD' | 'STRK' | 'BTC' | 'ETH';
export type RiskTolerance = 'conservative' | 'moderate' | 'aggressive';

export interface UserSettings {
  emailNotifications: boolean;
  preferredCurrency: Currency;
  riskTolerance: RiskTolerance;
  autoRebalance: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  emailNotifications: true,
  preferredCurrency: 'USD',
  riskTolerance: 'moderate',
  autoRebalance: false
};

class UserSettingsService {
  private getStorageKey(address: string): string {
    return `user_settings_${address.toLowerCase()}`;
  }

  loadSettings(address: string): UserSettings {
    try {
      const key = this.getStorageKey(address);
      const stored = localStorage.getItem(key);
      
      if (!stored) {
        logger.info('No settings found, returning defaults', { address });
        return { ...DEFAULT_SETTINGS };
      }

      const settings = JSON.parse(stored) as UserSettings;
      logger.info('Settings loaded successfully', { address, settings });
      return settings;
    } catch (error) {
      logger.error('Failed to load settings, returning defaults', error as Error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(address: string, settings: UserSettings): void {
    try {
      const key = this.getStorageKey(address);
      localStorage.setItem(key, JSON.stringify(settings));
      logger.info('Settings saved successfully', { address, settings });
    } catch (error) {
      logger.error('Failed to save settings', error as Error);
      throw error;
    }
  }

  getDefaultSettings(): UserSettings {
    return { ...DEFAULT_SETTINGS };
  }

  clearSettings(address: string): void {
    try {
      const key = this.getStorageKey(address);
      localStorage.removeItem(key);
      logger.info('Settings cleared', { address });
    } catch (error) {
      logger.error('Failed to clear settings', error as Error);
    }
  }

  validateSettings(settings: Partial<UserSettings>): boolean {
    try {
      if (settings.preferredCurrency && !['USD', 'STRK', 'BTC', 'ETH'].includes(settings.preferredCurrency)) {
        return false;
      }
      
      if (settings.riskTolerance && !['conservative', 'moderate', 'aggressive'].includes(settings.riskTolerance)) {
        return false;
      }
      
      if (settings.emailNotifications !== undefined && typeof settings.emailNotifications !== 'boolean') {
        return false;
      }
      
      if (settings.autoRebalance !== undefined && typeof settings.autoRebalance !== 'boolean') {
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('Settings validation failed', error as Error);
      return false;
    }
  }
}

export const userSettingsService = new UserSettingsService();
export default userSettingsService;

