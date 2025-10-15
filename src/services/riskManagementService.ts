/**
 * Risk Management Service
 * Comprehensive risk assessment and monitoring for hSTRK Protocol
 * Production-ready with real-time risk calculations
 */

import { pragmaOracleService } from './pragmaOracleService';
import { logger } from '../utils/logger';

// Risk Levels
export enum RiskLevel {
  SAFE = 'SAFE',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
  LIQUIDATION = 'LIQUIDATION'
}

// Risk Thresholds (Collateralization Ratios)
export const RISK_THRESHOLDS = {
  SAFE: 200,        // > 200%
  LOW: 175,         // 175-200%
  MEDIUM: 150,      // 150-175%
  HIGH: 130,        // 130-150%
  CRITICAL: 120,    // 120-130%
  LIQUIDATION: 110  // < 120%
};

// Protocol Parameters
export const PROTOCOL_PARAMS = {
  MIN_COLLATERAL_RATIO: 150,  // 150% minimum
  LIQUIDATION_RATIO: 120,      // 120% liquidation threshold
  LIQUIDATION_PENALTY: 10,     // 10% penalty
  STABILITY_FEE: 0.5,          // 0.5% annual
  EXIT_FEE: 0.1                // 0.1% exit fee
};

// Position Interface
export interface Position {
  collateralAmount: bigint;
  debtAmount: bigint;
  collateralToken: 'STRK' | 'ETH' | 'BTC';
  owner: string;
  createdAt: number;
  lastUpdated: number;
}

// Risk Assessment Interface
export interface RiskAssessment {
  position: Position;
  collateralizationRatio: number;
  riskLevel: RiskLevel;
  collateralValue: number;
  debtValue: number;
  liquidationPrice: number;
  healthFactor: number;
  canMint: boolean;
  canRedeem: boolean;
  maxMintable: bigint;
  maxRedeemable: bigint;
  warnings: string[];
  recommendations: string[];
}

class RiskManagementService {
  private isInitialized: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private positions: Map<string, Position> = new Map();

  /**
   * Initialize Risk Management Service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Risk Management Service already initialized');
      return;
    }

    try {
      logger.info('Initializing Risk Management Service...');

      // Initialize Oracle Service
      await pragmaOracleService.initialize();

      // Start monitoring (every 5 minutes)
      this.startMonitoring(300000);

      this.isInitialized = true;
      logger.info('✅ Risk Management Service initialized successfully');
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to initialize Risk Management Service', err);
      throw error;
    }
  }

  /**
   * Assess Position Risk
   */
  async assessPosition(position: Position): Promise<RiskAssessment> {
    try {
      // Get collateralization ratio
      const collateralizationRatio = await pragmaOracleService.getCollateralizationRatio(
        position.collateralAmount,
        position.debtAmount,
        position.collateralToken
      );

      // Get collateral value
      const collateralValue = await pragmaOracleService.calculateCollateralValue(
        position.collateralAmount,
        position.collateralToken
      );

      // Calculate debt value (hSTRK pegged to USD)
      const debtValue = Number(position.debtAmount) / 1e18;

      // Determine risk level
      const riskLevel = this.calculateRiskLevel(collateralizationRatio);

      // Calculate health factor (1.0 = at liquidation threshold)
      const healthFactor = collateralizationRatio / PROTOCOL_PARAMS.LIQUIDATION_RATIO;

      // Calculate liquidation price
      const liquidationPrice = this.calculateLiquidationPrice(
        position.collateralAmount,
        position.debtAmount
      );

      // Calculate max mintable
      const maxMintable = this.calculateMaxMintable(
        collateralValue,
        debtValue
      );

      // Calculate max redeemable
      const maxRedeemable = this.calculateMaxRedeemable(
        position.collateralAmount,
        debtValue
      );

      // Generate warnings and recommendations
      const warnings = this.generateWarnings(riskLevel, collateralizationRatio);
      const recommendations = this.generateRecommendations(riskLevel, healthFactor);

      const assessment: RiskAssessment = {
        position,
        collateralizationRatio,
        riskLevel,
        collateralValue,
        debtValue,
        liquidationPrice,
        healthFactor,
        canMint: collateralizationRatio > PROTOCOL_PARAMS.MIN_COLLATERAL_RATIO,
        canRedeem: debtValue > 0,
        maxMintable,
        maxRedeemable,
        warnings,
        recommendations
      };

      logger.debug('Position risk assessed', {
        owner: position.owner,
        riskLevel,
        collateralizationRatio,
        healthFactor
      });

      return assessment;
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to assess position risk', err);
      throw error;
    }
  }

  /**
   * Calculate Risk Level
   */
  private calculateRiskLevel(ratio: number): RiskLevel {
    if (ratio >= RISK_THRESHOLDS.SAFE) return RiskLevel.SAFE;
    if (ratio >= RISK_THRESHOLDS.LOW) return RiskLevel.LOW;
    if (ratio >= RISK_THRESHOLDS.MEDIUM) return RiskLevel.MEDIUM;
    if (ratio >= RISK_THRESHOLDS.HIGH) return RiskLevel.HIGH;
    if (ratio >= RISK_THRESHOLDS.CRITICAL) return RiskLevel.CRITICAL;
    return RiskLevel.LIQUIDATION;
  }

  /**
   * Calculate Liquidation Price
   */
  private calculateLiquidationPrice(
    collateralAmount: bigint,
    debtAmount: bigint
  ): number {
    const collateralDecimal = Number(collateralAmount) / 1e18;
    const debtDecimal = Number(debtAmount) / 1e18;

    if (collateralDecimal === 0) return 0;

    // Price at which position becomes liquidatable
    return (debtDecimal * PROTOCOL_PARAMS.LIQUIDATION_RATIO) / (collateralDecimal * 100);
  }

  /**
   * Calculate Max Mintable Amount
   */
  private calculateMaxMintable(
    collateralValue: number,
    currentDebt: number
  ): bigint {
    // Max debt = (collateral value / min ratio) * 100
    const maxDebt = (collateralValue / PROTOCOL_PARAMS.MIN_COLLATERAL_RATIO) * 100;
    const additionalMintable = Math.max(0, maxDebt - currentDebt);
    
    return BigInt(Math.floor(additionalMintable * 1e18));
  }

  /**
   * Calculate Max Redeemable Amount
   */
  private calculateMaxRedeemable(
    collateralAmount: bigint,
    debtValue: number
  ): bigint {
    if (debtValue === 0) return collateralAmount;

    // Can redeem up to the debt amount
    return BigInt(Math.floor(debtValue * 1e18));
  }

  /**
   * Generate Warnings
   */
  private generateWarnings(riskLevel: RiskLevel, ratio: number): string[] {
    const warnings: string[] = [];

    if (riskLevel === RiskLevel.LIQUIDATION) {
      warnings.push('⚠️ CRITICAL: Position is at risk of liquidation!');
      warnings.push('Add more collateral immediately or repay debt');
    } else if (riskLevel === RiskLevel.CRITICAL) {
      warnings.push('⚠️ WARNING: Position is approaching liquidation threshold');
      warnings.push(`Current ratio: ${ratio.toFixed(2)}% | Liquidation at: ${PROTOCOL_PARAMS.LIQUIDATION_RATIO}%`);
    } else if (riskLevel === RiskLevel.HIGH) {
      warnings.push('⚠️ CAUTION: Position has high risk');
      warnings.push('Consider adding collateral to improve safety');
    }

    return warnings;
  }

  /**
   * Generate Recommendations
   */
  private generateRecommendations(_riskLevel: RiskLevel, healthFactor: number): string[] {
    const recommendations: string[] = [];

    if (healthFactor < 1.2) {
      recommendations.push('💡 Add collateral to increase health factor above 1.5');
      recommendations.push('💡 Consider repaying some debt to reduce risk');
    } else if (healthFactor < 1.5) {
      recommendations.push('💡 Maintain collateral ratio above 150% for safety');
    } else if (healthFactor > 2.5) {
      recommendations.push('💡 Your position is very safe - you could mint more hSTRK if needed');
    }

    return recommendations;
  }

  /**
   * Start Position Monitoring
   */
  private startMonitoring(intervalMs: number): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        logger.debug('Running position monitoring...');
        
        // Monitor all tracked positions
        for (const [owner, position] of this.positions) {
          const assessment = await this.assessPosition(position);
          
          if (assessment.riskLevel === RiskLevel.CRITICAL || 
              assessment.riskLevel === RiskLevel.LIQUIDATION) {
            logger.warn('High-risk position detected', {
              owner,
              riskLevel: assessment.riskLevel,
              ratio: assessment.collateralizationRatio
            });
          }
        }
      } catch (error) {
        const err = error as Error;
        logger.error('Position monitoring error', err);
      }
    }, intervalMs);

    logger.info('Position monitoring started', { intervalMs });
  }

  /**
   * Stop Monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Position monitoring stopped');
    }
  }

  /**
   * Track Position
   */
  trackPosition(position: Position): void {
    this.positions.set(position.owner, position);
    logger.info('Position tracked', { owner: position.owner });
  }

  /**
   * Untrack Position
   */
  untrackPosition(owner: string): void {
    this.positions.delete(owner);
    logger.info('Position untracked', { owner });
  }
}

// Export singleton instance
export const riskManagementService = new RiskManagementService();
export default riskManagementService;

