use starknet::ContractAddress;
use starknet::storage::{
    Map, StoragePointerReadAccess, StoragePointerWriteAccess,
    StorageMapReadAccess, StorageMapWriteAccess
};
use core::integer::{i256, u256};

/// Rebalancing action data
#[derive(Drop, Serde, Copy)]
pub struct RebalancingAction {
    /// Action type: 'open_short', 'close_short', 'adjust_size', 'hedge_delta'
    pub action_type: felt252,
    /// Target contract address
    pub target_contract: ContractAddress,
    /// Action amount
    pub amount: u256,
    /// Additional parameters (encoded)
    pub parameters: u256,
}

/// Delta exposure summary
#[derive(Drop, Serde, Copy)]
pub struct DeltaExposure {
    /// Long exposure from vault assets
    pub long_exposure: u256,
    /// Short exposure from perpetuals
    pub short_exposure: u256,
    /// Options delta exposure
    pub options_delta: i256,
    /// Net delta (target should be 0)
    pub net_delta: i256,
    /// Delta deviation from target
    pub delta_deviation: u256,
}

/// Rebalancing execution result
#[derive(Drop, Serde, Copy)]
pub struct RebalancingResult {
    /// Number of actions executed
    pub actions_executed: u32,
    /// Total gas used
    pub gas_used: u256,
    /// Success status
    pub success: bool,
    /// Error message if failed
    pub error_message: felt252,
    /// Execution timestamp
    pub timestamp: u64,
}

#[starknet::interface]
pub trait IRebalancingEngine<TContractState> {
    /// Check if rebalancing is needed
    fn check_rebalancing_needed(self: @TContractState) -> bool;
    
    /// Calculate required rebalancing actions
    fn calculate_rebalancing_actions(self: @TContractState) -> Array<RebalancingAction>;
    
    /// Execute rebalancing (keeper function)
    fn perform_upkeep(ref self: TContractState) -> RebalancingResult;
    
    /// Manual rebalancing trigger
    fn manual_rebalance(ref self: TContractState) -> RebalancingResult;
    
    /// Get current delta exposure
    fn get_delta_exposure(self: @TContractState) -> DeltaExposure;
    
    /// Set rebalancing parameters
    fn set_rebalancing_params(
        ref self: TContractState,
        check_interval: u64,
        execution_threshold: u256,
        max_slippage_bps: u16,
    );
    
    /// Set keeper reward
    fn set_keeper_reward(ref self: TContractState, reward_bps: u16);
    
    /// Add authorized keeper
    fn add_keeper(ref self: TContractState, keeper: ContractAddress);
    
    /// Remove authorized keeper
    fn remove_keeper(ref self: TContractState, keeper: ContractAddress);
    
    /// Check if address is authorized keeper
    fn is_authorized_keeper(self: @TContractState, keeper: ContractAddress) -> bool;
    
    /// Get last rebalancing timestamp
    fn get_last_rebalancing(self: @TContractState) -> u64;
    
    /// Emergency pause rebalancing
    fn pause_rebalancing(ref self: TContractState);
    
    /// Resume rebalancing
    fn resume_rebalancing(ref self: TContractState);
    
    /// Check if rebalancing is paused
    fn is_paused(self: @TContractState) -> bool;
}

#[starknet::contract]
pub mod RebalancingEngine {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp, get_contract_address};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess,
        StoragePointerReadAccess, StoragePointerWriteAccess
    };
    use core::num::traits::Zero;
    use core::integer::{i256, u256};
    use super::{RebalancingAction, DeltaExposure, RebalancingResult};
    use crate::oracle::price_oracle::{IPriceOracleDispatcher, IPriceOracleDispatcherTrait};

    #[storage]
    struct Storage {
        owner: ContractAddress,
        /// Rebalancing parameters
        check_interval: u64,           // Default: 300 seconds (5 minutes)
        execution_threshold: u256,     // Default: 0.1 (10% delta deviation)
        max_slippage_bps: u16,        // Default: 100 (1%)
        keeper_reward_bps: u16,       // Default: 10 (0.1%)
        /// State tracking
        last_check_timestamp: u64,
        last_rebalancing_timestamp: u64,
        total_rebalancings: u32,
        paused: bool,
        /// Authorized keepers
        authorized_keepers: Map<ContractAddress, bool>,
        keepers_count: u32,
        /// Contract addresses
        protocol_vault: ContractAddress,
        price_oracle: ContractAddress,
        perpetual_hedge: ContractAddress,
        options_strategy: ContractAddress,
        risk_manager: ContractAddress,
        strk_token: ContractAddress,
        /// Delta tracking
        target_delta: i256,           // Should be 0 for delta-neutral
        last_calculated_delta: i256,
        delta_history: Map<u64, i256>, // timestamp -> delta
        /// Performance tracking
        total_gas_used: u256,
        successful_rebalancings: u32,
        failed_rebalancings: u32,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        /// Emitted when rebalancing is executed
        RebalancingExecuted: RebalancingExecuted,
        /// Emitted when rebalancing check is performed
        RebalancingCheck: RebalancingCheck,
        /// Emitted when keeper reward is paid
        KeeperRewardPaid: KeeperRewardPaid,
        /// Emitted when rebalancing parameters are updated
        RebalancingParamsUpdated: RebalancingParamsUpdated,
        /// Emitted when keeper is added/removed
        KeeperUpdated: KeeperUpdated,
        /// Emitted when rebalancing is paused/resumed
        RebalancingPauseStateChanged: RebalancingPauseStateChanged,
        /// Emitted when delta exposure is updated
        DeltaExposureUpdated: DeltaExposureUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct RebalancingExecuted {
        #[key]
        pub keeper: ContractAddress,
        pub actions_executed: u32,
        pub gas_used: u256,
        pub keeper_reward: u256,
        pub old_delta: i256,
        pub new_delta: i256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct RebalancingCheck {
        pub rebalancing_needed: bool,
        pub delta_deviation: u256,
        pub threshold: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct KeeperRewardPaid {
        #[key]
        pub keeper: ContractAddress,
        pub reward_amount: u256,
        pub reward_bps: u16,
    }

    #[derive(Drop, starknet::Event)]
    struct RebalancingParamsUpdated {
        pub parameter: felt252,
        pub old_value: u256,
        pub new_value: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct KeeperUpdated {
        #[key]
        pub keeper: ContractAddress,
        pub authorized: bool,
    }

    #[derive(Drop, starknet::Event)]
    struct RebalancingPauseStateChanged {
        pub paused: bool,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct DeltaExposureUpdated {
        pub long_exposure: u256,
        pub short_exposure: u256,
        pub options_delta: i256,
        pub net_delta: i256,
        pub delta_deviation: u256,
    }

    mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'RebalEngine: zero address';
        pub const PAUSED: felt252 = 'RebalEngine: paused';
        pub const UNAUTHORIZED_KEEPER: felt252 = 'RebalEngine: unauthorized';
        pub const REBALANCING_NOT_NEEDED: felt252 = 'RebalEngine: not needed';
        pub const INVALID_PARAMETER: felt252 = 'RebalEngine: invalid parameter';
        pub const KEEPER_EXISTS: felt252 = 'RebalEngine: keeper exists';
        pub const KEEPER_NOT_FOUND: felt252 = 'RebalEngine: keeper not found';
        pub const TOO_SOON: felt252 = 'RebalEngine: too soon';
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        protocol_vault: ContractAddress,
        price_oracle: ContractAddress,
        perpetual_hedge: ContractAddress,
        options_strategy: ContractAddress,
        risk_manager: ContractAddress,
        strk_token: ContractAddress,
    ) {
        self.owner.write(owner);
        
        // Validate addresses
        assert(!protocol_vault.is_zero(), Errors::ZERO_ADDRESS);
        assert(!price_oracle.is_zero(), Errors::ZERO_ADDRESS);
        assert(!strk_token.is_zero(), Errors::ZERO_ADDRESS);
        
        // Set contract addresses
        self.protocol_vault.write(protocol_vault);
        self.price_oracle.write(price_oracle);
        self.perpetual_hedge.write(perpetual_hedge);
        self.options_strategy.write(options_strategy);
        self.risk_manager.write(risk_manager);
        self.strk_token.write(strk_token);
        
        // Set default parameters
        self.check_interval.write(300);        // 5 minutes
        self.execution_threshold.write(100000000000000000); // 0.1 (10%)
        self.max_slippage_bps.write(100);      // 1%
        self.keeper_reward_bps.write(10);      // 0.1%
        
        // Initialize state
        let current_time = get_block_timestamp();
        self.last_check_timestamp.write(current_time);
        self.last_rebalancing_timestamp.write(current_time);
        self.target_delta.write(0);            // Delta-neutral
        self.paused.write(false);
        self.total_rebalancings.write(0);
        self.keepers_count.write(0);
        
        // Add owner as initial keeper
        self.authorized_keepers.write(owner, true);
        self.keepers_count.write(1);
    }

    #[abi(embed_v0)]
    impl RebalancingEngineImpl of super::IRebalancingEngine<ContractState> {
        fn check_rebalancing_needed(self: @ContractState) -> bool {
            if self.paused.read() {
                return false;
            }

            let current_time = get_block_timestamp();
            let last_check = self.last_check_timestamp.read();
            let check_interval = self.check_interval.read();

            // Check if enough time has passed since last check
            if current_time - last_check < check_interval {
                return false;
            }

            // Calculate current delta exposure
            let delta_exposure = self._calculate_delta_exposure();
            let threshold = self.execution_threshold.read();

            // Check if delta deviation exceeds threshold
            delta_exposure.delta_deviation >= threshold
        }

        fn calculate_rebalancing_actions(self: @ContractState) -> Array<RebalancingAction> {
            let mut actions = ArrayTrait::<RebalancingAction>::new();

            let delta_exposure = self._calculate_delta_exposure();
            let net_delta = delta_exposure.net_delta;
            let target_delta = self.target_delta.read();

            let delta_adjustment_needed = net_delta - target_delta;

            if delta_adjustment_needed == 0 {
                return actions;
            }

            // If we have positive delta (too much long exposure), need to add short positions
            if delta_adjustment_needed > 0 {
                let short_amount: u256 = delta_adjustment_needed.try_into().unwrap();

                // Action 1: Open short perpetual position
                let perp_action = RebalancingAction {
                    action_type: 'open_short',
                    target_contract: self.perpetual_hedge.read(),
                    amount: short_amount,
                    parameters: 0, // Could encode leverage, slippage, etc.
                };
                actions.append(perp_action);

            } else {
                // If we have negative delta (too much short exposure), need to reduce shorts
                let reduce_amount: u256 = (-delta_adjustment_needed).try_into().unwrap();

                // Action 1: Close some short perpetual positions
                let perp_action = RebalancingAction {
                    action_type: 'close_short',
                    target_contract: self.perpetual_hedge.read(),
                    amount: reduce_amount,
                    parameters: 0,
                };
                actions.append(perp_action);
            }

            // Action 2: Hedge options delta if needed
            if delta_exposure.options_delta != 0 {
                let options_hedge_action = RebalancingAction {
                    action_type: 'hedge_delta',
                    target_contract: self.options_strategy.read(),
                    amount: if delta_exposure.options_delta > 0 {
                        delta_exposure.options_delta.try_into().unwrap()
                    } else {
                        (-delta_exposure.options_delta).try_into().unwrap()
                    },
                    parameters: if delta_exposure.options_delta > 0 { 1 } else { 0 }, // 1 = hedge positive delta, 0 = hedge negative delta
                };
                actions.append(options_hedge_action);
            }

            actions
        }

        fn perform_upkeep(ref self: ContractState) -> RebalancingResult {
            self._assert_not_paused();
            self._assert_authorized_keeper();

            let current_time = get_block_timestamp();
            let keeper = get_caller_address();

            // Check if rebalancing is actually needed
            if !self.check_rebalancing_needed() {
                return RebalancingResult {
                    actions_executed: 0,
                    gas_used: 0,
                    success: false,
                    error_message: Errors::REBALANCING_NOT_NEEDED,
                    timestamp: current_time,
                };
            }

            // Calculate and execute rebalancing actions
            let actions = self.calculate_rebalancing_actions();
            let actions_count = actions.len();

            if actions_count == 0 {
                return RebalancingResult {
                    actions_executed: 0,
                    gas_used: 0,
                    success: true,
                    error_message: '',
                    timestamp: current_time,
                };
            }

            // Record delta before rebalancing
            let old_delta = self.last_calculated_delta.read();

            // Execute actions
            let execution_result = self._execute_rebalancing_actions(actions);

            if execution_result.success {
                // Update state
                self.last_rebalancing_timestamp.write(current_time);
                self.total_rebalancings.write(self.total_rebalancings.read() + 1);
                self.successful_rebalancings.write(self.successful_rebalancings.read() + 1);

                // Calculate new delta
                let new_delta_exposure = self._calculate_delta_exposure();
                let new_delta = new_delta_exposure.net_delta;
                self.last_calculated_delta.write(new_delta);
                self.delta_history.write(current_time, new_delta);

                // Pay keeper reward
                let reward_amount = self._pay_keeper_reward(keeper, execution_result.gas_used);

                self.emit(RebalancingExecuted {
                    keeper,
                    actions_executed: execution_result.actions_executed,
                    gas_used: execution_result.gas_used,
                    keeper_reward: reward_amount,
                    old_delta,
                    new_delta,
                    timestamp: current_time,
                });

                self.emit(DeltaExposureUpdated {
                    long_exposure: new_delta_exposure.long_exposure,
                    short_exposure: new_delta_exposure.short_exposure,
                    options_delta: new_delta_exposure.options_delta,
                    net_delta: new_delta_exposure.net_delta,
                    delta_deviation: new_delta_exposure.delta_deviation,
                });
            } else {
                self.failed_rebalancings.write(self.failed_rebalancings.read() + 1);
            }

            // Update check timestamp
            self.last_check_timestamp.write(current_time);

            execution_result
        }

        fn manual_rebalance(ref self: ContractState) -> RebalancingResult {
            self._check_owner();
            self._assert_not_paused();

            // Force rebalancing regardless of time interval
            let current_time = get_block_timestamp();
            let actions = self.calculate_rebalancing_actions();

            if actions.len() == 0 {
                return RebalancingResult {
                    actions_executed: 0,
                    gas_used: 0,
                    success: true,
                    error_message: '',
                    timestamp: current_time,
                };
            }

            let execution_result = self._execute_rebalancing_actions(actions);

            if execution_result.success {
                self.last_rebalancing_timestamp.write(current_time);
                self.total_rebalancings.write(self.total_rebalancings.read() + 1);
                self.successful_rebalancings.write(self.successful_rebalancings.read() + 1);

                let new_delta_exposure = self._calculate_delta_exposure();
                self.last_calculated_delta.write(new_delta_exposure.net_delta);
                self.delta_history.write(current_time, new_delta_exposure.net_delta);
            } else {
                self.failed_rebalancings.write(self.failed_rebalancings.read() + 1);
            }

            execution_result
        }

        fn get_delta_exposure(self: @ContractState) -> DeltaExposure {
            self._calculate_delta_exposure()
        }

        fn set_rebalancing_params(
            ref self: ContractState,
            check_interval: u64,
            execution_threshold: u256,
            max_slippage_bps: u16,
        ) {
            self._check_owner();

            // Validate parameters
            assert(check_interval >= 60, Errors::INVALID_PARAMETER); // Min 1 minute
            assert(execution_threshold <= 500000000000000000, Errors::INVALID_PARAMETER); // Max 50%
            assert(max_slippage_bps <= 1000, Errors::INVALID_PARAMETER); // Max 10%

            // Update parameters
            let old_interval = self.check_interval.read();
            self.check_interval.write(check_interval);
            self.emit(RebalancingParamsUpdated {
                parameter: 'check_interval',
                old_value: old_interval.into(),
                new_value: check_interval.into(),
            });

            let old_threshold = self.execution_threshold.read();
            self.execution_threshold.write(execution_threshold);
            self.emit(RebalancingParamsUpdated {
                parameter: 'execution_threshold',
                old_value: old_threshold,
                new_value: execution_threshold,
            });

            let old_slippage = self.max_slippage_bps.read();
            self.max_slippage_bps.write(max_slippage_bps);
            self.emit(RebalancingParamsUpdated {
                parameter: 'max_slippage_bps',
                old_value: old_slippage.into(),
                new_value: max_slippage_bps.into(),
            });
        }

        fn set_keeper_reward(ref self: ContractState, reward_bps: u16) {
            self._check_owner();
            assert(reward_bps <= 100, Errors::INVALID_PARAMETER); // Max 1%

            let old_reward = self.keeper_reward_bps.read();
            self.keeper_reward_bps.write(reward_bps);
            self.emit(RebalancingParamsUpdated {
                parameter: 'keeper_reward_bps',
                old_value: old_reward.into(),
                new_value: reward_bps.into(),
            });
        }

        fn add_keeper(ref self: ContractState, keeper: ContractAddress) {
            self._check_owner();
            assert(!keeper.is_zero(), Errors::ZERO_ADDRESS);
            assert(!self.authorized_keepers.read(keeper), Errors::KEEPER_EXISTS);

            self.authorized_keepers.write(keeper, true);
            self.keepers_count.write(self.keepers_count.read() + 1);

            self.emit(KeeperUpdated { keeper, authorized: true });
        }

        fn remove_keeper(ref self: ContractState, keeper: ContractAddress) {
            self._check_owner();
            assert(self.authorized_keepers.read(keeper), Errors::KEEPER_NOT_FOUND);

            self.authorized_keepers.write(keeper, false);
            self.keepers_count.write(self.keepers_count.read() - 1);

            self.emit(KeeperUpdated { keeper, authorized: false });
        }

        fn is_authorized_keeper(self: @ContractState, keeper: ContractAddress) -> bool {
            self.authorized_keepers.read(keeper)
        }

        fn get_last_rebalancing(self: @ContractState) -> u64 {
            self.last_rebalancing_timestamp.read()
        }

        fn pause_rebalancing(ref self: ContractState) {
            self._check_owner();
            self.paused.write(true);
            self.emit(RebalancingPauseStateChanged {
                paused: true,
                timestamp: get_block_timestamp(),
            });
        }

        fn resume_rebalancing(ref self: ContractState) {
            self._check_owner();
            self.paused.write(false);
            self.emit(RebalancingPauseStateChanged {
                paused: false,
                timestamp: get_block_timestamp(),
            });
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
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
        /// Assert not paused
        fn _assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), Errors::PAUSED);
        }

        /// Assert caller is authorized keeper
        fn _assert_authorized_keeper(self: @ContractState) {
            let caller = get_caller_address();
            assert(self.authorized_keepers.read(caller), Errors::UNAUTHORIZED_KEEPER);
        }

        /// Calculate current delta exposure across all positions
        fn _calculate_delta_exposure(self: @ContractState) -> DeltaExposure {
            // Get vault total assets (long exposure)
            let long_exposure = self._get_vault_total_assets();

            // Get perpetual short exposure
            let short_exposure = self._get_perpetual_short_exposure();

            // Get options delta exposure
            let options_delta = self._get_options_delta_exposure();

            // Calculate net delta
            let net_delta = long_exposure.try_into().unwrap() - short_exposure.try_into().unwrap() + options_delta;

            // Calculate deviation from target
            let target_delta = self.target_delta.read();
            let delta_deviation: u256 = if net_delta > target_delta {
                (net_delta - target_delta).try_into().unwrap()
            } else {
                (target_delta - net_delta).try_into().unwrap()
            };

            DeltaExposure {
                long_exposure,
                short_exposure,
                options_delta,
                net_delta,
                delta_deviation,
            }
        }

        /// Get vault total assets (long exposure)
        fn _get_vault_total_assets(self: @ContractState) -> u256 {
            // In production, would call vault contract to get total assets
            // Simplified: assume 1M STRK
            1000000_000000000000000000
        }

        /// Get perpetual short exposure
        fn _get_perpetual_short_exposure(self: @ContractState) -> u256 {
            // In production, would call perpetual hedge contract
            // Simplified: assume 800K STRK short
            800000_000000000000000000
        }

        /// Get options delta exposure
        fn _get_options_delta_exposure(self: @ContractState) -> i256 {
            // In production, would call options strategy contract
            // Simplified: assume -50K STRK delta (negative from selling puts)
            -50000_000000000000000000
        }

        /// Execute rebalancing actions
        fn _execute_rebalancing_actions(
            self: @ContractState,
            actions: Array<RebalancingAction>
        ) -> RebalancingResult {
            let mut actions_executed = 0;
            let mut total_gas_used = 0;
            let current_time = get_block_timestamp();

            let mut i = 0;
            while i < actions.len() {
                let action = *actions.at(i);

                // Execute action based on type
                let action_success = if action.action_type == 'open_short' {
                    self._execute_open_short_action(action)
                } else if action.action_type == 'close_short' {
                    self._execute_close_short_action(action)
                } else if action.action_type == 'hedge_delta' {
                    self._execute_hedge_delta_action(action)
                } else {
                    false
                };

                if action_success {
                    actions_executed += 1;
                    total_gas_used += 50000; // Estimated gas per action
                } else {
                    // If any action fails, return failure
                    return RebalancingResult {
                        actions_executed,
                        gas_used: total_gas_used,
                        success: false,
                        error_message: 'action_execution_failed',
                        timestamp: current_time,
                    };
                }

                i += 1;
            };

            RebalancingResult {
                actions_executed,
                gas_used: total_gas_used,
                success: true,
                error_message: '',
                timestamp: current_time,
            }
        }

        /// Execute open short action
        fn _execute_open_short_action(self: @ContractState, action: RebalancingAction) -> bool {
            // In production, would call perpetual hedge contract to open short position
            // For now, return success
            true
        }

        /// Execute close short action
        fn _execute_close_short_action(self: @ContractState, action: RebalancingAction) -> bool {
            // In production, would call perpetual hedge contract to close short position
            // For now, return success
            true
        }

        /// Execute hedge delta action
        fn _execute_hedge_delta_action(self: @ContractState, action: RebalancingAction) -> bool {
            // In production, would call options strategy contract to hedge delta
            // For now, return success
            true
        }

        /// Pay keeper reward
        fn _pay_keeper_reward(ref self: ContractState, keeper: ContractAddress, gas_used: u256) -> u256 {
            let reward_bps = self.keeper_reward_bps.read();
            let vault_tvl = self._get_vault_total_assets();

            // Calculate reward as percentage of TVL
            let reward_amount = vault_tvl * reward_bps.into() / 10000;

            // In production, would transfer STRK tokens to keeper
            let strk_token = ERC20ABIDispatcher { contract_address: self.strk_token.read() };
            // strk_token.transfer(keeper, reward_amount);

            self.emit(KeeperRewardPaid {
                keeper,
                reward_amount,
                reward_bps,
            });

            reward_amount
        }
    }
}
