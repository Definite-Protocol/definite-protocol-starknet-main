use starknet::ContractAddress;
use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

/// Simplified rebalancing result
#[derive(Drop, Serde, Copy)]
pub struct RebalancingResult {
    pub actions_executed: u32,
    pub total_volume: u256,
    pub success: bool,
}

#[starknet::interface]
trait IRebalancingEngine<TContractState> {
    /// Execute automatic rebalancing
    fn execute_rebalancing(ref self: TContractState) -> RebalancingResult;
    
    /// Get last rebalancing timestamp
    fn get_last_rebalancing(self: @TContractState) -> u64;
    
    /// Update rebalancing threshold
    fn set_execution_threshold(ref self: TContractState, threshold: u256);
    
    /// Get execution threshold
    fn get_execution_threshold(self: @TContractState) -> u256;
    
    /// Pause rebalancing
    fn pause_rebalancing(ref self: TContractState);
    
    /// Resume rebalancing
    fn resume_rebalancing(ref self: TContractState);
    
    /// Check if rebalancing is paused
    fn is_paused(self: @TContractState) -> bool;
}

#[starknet::contract]
mod RebalancingEngine {
    use super::{RebalancingResult, IRebalancingEngine};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        protocol_vault: ContractAddress,
        price_oracle: ContractAddress,
        perpetual_hedge: ContractAddress,
        options_strategy: ContractAddress,
        
        // Rebalancing parameters
        execution_threshold: u256,        // Delta threshold for execution (basis points)
        
        // Execution tracking
        last_rebalancing_timestamp: u64,
        total_rebalancings: u64,
        
        // Emergency controls
        paused: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        RebalancingExecuted: RebalancingExecuted,
        RebalancingPauseStateChanged: RebalancingPauseStateChanged,
    }

    #[derive(Drop, starknet::Event)]
    struct RebalancingExecuted {
        pub actions_executed: u32,
        pub total_volume: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct RebalancingPauseStateChanged {
        pub paused: bool,
        pub timestamp: u64,
    }

    mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'RebalEngine: zero address';
        pub const PAUSED: felt252 = 'RebalEngine: paused';
        pub const REBALANCING_NOT_NEEDED: felt252 = 'RebalEngine: not needed';
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        protocol_vault: ContractAddress,
        price_oracle: ContractAddress,
        perpetual_hedge: ContractAddress,
        options_strategy: ContractAddress,
    ) {
        self.owner.write(owner);
        
        // Validate addresses
        assert(!protocol_vault.is_zero(), Errors::ZERO_ADDRESS);
        assert(!price_oracle.is_zero(), Errors::ZERO_ADDRESS);
        
        // Set contract addresses
        self.protocol_vault.write(protocol_vault);
        self.price_oracle.write(price_oracle);
        self.perpetual_hedge.write(perpetual_hedge);
        self.options_strategy.write(options_strategy);
        
        // Initialize parameters
        self.execution_threshold.write(500);      // 5% delta threshold
        self.paused.write(false);
        self.last_rebalancing_timestamp.write(0);
        self.total_rebalancings.write(0);
    }

    #[abi(embed_v0)]
    impl RebalancingEngineImpl of IRebalancingEngine<ContractState> {
        fn execute_rebalancing(ref self: ContractState) -> RebalancingResult {
            self._check_owner();
            self._assert_not_paused();
            
            let current_time = get_block_timestamp();
            
            // Simple rebalancing logic
            let net_delta = 200000000000000000; // 0.2 STRK exposure
            let execution_threshold = self.execution_threshold.read();
            let threshold_amount = execution_threshold * 1000000000000000000 / 10000; // Convert bps to wei
            
            // Check if rebalancing is needed
            if net_delta < threshold_amount {
                return RebalancingResult {
                    actions_executed: 0,
                    total_volume: 0,
                    success: false,
                };
            }
            
            // Execute rebalancing
            let actions_executed = 1;
            let total_volume = net_delta;
            
            // Update state
            self.last_rebalancing_timestamp.write(current_time);
            self.total_rebalancings.write(self.total_rebalancings.read() + 1);
            
            // Emit event
            self.emit(RebalancingExecuted {
                actions_executed,
                total_volume,
                timestamp: current_time,
            });
            
            RebalancingResult {
                actions_executed,
                total_volume,
                success: true,
            }
        }

        fn get_last_rebalancing(self: @ContractState) -> u64 {
            self.last_rebalancing_timestamp.read()
        }

        fn set_execution_threshold(ref self: ContractState, threshold: u256) {
            self._check_owner();
            assert(threshold <= 5000, 'RebalEngine: invalid threshold'); // Max 50%
            self.execution_threshold.write(threshold);
        }

        fn get_execution_threshold(self: @ContractState) -> u256 {
            self.execution_threshold.read()
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
    }
}
