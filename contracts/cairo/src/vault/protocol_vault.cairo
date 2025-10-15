use starknet::ContractAddress;
use starknet::storage::{
    Map, StoragePointerReadAccess, StoragePointerWriteAccess,
    StorageMapReadAccess, StorageMapWriteAccess
};

/// Vault configuration parameters
#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct VaultConfig {
    /// Performance fee in basis points (default: 2000 = 20%)
    pub performance_fee_bps: u16,
    /// Management fee in basis points (default: 100 = 1%)
    pub management_fee_bps: u16,
    /// Exit fee in basis points (default: 10 = 0.1%)
    pub exit_fee_bps: u16,
    /// Minimum deposit amount (default: 10 STRK)
    pub min_deposit: u256,
    /// Maximum total value locked (for risk management)
    pub max_tvl: u256,
}

/// Yield report from strategies
#[derive(Drop, Serde, Copy)]
pub struct YieldReport {
    /// Strategy address reporting yield
    pub strategy: ContractAddress,
    /// Gross yield amount
    pub gross_yield: u256,
    /// Net yield after strategy fees
    pub net_yield: u256,
    /// Timestamp of report
    pub timestamp: u64,
}

#[starknet::interface]
pub trait IProtocolVault<TContractState> {
    /// Deposit STRK tokens and receive hSTRK
    fn deposit(ref self: TContractState, amount: u256) -> u256;
    
    /// Withdraw STRK tokens by burning hSTRK
    fn withdraw(ref self: TContractState, shares: u256) -> u256;
    
    /// Calculate current exchange rate (assets per share)
    fn calculate_exchange_rate(self: @TContractState) -> u256;
    
    /// Get total assets under management
    fn total_assets(self: @TContractState) -> u256;
    
    /// Get total shares outstanding
    fn total_shares(self: @TContractState) -> u256;
    
    /// Collect management fees (time-based accrual)
    fn collect_management_fee(ref self: TContractState) -> u256;
    
    /// Report yield from strategies
    fn report_yield(ref self: TContractState, yield_report: YieldReport) -> u256;
    
    /// Trigger hedge rebalancing
    fn trigger_hedge_rebalancing(ref self: TContractState);
    
    /// Emergency pause deposits/withdrawals
    fn emergency_pause(ref self: TContractState);
    
    /// Resume operations after pause
    fn resume_operations(ref self: TContractState);
    
    /// Update vault configuration
    fn update_config(ref self: TContractState, config: VaultConfig);
    
    /// Set contract addresses
    fn set_hstrk_token(ref self: TContractState, token: ContractAddress);
    fn set_strk_token(ref self: TContractState, token: ContractAddress);
    fn set_price_oracle(ref self: TContractState, oracle: ContractAddress);
    fn set_risk_manager(ref self: TContractState, risk_manager: ContractAddress);
    fn set_rebalancing_engine(ref self: TContractState, engine: ContractAddress);
    fn set_treasury(ref self: TContractState, treasury: ContractAddress);
    
    /// Add/remove strategy
    fn add_strategy(ref self: TContractState, strategy: ContractAddress, allocation_bps: u16);
    fn remove_strategy(ref self: TContractState, strategy: ContractAddress);
    
    /// Get vault configuration
    fn get_config(self: @TContractState) -> VaultConfig;
    
    /// Check if vault is paused
    fn is_paused(self: @TContractState) -> bool;
}

#[starknet::contract]
pub mod ProtocolVault {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp, get_contract_address};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess,
        StoragePointerReadAccess, StoragePointerWriteAccess
    };
    use core::num::traits::Zero;
    use super::{VaultConfig, YieldReport};
    use crate::tokens::hstrk_token::{IhSTRKTokenDispatcher, IhSTRKTokenDispatcherTrait};

    // IERC20 interface for STRK token interactions
    #[starknet::interface]
    trait IERC20<TContractState> {
        fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
        fn transfer_from(ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
        fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
        fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
        fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    }

    #[storage]
    struct Storage {
        /// Owner of the contract
        owner: ContractAddress,
        /// Total assets under management (in STRK)
        total_assets_amount: u256,
        /// Total shares outstanding (hSTRK)
        total_shares_amount: u256,
        /// Vault configuration
        config: VaultConfig,
        /// Contract addresses
        hstrk_token: ContractAddress,
        strk_token: ContractAddress,
        price_oracle: ContractAddress,
        risk_manager: ContractAddress,
        rebalancing_engine: ContractAddress,
        treasury: ContractAddress,
        /// Strategy allocations (strategy -> allocation in bps)
        strategy_allocations: Map<ContractAddress, u16>,
        /// Active strategies list
        active_strategies: Map<u32, ContractAddress>,
        strategies_count: u32,
        /// Fee tracking
        last_management_fee_collection: u64,
        accrued_performance_fees: u256,
        accrued_management_fees: u256,
        /// Pause state
        paused: bool,
        /// Reentrancy guard
        reentrancy_guard: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        /// Emitted when user deposits
        Deposited: Deposited,
        /// Emitted when user withdraws
        Withdrawn: Withdrawn,
        /// Emitted when yield is reported
        YieldReported: YieldReported,
        /// Emitted when management fee is collected
        ManagementFeeCollected: ManagementFeeCollected,
        /// Emitted when performance fee is collected
        PerformanceFeeCollected: PerformanceFeeCollected,
        /// Emitted when hedge rebalancing is triggered
        HedgeRebalancingTriggered: HedgeRebalancingTriggered,
        /// Emitted when vault is paused/unpaused
        VaultPauseStateChanged: VaultPauseStateChanged,
        /// Emitted when configuration is updated
        ConfigUpdated: ConfigUpdated,
        /// Emitted when strategy is added/removed
        StrategyUpdated: StrategyUpdated,
        /// Emitted when contract address is updated
        ContractAddressUpdated: ContractAddressUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct Deposited {
        #[key]
        pub user: ContractAddress,
        pub assets: u256,
        pub shares: u256,
        pub exchange_rate: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Withdrawn {
        #[key]
        pub user: ContractAddress,
        pub assets: u256,
        pub shares: u256,
        pub exit_fee: u256,
        pub exchange_rate: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct YieldReported {
        #[key]
        pub strategy: ContractAddress,
        pub gross_yield: u256,
        pub net_yield: u256,
        pub performance_fee: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct ManagementFeeCollected {
        pub amount: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct PerformanceFeeCollected {
        pub amount: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct HedgeRebalancingTriggered {
        pub timestamp: u64,
        pub trigger_reason: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct VaultPauseStateChanged {
        pub paused: bool,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct ConfigUpdated {
        pub old_config: VaultConfig,
        pub new_config: VaultConfig,
    }

    #[derive(Drop, starknet::Event)]
    struct StrategyUpdated {
        #[key]
        pub strategy: ContractAddress,
        pub allocation_bps: u16,
        pub action: felt252, // 'added' or 'removed'
    }

    #[derive(Drop, starknet::Event)]
    struct ContractAddressUpdated {
        pub contract_type: felt252,
        pub old_address: ContractAddress,
        pub new_address: ContractAddress,
    }

    mod Errors {
        pub const PAUSED: felt252 = 'Vault: paused';
        pub const REENTRANCY: felt252 = 'Vault: reentrancy';
        pub const ZERO_ADDRESS: felt252 = 'Vault: zero address';
        pub const ZERO_AMOUNT: felt252 = 'Vault: zero amount';
        pub const MIN_DEPOSIT: felt252 = 'Vault: below min deposit';
        pub const MAX_TVL_EXCEEDED: felt252 = 'Vault: max TVL exceeded';
        pub const INSUFFICIENT_SHARES: felt252 = 'Vault: insufficient shares';
        pub const INVALID_STRATEGY: felt252 = 'Vault: invalid strategy';
        pub const STRATEGY_EXISTS: felt252 = 'Vault: strategy exists';
        pub const STRATEGY_NOT_FOUND: felt252 = 'Vault: strategy not found';
        pub const INVALID_ALLOCATION: felt252 = 'Vault: invalid allocation';
        pub const UNAUTHORIZED_STRATEGY: felt252 = 'Vault: unauthorized strategy';
        pub const INVALID_CONFIG: felt252 = 'Vault: invalid config';
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        hstrk_token: ContractAddress,
        strk_token: ContractAddress,
        price_oracle: ContractAddress,
        treasury: ContractAddress,
    ) {
        self.owner.write(owner);
        
        // Validate addresses
        assert(!hstrk_token.is_zero(), Errors::ZERO_ADDRESS);
        assert(!strk_token.is_zero(), Errors::ZERO_ADDRESS);
        assert(!price_oracle.is_zero(), Errors::ZERO_ADDRESS);
        assert(!treasury.is_zero(), Errors::ZERO_ADDRESS);
        
        // Set contract addresses
        self.hstrk_token.write(hstrk_token);
        self.strk_token.write(strk_token);
        self.price_oracle.write(price_oracle);
        self.treasury.write(treasury);
        
        // Set default configuration
        let default_config = VaultConfig {
            performance_fee_bps: 2000, // 20%
            management_fee_bps: 100,   // 1%
            exit_fee_bps: 10,          // 0.1%
            min_deposit: 10_000000000000000000, // 10 STRK (18 decimals)
            max_tvl: 1000000_000000000000000000, // 1M STRK
        };
        self.config.write(default_config);
        
        // Initialize state
        self.total_assets_amount.write(0);
        self.total_shares_amount.write(0);
        self.last_management_fee_collection.write(get_block_timestamp());
        self.paused.write(false);
        self.reentrancy_guard.write(false);
        self.strategies_count.write(0);
    }

    #[abi(embed_v0)]
    impl ProtocolVaultImpl of super::IProtocolVault<ContractState> {
        fn deposit(ref self: ContractState, amount: u256) -> u256 {
            self._assert_not_paused();
            self._assert_no_reentrancy();
            self._set_reentrancy_guard(true);

            assert(amount > 0, Errors::ZERO_AMOUNT);
            assert(amount >= self.config.read().min_deposit, Errors::MIN_DEPOSIT);

            let caller = get_caller_address();
            let current_assets = self.total_assets_amount.read();
            let current_shares = self.total_shares_amount.read();

            // Check TVL limit
            assert(current_assets + amount <= self.config.read().max_tvl, Errors::MAX_TVL_EXCEEDED);

            // Calculate shares to mint
            let shares_to_mint = if current_shares == 0 {
                amount // 1:1 ratio for first deposit
            } else {
                amount * current_shares / current_assets
            };

            // Transfer STRK from user to vault
            let strk_token = IERC20Dispatcher { contract_address: self.strk_token.read() };
            let success = strk_token.transfer_from(caller, get_contract_address(), amount);
            assert(success, 'STRK transfer failed');

            // Mint hSTRK to user
            let hstrk_token = IhSTRKTokenDispatcher { contract_address: self.hstrk_token.read() };
            hstrk_token.mint(caller, shares_to_mint);

            // Update state
            self.total_assets_amount.write(current_assets + amount);
            self.total_shares_amount.write(current_shares + shares_to_mint);

            // Calculate exchange rate for event
            let exchange_rate = self._calculate_exchange_rate_internal();

            self.emit(Deposited {
                user: caller,
                assets: amount,
                shares: shares_to_mint,
                exchange_rate,
            });

            // Trigger hedge rebalancing if needed
            self._trigger_hedge_if_needed();

            self._set_reentrancy_guard(false);
            shares_to_mint
        }

        fn withdraw(ref self: ContractState, shares: u256) -> u256 {
            self._assert_not_paused();
            self._assert_no_reentrancy();
            self._set_reentrancy_guard(true);

            assert(shares > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let current_assets = self.total_assets_amount.read();
            let current_shares = self.total_shares_amount.read();

            assert(current_shares > 0, Errors::INSUFFICIENT_SHARES);

            // Calculate assets to return
            let assets_to_return = shares * current_assets / current_shares;

            // Calculate exit fee
            let exit_fee_bps = self.config.read().exit_fee_bps;
            let exit_fee = assets_to_return * exit_fee_bps.into() / 10000;
            let net_assets = assets_to_return - exit_fee;

            // Burn hSTRK from user
            let hstrk_token = IhSTRKTokenDispatcher { contract_address: self.hstrk_token.read() };
            hstrk_token.burn(caller, shares);

            // Transfer STRK to user (minus exit fee)
            let strk_token = IERC20Dispatcher { contract_address: self.strk_token.read() };
            let success = strk_token.transfer(caller, net_assets);
            assert(success, 'STRK transfer to user failed');

            // Transfer exit fee to treasury
            if exit_fee > 0 {
                let fee_success = strk_token.transfer(self.treasury.read(), exit_fee);
                assert(fee_success, 'Exit fee transfer failed');
            }

            // Update state
            self.total_assets_amount.write(current_assets - assets_to_return);
            self.total_shares_amount.write(current_shares - shares);

            // Calculate exchange rate for event
            let exchange_rate = self._calculate_exchange_rate_internal();

            self.emit(Withdrawn {
                user: caller,
                assets: net_assets,
                shares,
                exit_fee,
                exchange_rate,
            });

            // Trigger hedge rebalancing if needed
            self._trigger_hedge_if_needed();

            self._set_reentrancy_guard(false);
            net_assets
        }

        fn calculate_exchange_rate(self: @ContractState) -> u256 {
            self._calculate_exchange_rate_internal()
        }

        fn total_assets(self: @ContractState) -> u256 {
            self.total_assets_amount.read()
        }

        fn total_shares(self: @ContractState) -> u256 {
            self.total_shares_amount.read()
        }

        fn collect_management_fee(ref self: ContractState) -> u256 {
            let current_time = get_block_timestamp();
            let last_collection = self.last_management_fee_collection.read();
            let time_elapsed = current_time - last_collection;

            if time_elapsed == 0 {
                return 0;
            }

            let current_assets = self.total_assets_amount.read();
            let management_fee_bps = self.config.read().management_fee_bps;

            // Calculate annualized management fee
            // fee = assets * fee_bps * time_elapsed / (10000 * 365 * 24 * 3600)
            let annual_seconds = 365 * 24 * 3600;
            let management_fee = current_assets * management_fee_bps.into() * time_elapsed.into()
                / (10000 * annual_seconds);

            if management_fee > 0 {
                // Mint hSTRK to treasury as management fee
                let hstrk_token = IhSTRKTokenDispatcher { contract_address: self.hstrk_token.read() };
                hstrk_token.mint(self.treasury.read(), management_fee);

                // Update total shares
                let current_shares = self.total_shares_amount.read();
                self.total_shares_amount.write(current_shares + management_fee);

                self.emit(ManagementFeeCollected {
                    amount: management_fee,
                    timestamp: current_time,
                });
            }

            self.last_management_fee_collection.write(current_time);
            management_fee
        }

        fn report_yield(ref self: ContractState, yield_report: YieldReport) -> u256 {
            self._assert_authorized_strategy(yield_report.strategy);

            let performance_fee_bps = self.config.read().performance_fee_bps;
            let performance_fee = yield_report.net_yield * performance_fee_bps.into() / 10000;
            let net_yield_after_fee = yield_report.net_yield - performance_fee;

            // Add net yield to total assets
            let current_assets = self.total_assets_amount.read();
            self.total_assets_amount.write(current_assets + net_yield_after_fee);

            // Accrue performance fee
            let current_perf_fees = self.accrued_performance_fees.read();
            self.accrued_performance_fees.write(current_perf_fees + performance_fee);

            // Transfer performance fee to treasury
            if performance_fee > 0 {
                let strk_token = IERC20Dispatcher { contract_address: self.strk_token.read() };
                let success = strk_token.transfer(self.treasury.read(), performance_fee);
                assert(success, 'Performance fee transfer failed');

                self.emit(PerformanceFeeCollected {
                    amount: performance_fee,
                    timestamp: get_block_timestamp(),
                });
            }

            self.emit(YieldReported {
                strategy: yield_report.strategy,
                gross_yield: yield_report.gross_yield,
                net_yield: yield_report.net_yield,
                performance_fee,
            });

            net_yield_after_fee
        }

        fn trigger_hedge_rebalancing(ref self: ContractState) {
            self._check_owner();
            self._trigger_hedge_rebalancing_internal('manual');
        }

        fn emergency_pause(ref self: ContractState) {
            self._check_owner();
            self.paused.write(true);
            self.emit(VaultPauseStateChanged {
                paused: true,
                timestamp: get_block_timestamp(),
            });
        }

        fn resume_operations(ref self: ContractState) {
            self._check_owner();
            self.paused.write(false);
            self.emit(VaultPauseStateChanged {
                paused: false,
                timestamp: get_block_timestamp(),
            });
        }

        fn update_config(ref self: ContractState, config: VaultConfig) {
            self._check_owner();
            self._validate_config(config);

            let old_config = self.config.read();
            self.config.write(config);

            self.emit(ConfigUpdated { old_config, new_config: config });
        }

        // Contract address setters
        fn set_hstrk_token(ref self: ContractState, token: ContractAddress) {
            self._check_owner();
            assert(!token.is_zero(), Errors::ZERO_ADDRESS);
            let old_address = self.hstrk_token.read();
            self.hstrk_token.write(token);
            self.emit(ContractAddressUpdated {
                contract_type: 'hstrk_token',
                old_address,
                new_address: token,
            });
        }

        fn set_strk_token(ref self: ContractState, token: ContractAddress) {
            self._check_owner();
            assert(!token.is_zero(), Errors::ZERO_ADDRESS);
            let old_address = self.strk_token.read();
            self.strk_token.write(token);
            self.emit(ContractAddressUpdated {
                contract_type: 'strk_token',
                old_address,
                new_address: token,
            });
        }

        fn set_price_oracle(ref self: ContractState, oracle: ContractAddress) {
            self._check_owner();
            assert(!oracle.is_zero(), Errors::ZERO_ADDRESS);
            let old_address = self.price_oracle.read();
            self.price_oracle.write(oracle);
            self.emit(ContractAddressUpdated {
                contract_type: 'price_oracle',
                old_address,
                new_address: oracle,
            });
        }

        fn set_risk_manager(ref self: ContractState, risk_manager: ContractAddress) {
            self._check_owner();
            let old_address = self.risk_manager.read();
            self.risk_manager.write(risk_manager);
            self.emit(ContractAddressUpdated {
                contract_type: 'risk_manager',
                old_address,
                new_address: risk_manager,
            });
        }

        fn set_rebalancing_engine(ref self: ContractState, engine: ContractAddress) {
            self._check_owner();
            let old_address = self.rebalancing_engine.read();
            self.rebalancing_engine.write(engine);
            self.emit(ContractAddressUpdated {
                contract_type: 'rebalancing_engine',
                old_address,
                new_address: engine,
            });
        }

        fn set_treasury(ref self: ContractState, treasury: ContractAddress) {
            self._check_owner();
            assert(!treasury.is_zero(), Errors::ZERO_ADDRESS);
            let old_address = self.treasury.read();
            self.treasury.write(treasury);
            self.emit(ContractAddressUpdated {
                contract_type: 'treasury',
                old_address,
                new_address: treasury,
            });
        }

        // Strategy management
        fn add_strategy(ref self: ContractState, strategy: ContractAddress, allocation_bps: u16) {
            self._check_owner();
            assert(!strategy.is_zero(), Errors::ZERO_ADDRESS);
            assert(allocation_bps <= 10000, Errors::INVALID_ALLOCATION);
            assert(self.strategy_allocations.read(strategy) == 0, Errors::STRATEGY_EXISTS);

            // Add to strategies list
            let count = self.strategies_count.read();
            self.active_strategies.write(count, strategy);
            self.strategies_count.write(count + 1);

            // Set allocation
            self.strategy_allocations.write(strategy, allocation_bps);

            self.emit(StrategyUpdated {
                strategy,
                allocation_bps,
                action: 'added',
            });
        }

        fn remove_strategy(ref self: ContractState, strategy: ContractAddress) {
            self._check_owner();
            assert(self.strategy_allocations.read(strategy) > 0, Errors::STRATEGY_NOT_FOUND);

            // Remove allocation
            self.strategy_allocations.write(strategy, 0);

            // Remove from active strategies list (simplified - in production would compact array)
            let count = self.strategies_count.read();
            let mut i = 0;
            while i < count {
                if self.active_strategies.read(i) == strategy {
                    self.active_strategies.write(i, Zero::zero());
                    break;
                }
                i += 1;
            };

            self.emit(StrategyUpdated {
                strategy,
                allocation_bps: 0,
                action: 'removed',
            });
        }

        fn get_config(self: @ContractState) -> VaultConfig {
            self.config.read()
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Assert vault is not paused
        fn _assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), Errors::PAUSED);
        }

        /// Assert no reentrancy
        fn _assert_no_reentrancy(self: @ContractState) {
            assert(!self.reentrancy_guard.read(), Errors::REENTRANCY);
        }

        /// Set reentrancy guard
        fn _set_reentrancy_guard(ref self: ContractState, guard: bool) {
            self.reentrancy_guard.write(guard);
        }

        /// Calculate exchange rate (assets per share)
        fn _calculate_exchange_rate_internal(self: @ContractState) -> u256 {
            let total_shares = self.total_shares_amount.read();
            if total_shares == 0 {
                return 1_000000000000000000; // 1.0 in 18 decimals
            }
            let total_assets = self.total_assets_amount.read();
            total_assets * 1_000000000000000000 / total_shares
        }

        /// Trigger hedge rebalancing if conditions are met
        fn _trigger_hedge_if_needed(ref self: ContractState) {
            // Check if rebalancing is needed based on deposit/withdrawal size
            let total_assets = self.total_assets_amount.read();
            if total_assets > 0 {
                self._trigger_hedge_rebalancing_internal('deposit_withdrawal');
            }
        }

        /// Internal hedge rebalancing trigger
        fn _trigger_hedge_rebalancing_internal(ref self: ContractState, reason: felt252) {
            let rebalancing_engine = self.rebalancing_engine.read();
            if !rebalancing_engine.is_zero() {
                // In production, this would call the rebalancing engine
                self.emit(HedgeRebalancingTriggered {
                    timestamp: get_block_timestamp(),
                    trigger_reason: reason,
                });
            }
        }

        /// Assert caller is authorized strategy
        fn _assert_authorized_strategy(self: @ContractState, strategy: ContractAddress) {
            let allocation = self.strategy_allocations.read(strategy);
            assert(allocation > 0, Errors::UNAUTHORIZED_STRATEGY);
        }

        /// Validate vault configuration
        fn _validate_config(self: @ContractState, config: VaultConfig) {
            assert(config.performance_fee_bps <= 5000, Errors::INVALID_CONFIG); // Max 50%
            assert(config.management_fee_bps <= 500, Errors::INVALID_CONFIG);   // Max 5%
            assert(config.exit_fee_bps <= 100, Errors::INVALID_CONFIG);         // Max 1%
            assert(config.min_deposit > 0, Errors::INVALID_CONFIG);
            assert(config.max_tvl > config.min_deposit, Errors::INVALID_CONFIG);
        }

        // Internal function to check owner
        fn _check_owner(self: @ContractState) {
            let caller = get_caller_address();
            let owner = self.owner.read();
            assert(caller == owner, 'Vault: caller is not owner');
        }
    }
}
