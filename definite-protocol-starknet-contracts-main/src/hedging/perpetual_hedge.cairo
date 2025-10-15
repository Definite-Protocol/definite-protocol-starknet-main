use starknet::ContractAddress;
use starknet::storage::{
    Map, StoragePointerReadAccess, StoragePointerWriteAccess,
    StorageMapReadAccess, StorageMapWriteAccess
};

/// Signed integer representation for Cairo compatibility
#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct SignedInt {
    pub value: u256,
    pub is_negative: bool,
}

impl SignedInt {
    pub fn new(value: u256, is_negative: bool) -> SignedInt {
        SignedInt { value, is_negative }
    }

    pub fn zero() -> SignedInt {
        SignedInt { value: 0, is_negative: false }
    }

    pub fn from_u256(value: u256) -> SignedInt {
        SignedInt { value, is_negative: false }
    }
}

/// Perpetual position data
#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct PositionData {
    /// DEX address where position is held
    pub dex_address: ContractAddress,
    /// Position size (negative for short)
    pub size: SignedInt,
    /// Entry price in 8 decimals
    pub entry_price: u256,
    /// Leverage used (max 2x)
    pub leverage: u8,
    /// Margin amount
    pub margin: u256,
    /// Accrued funding payments
    pub funding_accrued: SignedInt,
    /// Liquidation price
    pub liquidation_price: u256,
    /// Position timestamp
    pub timestamp: u64,
    /// Position status
    pub active: bool,
}

/// Funding collection data
#[derive(Drop, Serde, Copy)]
pub struct FundingData {
    /// Funding rate (positive = longs pay shorts)
    pub funding_rate: SignedInt,
    /// Funding amount collected
    pub funding_amount: SignedInt,
    /// Collection timestamp
    pub timestamp: u64,
}

#[starknet::interface]
pub trait IPerpetualHedge<TContractState> {
    /// Open short position on specified DEX
    fn open_short_position(
        ref self: TContractState,
        dex_address: ContractAddress,
        size: u256,
        leverage: u8,
        max_slippage_bps: u16,
    ) -> u32;
    
    /// Close position by ID
    fn close_position(ref self: TContractState, position_id: u32) -> SignedInt;

    /// Collect funding payments (8-hour cycles)
    fn collect_funding(ref self: TContractState) -> SignedInt;

    /// Monitor position health and add margin if needed
    fn monitor_position_health(ref self: TContractState, position_id: u32);

    /// Calculate current delta exposure
    fn calculate_current_delta(self: @TContractState) -> SignedInt;
    
    /// Get position data
    fn get_position(self: @TContractState, position_id: u32) -> PositionData;
    
    /// Get total positions count
    fn get_positions_count(self: @TContractState) -> u32;
    
    /// Get target delta (should be 0 for delta-neutral)
    fn get_target_delta(self: @TContractState) -> SignedInt;

    /// Set target delta
    fn set_target_delta(ref self: TContractState, target_delta: SignedInt);
    
    /// Set rebalance threshold
    fn set_rebalance_threshold(ref self: TContractState, threshold: u256);
    
    /// Emergency close all positions
    fn emergency_close_all(ref self: TContractState);
    
    /// Set authorized DEX
    fn set_authorized_dex(ref self: TContractState, dex: ContractAddress, authorized: bool);
    
    /// Check if rebalancing is needed
    fn needs_rebalancing(self: @TContractState) -> bool;
}

#[starknet::contract]
pub mod PerpetualHedge {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp, get_contract_address};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess,
        StoragePointerReadAccess, StoragePointerWriteAccess
    };
    use core::num::traits::Zero;
    use core::integer::i256;
    use super::{PositionData, FundingData};
    use crate::oracle::price_oracle::{IPriceOracleDispatcher, IPriceOracleDispatcherTrait};

    #[storage]
    struct Storage {
        owner: ContractAddress,
        /// Position ID counter
        next_position_id: u32,
        /// Position ID -> Position data
        positions: Map<u32, PositionData>,
        /// Active positions count
        active_positions_count: u32,
        /// Target delta (0 for delta-neutral)
        target_delta: i256,
        /// Current delta exposure
        current_delta: i256,
        /// Rebalance threshold (0.1 = 10%)
        rebalance_threshold: u256,
        /// Authorized DEXs for perpetual trading
        authorized_dexs: Map<ContractAddress, bool>,
        /// Contract addresses
        protocol_vault: ContractAddress,
        price_oracle: ContractAddress,
        strk_token: ContractAddress,
        /// Funding collection tracking
        last_funding_collection: u64,
        total_funding_collected: i256,
        /// Risk parameters
        max_leverage: u8,
        min_margin_ratio: u256, // 1.2 = 120%
        warning_margin_ratio: u256, // 1.5 = 150%
        /// Emergency state
        emergency_mode: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        /// Emitted when position is opened
        PositionOpened: PositionOpened,
        /// Emitted when position is closed
        PositionClosed: PositionClosed,
        /// Emitted when funding is collected
        FundingCollected: FundingCollected,
        /// Emitted when margin is added to position
        MarginAdded: MarginAdded,
        /// Emitted when position health warning is triggered
        PositionHealthWarning: PositionHealthWarning,
        /// Emitted when delta is updated
        DeltaUpdated: DeltaUpdated,
        /// Emitted when rebalancing is needed
        RebalancingNeeded: RebalancingNeeded,
        /// Emitted when emergency mode is activated
        EmergencyModeActivated: EmergencyModeActivated,
        /// Emitted when DEX authorization changes
        DEXAuthorizationUpdated: DEXAuthorizationUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct PositionOpened {
        #[key]
        pub position_id: u32,
        pub dex_address: ContractAddress,
        pub size: i256,
        pub entry_price: u256,
        pub leverage: u8,
        pub margin: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct PositionClosed {
        #[key]
        pub position_id: u32,
        pub exit_price: u256,
        pub pnl: i256,
        pub funding_collected: i256,
    }

    #[derive(Drop, starknet::Event)]
    struct FundingCollected {
        pub total_amount: i256,
        pub positions_count: u32,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct MarginAdded {
        #[key]
        pub position_id: u32,
        pub margin_added: u256,
        pub new_margin_ratio: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct PositionHealthWarning {
        #[key]
        pub position_id: u32,
        pub margin_ratio: u256,
        pub liquidation_price: u256,
        pub current_price: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct DeltaUpdated {
        pub old_delta: i256,
        pub new_delta: i256,
        pub target_delta: i256,
    }

    #[derive(Drop, starknet::Event)]
    struct RebalancingNeeded {
        pub current_delta: i256,
        pub target_delta: i256,
        pub deviation: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct EmergencyModeActivated {
        pub reason: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct DEXAuthorizationUpdated {
        #[key]
        pub dex: ContractAddress,
        pub authorized: bool,
    }

    mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'PerpHedge: zero address';
        pub const UNAUTHORIZED_DEX: felt252 = 'PerpHedge: unauthorized DEX';
        pub const INVALID_LEVERAGE: felt252 = 'PerpHedge: invalid leverage';
        pub const INVALID_SIZE: felt252 = 'PerpHedge: invalid size';
        pub const POSITION_NOT_FOUND: felt252 = 'PerpHedge: position not found';
        pub const POSITION_INACTIVE: felt252 = 'PerpHedge: position inactive';
        pub const INSUFFICIENT_MARGIN: felt252 = 'PerpHedge: insufficient margin';
        pub const EMERGENCY_MODE: felt252 = 'PerpHedge: emergency mode';
        pub const UNAUTHORIZED_CALLER: felt252 = 'PerpHedge: unauthorized caller';
        pub const INVALID_SLIPPAGE: felt252 = 'PerpHedge: invalid slippage';
        pub const LIQUIDATION_RISK: felt252 = 'PerpHedge: liquidation risk';
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        protocol_vault: ContractAddress,
        price_oracle: ContractAddress,
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
        self.strk_token.write(strk_token);
        
        // Initialize parameters
        self.next_position_id.write(1);
        self.target_delta.write(0); // Delta-neutral
        self.current_delta.write(0);
        self.rebalance_threshold.write(100000000000000000); // 0.1 = 10%
        self.max_leverage.write(2); // 2x max leverage
        self.min_margin_ratio.write(1200000000000000000); // 1.2 = 120%
        self.warning_margin_ratio.write(1500000000000000000); // 1.5 = 150%
        self.last_funding_collection.write(get_block_timestamp());
        self.emergency_mode.write(false);
    }

    #[abi(embed_v0)]
    impl PerpetualHedgeImpl of super::IPerpetualHedge<ContractState> {
        fn open_short_position(
            ref self: ContractState,
            dex_address: ContractAddress,
            size: u256,
            leverage: u8,
            max_slippage_bps: u16,
        ) -> u32 {
            self._assert_not_emergency();
            self._assert_authorized_caller();
            assert(self.authorized_dexs.read(dex_address), Errors::UNAUTHORIZED_DEX);
            assert(size > 0, Errors::INVALID_SIZE);
            assert(leverage > 0 && leverage <= self.max_leverage.read(), Errors::INVALID_LEVERAGE);
            assert(max_slippage_bps <= 1000, Errors::INVALID_SLIPPAGE); // Max 10%

            // Get current price from oracle
            let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
            let strk_token = self.strk_token.read();
            let price_data = oracle.get_price(strk_token);
            let entry_price = price_data.price;

            // Calculate required margin
            let margin_required = size * entry_price / (leverage.into() * 100000000); // 8 decimals

            // Calculate liquidation price for short position
            let liquidation_price = entry_price * (100 + 80) / 100; // 80% above entry for 2x leverage

            // Create position
            let position_id = self.next_position_id.read();
            let position = PositionData {
                dex_address,
                size: -(size.try_into().unwrap()), // Negative for short
                entry_price,
                leverage,
                margin: margin_required,
                funding_accrued: 0,
                liquidation_price,
                timestamp: get_block_timestamp(),
                active: true,
            };

            // Store position
            self.positions.write(position_id, position);
            self.next_position_id.write(position_id + 1);
            self.active_positions_count.write(self.active_positions_count.read() + 1);

            // Update delta
            let current_delta = self.current_delta.read();
            let new_delta = current_delta - size.try_into().unwrap();
            self.current_delta.write(new_delta);

            // In production, execute actual DEX trade here
            self._execute_dex_trade(dex_address, size, leverage, max_slippage_bps);

            self.emit(PositionOpened {
                position_id,
                dex_address,
                size: -(size.try_into().unwrap()),
                entry_price,
                leverage,
                margin: margin_required,
            });

            self.emit(DeltaUpdated {
                old_delta: current_delta,
                new_delta,
                target_delta: self.target_delta.read(),
            });

            position_id
        }

        fn close_position(ref self: ContractState, position_id: u32) -> i256 {
            self._assert_authorized_caller();

            let mut position = self.positions.read(position_id);
            assert(position.active, Errors::POSITION_INACTIVE);

            // Get current price
            let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
            let strk_token = self.strk_token.read();
            let price_data = oracle.get_price(strk_token);
            let exit_price = price_data.price;

            // Calculate PnL for short position
            let size_abs: u256 = if position.size < 0 {
                (-position.size).try_into().unwrap()
            } else {
                position.size.try_into().unwrap()
            };

            // For short: PnL = (entry_price - exit_price) * size / entry_price
            let pnl = if exit_price < position.entry_price {
                // Profit for short
                let profit = (position.entry_price - exit_price) * size_abs / position.entry_price;
                profit.try_into().unwrap()
            } else {
                // Loss for short
                let loss = (exit_price - position.entry_price) * size_abs / position.entry_price;
                -(loss.try_into().unwrap())
            };

            // Close position
            position.active = false;
            self.positions.write(position_id, position);
            self.active_positions_count.write(self.active_positions_count.read() - 1);

            // Update delta
            let current_delta = self.current_delta.read();
            let new_delta = current_delta - position.size;
            self.current_delta.write(new_delta);

            // In production, execute actual DEX trade here
            self._execute_dex_close(position.dex_address, size_abs);

            self.emit(PositionClosed {
                position_id,
                exit_price,
                pnl,
                funding_collected: position.funding_accrued,
            });

            self.emit(DeltaUpdated {
                old_delta: current_delta,
                new_delta,
                target_delta: self.target_delta.read(),
            });

            pnl
        }

        fn collect_funding(ref self: ContractState) -> i256 {
            let current_time = get_block_timestamp();
            let last_collection = self.last_funding_collection.read();

            // Funding is typically collected every 8 hours
            if current_time - last_collection < 8 * 3600 {
                return 0;
            }

            let mut total_funding: i256 = 0;
            let mut positions_processed: u32 = 0;

            // Iterate through active positions
            let mut position_id = 1;
            let next_id = self.next_position_id.read();

            while position_id < next_id {
                let mut position = self.positions.read(position_id);
                if position.active {
                    // Simulate funding rate (in production, fetch from DEX)
                    let funding_rate = self._get_funding_rate(position.dex_address);

                    // Calculate funding payment for this position
                    let size_abs: u256 = if position.size < 0 {
                        (-position.size).try_into().unwrap()
                    } else {
                        position.size.try_into().unwrap()
                    };

                    let funding_payment = funding_rate * size_abs.try_into().unwrap() / 1000000; // Normalize

                    // For short positions, positive funding rate means we receive payment
                    let funding_for_position = if position.size < 0 { funding_payment } else { -funding_payment };

                    position.funding_accrued += funding_for_position;
                    self.positions.write(position_id, position);

                    total_funding += funding_for_position;
                    positions_processed += 1;
                }
                position_id += 1;
            };

            // Update tracking
            self.last_funding_collection.write(current_time);
            let current_total = self.total_funding_collected.read();
            self.total_funding_collected.write(current_total + total_funding);

            self.emit(FundingCollected {
                total_amount: total_funding,
                positions_count: positions_processed,
                timestamp: current_time,
            });

            total_funding
        }

        fn monitor_position_health(ref self: ContractState, position_id: u32) {
            let position = self.positions.read(position_id);
            assert(position.active, Errors::POSITION_INACTIVE);

            // Get current price
            let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
            let strk_token = self.strk_token.read();
            let price_data = oracle.get_price(strk_token);
            let current_price = price_data.price;

            // Calculate current margin ratio
            let size_abs: u256 = if position.size < 0 {
                (-position.size).try_into().unwrap()
            } else {
                position.size.try_into().unwrap()
            };

            let position_value = size_abs * current_price / 100000000; // 8 decimals
            let margin_ratio = position.margin * 1000000000000000000 / position_value; // 18 decimals

            let min_margin = self.min_margin_ratio.read();
            let warning_margin = self.warning_margin_ratio.read();

            if margin_ratio < min_margin {
                // Critical: Add emergency margin
                let additional_margin = position_value * 500000000000000000 / 1000000000000000000; // 50% of position value
                self._add_margin_to_position(position_id, additional_margin);
            } else if margin_ratio < warning_margin {
                // Warning: Emit warning event
                self.emit(PositionHealthWarning {
                    position_id,
                    margin_ratio,
                    liquidation_price: position.liquidation_price,
                    current_price,
                });
            }
        }

        fn calculate_current_delta(self: @ContractState) -> i256 {
            self.current_delta.read()
        }

        fn get_position(self: @ContractState, position_id: u32) -> PositionData {
            self.positions.read(position_id)
        }

        fn get_positions_count(self: @ContractState) -> u32 {
            self.next_position_id.read() - 1
        }

        fn get_target_delta(self: @ContractState) -> i256 {
            self.target_delta.read()
        }

        fn set_target_delta(ref self: ContractState, target_delta: i256) {
            self._check_owner();
            let old_delta = self.target_delta.read();
            self.target_delta.write(target_delta);

            self.emit(DeltaUpdated {
                old_delta,
                new_delta: self.current_delta.read(),
                target_delta,
            });
        }

        fn set_rebalance_threshold(ref self: ContractState, threshold: u256) {
            self._check_owner();
            self.rebalance_threshold.write(threshold);
        }

        fn emergency_close_all(ref self: ContractState) {
            self._check_owner();
            self.emergency_mode.write(true);

            // Close all active positions
            let mut position_id = 1;
            let next_id = self.next_position_id.read();

            while position_id < next_id {
                let position = self.positions.read(position_id);
                if position.active {
                    self.close_position(position_id);
                }
                position_id += 1;
            };

            self.emit(EmergencyModeActivated {
                reason: 'manual_emergency_close',
                timestamp: get_block_timestamp(),
            });
        }

        fn set_authorized_dex(ref self: ContractState, dex: ContractAddress, authorized: bool) {
            self._check_owner();
            self.authorized_dexs.write(dex, authorized);

            self.emit(DEXAuthorizationUpdated { dex, authorized });
        }

        fn needs_rebalancing(self: @ContractState) -> bool {
            let current_delta = self.current_delta.read();
            let target_delta = self.target_delta.read();
            let threshold = self.rebalance_threshold.read();

            let deviation = if current_delta > target_delta {
                (current_delta - target_delta).try_into().unwrap()
            } else {
                (target_delta - current_delta).try_into().unwrap()
            };

            deviation > threshold
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

        /// Execute DEX trade (placeholder for actual DEX integration)
        fn _execute_dex_trade(
            self: @ContractState,
            dex_address: ContractAddress,
            size: u256,
            leverage: u8,
            max_slippage_bps: u16,
        ) {
            // In production, this would integrate with actual DEX APIs
            // For zkLend: call their perpetual trading interface
            // For MySwap: call their perpetual trading interface
            // This is a placeholder implementation
        }

        /// Execute DEX position close (placeholder for actual DEX integration)
        fn _execute_dex_close(self: @ContractState, dex_address: ContractAddress, size: u256) {
            // In production, this would integrate with actual DEX APIs
            // This is a placeholder implementation
        }

        /// Get funding rate from DEX (placeholder for actual DEX integration)
        fn _get_funding_rate(self: @ContractState, dex_address: ContractAddress) -> i256 {
            // In production, this would fetch actual funding rates from DEX
            // Positive rate means longs pay shorts (good for our short positions)
            // Simulating a positive funding rate of 0.01% (10 basis points)
            100 // 0.01% in basis points
        }

        /// Add margin to position to prevent liquidation
        fn _add_margin_to_position(ref self: ContractState, position_id: u32, additional_margin: u256) {
            let mut position = self.positions.read(position_id);
            position.margin += additional_margin;
            self.positions.write(position_id, position);

            // Calculate new margin ratio
            let oracle = IPriceOracleDispatcher { contract_address: self.price_oracle.read() };
            let strk_token = self.strk_token.read();
            let price_data = oracle.get_price(strk_token);
            let current_price = price_data.price;

            let size_abs: u256 = if position.size < 0 {
                (-position.size).try_into().unwrap()
            } else {
                position.size.try_into().unwrap()
            };

            let position_value = size_abs * current_price / 100000000;
            let new_margin_ratio = position.margin * 1000000000000000000 / position_value;

            self.emit(MarginAdded {
                position_id,
                margin_added: additional_margin,
                new_margin_ratio,
            });
        }
    }
}
