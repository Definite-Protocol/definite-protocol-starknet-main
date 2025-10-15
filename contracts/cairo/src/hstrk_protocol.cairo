// SPDX-License-Identifier: MIT
// hSTRK Protocol - Hedged STRK Protocol
// Production-ready protocol for minting/redeeming hSTRK
// Cairo 2.12.2 compatible

use starknet::ContractAddress;

#[starknet::interface]
pub trait IHSTRKProtocol<TContractState> {
    // Core Functions
    fn mint_hstrk(ref self: TContractState, collateral_amount: u256) -> u256;
    fn redeem_hstrk(ref self: TContractState, hstrk_amount: u256) -> (u256, u256);

    // View Functions
    fn get_user_position(self: @TContractState, user: ContractAddress) -> (u256, u256, u256);
    fn get_protocol_stats(self: @TContractState) -> (u256, u256, u256, u256);
    fn calculate_mint_amount(self: @TContractState, collateral_amount: u256) -> u256;
    fn calculate_redeem_amount(self: @TContractState, hstrk_amount: u256) -> (u256, u256);

    // Admin Functions
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn set_collateral_ratio(ref self: TContractState, new_ratio: u256);
    fn set_liquidation_threshold(ref self: TContractState, new_threshold: u256);
    fn set_oracle_address(ref self: TContractState, new_oracle: ContractAddress);
}

#[starknet::contract]
mod HSTRKProtocol {
    use super::ContractAddress;
    use starknet::get_caller_address;
    use starknet::get_contract_address;
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Map, StorageMapReadAccess,
        StorageMapWriteAccess
    };
    use core::num::traits::Zero;
    use openzeppelin::access::ownable::OwnableComponent;
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        hstrk_token: ContractAddress,
        collateral_token: ContractAddress,
        oracle_address: ContractAddress,
        user_deposits: Map<ContractAddress, u256>,
        user_minted: Map<ContractAddress, u256>,
        collateral_ratio: u256,
        liquidation_threshold: u256,
        minimum_deposit: u256,
        is_paused: bool,
        total_deposits: u256,
        total_minted: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        Minted: Minted,
        Redeemed: Redeemed,
        Paused: Paused,
        Unpaused: Unpaused,
        CollateralRatioUpdated: CollateralRatioUpdated,
        LiquidationThresholdUpdated: LiquidationThresholdUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct Minted {
        #[key]
        user: ContractAddress,
        collateral_amount: u256,
        hstrk_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Redeemed {
        #[key]
        user: ContractAddress,
        hstrk_amount: u256,
        collateral_returned: u256,
        fee: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Paused {
        by: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct Unpaused {
        by: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct CollateralRatioUpdated {
        old_ratio: u256,
        new_ratio: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct LiquidationThresholdUpdated {
        old_threshold: u256,
        new_threshold: u256,
    }

    // Custom interface for hSTRK token
    #[starknet::interface]
    trait IHSTRKTokenInternal<TContractState> {
        fn mint(ref self: TContractState, to: ContractAddress, amount: u256, collateral: u256);
        fn burn(ref self: TContractState, from: ContractAddress, amount: u256) -> (u256, u256);
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        hstrk_token: ContractAddress,
        collateral_token: ContractAddress,
        oracle_address: ContractAddress
    ) {
        // Initialize Ownable
        self.ownable.initializer(owner);

        // Set addresses
        self.hstrk_token.write(hstrk_token);
        self.collateral_token.write(collateral_token);
        self.oracle_address.write(oracle_address);

        // Set protocol parameters
        self.collateral_ratio.write(15000); // 150% (basis points)
        self.liquidation_threshold.write(12000); // 120%
        self.minimum_deposit.write(2000000000000000000); // 2 STRK (18 decimals)
        self.is_paused.write(false);

        // Initialize counters
        self.total_deposits.write(0);
        self.total_minted.write(0);
    }

    #[abi(embed_v0)]
    impl HSTRKProtocolImpl of super::IHSTRKProtocol<ContractState> {
        fn mint_hstrk(ref self: ContractState, collateral_amount: u256) -> u256 {
            assert(!self.is_paused.read(), 'Protocol is paused');
            assert(collateral_amount >= self.minimum_deposit.read(), 'Below minimum deposit');

            let caller = get_caller_address();
            let this_contract = get_contract_address();

            // Transfer collateral from user to protocol
            let collateral_token = IERC20Dispatcher {
                contract_address: self.collateral_token.read()
            };
            let success = collateral_token
                .transfer_from(caller, this_contract, collateral_amount);
            assert(success, 'Collateral transfer failed');

            // Calculate hSTRK amount (1:1 for now, can add oracle pricing later)
            let hstrk_amount = collateral_amount;

            // Update user position
            let current_deposit = self.user_deposits.read(caller);
            let current_minted = self.user_minted.read(caller);

            self.user_deposits.write(caller, current_deposit + collateral_amount);
            self.user_minted.write(caller, current_minted + hstrk_amount);

            // Update totals
            self.total_deposits.write(self.total_deposits.read() + collateral_amount);
            self.total_minted.write(self.total_minted.read() + hstrk_amount);

            // Mint hSTRK tokens
            let hstrk_token = IHSTRKTokenInternalDispatcher {
                contract_address: self.hstrk_token.read()
            };
            hstrk_token.mint(caller, hstrk_amount, collateral_amount);

            // Emit event
            self.emit(Minted { user: caller, collateral_amount, hstrk_amount });

            hstrk_amount
        }

        fn redeem_hstrk(ref self: ContractState, hstrk_amount: u256) -> (u256, u256) {
            assert(!self.is_paused.read(), 'Protocol is paused');
            assert(hstrk_amount > 0, 'Amount must be positive');

            let caller = get_caller_address();

            // Check user has enough minted
            let user_minted = self.user_minted.read(caller);
            assert(user_minted >= hstrk_amount, 'Insufficient minted balance');

            // Burn hSTRK tokens and get collateral amount
            let hstrk_token = IHSTRKTokenInternalDispatcher {
                contract_address: self.hstrk_token.read()
            };
            let (collateral_to_return, fee) = hstrk_token.burn(caller, hstrk_amount);

            // Update user position
            let current_deposit = self.user_deposits.read(caller);
            self.user_deposits.write(caller, current_deposit - hstrk_amount);
            self.user_minted.write(caller, user_minted - hstrk_amount);

            // Update totals
            self.total_deposits.write(self.total_deposits.read() - hstrk_amount);
            self.total_minted.write(self.total_minted.read() - hstrk_amount);

            // Transfer collateral back to user
            let collateral_token = IERC20Dispatcher {
                contract_address: self.collateral_token.read()
            };
            let success = collateral_token.transfer(caller, collateral_to_return);
            assert(success, 'Collateral transfer failed');

            // Emit event
            self.emit(Redeemed { user: caller, hstrk_amount, collateral_returned: collateral_to_return, fee });

            (collateral_to_return, fee)
        }

        fn get_user_position(self: @ContractState, user: ContractAddress) -> (u256, u256, u256) {
            let deposits = self.user_deposits.read(user);
            let minted = self.user_minted.read(user);

            // Calculate collateralization ratio
            let ratio = if minted == 0 {
                0
            } else {
                (deposits * 10000) / minted
            };

            (deposits, minted, ratio)
        }

        fn get_protocol_stats(self: @ContractState) -> (u256, u256, u256, u256) {
            (
                self.total_deposits.read(),
                self.total_minted.read(),
                self.collateral_ratio.read(),
                self.liquidation_threshold.read()
            )
        }

        fn calculate_mint_amount(self: @ContractState, collateral_amount: u256) -> u256 {
            // 1:1 ratio for now (can add oracle pricing later)
            collateral_amount
        }

        fn calculate_redeem_amount(self: @ContractState, hstrk_amount: u256) -> (u256, u256) {
            // Calculate fee (0.1% default)
            let fee = (hstrk_amount * 10) / 10000;
            let collateral_to_return = hstrk_amount - fee;

            (collateral_to_return, fee)
        }

        fn pause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.is_paused.write(true);
            self.emit(Paused { by: get_caller_address() });
        }

        fn unpause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.is_paused.write(false);
            self.emit(Unpaused { by: get_caller_address() });
        }

        fn set_collateral_ratio(ref self: ContractState, new_ratio: u256) {
            self.ownable.assert_only_owner();
            assert(new_ratio >= 10000, 'Ratio must be >= 100%');
            assert(new_ratio <= 50000, 'Ratio must be <= 500%');

            let old_ratio = self.collateral_ratio.read();
            self.collateral_ratio.write(new_ratio);
            self.emit(CollateralRatioUpdated { old_ratio, new_ratio });
        }

        fn set_liquidation_threshold(ref self: ContractState, new_threshold: u256) {
            self.ownable.assert_only_owner();
            assert(new_threshold >= 10000, 'Threshold must be >= 100%');
            assert(new_threshold <= 20000, 'Threshold must be <= 200%');
            assert(
                new_threshold < self.collateral_ratio.read(), 'Threshold must be < ratio'
            );

            let old_threshold = self.liquidation_threshold.read();
            self.liquidation_threshold.write(new_threshold);
            self.emit(LiquidationThresholdUpdated { old_threshold, new_threshold });
        }

        fn set_oracle_address(ref self: ContractState, new_oracle: ContractAddress) {
            self.ownable.assert_only_owner();
            self.oracle_address.write(new_oracle);
        }
    }
}

