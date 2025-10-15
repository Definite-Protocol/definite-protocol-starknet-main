use starknet::ContractAddress;

/// Interface for hSTRK token - yield-bearing token representing user deposits in Definite Protocol
#[starknet::interface]
pub trait IhSTRKToken<TContractState> {
    // Standard ERC20 functions
    fn name(self: @TContractState) -> ByteArray;
    fn symbol(self: @TContractState) -> ByteArray;
    fn decimals(self: @TContractState) -> u8;
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, to: ContractAddress, amount: u256) -> bool;
    fn transfer_from(ref self: TContractState, from: ContractAddress, to: ContractAddress, amount: u256) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    
    /// Mint tokens - only callable by protocol vault
    fn mint(ref self: TContractState, to: ContractAddress, amount: u256);
    
    /// Burn tokens - only callable by protocol vault  
    fn burn(ref self: TContractState, from: ContractAddress, amount: u256);
    
    /// Pause token transfers - only callable by owner
    fn pause(ref self: TContractState);
    
    /// Unpause token transfers - only callable by owner
    fn unpause(ref self: TContractState);
    
    /// Check if token is paused
    fn is_paused(self: @TContractState) -> bool;
    
    /// Set protocol vault address - only callable by owner
    fn set_protocol_vault(ref self: TContractState, vault_address: ContractAddress);
    
    /// Get protocol vault address
    fn get_protocol_vault(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod hSTRKToken {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess,
        StoragePointerReadAccess, StoragePointerWriteAccess
    };
    use core::num::traits::Zero;

    #[storage]
    struct Storage {
        // ERC20 storage
        name: ByteArray,
        symbol: ByteArray,
        decimals: u8,
        total_supply: u256,
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,

        // Protocol-specific storage
        owner: ContractAddress,
        protocol_vault: ContractAddress,
        paused: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Transfer: Transfer,
        Approval: Approval,
        Minted: Minted,
        Burned: Burned,
        Paused: Paused,
        Unpaused: Unpaused,
        ProtocolVaultUpdated: ProtocolVaultUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct Transfer {
        #[key]
        pub from: ContractAddress,
        #[key]
        pub to: ContractAddress,
        pub value: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Approval {
        #[key]
        pub owner: ContractAddress,
        #[key]
        pub spender: ContractAddress,
        pub value: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Minted {
        #[key]
        pub to: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Burned {
        #[key]
        pub from: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Paused {}

    #[derive(Drop, starknet::Event)]
    struct Unpaused {}

    #[derive(Drop, starknet::Event)]
    struct ProtocolVaultUpdated {
        pub old_vault: ContractAddress,
        pub new_vault: ContractAddress,
    }

    mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'hSTRK: zero address';
        pub const INSUFFICIENT_BALANCE: felt252 = 'hSTRK: insufficient balance';
        pub const INSUFFICIENT_ALLOWANCE: felt252 = 'hSTRK: insufficient allowance';
        pub const PAUSED: felt252 = 'hSTRK: paused';
        pub const UNAUTHORIZED: felt252 = 'hSTRK: unauthorized';
        pub const ALREADY_PAUSED: felt252 = 'hSTRK: already paused';
        pub const NOT_PAUSED: felt252 = 'hSTRK: not paused';
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        protocol_vault: ContractAddress,
    ) {
        assert(!owner.is_zero(), Errors::ZERO_ADDRESS);
        assert(!protocol_vault.is_zero(), Errors::ZERO_ADDRESS);

        self.name.write("Hedged STRK");
        self.symbol.write("hSTRK");
        self.decimals.write(18);
        self.total_supply.write(0);
        self.owner.write(owner);
        self.protocol_vault.write(protocol_vault);
        self.paused.write(false);
    }

    #[abi(embed_v0)]
    impl hSTRKTokenImpl of super::IhSTRKToken<ContractState> {
        fn name(self: @ContractState) -> ByteArray {
            self.name.read()
        }

        fn symbol(self: @ContractState) -> ByteArray {
            self.symbol.read()
        }

        fn decimals(self: @ContractState) -> u8 {
            self.decimals.read()
        }

        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        fn allowance(self: @ContractState, owner: ContractAddress, spender: ContractAddress) -> u256 {
            self.allowances.read((owner, spender))
        }

        fn transfer(ref self: ContractState, to: ContractAddress, amount: u256) -> bool {
            self._check_not_paused();
            let caller = get_caller_address();
            self._transfer(caller, to, amount);
            true
        }

        fn transfer_from(ref self: ContractState, from: ContractAddress, to: ContractAddress, amount: u256) -> bool {
            self._check_not_paused();
            let caller = get_caller_address();
            let current_allowance = self.allowances.read((from, caller));
            assert(current_allowance >= amount, Errors::INSUFFICIENT_ALLOWANCE);

            self.allowances.write((from, caller), current_allowance - amount);
            self._transfer(from, to, amount);
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self.allowances.write((caller, spender), amount);
            self.emit(Approval { owner: caller, spender, value: amount });
            true
        }

        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            self._check_not_paused();
            self._check_only_vault();
            assert(!to.is_zero(), Errors::ZERO_ADDRESS);

            let new_total_supply = self.total_supply.read() + amount;
            let new_balance = self.balances.read(to) + amount;

            self.total_supply.write(new_total_supply);
            self.balances.write(to, new_balance);

            self.emit(Transfer { from: Zero::zero(), to, value: amount });
            self.emit(Minted { to, amount });
        }

        fn burn(ref self: ContractState, from: ContractAddress, amount: u256) {
            self._check_not_paused();
            self._check_only_vault();
            assert(!from.is_zero(), Errors::ZERO_ADDRESS);

            let balance = self.balances.read(from);
            assert(balance >= amount, Errors::INSUFFICIENT_BALANCE);

            let new_total_supply = self.total_supply.read() - amount;
            let new_balance = balance - amount;

            self.total_supply.write(new_total_supply);
            self.balances.write(from, new_balance);

            self.emit(Transfer { from, to: Zero::zero(), value: amount });
            self.emit(Burned { from, amount });
        }

        fn pause(ref self: ContractState) {
            self._check_only_owner();
            assert(!self.paused.read(), Errors::ALREADY_PAUSED);

            self.paused.write(true);
            self.emit(Paused {});
        }

        fn unpause(ref self: ContractState) {
            self._check_only_owner();
            assert(self.paused.read(), Errors::NOT_PAUSED);

            self.paused.write(false);
            self.emit(Unpaused {});
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        fn set_protocol_vault(ref self: ContractState, vault_address: ContractAddress) {
            self._check_only_owner();
            assert(!vault_address.is_zero(), Errors::ZERO_ADDRESS);

            let old_vault = self.protocol_vault.read();
            self.protocol_vault.write(vault_address);

            self.emit(ProtocolVaultUpdated { old_vault, new_vault: vault_address });
        }

        fn get_protocol_vault(self: @ContractState) -> ContractAddress {
            self.protocol_vault.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _check_not_paused(self: @ContractState) {
            assert(!self.paused.read(), Errors::PAUSED);
        }

        fn _check_only_owner(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), Errors::UNAUTHORIZED);
        }

        fn _check_only_vault(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.protocol_vault.read(), Errors::UNAUTHORIZED);
        }

        fn _transfer(ref self: ContractState, from: ContractAddress, to: ContractAddress, amount: u256) {
            assert(!from.is_zero(), Errors::ZERO_ADDRESS);
            assert(!to.is_zero(), Errors::ZERO_ADDRESS);

            let from_balance = self.balances.read(from);
            assert(from_balance >= amount, Errors::INSUFFICIENT_BALANCE);

            let to_balance = self.balances.read(to);

            self.balances.write(from, from_balance - amount);
            self.balances.write(to, to_balance + amount);

            self.emit(Transfer { from, to, value: amount });
        }
    }
}

/// Error constants for hSTRK token
mod Errors {
    pub const ZERO_ADDRESS: felt252 = 'Zero address not allowed';
    pub const INSUFFICIENT_BALANCE: felt252 = 'Insufficient balance';
    pub const INSUFFICIENT_ALLOWANCE: felt252 = 'Insufficient allowance';
    pub const UNAUTHORIZED: felt252 = 'Unauthorized';
    pub const PAUSED: felt252 = 'Contract is paused';
    pub const ALREADY_PAUSED: felt252 = 'Already paused';
    pub const NOT_PAUSED: felt252 = 'Not paused';
}
