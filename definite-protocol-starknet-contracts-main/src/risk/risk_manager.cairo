use starknet::ContractAddress;
use starknet::storage::{
    Map, StoragePointerReadAccess, StoragePointerWriteAccess,
    StorageMapReadAccess, StorageMapWriteAccess
};

/// Risk level enumeration
#[derive(Drop, Serde, Copy, starknet::Store)]
pub enum RiskLevel {
    Low,      // 0-40
    Medium,   // 41-60
    High,     // 61-80
    Critical, // 81-100
}

/// Risk metrics data
#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct RiskMetrics {
    /// Overall risk score (0-100)
    pub risk_score: u8,
    /// Portfolio VaR (99% confidence) in basis points
    pub portfolio_var_bps: u16,
    /// Current leverage ratio (1.0 = 100%)
    pub leverage_ratio: u256,
    /// Liquidity ratio (available/total)
    pub liquidity_ratio: u256,
    /// Current drawdown in basis points
    pub current_drawdown_bps: u16,
    /// Correlation risk factor
    pub correlation_risk: u8,
    /// Volatility risk factor
    pub volatility_risk: u8,
    /// Last update timestamp
    pub timestamp: u64,
}

/// Circuit breaker trigger data
#[derive(Drop, Serde, Copy)]
pub struct CircuitBreakerTrigger {
    /// Trigger type
    pub trigger_type: felt252,
    /// Trigger value
    pub trigger_value: u256,
    /// Threshold that was breached
    pub threshold: u256,
    /// Timestamp of trigger
    pub timestamp: u64,
}

#[starknet::interface]
pub trait IRiskManager<TContractState> {
    /// Calculate current risk score (0-100)
    fn calculate_risk_score(ref self: TContractState) -> u8;
    
    /// Check circuit breaker conditions
    fn check_circuit_breaker(ref self: TContractState) -> bool;
    
    /// Get current risk metrics
    fn get_risk_metrics(self: @TContractState) -> RiskMetrics;
    
    /// Get current risk level
    fn get_risk_level(self: @TContractState) -> RiskLevel;
    
    /// Execute automated risk response
    fn automated_response(ref self: TContractState, risk_level: RiskLevel);
    
    /// Set risk thresholds
    fn set_risk_thresholds(
        ref self: TContractState,
        max_drawdown_bps: u16,
        max_leverage: u256,
        min_liquidity_ratio: u256,
        max_var_bps: u16,
    );
    
    /// Set circuit breaker parameters
    fn set_circuit_breaker_params(
        ref self: TContractState,
        price_drop_threshold_bps: u16,
        price_drop_timeframe: u64,
        iv_spike_threshold: u256,
        min_liquidity_threshold: u256,
    );
    
    /// Manual circuit breaker activation
    fn activate_circuit_breaker(ref self: TContractState, reason: felt252);
    
    /// Deactivate circuit breaker
    fn deactivate_circuit_breaker(ref self: TContractState);
    
    /// Check if circuit breaker is active
    fn is_circuit_breaker_active(self: @TContractState) -> bool;
    
    /// Update risk metrics manually
    fn update_risk_metrics(ref self: TContractState);
    
    /// Get historical risk data
    fn get_historical_risk_score(self: @TContractState, timestamp: u64) -> u8;
}

#[starknet::contract]
pub mod RiskManager {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess,
        StoragePointerReadAccess, StoragePointerWriteAccess
    };
    use core::num::traits::Zero;
    use super::{RiskLevel, RiskMetrics, CircuitBreakerTrigger};
    use crate::oracle::price_oracle::{IPriceOracleDispatcher, IPriceOracleDispatcherTrait};

    #[storage]
    struct Storage {
        owner: ContractAddress,
        /// Current risk metrics
        current_risk_metrics: RiskMetrics,
        /// Risk thresholds
        max_drawdown_bps: u16,        // Default: 2000 (20%)
        max_leverage: u256,           // Default: 2.0
        min_liquidity_ratio: u256,    // Default: 0.1 (10%)
        max_var_bps: u16,            // Default: 500 (5%)
        /// Circuit breaker parameters
        price_drop_threshold_bps: u16, // Default: 1000 (10% in 15min)
        price_drop_timeframe: u64,     // Default: 900 (15 minutes)
        iv_spike_threshold: u256,      // Default: 2x normal IV
        min_liquidity_threshold: u256, // Default: 5% of TVL
        /// Circuit breaker state
        circuit_breaker_active: bool,
        circuit_breaker_reason: felt252,
        circuit_breaker_timestamp: u64,
        /// Contract addresses
        protocol_vault: ContractAddress,
        price_oracle: ContractAddress,
        perpetual_hedge: ContractAddress,
        options_strategy: ContractAddress,
        /// Historical data (simplified - in production would use more sophisticated storage)
        historical_risk_scores: Map<u64, u8>, // timestamp -> risk_score
        /// Price tracking for circuit breaker
        price_history: Map<u64, u256>, // timestamp -> price
        last_price_update: u64,
        /// Risk calculation weights
        leverage_weight: u8,      // Default: 25%
        liquidity_weight: u8,     // Default: 20%
        drawdown_weight: u8,      // Default: 30%
        correlation_weight: u8,   // Default: 15%
        volatility_weight: u8,    // Default: 10%
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        /// Emitted when risk score is updated
        RiskScoreUpdated: RiskScoreUpdated,
        /// Emitted when risk level changes
        RiskLevelChanged: RiskLevelChanged,
        /// Emitted when circuit breaker is triggered
        CircuitBreakerTriggered: CircuitBreakerTriggered,
        /// Emitted when circuit breaker is deactivated
        CircuitBreakerDeactivated: CircuitBreakerDeactivated,
        /// Emitted when automated risk response is executed
        AutomatedRiskResponse: AutomatedRiskResponse,
        /// Emitted when risk thresholds are updated
        RiskThresholdsUpdated: RiskThresholdsUpdated,
        /// Emitted when circuit breaker parameters are updated
        CircuitBreakerParamsUpdated: CircuitBreakerParamsUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct RiskScoreUpdated {
        pub old_score: u8,
        pub new_score: u8,
        pub risk_level: RiskLevel,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct RiskLevelChanged {
        pub old_level: RiskLevel,
        pub new_level: RiskLevel,
        pub risk_score: u8,
    }

    #[derive(Drop, starknet::Event)]
    struct CircuitBreakerTriggered {
        pub trigger_type: felt252,
        pub trigger_value: u256,
        pub threshold: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct CircuitBreakerDeactivated {
        pub timestamp: u64,
        pub duration_active: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct AutomatedRiskResponse {
        pub risk_level: RiskLevel,
        pub actions_taken: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct RiskThresholdsUpdated {
        pub parameter: felt252,
        pub old_value: u256,
        pub new_value: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct CircuitBreakerParamsUpdated {
        pub parameter: felt252,
        pub old_value: u256,
        pub new_value: u256,
    }

    mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'RiskManager: zero address';
        pub const CIRCUIT_BREAKER_ACTIVE: felt252 = 'circuit breaker active';
        pub const INVALID_THRESHOLD: felt252 = 'invalid threshold';
        pub const UNAUTHORIZED_CALLER: felt252 = 'unauthorized caller';
        pub const INVALID_WEIGHT: felt252 = 'invalid weight';
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        protocol_vault: ContractAddress,
        price_oracle: ContractAddress,
    ) {
        self.owner.write(owner);
        
        // Validate addresses
        assert(!protocol_vault.is_zero(), Errors::ZERO_ADDRESS);
        assert(!price_oracle.is_zero(), Errors::ZERO_ADDRESS);
        
        // Set contract addresses
        self.protocol_vault.write(protocol_vault);
        self.price_oracle.write(price_oracle);
        
        // Set default risk thresholds
        self.max_drawdown_bps.write(2000);      // 20%
        self.max_leverage.write(2000000000000000000); // 2.0
        self.min_liquidity_ratio.write(100000000000000000); // 0.1 (10%)
        self.max_var_bps.write(500);            // 5%
        
        // Set default circuit breaker parameters
        self.price_drop_threshold_bps.write(1000); // 10%
        self.price_drop_timeframe.write(900);       // 15 minutes
        self.iv_spike_threshold.write(2000000000000000000); // 2x
        self.min_liquidity_threshold.write(50000000000000000); // 5%
        
        // Initialize state
        self.circuit_breaker_active.write(false);
        self.last_price_update.write(get_block_timestamp());
        
        // Set default risk calculation weights (must sum to 100)
        self.leverage_weight.write(25);
        self.liquidity_weight.write(20);
        self.drawdown_weight.write(30);
        self.correlation_weight.write(15);
        self.volatility_weight.write(10);
        
        // Initialize risk metrics
        let initial_metrics = RiskMetrics {
            risk_score: 0,
            portfolio_var_bps: 0,
            leverage_ratio: 1000000000000000000, // 1.0
            liquidity_ratio: 1000000000000000000, // 1.0
            current_drawdown_bps: 0,
            correlation_risk: 0,
            volatility_risk: 0,
            timestamp: get_block_timestamp(),
        };
        self.current_risk_metrics.write(initial_metrics);
    }

    #[abi(embed_v0)]
    impl RiskManagerImpl of super::IRiskManager<ContractState> {
        fn calculate_risk_score(ref self: ContractState) -> u8 {
            // Update risk metrics first
            self._update_risk_metrics_internal();

            let metrics = self.current_risk_metrics.read();

            // Calculate weighted risk score
            let leverage_score = self._calculate_leverage_risk_score(metrics.leverage_ratio);
            let liquidity_score = self._calculate_liquidity_risk_score(metrics.liquidity_ratio);
            let drawdown_score = self._calculate_drawdown_risk_score(metrics.current_drawdown_bps);
            let correlation_score = metrics.correlation_risk;
            let volatility_score = metrics.volatility_risk;

            // Apply weights
            let total_weighted = (
                leverage_score.into() * self.leverage_weight.read().into() +
                liquidity_score.into() * self.liquidity_weight.read().into() +
                drawdown_score.into() * self.drawdown_weight.read().into() +
                correlation_score.into() * self.correlation_weight.read().into() +
                volatility_score.into() * self.volatility_weight.read().into()
            );
            let weighted_score: u8 = (total_weighted / 100_u256).try_into().unwrap();

            let new_score: u8 = if weighted_score > 100 { 100 } else { weighted_score.try_into().unwrap() };

            // Update metrics with new score
            let mut updated_metrics = metrics;
            updated_metrics.risk_score = new_score;
            updated_metrics.timestamp = get_block_timestamp();
            self.current_risk_metrics.write(updated_metrics);

            // Store historical data
            self.historical_risk_scores.write(get_block_timestamp(), new_score);

            // Emit events
            let old_score = metrics.risk_score;
            let risk_level = self._get_risk_level_from_score(new_score);

            self.emit(RiskScoreUpdated {
                old_score,
                new_score,
                risk_level,
                timestamp: get_block_timestamp(),
            });

            // Check if risk level changed
            let old_level = self._get_risk_level_from_score(old_score);
            if self._risk_levels_different(old_level, risk_level) {
                self.emit(RiskLevelChanged {
                    old_level,
                    new_level: risk_level,
                    risk_score: new_score,
                });

                // Execute automated response
                self.automated_response(risk_level);
            }

            new_score
        }

        fn check_circuit_breaker(ref self: ContractState) -> bool {
            if self.circuit_breaker_active.read() {
                return true;
            }

            let current_time = get_block_timestamp();

            // Check price drop circuit breaker
            if self._check_price_drop_trigger(current_time) {
                self._activate_circuit_breaker_internal('price_drop');
                return true;
            }

            // Check IV spike circuit breaker
            if self._check_iv_spike_trigger() {
                self._activate_circuit_breaker_internal('iv_spike');
                return true;
            }

            // Check liquidity circuit breaker
            if self._check_liquidity_trigger() {
                self._activate_circuit_breaker_internal('low_liquidity');
                return true;
            }

            // Check drawdown circuit breaker
            let metrics = self.current_risk_metrics.read();
            if metrics.current_drawdown_bps >= self.max_drawdown_bps.read() {
                self._activate_circuit_breaker_internal('max_drawdown');
                return true;
            }

            false
        }

        fn get_risk_metrics(self: @ContractState) -> RiskMetrics {
            self.current_risk_metrics.read()
        }

        fn get_risk_level(self: @ContractState) -> RiskLevel {
            let metrics = self.current_risk_metrics.read();
            self._get_risk_level_from_score(metrics.risk_score)
        }

        fn automated_response(ref self: ContractState, risk_level: RiskLevel) {
            let actions_taken = match risk_level {
                RiskLevel::Low => {
                    // No action needed
                    'none'
                },
                RiskLevel::Medium => {
                    // Increase monitoring frequency
                    'increased_monitoring'
                },
                RiskLevel::High => {
                    // Pause new deposits, increase rebalancing frequency
                    self._pause_new_deposits();
                    self._increase_rebalancing_frequency();
                    'pause_deposits_rebalance'
                },
                RiskLevel::Critical => {
                    // Emergency mode: pause all operations, force deleveraging
                    self._activate_emergency_mode();
                    'emergency_mode_activated'
                },
            };

            self.emit(AutomatedRiskResponse {
                risk_level,
                actions_taken,
                timestamp: get_block_timestamp(),
            });
        }

        fn set_risk_thresholds(
            ref self: ContractState,
            max_drawdown_bps: u16,
            max_leverage: u256,
            min_liquidity_ratio: u256,
            max_var_bps: u16,
        ) {
            self._check_owner();

            // Validate thresholds
            assert(max_drawdown_bps <= 5000, Errors::INVALID_THRESHOLD); // Max 50%
            assert(max_leverage <= 5000000000000000000, Errors::INVALID_THRESHOLD); // Max 5x
            assert(min_liquidity_ratio <= 500000000000000000, Errors::INVALID_THRESHOLD); // Max 50%
            assert(max_var_bps <= 2000, Errors::INVALID_THRESHOLD); // Max 20%

            // Update thresholds
            let old_drawdown = self.max_drawdown_bps.read();
            self.max_drawdown_bps.write(max_drawdown_bps);
            self.emit(RiskThresholdsUpdated {
                parameter: 'max_drawdown_bps',
                old_value: old_drawdown.into(),
                new_value: max_drawdown_bps.into(),
            });

            let old_leverage = self.max_leverage.read();
            self.max_leverage.write(max_leverage);
            self.emit(RiskThresholdsUpdated {
                parameter: 'max_leverage',
                old_value: old_leverage,
                new_value: max_leverage,
            });

            let old_liquidity = self.min_liquidity_ratio.read();
            self.min_liquidity_ratio.write(min_liquidity_ratio);
            self.emit(RiskThresholdsUpdated {
                parameter: 'min_liquidity_ratio',
                old_value: old_liquidity,
                new_value: min_liquidity_ratio,
            });

            let old_var = self.max_var_bps.read();
            self.max_var_bps.write(max_var_bps);
            self.emit(RiskThresholdsUpdated {
                parameter: 'max_var_bps',
                old_value: old_var.into(),
                new_value: max_var_bps.into(),
            });
        }

        fn set_circuit_breaker_params(
            ref self: ContractState,
            price_drop_threshold_bps: u16,
            price_drop_timeframe: u64,
            iv_spike_threshold: u256,
            min_liquidity_threshold: u256,
        ) {
            self._check_owner();

            // Validate parameters
            assert(price_drop_threshold_bps <= 3000, Errors::INVALID_THRESHOLD); // Max 30%
            assert(price_drop_timeframe >= 300, Errors::INVALID_THRESHOLD); // Min 5 minutes
            assert(iv_spike_threshold >= 1500000000000000000, Errors::INVALID_THRESHOLD); // Min 1.5x

            // Update parameters
            let old_price_drop = self.price_drop_threshold_bps.read();
            self.price_drop_threshold_bps.write(price_drop_threshold_bps);
            self.emit(CircuitBreakerParamsUpdated {
                parameter: 'price_drop_threshold_bps',
                old_value: old_price_drop.into(),
                new_value: price_drop_threshold_bps.into(),
            });

            let old_timeframe = self.price_drop_timeframe.read();
            self.price_drop_timeframe.write(price_drop_timeframe);
            self.emit(CircuitBreakerParamsUpdated {
                parameter: 'price_drop_timeframe',
                old_value: old_timeframe.into(),
                new_value: price_drop_timeframe.into(),
            });

            let old_iv_spike = self.iv_spike_threshold.read();
            self.iv_spike_threshold.write(iv_spike_threshold);
            self.emit(CircuitBreakerParamsUpdated {
                parameter: 'iv_spike_threshold',
                old_value: old_iv_spike,
                new_value: iv_spike_threshold,
            });

            let old_liquidity = self.min_liquidity_threshold.read();
            self.min_liquidity_threshold.write(min_liquidity_threshold);
            self.emit(CircuitBreakerParamsUpdated {
                parameter: 'min_liquidity_threshold',
                old_value: old_liquidity,
                new_value: min_liquidity_threshold,
            });
        }

        fn activate_circuit_breaker(ref self: ContractState, reason: felt252) {
            self._check_owner();
            self._activate_circuit_breaker_internal(reason);
        }

        fn deactivate_circuit_breaker(ref self: ContractState) {
            self._check_owner();
            assert(self.circuit_breaker_active.read(), 'RiskManager: not active');

            let activation_time = self.circuit_breaker_timestamp.read();
            let current_time = get_block_timestamp();
            let duration_active = current_time - activation_time;

            self.circuit_breaker_active.write(false);
            self.circuit_breaker_reason.write('');
            self.circuit_breaker_timestamp.write(0);

            self.emit(CircuitBreakerDeactivated {
                timestamp: current_time,
                duration_active,
            });
        }

        fn is_circuit_breaker_active(self: @ContractState) -> bool {
            self.circuit_breaker_active.read()
        }

        fn update_risk_metrics(ref self: ContractState) {
            self._assert_authorized_caller();
            self._update_risk_metrics_internal();
        }

        fn get_historical_risk_score(self: @ContractState, timestamp: u64) -> u8 {
            self.historical_risk_scores.read(timestamp)
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Internal owner check function
        fn _check_owner(self: @ContractState) {
            let caller = get_caller_address();
            let owner = self.owner.read();
            assert(caller == owner, 'caller is not owner');
        }
        /// Assert caller is authorized
        fn _assert_authorized_caller(self: @ContractState) {
            let caller = get_caller_address();
            let vault = self.protocol_vault.read();
            let owner = self.owner.read();
            assert(caller == vault || caller == owner, Errors::UNAUTHORIZED_CALLER);
        }

        /// Update risk metrics internal calculation
        fn _update_risk_metrics_internal(ref self: ContractState) {
            let current_time = get_block_timestamp();

            // Calculate leverage ratio
            let leverage_ratio = self._calculate_current_leverage();

            // Calculate liquidity ratio
            let liquidity_ratio = self._calculate_liquidity_ratio();

            // Calculate current drawdown
            let current_drawdown_bps = self._calculate_current_drawdown();

            // Calculate portfolio VaR
            let portfolio_var_bps = self._calculate_portfolio_var();

            // Calculate correlation and volatility risks
            let correlation_risk = self._calculate_correlation_risk();
            let volatility_risk = self._calculate_volatility_risk();

            // Update price history for circuit breaker
            self._update_price_history(current_time);

            let updated_metrics = RiskMetrics {
                risk_score: 0, // Will be calculated in calculate_risk_score
                portfolio_var_bps,
                leverage_ratio,
                liquidity_ratio,
                current_drawdown_bps,
                correlation_risk,
                volatility_risk,
                timestamp: current_time,
            };

            self.current_risk_metrics.write(updated_metrics);
        }

        /// Calculate current leverage ratio
        fn _calculate_current_leverage(self: @ContractState) -> u256 {
            // In production, would fetch actual positions from vault and strategies
            // Simplified calculation: assume 1.5x leverage
            1500000000000000000 // 1.5
        }

        /// Calculate liquidity ratio
        fn _calculate_liquidity_ratio(self: @ContractState) -> u256 {
            // In production, would calculate available liquidity vs total assets
            // Simplified: assume 20% liquidity
            200000000000000000 // 0.2
        }

        /// Calculate current drawdown
        fn _calculate_current_drawdown(self: @ContractState) -> u16 {
            // In production, would track high water mark and current value
            // Simplified: assume 5% drawdown
            500 // 5%
        }

        /// Calculate portfolio VaR (99% confidence)
        fn _calculate_portfolio_var(self: @ContractState) -> u16 {
            // In production, would use historical simulation or Monte Carlo
            // Simplified: assume 3% VaR
            300 // 3%
        }

        /// Calculate correlation risk
        fn _calculate_correlation_risk(self: @ContractState) -> u8 {
            // In production, would analyze correlations between positions
            // Simplified: assume medium correlation risk
            40 // 40/100
        }

        /// Calculate volatility risk
        fn _calculate_volatility_risk(self: @ContractState) -> u8 {
            // In production, would analyze portfolio volatility
            // Simplified: assume medium volatility risk
            35 // 35/100
        }

        /// Update price history for circuit breaker monitoring
        fn _update_price_history(ref self: ContractState, timestamp: u64) {
            let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
            // In production, would specify the actual STRK token address
            let mock_strk_address: ContractAddress = Zero::zero(); // Placeholder

            // For now, skip actual price fetch to avoid zero address error
            // In production: let price_data = oracle.get_price(strk_token_address);
            let current_price = 100000000; // Mock price: $1.00 in 8 decimals

            self.price_history.write(timestamp, current_price);
            self.last_price_update.write(timestamp);
        }

        /// Calculate leverage risk score (0-100)
        fn _calculate_leverage_risk_score(self: @ContractState, leverage_ratio: u256) -> u8 {
            let max_leverage = self.max_leverage.read();
            if leverage_ratio >= max_leverage {
                return 100;
            }

            // Linear scaling: 1x = 0 points, max_leverage = 100 points
            let risk_ratio = leverage_ratio * 100 / max_leverage;
            if risk_ratio > 100 { 100 } else { risk_ratio.try_into().unwrap() }
        }

        /// Calculate liquidity risk score (0-100)
        fn _calculate_liquidity_risk_score(self: @ContractState, liquidity_ratio: u256) -> u8 {
            let min_liquidity = self.min_liquidity_ratio.read();
            if liquidity_ratio <= min_liquidity {
                return 100;
            }

            // Inverse scaling: high liquidity = low risk
            let risk_ratio = (1000000000000000000 - liquidity_ratio) * 100 / (1000000000000000000 - min_liquidity);
            if risk_ratio > 100 { 100 } else { risk_ratio.try_into().unwrap() }
        }

        /// Calculate drawdown risk score (0-100)
        fn _calculate_drawdown_risk_score(self: @ContractState, drawdown_bps: u16) -> u8 {
            let max_drawdown = self.max_drawdown_bps.read();
            if drawdown_bps >= max_drawdown {
                return 100;
            }

            // Linear scaling
            let risk_ratio: u8 = ((drawdown_bps.into() * 100_u256) / max_drawdown.into()).try_into().unwrap();
            if risk_ratio > 100 { 100 } else { risk_ratio.try_into().unwrap() }
        }

        /// Get risk level from score
        fn _get_risk_level_from_score(self: @ContractState, score: u8) -> RiskLevel {
            if score <= 40 {
                RiskLevel::Low
            } else if score <= 60 {
                RiskLevel::Medium
            } else if score <= 80 {
                RiskLevel::High
            } else {
                RiskLevel::Critical
            }
        }

        /// Check if risk levels are different
        fn _risk_levels_different(self: @ContractState, level1: RiskLevel, level2: RiskLevel) -> bool {
            match (level1, level2) {
                (RiskLevel::Low, RiskLevel::Low) => false,
                (RiskLevel::Medium, RiskLevel::Medium) => false,
                (RiskLevel::High, RiskLevel::High) => false,
                (RiskLevel::Critical, RiskLevel::Critical) => false,
                _ => true,
            }
        }

        /// Check price drop circuit breaker trigger
        fn _check_price_drop_trigger(self: @ContractState, current_time: u64) -> bool {
            let timeframe = self.price_drop_timeframe.read();
            let threshold_bps = self.price_drop_threshold_bps.read();

            let start_time = current_time - timeframe;
            let start_price = self.price_history.read(start_time);
            let current_price = self.price_history.read(current_time);

            if start_price == 0 || current_price == 0 {
                return false; // Not enough data
            }

            if current_price < start_price {
                let price_drop = start_price - current_price;
                let drop_bps = price_drop * 10000 / start_price;
                drop_bps >= threshold_bps.into()
            } else {
                false
            }
        }

        /// Check IV spike circuit breaker trigger
        fn _check_iv_spike_trigger(self: @ContractState) -> bool {
            // In production, would fetch current IV and compare to historical average
            // Simplified: assume no IV spike
            false
        }

        /// Check liquidity circuit breaker trigger
        fn _check_liquidity_trigger(self: @ContractState) -> bool {
            let metrics = self.current_risk_metrics.read();
            let min_threshold = self.min_liquidity_threshold.read();
            metrics.liquidity_ratio < min_threshold
        }

        /// Activate circuit breaker internal
        fn _activate_circuit_breaker_internal(ref self: ContractState, reason: felt252) {
            let current_time = get_block_timestamp();

            self.circuit_breaker_active.write(true);
            self.circuit_breaker_reason.write(reason);
            self.circuit_breaker_timestamp.write(current_time);

            self.emit(CircuitBreakerTriggered {
                trigger_type: reason,
                trigger_value: 0, // Would be actual trigger value in production
                threshold: 0,     // Would be actual threshold in production
                timestamp: current_time,
            });
        }

        /// Pause new deposits (placeholder)
        fn _pause_new_deposits(self: @ContractState) {
            // In production, would call vault to pause deposits
        }

        /// Increase rebalancing frequency (placeholder)
        fn _increase_rebalancing_frequency(self: @ContractState) {
            // In production, would call rebalancing engine to increase frequency
        }

        /// Activate emergency mode (placeholder)
        fn _activate_emergency_mode(self: @ContractState) {
            // In production, would:
            // 1. Pause all operations
            // 2. Close risky positions
            // 3. Increase collateral
            // 4. Notify administrators
        }
    }
}
