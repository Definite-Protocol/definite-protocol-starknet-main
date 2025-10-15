"""
Rebalance Engine Contract for hALGO Protocol
Enterprise-grade auto-rebalancing and hedge management

Features:
- Delta hedging calculations
- Auto-rebalancing triggers
- Funding rate management
- Yield aggregation
- Performance optimization
"""

from pyteal import (
    App, Assert, Btoi, Bytes, Cond, Expr, Global, Gtxn, If, Int,
    Return, Seq, Txn, TxnType, OnComplete, ScratchVar, And, Or,
    compileTeal, Mode, TealType
)

# Rebalancing Configuration
REBALANCE_THRESHOLD = Int(500)  # 5% delta threshold
MIN_REBALANCE_INTERVAL = Int(3600)  # 1 hour minimum interval
MAX_SLIPPAGE = Int(300)  # 3% maximum slippage
FUNDING_RATE_PRECISION = Int(1000000)  # 6 decimal places

# Global State Keys
LAST_REBALANCE_KEY = Bytes("last_rebalance")
CURRENT_DELTA_KEY = Bytes("current_delta")
TARGET_DELTA_KEY = Bytes("target_delta")
FUNDING_RATE_KEY = Bytes("funding_rate")
YIELD_POOL_KEY = Bytes("yield_pool")
REBALANCE_COUNT_KEY = Bytes("rebalance_count")

def approval_program():
    """Rebalance Engine approval program"""
    
    # Application creation
    on_creation = Seq(
        App.globalPut(LAST_REBALANCE_KEY, Global.latest_timestamp()),
        App.globalPut(CURRENT_DELTA_KEY, Int(0)),
        App.globalPut(TARGET_DELTA_KEY, Int(0)),
        App.globalPut(FUNDING_RATE_KEY, Int(0)),
        App.globalPut(YIELD_POOL_KEY, Int(0)),
        App.globalPut(REBALANCE_COUNT_KEY, Int(0)),
        Return(Int(1))
    )
    
    # Calculate delta exposure
    total_halgo_supply = ScratchVar(TealType.uint64)
    total_collateral = ScratchVar(TealType.uint64)
    current_price = ScratchVar(TealType.uint64)
    price_change = ScratchVar(TealType.uint64)
    portfolio_value = ScratchVar(TealType.uint64)
    collateral_value = ScratchVar(TealType.uint64)
    current_delta = ScratchVar(TealType.uint64)

    calculate_delta = Seq(
        Assert(Txn.application_args.length() == Int(5)),
        total_halgo_supply.store(Btoi(Txn.application_args[1])),
        total_collateral.store(Btoi(Txn.application_args[2])),
        current_price.store(Btoi(Txn.application_args[3])),
        price_change.store(Btoi(Txn.application_args[4])),

        # Calculate current delta
        # Delta = (Change in portfolio value) / (Change in underlying price)
        portfolio_value.store(total_halgo_supply.load() * current_price.load() / Int(1000000)),
        collateral_value.store(total_collateral.load() * current_price.load() / Int(1000000)),

        # Simplified delta calculation
        current_delta.store(If(price_change.load() != Int(0),
            (portfolio_value.load() - collateral_value.load()) * Int(10000) / price_change.load(),
            Int(0)
        )),

        # Update global state
        App.globalPut(CURRENT_DELTA_KEY, current_delta.load()),

        Return(Int(1))
    )
    
    # Check if rebalancing is needed
    current_time = ScratchVar(TealType.uint64)
    last_rebalance = ScratchVar(TealType.uint64)
    time_since_rebalance = ScratchVar(TealType.uint64)
    time_ok = ScratchVar(TealType.uint64)
    current_delta_check = ScratchVar(TealType.uint64)
    target_delta_check = ScratchVar(TealType.uint64)
    delta_diff = ScratchVar(TealType.uint64)
    delta_threshold_exceeded = ScratchVar(TealType.uint64)
    rebalance_needed = ScratchVar(TealType.uint64)

    check_rebalance_needed = Seq(
        current_time.store(Global.latest_timestamp()),
        last_rebalance.store(App.globalGet(LAST_REBALANCE_KEY)),
        time_since_rebalance.store(current_time.load() - last_rebalance.load()),

        # Check time constraint
        time_ok.store(time_since_rebalance.load() >= MIN_REBALANCE_INTERVAL),

        # Check delta threshold
        current_delta_check.store(App.globalGet(CURRENT_DELTA_KEY)),
        target_delta_check.store(App.globalGet(TARGET_DELTA_KEY)),
        delta_diff.store(If(current_delta_check.load() > target_delta_check.load(),
            current_delta_check.load() - target_delta_check.load(),
            target_delta_check.load() - current_delta_check.load()
        )),
        delta_threshold_exceeded.store(delta_diff.load() > REBALANCE_THRESHOLD),

        # Return if rebalancing is needed
        rebalance_needed.store(And(time_ok.load(), delta_threshold_exceeded.load())),
        Return(rebalance_needed.load())
    )
    
    # Execute rebalancing
    rebalance_amount = ScratchVar(TealType.uint64)
    direction = ScratchVar(TealType.uint64)
    slippage = ScratchVar(TealType.uint64)
    current_time_rebalance = ScratchVar(TealType.uint64)
    rebalance_count = ScratchVar(TealType.uint64)

    execute_rebalance = Seq(
        Assert(Txn.application_args.length() == Int(4)),
        Assert(Global.group_size() >= Int(2)),  # Rebalance transactions

        rebalance_amount.store(Btoi(Txn.application_args[1])),
        direction.store(Btoi(Txn.application_args[2])),  # 1 for buy, 0 for sell
        slippage.store(Btoi(Txn.application_args[3])),

        # Validate slippage
        Assert(slippage.load() <= MAX_SLIPPAGE),

        # Update rebalance state
        current_time_rebalance.store(Global.latest_timestamp()),
        App.globalPut(LAST_REBALANCE_KEY, current_time_rebalance.load()),

        rebalance_count.store(App.globalGet(REBALANCE_COUNT_KEY)),
        App.globalPut(REBALANCE_COUNT_KEY, rebalance_count.load() + Int(1)),

        Return(Int(1))
    )
    
    # Update funding rate
    new_funding_rate = ScratchVar(TealType.uint64)

    update_funding_rate = Seq(
        Assert(Txn.application_args.length() == Int(2)),
        new_funding_rate.store(Btoi(Txn.application_args[1])),

        # Validate funding rate is reasonable (0 to +10%)
        # Note: PyTeal doesn't support negative integers directly
        Assert(new_funding_rate.load() <= Int(1000000)),

        App.globalPut(FUNDING_RATE_KEY, new_funding_rate.load()),
        Return(Int(1))
    )
    
    # Distribute yield
    yield_amount = ScratchVar(TealType.uint64)
    current_yield_pool = ScratchVar(TealType.uint64)

    distribute_yield = Seq(
        Assert(Txn.application_args.length() == Int(2)),
        Assert(Global.group_size() >= Int(2)),  # Yield payment + app call

        yield_amount.store(Btoi(Txn.application_args[1])),

        # Validate yield payment
        Assert(Gtxn[0].type_enum() == TxnType.Payment),
        Assert(Gtxn[0].receiver() == Global.current_application_address()),
        Assert(Gtxn[0].amount() == yield_amount.load()),

        # Update yield pool
        current_yield_pool.store(App.globalGet(YIELD_POOL_KEY)),
        App.globalPut(YIELD_POOL_KEY, current_yield_pool.load() + yield_amount.load()),

        Return(Int(1))
    )
    
    # Calculate optimal hedge ratio
    portfolio_value_hedge = ScratchVar(TealType.uint64)
    volatility = ScratchVar(TealType.uint64)
    correlation = ScratchVar(TealType.uint64)
    hedge_ratio = ScratchVar(TealType.uint64)
    final_hedge_ratio = ScratchVar(TealType.uint64)

    calculate_hedge_ratio = Seq(
        Assert(Txn.application_args.length() == Int(4)),
        portfolio_value_hedge.store(Btoi(Txn.application_args[1])),
        volatility.store(Btoi(Txn.application_args[2])),
        correlation.store(Btoi(Txn.application_args[3])),

        # Simplified hedge ratio calculation
        # Optimal hedge ratio = correlation * (volatility_portfolio / volatility_hedge)
        hedge_ratio.store(correlation.load() * volatility.load() / Int(10000)),

        # Ensure hedge ratio is within reasonable bounds (0 to 10000)
        # Note: PyTeal doesn't support negative integers directly
        final_hedge_ratio.store(If(hedge_ratio.load() > Int(10000), Int(10000), hedge_ratio.load())),

        Return(Int(1))
    )

    # Set target delta
    new_target_delta = ScratchVar(TealType.uint64)

    set_target_delta = Seq(
        Assert(Txn.sender() == Global.creator_address()),
        Assert(Txn.application_args.length() == Int(2)),
        new_target_delta.store(Btoi(Txn.application_args[1])),
        App.globalPut(TARGET_DELTA_KEY, new_target_delta.load()),
        Return(Int(1))
    )
    
    # Main program logic
    program = Cond(
        [Txn.application_id() == Int(0), on_creation],
        [Txn.on_completion() == OnComplete.NoOp, Cond(
            [Txn.application_args[0] == Bytes("calculate_delta"), calculate_delta],
            [Txn.application_args[0] == Bytes("check_rebalance"), check_rebalance_needed],
            [Txn.application_args[0] == Bytes("execute_rebalance"), execute_rebalance],
            [Txn.application_args[0] == Bytes("update_funding"), update_funding_rate],
            [Txn.application_args[0] == Bytes("distribute_yield"), distribute_yield],
            [Txn.application_args[0] == Bytes("calculate_hedge"), calculate_hedge_ratio],
            [Txn.application_args[0] == Bytes("set_target_delta"), set_target_delta],
        )],
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(Txn.sender() == Global.creator_address())],
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(Txn.sender() == Global.creator_address())],
    )
    
    return program

def clear_state_program():
    """Clear state program"""
    return Return(Int(1))

# Compile the contract
if __name__ == "__main__":
    approval_teal = compileTeal(approval_program(), Mode.Application, version=6)
    clear_state_teal = compileTeal(clear_state_program(), Mode.Application, version=6)
    
    print("=== REBALANCE ENGINE APPROVAL PROGRAM ===")
    print(approval_teal)
    print("\n=== REBALANCE ENGINE CLEAR STATE PROGRAM ===")
    print(clear_state_teal)
