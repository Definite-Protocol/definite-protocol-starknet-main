use starknet::ContractAddress;
use starknet::storage::{
    Map, StoragePointerReadAccess, StoragePointerWriteAccess,
    StorageMapReadAccess, StorageMapWriteAccess
};
use core::integer::i256;

/// Option position data
#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct OptionPosition {
    /// Option ID from Carmine AMM
    pub option_id: u256,
    /// Strike price in 8 decimals
    pub strike: u256,
    /// Expiry timestamp
    pub expiry: u64,
    /// Quantity of options sold
    pub quantity: u256,
    /// Premium collected per option
    pub premium_collected: u256,
    /// Option delta
    pub delta: i256,
    /// Option gamma
    pub gamma: u256,
    /// Option vega
    pub vega: i256,
    /// Position timestamp
    pub timestamp: u64,
    /// Position status
    pub active: bool,
}

/// Greeks summary for portfolio
#[derive(Drop, Serde, Copy)]
pub struct GreeksSummary {
    /// Total portfolio delta
    pub total_delta: i256,
    /// Total portfolio gamma
    pub total_gamma: u256,
    /// Total portfolio vega
    pub total_vega: i256,
    /// Total portfolio theta
    pub total_theta: i256,
}

#[starknet::interface]
pub trait IOptionsStrategy<TContractState> {
    /// Execute volatility selling strategy when IV > threshold
    fn execute_vol_selling(ref self: TContractState, strike_offset_bps: u16) -> u32;
    
    /// Hedge option delta with perpetuals
    fn hedge_option_delta(ref self: TContractState, position_id: u32);
    
    /// Update option Greeks for all positions
    fn update_option_greeks(ref self: TContractState);
    
    /// Manage expiring options (close if ITM, let expire if OTM)
    fn manage_expiries(ref self: TContractState);
    
    /// Close option position early
    fn close_option_position(ref self: TContractState, position_id: u32) -> i256;
    
    /// Get option position data
    fn get_option_position(self: @ContractState, position_id: u32) -> OptionPosition;
    
    /// Get portfolio Greeks summary
    fn get_portfolio_greeks(self: @ContractState) -> GreeksSummary;
    
    /// Get implied volatility threshold
    fn get_iv_threshold(self: @ContractState) -> u256;
    
    /// Set implied volatility threshold
    fn set_iv_threshold(ref self: TContractState, threshold: u256);
    
    /// Set maximum vega limit
    fn set_max_vega_limit(ref self: TContractState, limit: u256);
    
    /// Set target delta range
    fn set_target_delta_range(ref self: TContractState, min_delta: i256, max_delta: i256);
    
    /// Check if strategy should execute
    fn should_execute_strategy(self: @ContractState) -> bool;
    
    /// Emergency close all options
    fn emergency_close_all_options(ref self: TContractState);
}

#[starknet::contract]
pub mod OptionsStrategy {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp, get_contract_address};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess,
        StoragePointerReadAccess, StoragePointerWriteAccess
    };
    use core::num::traits::Zero;
    use core::integer::i256;
    use super::{OptionPosition, GreeksSummary};
    use crate::oracle::price_oracle::{IPriceOracleDispatcher, IPriceOracleDispatcherTrait};

    #[storage]
    struct Storage {
        owner: ContractAddress,
        /// Position ID counter
        next_position_id: u32,
        /// Position ID -> Option position data
        option_positions: Map<u32, OptionPosition>,
        /// Active positions count
        active_positions_count: u32,
        /// Implied volatility threshold (6000 = 60%)
        iv_threshold: u256,
        /// Maximum vega exposure limit
        max_vega_limit: u256,
        /// Target delta range for options
        target_delta_min: i256,
        target_delta_max: i256,
        /// Contract addresses
        protocol_vault: ContractAddress,
        price_oracle: ContractAddress,
        carmine_amm: ContractAddress,
        perpetual_hedge: ContractAddress,
        strk_token: ContractAddress,
        /// Portfolio Greeks tracking
        portfolio_delta: i256,
        portfolio_gamma: u256,
        portfolio_vega: i256,
        portfolio_theta: i256,
        /// Strategy parameters
        min_time_to_expiry: u64, // Minimum 7 days
        max_time_to_expiry: u64, // Maximum 30 days
        strike_offset_bps: u16,  // 10% OTM default
        /// Emergency state
        emergency_mode: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        /// Emitted when option position is opened
        OptionPositionOpened: OptionPositionOpened,
        /// Emitted when option position is closed
        OptionPositionClosed: OptionPositionClosed,
        /// Emitted when option delta is hedged
        OptionDeltaHedged: OptionDeltaHedged,
        /// Emitted when Greeks are updated
        GreeksUpdated: GreeksUpdated,
        /// Emitted when expiry management is executed
        ExpiryManaged: ExpiryManaged,
        /// Emitted when volatility selling is executed
        VolatilitySelling: VolatilitySelling,
        /// Emitted when emergency mode is activated
        EmergencyModeActivated: EmergencyModeActivated,
        /// Emitted when strategy parameters are updated
        StrategyParametersUpdated: StrategyParametersUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct OptionPositionOpened {
        #[key]
        pub position_id: u32,
        pub option_id: u256,
        pub strike: u256,
        pub expiry: u64,
        pub quantity: u256,
        pub premium_collected: u256,
        pub implied_volatility: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct OptionPositionClosed {
        #[key]
        pub position_id: u32,
        pub pnl: i256,
        pub reason: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct OptionDeltaHedged {
        #[key]
        pub position_id: u32,
        pub delta_hedged: i256,
        pub hedge_size: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct GreeksUpdated {
        pub portfolio_delta: i256,
        pub portfolio_gamma: u256,
        pub portfolio_vega: i256,
        pub portfolio_theta: i256,
    }

    #[derive(Drop, starknet::Event)]
    struct ExpiryManaged {
        pub positions_closed: u32,
        pub positions_expired: u32,
        pub total_pnl: i256,
    }

    #[derive(Drop, starknet::Event)]
    struct VolatilitySelling {
        pub positions_opened: u32,
        pub total_premium: u256,
        pub average_iv: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct EmergencyModeActivated {
        pub reason: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct StrategyParametersUpdated {
        pub parameter: felt252,
        pub old_value: u256,
        pub new_value: u256,
    }

    mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'OptStrategy: zero address';
        pub const POSITION_NOT_FOUND: felt252 = 'OptStrategy: position not found';
        pub const POSITION_INACTIVE: felt252 = 'OptStrategy: position inactive';
        pub const EMERGENCY_MODE: felt252 = 'OptStrategy: emergency mode';
        pub const UNAUTHORIZED_CALLER: felt252 = 'OptStrategy: unauthorized caller';
        pub const INVALID_THRESHOLD: felt252 = 'OptStrategy: invalid threshold';
        pub const VEGA_LIMIT_EXCEEDED: felt252 = 'OptStrategy: vega limit exceeded';
        pub const INVALID_STRIKE_OFFSET: felt252 = 'OptStrategy: invalid strike offset';
        pub const INSUFFICIENT_LIQUIDITY: felt252 = 'OptStrategy: insufficient liquidity';
        pub const INVALID_EXPIRY: felt252 = 'OptStrategy: invalid expiry';
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        protocol_vault: ContractAddress,
        price_oracle: ContractAddress,
        carmine_amm: ContractAddress,
        perpetual_hedge: ContractAddress,
        strk_token: ContractAddress,
    ) {
        self.owner.write(owner);
        
        // Validate addresses
        assert(!protocol_vault.is_zero(), Errors::ZERO_ADDRESS);
        assert(!price_oracle.is_zero(), Errors::ZERO_ADDRESS);
        assert(!carmine_amm.is_zero(), Errors::ZERO_ADDRESS);
        assert(!strk_token.is_zero(), Errors::ZERO_ADDRESS);
        
        // Set contract addresses
        self.protocol_vault.write(protocol_vault);
        self.price_oracle.write(price_oracle);
        self.carmine_amm.write(carmine_amm);
        self.perpetual_hedge.write(perpetual_hedge);
        self.strk_token.write(strk_token);
        
        // Initialize parameters
        self.next_position_id.write(1);
        self.iv_threshold.write(6000); // 60% IV threshold
        self.max_vega_limit.write(1000000000000000000000); // 1000 STRK vega limit
        self.target_delta_min.write(300000000000000000); // 0.3
        self.target_delta_max.write(500000000000000000); // 0.5
        self.min_time_to_expiry.write(7 * 24 * 3600); // 7 days
        self.max_time_to_expiry.write(30 * 24 * 3600); // 30 days
        self.strike_offset_bps.write(1000); // 10% OTM
        self.emergency_mode.write(false);
        
        // Initialize portfolio Greeks
        self.portfolio_delta.write(0);
        self.portfolio_gamma.write(0);
        self.portfolio_vega.write(0);
        self.portfolio_theta.write(0);
    }

    #[abi(embed_v0)]
    impl OptionsStrategyImpl of super::IOptionsStrategy<ContractState> {
        fn execute_vol_selling(ref self: ContractState, strike_offset_bps: u16) -> u32 {
            self._assert_not_emergency();
            self._assert_authorized_caller();
            assert(strike_offset_bps <= 2000, Errors::INVALID_STRIKE_OFFSET); // Max 20% OTM

            // Check if IV is above threshold
            let current_iv = self._get_current_implied_volatility();
            assert(current_iv >= self.iv_threshold.read(), 'OptStrategy: IV below threshold');

            // Get current STRK price
            let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
            let strk_token = self.strk_token.read();
            let price_data = oracle.get_price(strk_token);
            let current_price = price_data.price;

            // Calculate strike price (10% OTM put)
            let strike_price = current_price * (10000 - strike_offset_bps.into()) / 10000;

            // Calculate expiry (14 days from now)
            let expiry = get_block_timestamp() + 14 * 24 * 3600;

            // Check vega limit before opening position
            let estimated_vega = self._estimate_option_vega(strike_price, expiry, current_price);
            let current_vega: u256 = if self.portfolio_vega.read() >= 0 {
                self.portfolio_vega.read().try_into().unwrap()
            } else {
                0
            };
            assert(current_vega + estimated_vega <= self.max_vega_limit.read(), Errors::VEGA_LIMIT_EXCEEDED);

            // Calculate position size (based on available capital and risk limits)
            let position_size = self._calculate_optimal_position_size(strike_price, current_price);

            // Execute option sale on Carmine AMM
            let option_id = self._sell_put_option(strike_price, expiry, position_size);
            let premium_collected = self._get_option_premium(option_id, position_size);

            // Calculate Greeks for the new position
            let (delta, gamma, vega, theta) = self._calculate_option_greeks(
                strike_price, expiry, current_price, position_size
            );

            // Create position record
            let position_id = self.next_position_id.read();
            let position = OptionPosition {
                option_id,
                strike: strike_price,
                expiry,
                quantity: position_size,
                premium_collected,
                delta,
                gamma,
                vega,
                timestamp: get_block_timestamp(),
                active: true,
            };

            // Store position
            self.option_positions.write(position_id, position);
            self.next_position_id.write(position_id + 1);
            self.active_positions_count.write(self.active_positions_count.read() + 1);

            // Update portfolio Greeks
            self._update_portfolio_greeks_internal();

            self.emit(OptionPositionOpened {
                position_id,
                option_id,
                strike: strike_price,
                expiry,
                quantity: position_size,
                premium_collected,
                implied_volatility: current_iv,
            });

            // Hedge the delta exposure
            self.hedge_option_delta(position_id);

            position_id
        }

        fn hedge_option_delta(ref self: ContractState, position_id: u32) {
            let position = self.option_positions.read(position_id);
            assert(position.active, Errors::POSITION_INACTIVE);

            // For put options, delta is negative, so we need to hedge with long exposure
            // But since we're selling puts, we receive positive delta exposure
            let delta_to_hedge = position.delta * position.quantity.try_into().unwrap() / 1000000000000000000;

            if delta_to_hedge != 0 {
                // Calculate hedge size in STRK
                let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
                let strk_token = self.strk_token.read();
                let price_data = oracle.get_price(strk_token);
                let current_price = price_data.price;

                let hedge_size: u256 = if delta_to_hedge > 0 {
                    (delta_to_hedge * current_price.try_into().unwrap() / 100000000).try_into().unwrap()
                } else {
                    ((-delta_to_hedge) * current_price.try_into().unwrap() / 100000000).try_into().unwrap()
                };

                // Execute hedge through perpetual hedge contract
                // In production, this would call the actual perpetual hedge contract
                self._execute_delta_hedge(delta_to_hedge, hedge_size);

                self.emit(OptionDeltaHedged {
                    position_id,
                    delta_hedged: delta_to_hedge,
                    hedge_size,
                });
            }
        }

        fn update_option_greeks(ref self: ContractState) {
            let mut position_id = 1;
            let next_id = self.next_position_id.read();

            while position_id < next_id {
                let mut position = self.option_positions.read(position_id);
                if position.active {
                    // Get current price
                    let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
                    let strk_token = self.strk_token.read();
                    let price_data = oracle.get_price(strk_token);
                    let current_price = price_data.price;

                    // Recalculate Greeks
                    let (delta, gamma, vega, theta) = self._calculate_option_greeks(
                        position.strike, position.expiry, current_price, position.quantity
                    );

                    // Update position
                    position.delta = delta;
                    position.gamma = gamma;
                    position.vega = vega;
                    self.option_positions.write(position_id, position);
                }
                position_id += 1;
            };

            // Update portfolio Greeks
            self._update_portfolio_greeks_internal();
        }

        fn manage_expiries(ref self: ContractState) {
            let current_time = get_block_timestamp();
            let mut positions_closed = 0;
            let mut positions_expired = 0;
            let mut total_pnl: i256 = 0;

            let mut position_id = 1;
            let next_id = self.next_position_id.read();

            while position_id < next_id {
                let position = self.option_positions.read(position_id);
                if position.active {
                    let time_to_expiry = if position.expiry > current_time {
                        position.expiry - current_time
                    } else {
                        0
                    };

                    // Close positions with less than 24 hours to expiry if ITM
                    if time_to_expiry < 24 * 3600 {
                        let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
                        let strk_token = self.strk_token.read();
                        let price_data = oracle.get_price(strk_token);
                        let current_price = price_data.price;

                        // For put options, ITM when current_price < strike
                        if current_price < position.strike {
                            // Close ITM position to avoid assignment
                            let pnl = self.close_option_position(position_id);
                            total_pnl += pnl;
                            positions_closed += 1;
                        } else {
                            // Let OTM position expire worthlessly (keep premium)
                            let mut expired_position = position;
                            expired_position.active = false;
                            self.option_positions.write(position_id, expired_position);
                            self.active_positions_count.write(self.active_positions_count.read() - 1);

                            total_pnl += position.premium_collected.try_into().unwrap();
                            positions_expired += 1;
                        }
                    }
                }
                position_id += 1;
            };

            if positions_closed > 0 || positions_expired > 0 {
                // Update portfolio Greeks after expiry management
                self._update_portfolio_greeks_internal();

                self.emit(ExpiryManaged {
                    positions_closed,
                    positions_expired,
                    total_pnl,
                });
            }
        }

        fn close_option_position(ref self: ContractState, position_id: u32) -> i256 {
            self._assert_authorized_caller();

            let mut position = self.option_positions.read(position_id);
            assert(position.active, Errors::POSITION_INACTIVE);

            // Buy back the option to close the short position
            let buyback_cost = self._buy_back_option(position.option_id, position.quantity);

            // Calculate PnL (premium collected - buyback cost)
            let pnl = position.premium_collected.try_into().unwrap() - buyback_cost.try_into().unwrap();

            // Close position
            position.active = false;
            self.option_positions.write(position_id, position);
            self.active_positions_count.write(self.active_positions_count.read() - 1);

            // Update portfolio Greeks
            self._update_portfolio_greeks_internal();

            self.emit(OptionPositionClosed {
                position_id,
                pnl,
                reason: 'manual_close',
            });

            pnl
        }

        fn get_option_position(self: @ContractState, position_id: u32) -> OptionPosition {
            self.option_positions.read(position_id)
        }

        fn get_portfolio_greeks(self: @ContractState) -> GreeksSummary {
            GreeksSummary {
                total_delta: self.portfolio_delta.read(),
                total_gamma: self.portfolio_gamma.read(),
                total_vega: self.portfolio_vega.read(),
                total_theta: self.portfolio_theta.read(),
            }
        }

        fn get_iv_threshold(self: @ContractState) -> u256 {
            self.iv_threshold.read()
        }

        fn set_iv_threshold(ref self: ContractState, threshold: u256) {
            self._check_owner();
            assert(threshold >= 2000 && threshold <= 15000, Errors::INVALID_THRESHOLD); // 20% to 150%

            let old_value = self.iv_threshold.read();
            self.iv_threshold.write(threshold);

            self.emit(StrategyParametersUpdated {
                parameter: 'iv_threshold',
                old_value,
                new_value: threshold,
            });
        }

        fn set_max_vega_limit(ref self: ContractState, limit: u256) {
            self._check_owner();
            let old_value = self.max_vega_limit.read();
            self.max_vega_limit.write(limit);

            self.emit(StrategyParametersUpdated {
                parameter: 'max_vega_limit',
                old_value,
                new_value: limit,
            });
        }

        fn set_target_delta_range(ref self: ContractState, min_delta: i256, max_delta: i256) {
            self._check_owner();
            assert(min_delta < max_delta, 'OptStrategy: invalid delta range');

            self.target_delta_min.write(min_delta);
            self.target_delta_max.write(max_delta);
        }

        fn should_execute_strategy(self: @ContractState) -> bool {
            if self.emergency_mode.read() {
                return false;
            }

            let current_iv = self._get_current_implied_volatility();
            let iv_threshold = self.iv_threshold.read();

            // Check if IV is above threshold and vega limit allows new positions
            let current_vega: u256 = if self.portfolio_vega.read() >= 0 {
                self.portfolio_vega.read().try_into().unwrap()
            } else {
                0
            };

            current_iv >= iv_threshold && current_vega < self.max_vega_limit.read() * 80 / 100 // 80% of limit
        }

        fn emergency_close_all_options(ref self: ContractState) {
            self._check_owner();
            self.emergency_mode.write(true);

            let mut position_id = 1;
            let next_id = self.next_position_id.read();

            while position_id < next_id {
                let position = self.option_positions.read(position_id);
                if position.active {
                    self.close_option_position(position_id);
                }
                position_id += 1;
            };

            self.emit(EmergencyModeActivated {
                reason: 'manual_emergency_close',
                timestamp: get_block_timestamp(),
            });
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
        /// Assert not in emergency mode
        fn _assert_not_emergency(self: @ContractState) {
            assert(!self.emergency_mode.read(), Errors::EMERGENCY_MODE);
        }

        /// Assert caller is authorized (vault or owner)
        fn _assert_authorized_caller(self: @ContractState) {
            let caller = get_caller_address();
            let vault = self.protocol_vault.read();
            let owner = self.ownable.owner();
            assert(caller == vault || caller == owner, Errors::UNAUTHORIZED_CALLER);
        }

        /// Get current implied volatility (placeholder for Carmine integration)
        fn _get_current_implied_volatility(self: @ContractState) -> u256 {
            // In production, this would fetch IV from Carmine AMM
            // Simulating high IV scenario (65%)
            6500
        }

        /// Estimate option vega for position sizing
        fn _estimate_option_vega(
            self: @ContractState,
            strike: u256,
            expiry: u64,
            current_price: u256,
        ) -> u256 {
            // Simplified vega estimation
            // In production, would use Black-Scholes or Carmine's pricing model
            let time_to_expiry = expiry - get_block_timestamp();
            let time_factor = time_to_expiry * 1000000000000000000 / (365 * 24 * 3600); // Annualized

            // Vega is highest for ATM options
            let moneyness = if current_price > strike {
                current_price - strike
            } else {
                strike - current_price
            };

            let vega_factor = 1000000000000000000 - (moneyness * 1000000000000000000 / current_price);
            vega_factor * time_factor / 1000000000000000000
        }

        /// Calculate optimal position size based on risk limits
        fn _calculate_optimal_position_size(self: @ContractState, strike: u256, current_price: u256) -> u256 {
            // Simple position sizing: 1% of vault TVL
            // In production, would use more sophisticated risk models
            100000000000000000000 // 100 STRK equivalent
        }

        /// Sell put option on Carmine AMM (placeholder)
        fn _sell_put_option(self: @ContractState, strike: u256, expiry: u64, quantity: u256) -> u256 {
            // In production, this would integrate with Carmine AMM
            // Return mock option ID
            12345
        }

        /// Get option premium for position (placeholder)
        fn _get_option_premium(self: @ContractState, option_id: u256, quantity: u256) -> u256 {
            // In production, would fetch from Carmine AMM
            // Simulating 2% premium
            quantity * 2 / 100
        }

        /// Calculate option Greeks using simplified Black-Scholes
        fn _calculate_option_greeks(
            self: @ContractState,
            strike: u256,
            expiry: u64,
            current_price: u256,
            quantity: u256,
        ) -> (i256, u256, i256, i256) {
            // Simplified Greeks calculation
            // In production, would use proper Black-Scholes or fetch from Carmine

            let time_to_expiry = expiry - get_block_timestamp();
            let time_factor = time_to_expiry * 1000000000000000000 / (365 * 24 * 3600);

            // Delta: for put options, negative and increases as price decreases
            let delta = if current_price < strike {
                -800000000000000000 // -0.8 for ITM put
            } else {
                -300000000000000000 // -0.3 for OTM put
            };

            // Gamma: highest for ATM options
            let gamma = if current_price > strike * 95 / 100 && current_price < strike * 105 / 100 {
                50000000000000000 // 0.05 for ATM
            } else {
                20000000000000000 // 0.02 for OTM/ITM
            };

            // Vega: positive for long options, negative for short
            let vega = -(time_factor * 100000000000000000 / 1000000000000000000); // Negative for short

            // Theta: time decay, negative for long options, positive for short
            let theta = quantity.try_into().unwrap() * 10000000000000000 / time_factor.try_into().unwrap(); // Positive for short

            (delta, gamma, vega, theta)
        }

        /// Update portfolio Greeks by summing all active positions
        fn _update_portfolio_greeks_internal(ref self: ContractState) {
            let mut total_delta: i256 = 0;
            let mut total_gamma: u256 = 0;
            let mut total_vega: i256 = 0;
            let mut total_theta: i256 = 0;

            let mut position_id = 1;
            let next_id = self.next_position_id.read();

            while position_id < next_id {
                let position = self.option_positions.read(position_id);
                if position.active {
                    total_delta += position.delta * position.quantity.try_into().unwrap() / 1000000000000000000;
                    total_gamma += position.gamma * position.quantity / 1000000000000000000;
                    total_vega += position.vega * position.quantity.try_into().unwrap() / 1000000000000000000;
                    // Theta calculation would be similar
                }
                position_id += 1;
            };

            // Update storage
            self.portfolio_delta.write(total_delta);
            self.portfolio_gamma.write(total_gamma);
            self.portfolio_vega.write(total_vega);
            self.portfolio_theta.write(total_theta);

            self.emit(GreeksUpdated {
                portfolio_delta: total_delta,
                portfolio_gamma: total_gamma,
                portfolio_vega: total_vega,
                portfolio_theta: total_theta,
            });
        }

        /// Execute delta hedge through perpetual hedge contract
        fn _execute_delta_hedge(self: @ContractState, delta: i256, hedge_size: u256) {
            // In production, this would call the perpetual hedge contract
            // to open/close positions to hedge the delta exposure
        }

        /// Buy back option to close short position (placeholder)
        fn _buy_back_option(self: @ContractState, option_id: u256, quantity: u256) -> u256 {
            // In production, would integrate with Carmine AMM
            // Simulating buyback cost (could be higher or lower than premium collected)
            quantity * 15 / 1000 // 1.5% cost
        }
    }
}
