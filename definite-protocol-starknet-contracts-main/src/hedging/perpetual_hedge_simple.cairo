use starknet::ContractAddress;
use starknet::storage::{
    StoragePointerReadAccess, StoragePointerWriteAccess,
    StorageMapReadAccess, StorageMapWriteAccess
};

/// Simplified perpetual position data without i256
#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct PositionData {
    pub dex_address: ContractAddress,
    pub size: u256,           // Always positive, direction stored separately
    pub is_short: bool,       // true = short, false = long
    pub entry_price: u256,
    pub leverage: u8,
    pub margin: u256,
    pub funding_accrued: u256,
    pub is_funding_negative: bool,
    pub liquidation_price: u256,
    pub timestamp: u64,
    pub is_active: bool,
}

#[starknet::interface]
trait IPerpetualHedge<TContractState> {
    /// Open new perpetual position
    fn open_position(
        ref self: TContractState,
        dex_address: ContractAddress,
        size: u256,
        is_short: bool,
        leverage: u8,
        margin: u256,
    ) -> u32;
    
    /// Close position by ID
    fn close_position(ref self: TContractState, position_id: u32) -> u256;
    
    /// Get position data
    fn get_position(self: @TContractState, position_id: u32) -> PositionData;
    
    /// Get current delta exposure (absolute value)
    fn calculate_current_delta(self: @TContractState) -> u256;
    
    /// Check if portfolio is net short (true) or net long (false)
    fn is_net_short(self: @TContractState) -> bool;
    
    /// Get target delta
    fn get_target_delta(self: @TContractState) -> u256;
    
    /// Set target delta
    fn set_target_delta(ref self: TContractState, target_delta: u256);
}

#[starknet::contract]
mod PerpetualHedge {
    use super::{PositionData, IPerpetualHedge};
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use core::num::traits::Zero;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        protocol_vault: ContractAddress,
        price_oracle: ContractAddress,
        
        // Position management
        next_position_id: u32,
        active_positions_count: u32,

        // Delta management
        target_delta: u256,
        current_delta: u256,
        is_net_short: bool,

        // Risk parameters
        max_leverage: u8,
        min_margin: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        PositionOpened: PositionOpened,
        PositionClosed: PositionClosed,
        DeltaUpdated: DeltaUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct PositionOpened {
        pub position_id: u32,
        pub dex_address: ContractAddress,
        pub size: u256,
        pub is_short: bool,
        pub entry_price: u256,
        pub leverage: u8,
    }

    #[derive(Drop, starknet::Event)]
    struct PositionClosed {
        pub position_id: u32,
        pub exit_price: u256,
        pub pnl: u256,
        pub is_profit: bool,
    }

    #[derive(Drop, starknet::Event)]
    struct DeltaUpdated {
        pub old_delta: u256,
        pub new_delta: u256,
        pub is_net_short: bool,
    }

    mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'PerpHedge: zero address';
        pub const UNAUTHORIZED_CALLER: felt252 = 'PerpHedge: unauthorized';
        pub const POSITION_NOT_FOUND: felt252 = 'PerpHedge: position not found';
        pub const INVALID_LEVERAGE: felt252 = 'PerpHedge: invalid leverage';
        pub const INSUFFICIENT_MARGIN: felt252 = 'PerpHedge: insufficient margin';
        pub const UNAUTHORIZED_DEX: felt252 = 'PerpHedge: unauthorized dex';
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
        self.next_position_id.write(1);
        self.target_delta.write(0);           // Delta-neutral
        self.current_delta.write(0);
        self.is_net_short.write(false);
        self.max_leverage.write(10);          // 10x max leverage
        self.min_margin.write(1000000000000000000); // 1 STRK minimum
    }

    #[abi(embed_v0)]
    impl PerpetualHedgeImpl of IPerpetualHedge<ContractState> {
        fn open_position(
            ref self: ContractState,
            dex_address: ContractAddress,
            size: u256,
            is_short: bool,
            leverage: u8,
            margin: u256,
        ) -> u32 {
            self._check_owner();
            
            // Validate parameters
            assert(!dex_address.is_zero(), Errors::ZERO_ADDRESS);
            assert(self.authorized_dexs.read(dex_address), Errors::UNAUTHORIZED_DEX);
            assert(leverage > 0 && leverage <= self.max_leverage.read(), Errors::INVALID_LEVERAGE);
            assert(margin >= self.min_margin.read(), Errors::INSUFFICIENT_MARGIN);
            
            let position_id = self.next_position_id.read();
            let current_time = get_block_timestamp();
            
            // Create position
            let position = PositionData {
                dex_address,
                size,
                is_short,
                entry_price: 100000000, // Placeholder price (8 decimals)
                leverage,
                margin,
                funding_accrued: 0,
                is_funding_negative: false,
                liquidation_price: 0, // Calculate based on leverage
                timestamp: current_time,
                is_active: true,
            };
            
            self.positions.write(position_id, position);
            self.next_position_id.write(position_id + 1);
            self.active_positions_count.write(self.active_positions_count.read() + 1);
            
            // Update delta exposure
            self._update_delta_exposure();
            
            self.emit(PositionOpened {
                position_id,
                dex_address,
                size,
                is_short,
                entry_price: position.entry_price,
                leverage,
            });
            
            position_id
        }

        fn close_position(ref self: ContractState, position_id: u32) -> u256 {
            self._check_owner();
            
            let mut position = self.positions.read(position_id);
            assert(position.is_active, Errors::POSITION_NOT_FOUND);
            
            // Mark position as closed
            position.is_active = false;
            self.positions.write(position_id, position);
            self.active_positions_count.write(self.active_positions_count.read() - 1);
            
            // Calculate PnL (simplified)
            let exit_price = 105000000; // Placeholder exit price
            let pnl = if position.size > 0 { position.size * 5 / 100 } else { 0 }; // 5% profit
            
            // Update delta exposure
            self._update_delta_exposure();
            
            self.emit(PositionClosed {
                position_id,
                exit_price,
                pnl,
                is_profit: true,
            });
            
            pnl
        }

        fn get_position(self: @ContractState, position_id: u32) -> PositionData {
            self.positions.read(position_id)
        }

        fn calculate_current_delta(self: @ContractState) -> u256 {
            self.current_delta.read()
        }

        fn is_net_short(self: @ContractState) -> bool {
            self.is_net_short.read()
        }

        fn get_target_delta(self: @ContractState) -> u256 {
            self.target_delta.read()
        }

        fn set_target_delta(ref self: ContractState, target_delta: u256) {
            self._check_owner();
            let old_delta = self.target_delta.read();
            self.target_delta.write(target_delta);
            
            self.emit(DeltaUpdated {
                old_delta,
                new_delta: target_delta,
                is_net_short: self.is_net_short.read(),
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

        /// Update delta exposure calculation
        fn _update_delta_exposure(ref self: ContractState) {
            let mut total_long: u256 = 0;
            let mut total_short: u256 = 0;
            
            // Simplified calculation - in production would iterate through all positions
            let active_count = self.active_positions_count.read();
            if active_count > 0 {
                total_short = 1000000000000000000; // 1 STRK equivalent short
            }
            
            let (net_delta, is_short) = if total_short > total_long {
                (total_short - total_long, true)
            } else {
                (total_long - total_short, false)
            };
            
            self.current_delta.write(net_delta);
            self.is_net_short.write(is_short);
        }
    }
}
