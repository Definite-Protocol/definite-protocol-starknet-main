use starknet::ContractAddress;
use starknet::storage::{
    Map, StoragePointerReadAccess, StoragePointerWriteAccess,
    StorageMapReadAccess, StorageMapWriteAccess
};

/// Simplified rebalancing result without i256
#[derive(Drop, Serde, Copy)]
pub struct RebalancingResult {
    pub actions_executed: u32,
    pub total_volume: u256,
    pub gas_used: u256,
    pub success: bool,
}

/// Delta exposure without signed integers
#[derive(Drop, Serde, Copy)]
pub struct DeltaExposure {
    pub long_exposure: u256,
    pub short_exposure: u256,
    pub net_delta: u256,
    pub is_net_short: bool,
}

#[starknet::interface]
trait IRebalancingEngine<TContractState> {
    /// Execute automatic rebalancing
    fn execute_rebalancing(ref self: TContractState) -> RebalancingResult;
    
    /// Manual rebalancing (owner only)
    fn manual_rebalance(ref self: TContractState) -> RebalancingResult;
    
    /// Update rebalancing parameters
    fn update_rebalancing_params(
        ref self: TContractState,
        check_interval: u64,
        execution_threshold: u256,
        max_slippage_bps: u16,
    );
    
    /// Set keeper reward
    fn set_keeper_reward(ref self: TContractState, reward_bps: u16);
    
    /// Add authorized keeper
    fn add_keeper(ref self: TContractState, keeper: ContractAddress);
    
    /// Remove keeper
    fn remove_keeper(ref self: TContractState, keeper: ContractAddress);
    
    /// Get last rebalancing timestamp
    fn get_last_rebalancing(self: @TContractState) -> u64;
    
    /// Pause rebalancing
    fn pause_rebalancing(ref self: TContractState);
    
    /// Resume rebalancing
    fn resume_rebalancing(ref self: TContractState);
    
    /// Check if rebalancing is paused
    fn is_paused(self: @TContractState) -> bool;
}

#[starknet::contract]
mod RebalancingEngine {
    use super::{RebalancingResult, DeltaExposure, IRebalancingEngine};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use core::num::traits::Zero;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        protocol_vault: ContractAddress,
        price_oracle: ContractAddress,
        perpetual_hedge: ContractAddress,
        options_strategy: ContractAddress,
        risk_manager: ContractAddress,
        strk_token: ContractAddress,
        
        // Rebalancing parameters
        check_interval: u64,              // Minimum time between checks (seconds)
        execution_threshold: u256,        // Delta threshold for execution (basis points)
        max_slippage_bps: u16,           // Maximum slippage (basis points)
        
        // Delta tracking
        target_delta: u256,              // Should be 0 for delta-neutral
        last_calculated_delta: u256,
        is_last_delta_short: bool,
        delta_history: Map<u64, u256>,   // timestamp -> delta magnitude
        
        // Execution tracking
        last_rebalancing_timestamp: u64,
        total_rebalancings: u64,
        
        // Keeper management
        authorized_keepers: Map<ContractAddress, bool>,
        keepers_count: u32,
        keeper_reward_bps: u16,          // Keeper reward (basis points)
        
        // Emergency controls
        paused: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        RebalancingExecuted: RebalancingExecuted,
        RebalancingParamsUpdated: RebalancingParamsUpdated,
        KeeperUpdated: KeeperUpdated,
        RebalancingPauseStateChanged: RebalancingPauseStateChanged,
    }

    #[derive(Drop, starknet::Event)]
    struct RebalancingExecuted {
        pub keeper: ContractAddress,
        pub actions_executed: u32,
        pub total_volume: u256,
        pub delta_before: u256,
        pub delta_after: u256,
        pub gas_used: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct RebalancingParamsUpdated {
        pub parameter: felt252,
        pub old_value: u256,
        pub new_value: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct KeeperUpdated {
        pub keeper: ContractAddress,
        pub authorized: bool,
    }

    #[derive(Drop, starknet::Event)]
    struct RebalancingPauseStateChanged {
        pub paused: bool,
        pub timestamp: u64,
    }

    mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'RebalEngine: zero address';
        pub const PAUSED: felt252 = 'RebalEngine: paused';
        pub const UNAUTHORIZED_KEEPER: felt252 = 'RebalEngine: unauthorized';
        pub const REBALANCING_NOT_NEEDED: felt252 = 'RebalEngine: not needed';
        pub const INVALID_PARAMETER: felt252 = 'RebalEngine: invalid param';
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
        
        // Initialize parameters
        self.check_interval.write(300);           // 5 minutes
        self.execution_threshold.write(500);      // 5% delta threshold
        self.max_slippage_bps.write(100);        // 1% max slippage
        self.target_delta.write(0);              // Delta-neutral
        self.keeper_reward_bps.write(10);        // 0.1% keeper reward
        self.paused.write(false);
    }

    #[abi(embed_v0)]
    impl RebalancingEngineImpl of IRebalancingEngine<ContractState> {
        fn execute_rebalancing(ref self: ContractState) -> RebalancingResult {
            self._assert_authorized_keeper();
            self._assert_not_paused();
            
            let current_time = get_block_timestamp();
            let last_rebalancing = self.last_rebalancing_timestamp.read();
            let check_interval = self.check_interval.read();
            
            // Check time interval
            assert(current_time >= last_rebalancing + check_interval, Errors::TOO_SOON);
            
            // Calculate current delta exposure
            let delta_exposure = self._calculate_delta_exposure();
            let execution_threshold = self.execution_threshold.read();
            
            // Check if rebalancing is needed
            let threshold_amount = execution_threshold * 1000000000000000000 / 10000; // Convert bps to wei
            assert(delta_exposure.net_delta >= threshold_amount, Errors::REBALANCING_NOT_NEEDED);
            
            // Execute rebalancing actions
            let result = self._execute_rebalancing_actions(delta_exposure);
            
            // Update state
            self.last_rebalancing_timestamp.write(current_time);
            self.total_rebalancings.write(self.total_rebalancings.read() + 1);
            self.last_calculated_delta.write(delta_exposure.net_delta);
            self.is_last_delta_short.write(delta_exposure.is_net_short);
            self.delta_history.write(current_time, delta_exposure.net_delta);
            
            // Emit event
            self.emit(RebalancingExecuted {
                keeper: get_caller_address(),
                actions_executed: result.actions_executed,
                total_volume: result.total_volume,
                delta_before: delta_exposure.net_delta,
                delta_after: 0, // Simplified: assume perfect rebalancing
                gas_used: result.gas_used,
            });
            
            result
        }

        fn manual_rebalance(ref self: ContractState) -> RebalancingResult {
            self._check_owner();
            self._assert_not_paused();
            
            // Force rebalancing regardless of time interval
            let current_time = get_block_timestamp();
            let delta_exposure = self._calculate_delta_exposure();
            let result = self._execute_rebalancing_actions(delta_exposure);
            
            // Update state
            self.last_rebalancing_timestamp.write(current_time);
            self.total_rebalancings.write(self.total_rebalancings.read() + 1);
            
            result
        }

        fn update_rebalancing_params(
            ref self: ContractState,
            check_interval: u64,
            execution_threshold: u256,
            max_slippage_bps: u16,
        ) {
            self._check_owner();
            
            // Validate parameters
            assert(check_interval >= 60, Errors::INVALID_PARAMETER); // Min 1 minute
            assert(execution_threshold <= 5000, Errors::INVALID_PARAMETER); // Max 50%
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
            // Simplified calculation
            let long_exposure = 1000000000000000000; // 1 STRK from vault
            let short_exposure = 800000000000000000;  // 0.8 STRK from hedging
            
            let (net_delta, is_net_short) = if short_exposure > long_exposure {
                (short_exposure - long_exposure, true)
            } else {
                (long_exposure - short_exposure, false)
            };
            
            DeltaExposure {
                long_exposure,
                short_exposure,
                net_delta,
                is_net_short,
            }
        }

        /// Execute rebalancing actions
        fn _execute_rebalancing_actions(self: @ContractState, delta_exposure: DeltaExposure) -> RebalancingResult {
            // Simplified rebalancing execution
            let actions_executed = if delta_exposure.net_delta > 0 { 1 } else { 0 };
            let total_volume = delta_exposure.net_delta;
            let gas_used = 100000; // Estimated gas
            
            RebalancingResult {
                actions_executed,
                total_volume,
                gas_used,
                success: true,
            }
        }
    }
}
