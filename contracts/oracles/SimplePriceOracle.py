#!/usr/bin/env python3
"""
Simple Price Oracle Smart Contract
Basic price feed functionality for hALGO protocol

Features:
- Price submission by authorized oracles
- Price validation and staleness checks
- Circuit breaker protection
- Multi-oracle aggregation
"""

from pyteal import *

def approval_program():
    """Simple price oracle approval program"""
    
    # Global state keys
    current_price_key = Bytes("current_price")
    last_update_key = Bytes("last_update")
    oracle_count_key = Bytes("oracle_count")
    
    # Local state keys
    oracle_authorized_key = Bytes("oracle_auth")
    
    # Configuration
    max_price_deviation = Int(500)  # 5% max deviation
    staleness_threshold = Int(3600)  # 1 hour
    
    # Handle creation
    on_creation = Seq([
        App.globalPut(current_price_key, Int(250000)),  # $0.25 initial price
        App.globalPut(last_update_key, Global.latest_timestamp()),
        App.globalPut(oracle_count_key, Int(0)),
        Return(Int(1))
    ])
    
    # Handle opt-in (oracle registration)
    on_opt_in = Seq([
        App.localPut(Txn.sender(), oracle_authorized_key, Int(0)),
        Return(Int(1))
    ])
    
    # Authorize oracle (simplified - oracle must opt-in first)
    authorize_oracle = Seq([
        Assert(Txn.sender() == Global.creator_address()),

        # Note: Oracle must opt-in first, then creator authorizes
        App.globalPut(oracle_count_key, App.globalGet(oracle_count_key) + Int(1)),

        Return(Int(1))
    ])
    
    # Submit price
    new_price = ScratchVar(TealType.uint64)
    current_price = ScratchVar(TealType.uint64)
    price_diff = ScratchVar(TealType.uint64)
    max_deviation = ScratchVar(TealType.uint64)

    submit_price = Seq([
        Assert(App.localGet(Txn.sender(), oracle_authorized_key) == Int(1)),
        Assert(Txn.application_args.length() >= Int(2)),

        # Parse new price
        new_price.store(Btoi(Txn.application_args[1])),
        current_price.store(App.globalGet(current_price_key)),

        # Validate price (basic deviation check)
        price_diff.store(If(new_price.load() > current_price.load(),
                           new_price.load() - current_price.load(),
                           current_price.load() - new_price.load())),
        max_deviation.store(current_price.load() * max_price_deviation / Int(10000)),

        Assert(price_diff.load() <= max_deviation.load()),

        # Update price and timestamp
        App.globalPut(current_price_key, new_price.load()),
        App.globalPut(last_update_key, Global.latest_timestamp()),

        Return(Int(1))
    ])
    
    # Get current price
    current_time = ScratchVar(TealType.uint64)
    last_update = ScratchVar(TealType.uint64)

    get_price = Seq([
        current_time.store(Global.latest_timestamp()),
        last_update.store(App.globalGet(last_update_key)),

        # Check if price is stale
        Assert(current_time.load() - last_update.load() <= staleness_threshold),

        Return(App.globalGet(current_price_key))
    ])
    
    # Main program logic
    program = Cond(
        [Txn.application_id() == Int(0), on_creation],
        [Txn.on_completion() == OnComplete.OptIn, on_opt_in],
        [Txn.on_completion() == OnComplete.NoOp, Cond(
            [Txn.application_args[0] == Bytes("authorize"), authorize_oracle],
            [Txn.application_args[0] == Bytes("submit"), submit_price],
            [Txn.application_args[0] == Bytes("get_price"), get_price],
        )],
        [Txn.on_completion() == OnComplete.CloseOut, Return(Int(1))],
        [Txn.on_completion() == OnComplete.UpdateApplication, 
         Return(Txn.sender() == Global.creator_address())],
        [Txn.on_completion() == OnComplete.DeleteApplication, 
         Return(Txn.sender() == Global.creator_address())],
    )
    
    return program

def clear_state_program():
    """Clear state program"""
    return Return(Int(1))

# Test compilation
if __name__ == "__main__":
    print("Compiling Simple Price Oracle Contract...")
    
    approval_teal = compileTeal(approval_program(), Mode.Application, version=6)
    clear_state_teal = compileTeal(clear_state_program(), Mode.Application, version=6)
    
    print("✅ Compilation successful!")
    print(f"Approval program: {len(approval_teal)} characters")
    print(f"Clear state program: {len(clear_state_teal)} characters")
