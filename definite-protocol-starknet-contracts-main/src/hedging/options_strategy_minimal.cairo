use starknet::ContractAddress;
use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};

#[starknet::interface]
trait IOptionsStrategy<TContractState> {
    /// Execute options strategy
    fn execute_strategy(ref self: TContractState) -> bool;
    
    /// Get portfolio delta
    fn get_portfolio_delta(self: @TContractState) -> u256;
    
    /// Check if delta is negative
    fn is_delta_negative(self: @TContractState) -> bool;
    
    /// Get IV threshold
    fn get_iv_threshold(self: @TContractState) -> u256;
    
    /// Set IV threshold
    fn set_iv_threshold(ref self: TContractState, threshold: u256);
}

#[starknet::contract]
mod OptionsStrategy {
    use super::IOptionsStrategy;
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        protocol_vault: ContractAddress,
        price_oracle: ContractAddress,
        
        // Strategy parameters
        iv_threshold: u256,           // Implied volatility threshold (basis points)
        
        // Portfolio Greeks tracking
        portfolio_delta: u256,
        is_portfolio_delta_negative: bool,
        portfolio_gamma: u256,
        portfolio_vega: u256,
        
        // Position counters
        total_options: u32,
        active_options: u32,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        StrategyExecuted: StrategyExecuted,
        GreeksUpdated: GreeksUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct StrategyExecuted {
        pub strategy_type: u8,
        pub options_opened: u32,
        pub total_premium: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct GreeksUpdated {
        pub delta: u256,
        pub gamma: u256,
        pub vega: u256,
    }

    mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'OptStrategy: zero address';
        pub const UNAUTHORIZED_CALLER: felt252 = 'OptStrategy: unauthorized';
        pub const STRATEGY_NOT_NEEDED: felt252 = 'OptStrategy: not needed';
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
        
        // Initialize parameters
        self.iv_threshold.write(2000);        // 20% IV threshold
        
        // Initialize Greeks
        self.portfolio_delta.write(0);
        self.is_portfolio_delta_negative.write(false);
        self.portfolio_gamma.write(0);
        self.portfolio_vega.write(0);
        
        // Initialize counters
        self.total_options.write(0);
        self.active_options.write(0);
    }

    #[abi(embed_v0)]
    impl OptionsStrategyImpl of IOptionsStrategy<ContractState> {
        fn execute_strategy(ref self: ContractState) -> bool {
            self._check_owner();
            
            // Check if strategy should be executed
            let current_iv = 2500; // Placeholder: 25% IV
            let iv_threshold = self.iv_threshold.read();
            
            if current_iv <= iv_threshold {
                return false;
            }
            
            // Execute protective put strategy
            let premium = 50000000000000000; // 0.05 STRK premium
            
            // Update state
            self.total_options.write(self.total_options.read() + 1);
            self.active_options.write(self.active_options.read() + 1);
            
            // Update Greeks
            self._update_portfolio_greeks();
            
            self.emit(StrategyExecuted {
                strategy_type: 1, // protective put
                options_opened: 1,
                total_premium: premium,
            });
            
            true
        }

        fn get_portfolio_delta(self: @ContractState) -> u256 {
            self.portfolio_delta.read()
        }

        fn is_delta_negative(self: @ContractState) -> bool {
            self.is_portfolio_delta_negative.read()
        }

        fn get_iv_threshold(self: @ContractState) -> u256 {
            self.iv_threshold.read()
        }

        fn set_iv_threshold(ref self: ContractState, threshold: u256) {
            self._check_owner();
            self.iv_threshold.write(threshold);
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

        /// Update portfolio Greeks (simplified calculation)
        fn _update_portfolio_greeks(ref self: ContractState) {
            let active_count = self.active_options.read();
            
            if active_count > 0 {
                self.portfolio_delta.write(500); // 0.05 delta per option
                self.portfolio_gamma.write(100); // 0.01 gamma per option
                self.portfolio_vega.write(1000000000000000000); // 1 STRK vega
            } else {
                self.portfolio_delta.write(0);
                self.portfolio_gamma.write(0);
                self.portfolio_vega.write(0);
            }
            
            self.emit(GreeksUpdated {
                delta: self.portfolio_delta.read(),
                gamma: self.portfolio_gamma.read(),
                vega: self.portfolio_vega.read(),
            });
        }
    }
}
