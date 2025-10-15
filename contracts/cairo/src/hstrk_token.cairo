// SPDX-License-Identifier: MIT
// hSTRK Token - Hedged STRK Token
// Production-ready ERC20 implementation on Starknet
// Cairo 2.12.2 compatible

use starknet::ContractAddress;

#[starknet::interface]
pub trait IHSTRKToken<TContractState> {
    // ERC20 Standard
    fn name(self: @TContractState) -> ByteArray;
    fn symbol(self: @TContractState) -> ByteArray;
    fn decimals(self: @TContractState) -> u8;
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256
    ) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;

    // Protocol Functions
    fn mint(ref self: TContractState, to: ContractAddress, amount: u256, collateral: u256);
    fn burn(ref self: TContractState, from: ContractAddress, amount: u256) -> (u256, u256);

    // View Functions
    fn get_total_collateral(self: @TContractState) -> u256;
    fn get_protocol_address(self: @TContractState) -> ContractAddress;
    fn is_paused(self: @TContractState) -> bool;
    fn get_min_mint_amount(self: @TContractState) -> u256;
    fn get_exit_fee_bps(self: @TContractState) -> u256;

    // Admin Functions
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn set_protocol_address(ref self: TContractState, new_protocol: ContractAddress);
    fn set_min_mint_amount(ref self: TContractState, new_min: u256);
    fn set_exit_fee(ref self: TContractState, new_fee: u256);
}

#[starknet::contract]
mod HSTRKToken {
    use super::ContractAddress;
    use starknet::get_caller_address;
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Map, StorageMapReadAccess,
        StorageMapWriteAccess
    };
    use core::num::traits::Zero;
    use openzeppelin::token::erc20::{ERC20Component, ERC20HooksEmptyImpl};
    use openzeppelin::access::ownable::OwnableComponent;

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    // ERC20 Impl
    impl ERC20Impl = ERC20Component::ERC20Impl<ContractState>;
    impl ERC20MetadataImpl = ERC20Component::ERC20MetadataImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    // Ownable Mixin
    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        protocol_address: ContractAddress,
        is_paused: bool,
        min_mint_amount: u256,
        exit_fee_bps: u256,
        total_collateral: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        Minted: Minted,
        Burned: Burned,
        Paused: Paused,
        Unpaused: Unpaused,
        ProtocolAddressUpdated: ProtocolAddressUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct Minted {
        #[key]
        to: ContractAddress,
        amount: u256,
        collateral: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Burned {
        #[key]
        from: ContractAddress,
        amount: u256,
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
    struct ProtocolAddressUpdated {
        old_address: ContractAddress,
        new_address: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, owner: ContractAddress, protocol_address: ContractAddress
    ) {
        // Initialize ERC20
        self.erc20.initializer("Hedged STRK", "hSTRK");

        // Initialize Ownable
        self.ownable.initializer(owner);

        // Initialize protocol parameters
        self.protocol_address.write(protocol_address);
        self.is_paused.write(false);
        self.min_mint_amount.write(2000000000000000000); // 2 STRK minimum (18 decimals)
        self.exit_fee_bps.write(10); // 0.1% exit fee
        self.total_collateral.write(0);
    }

    #[abi(embed_v0)]
    impl HSTRKTokenImpl of super::IHSTRKToken<ContractState> {
        // ERC20 Standard Functions
        fn name(self: @ContractState) -> ByteArray {
            self.erc20.name()
        }

        fn symbol(self: @ContractState) -> ByteArray {
            self.erc20.symbol()
        }

        fn decimals(self: @ContractState) -> u8 {
            self.erc20.decimals()
        }

        fn total_supply(self: @ContractState) -> u256 {
            self.erc20.total_supply()
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.erc20.balance_of(account)
        }

        fn allowance(
            self: @ContractState, owner: ContractAddress, spender: ContractAddress
        ) -> u256 {
            self.erc20.allowance(owner, spender)
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            self.erc20.transfer(recipient, amount)
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256
        ) -> bool {
            self.erc20.transfer_from(sender, recipient, amount)
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            self.erc20.approve(spender, amount)
        }

        // Protocol Functions
        fn mint(ref self: ContractState, to: ContractAddress, amount: u256, collateral: u256) {
            let caller = get_caller_address();
            assert(caller == self.protocol_address.read(), 'Only protocol can mint');
            assert(!self.is_paused.read(), 'Contract is paused');
            assert(amount >= self.min_mint_amount.read(), 'Amount below minimum');

            // Mint tokens
            self.erc20.mint(to, amount);

            // Update collateral
            let old_collateral = self.total_collateral.read();
            let new_collateral = old_collateral + collateral;
            self.total_collateral.write(new_collateral);

            // Emit event
            self.emit(Minted { to, amount, collateral });
        }

        fn burn(ref self: ContractState, from: ContractAddress, amount: u256) -> (u256, u256) {
            let caller = get_caller_address();
            assert(caller == self.protocol_address.read(), 'Only protocol can burn');
            assert(!self.is_paused.read(), 'Contract is paused');

            // Calculate fee
            let fee = (amount * self.exit_fee_bps.read()) / 10000;
            let collateral_to_return = amount - fee;

            // Burn tokens
            self.erc20.burn(from, amount);

            // Update collateral
            let old_collateral = self.total_collateral.read();
            let new_collateral = old_collateral - amount;
            self.total_collateral.write(new_collateral);

            // Emit event
            self.emit(Burned { from, amount, collateral_returned: collateral_to_return, fee });

            (collateral_to_return, fee)
        }

        // View Functions
        fn get_total_collateral(self: @ContractState) -> u256 {
            self.total_collateral.read()
        }

        fn get_protocol_address(self: @ContractState) -> ContractAddress {
            self.protocol_address.read()
        }

        fn is_paused(self: @ContractState) -> bool {
            self.is_paused.read()
        }

        fn get_min_mint_amount(self: @ContractState) -> u256 {
            self.min_mint_amount.read()
        }

        fn get_exit_fee_bps(self: @ContractState) -> u256 {
            self.exit_fee_bps.read()
        }

        // Admin Functions
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

        fn set_protocol_address(ref self: ContractState, new_protocol: ContractAddress) {
            self.ownable.assert_only_owner();
            let old_address = self.protocol_address.read();
            self.protocol_address.write(new_protocol);
            self.emit(ProtocolAddressUpdated { old_address, new_address: new_protocol });
        }

        fn set_min_mint_amount(ref self: ContractState, new_min: u256) {
            self.ownable.assert_only_owner();
            self.min_mint_amount.write(new_min);
        }

        fn set_exit_fee(ref self: ContractState, new_fee: u256) {
            self.ownable.assert_only_owner();
            assert(new_fee <= 1000, 'Fee too high'); // Max 10%
            self.exit_fee_bps.write(new_fee);
        }
    }
}

