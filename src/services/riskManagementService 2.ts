// Enterprise Risk Management Service
import { config } from '../config/environment';
import { logger, measurePerformance } from '../utils/logger';
import { errorHandler, ErrorType } from '../utils/errorHandler';
import { oracleService, PriceData } from './oracleService';
import { AlgorandService } from './algorandService';

export interface RiskMetrics {
  collateralRatio: number;
  liquidationThreshold: number;
  healthFactor: number;
  valueAtRisk: number; // VaR at 95% confidence
  expectedShortfall: number; // ES at 95% confidence
  volatility: number; // 30-day volatility
  sharpeRatio: number;
  maxDrawdown: number;
  beta: number; // Beta vs ALGO
}

export interface PositionRisk {
  address: string;
  collateralValue: number;
  debtValue: number;
  collateralRatio: number;
  healthFactor: number;
  liquidationPrice: number;
  timeToLiquidation: number; // estimated hours
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface RiskLimits {
  maxPositionSize: number;
  maxLeverage: number;
  minCollateralRatio: number;
  maxConcentration: number; // Max % of total TVL in single position
  maxDailyVolume: number;
  maxSlippage: number;
}

export interface LiquidationEvent {
  address: string;
  collateralAmount: number;
  debtAmount: number;
  liquidationPrice: number;
  timestamp: number;
  txHash?: string;
  liquidator?: string;
}

export class RiskManagementService {
  private static instance: RiskManagementService;
  private riskLimits: RiskLimits;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private liquidationQueue: PositionRisk[] = [];
  private riskMetricsCache: Map<string, { metrics: RiskMetrics; timestamp: number }> = new Map();

  private constructor() {
    this.riskLimits = {
      maxPositionSize: 1000000 * 1000000, // 1M ALGO in microAlgos
      maxLeverage: 1 / config.protocol.collateralRatio, // ~0.67x for 150% collateral
      minCollateralRatio: config.protocol.collateralRatio,
      maxConcentration: 0.1, // 10% of TVL
      maxDailyVolume: 10000000 * 1000000, // 10M ALGO daily
      maxSlippage: 0.05 // 5%
    };
  }

  public static getInstance(): RiskManagementService {
    if (!RiskManagementService.instance) {
      RiskManagementService.instance = new RiskManagementService();
    }
    return RiskManagementService.instance;
  }

  // Initialize risk management system
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing Risk Management Service', {
        riskLimits: this.riskLimits,
        liquidationThreshold: config.protocol.liquidationThreshold
      });

      // Start continuous risk monitoring
      await this.startRiskMonitoring();
      
      logger.info('Risk Management Service initialized successfully');
    } catch (error) {
      const appError = errorHandler.handleError(
        error as Error,
        { operation: 'RiskManagementService.initialize' },
        ErrorType.UNKNOWN_ERROR
      );
      throw appError;
    }
  }

  // Calculate comprehensive risk metrics for a position
  public async calculateRiskMetrics(address: string): Promise<RiskMetrics> {
    return measurePerformance(
      'calculateRiskMetrics',
      async () => {
        // Check cache first
        const cached = this.riskMetricsCache.get(address);
        if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
          return cached.metrics;
        }

        const accountInfo = await AlgorandService.getAccountInfo(address);
        const algoPrice = await oracleService.getPrice('ALGO', 'USD');
        
        // Get historical price data for volatility calculation
        const priceHistory = await oracleService.getPriceHistory('ALGO', 'USD', 30);
        
        const amount = Number(accountInfo.amount) || 0;
        const assets = accountInfo.assets as Array<Record<string, unknown>> || [];

        const collateralValue = (amount / 1000000) * algoPrice.price;
        const halgoAsset = assets.find((a: Record<string, unknown>) => a['asset-id'] === config.protocol.halgoAssetId);
        const debtValue = halgoAsset ? (Number(halgoAsset.amount) / 1000000) * algoPrice.price : 0;
        
        const collateralRatio = debtValue > 0 ? collateralValue / debtValue : Infinity;
        const healthFactor = collateralRatio / config.protocol.liquidationThreshold;
        
        // Calculate volatility (30-day)
        const returns = this.calculateReturns(priceHistory);
        const volatility = this.calculateVolatility(returns);
        
        // Calculate VaR and ES at 95% confidence
        const sortedReturns = returns.sort((a, b) => a - b);
        const varIndex = Math.floor(returns.length * 0.05);
        const valueAtRisk = Math.abs(sortedReturns[varIndex] || 0) * collateralValue;
        const expectedShortfall = Math.abs(
          sortedReturns.slice(0, varIndex).reduce((sum, r) => sum + r, 0) / varIndex || 0
        ) * collateralValue;
        
        // Calculate Sharpe ratio (simplified)
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;
        
        // Calculate max drawdown
        const maxDrawdown = this.calculateMaxDrawdown(priceHistory);
        
        const metrics: RiskMetrics = {
          collateralRatio,
          liquidationThreshold: config.protocol.liquidationThreshold,
          healthFactor,
          valueAtRisk,
          expectedShortfall,
          volatility,
          sharpeRatio,
          maxDrawdown,
          beta: 1.0 // Beta vs ALGO is 1.0 by definition
        };

        // Cache the result
        this.riskMetricsCache.set(address, { metrics, timestamp: Date.now() });
        
        logger.debug('Risk metrics calculated', { address, metrics });
        
        return metrics;
      },
      { address }
    );
  }

  // Assess position risk and liquidation probability
  public async assessPositionRisk(address: string): Promise<PositionRisk> {
    const accountInfo = await AlgorandService.getAccountInfo(address);
    const algoPrice = await oracleService.getPrice('ALGO', 'USD');
    
    const amount = Number(accountInfo.amount) || 0;
    const assets = accountInfo.assets as Array<Record<string, unknown>> || [];

    const collateralValue = (amount / 1000000) * algoPrice.price;
    const halgoAsset = assets.find((a: Record<string, unknown>) => a['asset-id'] === config.protocol.halgoAssetId);
    const debtValue = halgoAsset ? (Number(halgoAsset.amount) / 1000000) * algoPrice.price : 0;
    
    const collateralRatio = debtValue > 0 ? collateralValue / debtValue : Infinity;
    const healthFactor = collateralRatio / config.protocol.liquidationThreshold;
    
    // Calculate liquidation price
    const liquidationPrice = debtValue > 0
      ? (debtValue * config.protocol.liquidationThreshold) / (amount / 1000000)
      : 0;
    
    // Estimate time to liquidation based on volatility
    const volatility = (await this.calculateRiskMetrics(address)).volatility;
    const priceDistance = Math.abs(algoPrice.price - liquidationPrice) / algoPrice.price;
    const timeToLiquidation = volatility > 0 ? (priceDistance / volatility) * 24 : Infinity;
    
    // Determine risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (healthFactor > 2.0) riskLevel = 'LOW';
    else if (healthFactor > 1.5) riskLevel = 'MEDIUM';
    else if (healthFactor > 1.1) riskLevel = 'HIGH';
    else riskLevel = 'CRITICAL';

    const positionRisk: PositionRisk = {
      address,
      collateralValue,
      debtValue,
      collateralRatio,
      healthFactor,
      liquidationPrice,
      timeToLiquidation,
      riskLevel
    };

    // Add to liquidation queue if critical
    if (riskLevel === 'CRITICAL' && !this.liquidationQueue.find(p => p.address === address)) {
      this.liquidationQueue.push(positionRisk);
      logger.warn('Position added to liquidation queue', { address, healthFactor });
    }

    return positionRisk;
  }

  // Validate transaction against risk limits
  public async validateTransaction(
    address: string,
    operation: 'mint' | 'burn' | 'deposit' | 'withdraw',
    amount: number
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      const currentRisk = await this.assessPositionRisk(address);
      
      // Check position size limits
      if (operation === 'mint' || operation === 'deposit') {
        const newCollateralValue = currentRisk.collateralValue + amount;
        if (newCollateralValue > this.riskLimits.maxPositionSize) {
          return {
            valid: false,
            reason: `Position size would exceed maximum limit of ${this.riskLimits.maxPositionSize / 1000000} ALGO`
          };
        }
      }

      // Check collateral ratio after transaction
      if (operation === 'mint') {
        const newDebtValue = currentRisk.debtValue + amount;
        const newCollateralRatio = currentRisk.collateralValue / newDebtValue;
        
        if (newCollateralRatio < this.riskLimits.minCollateralRatio) {
          return {
            valid: false,
            reason: `Transaction would result in insufficient collateral ratio: ${newCollateralRatio.toFixed(2)}`
          };
        }
      }

      // Check withdrawal limits
      if (operation === 'withdraw') {
        const newCollateralValue = currentRisk.collateralValue - amount;
        const newCollateralRatio = newCollateralValue / currentRisk.debtValue;
        
        if (currentRisk.debtValue > 0 && newCollateralRatio < this.riskLimits.minCollateralRatio) {
          return {
            valid: false,
            reason: `Withdrawal would result in insufficient collateral ratio: ${newCollateralRatio.toFixed(2)}`
          };
        }
      }

      return { valid: true };
    } catch (error) {
      logger.error('Transaction validation failed', error as Error, { address, operation, amount });
      return {
        valid: false,
        reason: 'Unable to validate transaction due to system error'
      };
    }
  }

  // Start continuous risk monitoring
  private async startRiskMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performRiskScan();
      } catch (error) {
        logger.error('Risk monitoring scan failed', error as Error);
      }
    }, 60000); // Every minute

    logger.info('Risk monitoring started');
  }

  // Perform comprehensive risk scan
  private async performRiskScan(): Promise<void> {
    // In production, this would scan all active positions
    // For now, we'll process the liquidation queue
    
    for (const position of [...this.liquidationQueue]) {
      try {
        const updatedRisk = await this.assessPositionRisk(position.address);
        
        if (updatedRisk.healthFactor <= 1.0) {
          // Trigger liquidation
          await this.triggerLiquidation(position);
        } else if (updatedRisk.riskLevel !== 'CRITICAL') {
          // Remove from liquidation queue if risk improved
          const index = this.liquidationQueue.findIndex(p => p.address === position.address);
          if (index > -1) {
            this.liquidationQueue.splice(index, 1);
            logger.info('Position removed from liquidation queue', { 
              address: position.address, 
              newHealthFactor: updatedRisk.healthFactor 
            });
          }
        }
      } catch (error) {
        logger.error('Failed to update position risk', error as Error, { address: position.address });
      }
    }
  }

  // Trigger liquidation for underwater position
  private async triggerLiquidation(position: PositionRisk): Promise<void> {
    try {
      logger.warn('Triggering liquidation', {
        address: position.address,
        healthFactor: position.healthFactor,
        collateralValue: position.collateralValue,
        debtValue: position.debtValue
      });

      // In production, this would call the liquidation smart contract
      // For now, we'll log the liquidation event
      
      const liquidationEvent: LiquidationEvent = {
        address: position.address,
        collateralAmount: position.collateralValue,
        debtAmount: position.debtValue,
        liquidationPrice: position.liquidationPrice,
        timestamp: Date.now()
      };

      logger.info('Liquidation event recorded', liquidationEvent as unknown as Record<string, unknown>);
      
      // Remove from liquidation queue
      const index = this.liquidationQueue.findIndex(p => p.address === position.address);
      if (index > -1) {
        this.liquidationQueue.splice(index, 1);
      }

    } catch (error) {
      logger.error('Liquidation failed', error as Error, { address: position.address });
    }
  }

  // Calculate returns from price history
  private calculateReturns(priceHistory: PriceData[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < priceHistory.length; i++) {
      const currentPrice = priceHistory[i].price;
      const previousPrice = priceHistory[i - 1].price;
      const return_ = (currentPrice - previousPrice) / previousPrice;
      returns.push(return_);
    }
    return returns;
  }

  // Calculate volatility (standard deviation of returns)
  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  // Calculate maximum drawdown
  private calculateMaxDrawdown(priceHistory: PriceData[]): number {
    let maxDrawdown = 0;
    let peak = priceHistory[0]?.price || 0;
    
    for (const point of priceHistory) {
      if (point.price > peak) {
        peak = point.price;
      }
      
      const drawdown = (peak - point.price) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  // Get current risk limits
  public getRiskLimits(): RiskLimits {
    return { ...this.riskLimits };
  }

  // Update risk limits (admin function)
  public updateRiskLimits(newLimits: Partial<RiskLimits>): void {
    this.riskLimits = { ...this.riskLimits, ...newLimits };
    logger.info('Risk limits updated', { newLimits });
  }

  // Get liquidation queue
  public getLiquidationQueue(): PositionRisk[] {
    return [...this.liquidationQueue];
  }

  // Cleanup resources
  public destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.liquidationQueue = [];
    this.riskMetricsCache.clear();
    
    logger.info('Risk Management Service destroyed');
  }
}

// Export singleton instance
export const riskManagementService = RiskManagementService.getInstance();

export default riskManagementService;
