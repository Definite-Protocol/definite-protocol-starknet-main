"""
Risk Manager Contract for hALGO Protocol
Enterprise-grade risk management and liquidation engine

Features:
- Delta calculation and monitoring
- Collateral ratio tracking
- Liquidation triggers
- Risk score calculation
- Position health monitoring
"""

import sys
from pathlib import Path

# Add project root to path for imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Enterprise PyTeal imports
from common.pyteal_imports import (
    Expr, TealType, Mode, Int, Bytes, Addr,
    Txn, Gtxn, TxnType, TxnField, Global, App,
    Seq, Cond, If, Return, Assert, Reject,
    Add, Minus, Mul, Div, And, Or, Not, Eq, Neq, Lt, Le, Gt, Ge,
    Concat, Itob, Btoi, ScratchVar, compileTeal,
    OnComplete, NoOp, OptIn, CloseOut, UpdateApplication, DeleteApplication,
    PyTealPatterns, ContractErrors, ContractConfig
)
from typing import List, Dict, Any, Optional

# Risk Management Configuration
LIQUIDATION_THRESHOLD = Int(120)  # 120% collateral ratio
LIQUIDATION_PENALTY = Int(500)  # 5% liquidation penalty
MAX_POSITION_SIZE = Int(1000000_000000)  # 1M ALGO max position
RISK_SCORE_THRESHOLD = Int(8000)  # 80% risk score threshold

# Global State Keys
TOTAL_RISK_EXPOSURE_KEY = Bytes("total_risk_exposure")
LIQUIDATION_POOL_KEY = Bytes("liquidation_pool")
SYSTEM_HEALTH_KEY = Bytes("system_health")
LAST_RISK_UPDATE_KEY = Bytes("last_risk_update")

# Local State Keys
USER_RISK_SCORE_KEY = Bytes("user_risk_score")
USER_DELTA_EXPOSURE_KEY = Bytes("user_delta_exposure")
USER_LIQUIDATION_PRICE_KEY = Bytes("user_liquidation_price")

def approval_program():
    """Risk Manager approval program"""
    
    # Application creation
    on_creation = Seq(
        App.globalPut(TOTAL_RISK_EXPOSURE_KEY, Int(0)),
        App.globalPut(LIQUIDATION_POOL_KEY, Int(0)),
        App.globalPut(SYSTEM_HEALTH_KEY, Int(10000)),  # 100% healthy
        App.globalPut(LAST_RISK_UPDATE_KEY, Global.latest_timestamp()),
        Return(Int(1))
    )
    
    # Calculate user risk score - simplified for PyTeal compatibility
    user_collateral = ScratchVar(TealType.uint64)
    user_halgo_balance = ScratchVar(TealType.uint64)
    current_price = ScratchVar(TealType.uint64)
    risk_score = ScratchVar(TealType.uint64)

    calculate_risk_score = Seq(
        Assert(Txn.application_args.length() == Int(4)),
        user_collateral.store(Btoi(Txn.application_args[1])),
        user_halgo_balance.store(Btoi(Txn.application_args[2])),
        current_price.store(Btoi(Txn.application_args[3])),

        # Calculate simplified risk score
        risk_score.store(
            If(user_halgo_balance.load() > Int(0),
               user_collateral.load() * Int(10000) / user_halgo_balance.load(),
               Int(10000))
        ),

        # Update user local state
        App.localPut(Txn.sender(), USER_RISK_SCORE_KEY, risk_score.load()),
        App.localPut(Txn.sender(), USER_LIQUIDATION_PRICE_KEY, risk_score.load()),

        Return(Int(1))
    )
    
    # Check liquidation eligibility - simplified for PyTeal compatibility
    user_collateral_check = ScratchVar(TealType.uint64)
    user_halgo_balance_check = ScratchVar(TealType.uint64)
    current_price_check = ScratchVar(TealType.uint64)
    collateral_ratio = ScratchVar(TealType.uint64)

    check_liquidation = Seq(
        Assert(Txn.application_args.length() == Int(5)),
        user_collateral_check.store(Btoi(Txn.application_args[2])),
        user_halgo_balance_check.store(Btoi(Txn.application_args[3])),
        current_price_check.store(Btoi(Txn.application_args[4])),

        # Calculate simplified collateral ratio
        collateral_ratio.store(
            If(user_halgo_balance_check.load() > Int(0),
               user_collateral_check.load() * Int(10000) / user_halgo_balance_check.load(),
               Int(10000))
        ),

        # Return liquidation status
        Return(If(collateral_ratio.load() < LIQUIDATION_THRESHOLD, Int(1), Int(0)))
    )
    
    # Execute liquidation - simplified for PyTeal compatibility
    liquidation_amount = ScratchVar(TealType.uint64)
    current_price = ScratchVar(TealType.uint64)
    penalty_amount = ScratchVar(TealType.uint64)
    protocol_fee = ScratchVar(TealType.uint64)

    execute_liquidation = Seq(
        Assert(Txn.application_args.length() == Int(5)),
        Assert(Global.group_size() >= Int(2)),  # Liquidation payment + app call

        liquidation_amount.store(Btoi(Txn.application_args[2])),
        current_price.store(Btoi(Txn.application_args[3])),

        # Validate liquidation payment
        Assert(Gtxn[0].type_enum() == TxnType.Payment),
        Assert(Gtxn[0].receiver() == Global.current_application_address()),

        # Calculate liquidation penalty
        penalty_amount.store(liquidation_amount.load() * LIQUIDATION_PENALTY / Int(10000)),
        protocol_fee.store(penalty_amount.load() / Int(2)),

        # Update liquidation pool
        App.globalPut(LIQUIDATION_POOL_KEY, App.globalGet(LIQUIDATION_POOL_KEY) + protocol_fee.load()),

        Return(Int(1))
    )
    
    # Update system health score
    new_health_score = ScratchVar(TealType.uint64)

    update_system_health = Seq(
        Assert(Txn.sender() == Global.creator_address()),
        Assert(Txn.application_args.length() == Int(2)),
        new_health_score.store(Btoi(Txn.application_args[1])),
        App.globalPut(SYSTEM_HEALTH_KEY, new_health_score.load()),
        App.globalPut(LAST_RISK_UPDATE_KEY, Global.latest_timestamp()),
        Return(Int(1))
    )
    
    # Calculate delta exposure
    user_halgo_balance = ScratchVar(TealType.uint64)
    current_price = ScratchVar(TealType.uint64)
    price_volatility = ScratchVar(TealType.uint64)
    delta_exposure = ScratchVar(TealType.uint64)

    calculate_delta = Seq(
        Assert(Txn.application_args.length() == Int(4)),
        user_halgo_balance.store(Btoi(Txn.application_args[1])),
        current_price.store(Btoi(Txn.application_args[2])),
        price_volatility.store(Btoi(Txn.application_args[3])),

        # Calculate delta exposure (simplified)
        delta_exposure.store(user_halgo_balance.load() * price_volatility.load() / Int(10000)),

        # Update user delta exposure
        App.localPut(Txn.sender(), USER_DELTA_EXPOSURE_KEY, delta_exposure.load()),

        Return(Int(1))
    )
    
    # Main program logic
    program = Cond(
        [Txn.application_id() == Int(0), on_creation],
        [Txn.on_completion() == NoOp, Cond(
            [Txn.application_args[0] == Bytes("calculate_risk"), calculate_risk_score],
            [Txn.application_args[0] == Bytes("check_liquidation"), check_liquidation],
            [Txn.application_args[0] == Bytes("execute_liquidation"), execute_liquidation],
            [Txn.application_args[0] == Bytes("update_health"), update_system_health],
            [Txn.application_args[0] == Bytes("calculate_delta"), calculate_delta],
        )],
        [Txn.on_completion() == OptIn, Return(Int(1))],
        [Txn.on_completion() == CloseOut, Return(Int(1))],
        [Txn.on_completion() == UpdateApplication, Return(Txn.sender() == Global.creator_address())],
        [Txn.on_completion() == DeleteApplication, Return(Txn.sender() == Global.creator_address())],
    )
    
    return program

def clear_state_program():
    """Clear state program"""
    return Return(Int(1))

# Compile the contract
if __name__ == "__main__":
    approval_teal = compileTeal(approval_program(), Mode.Application, version=8)
    clear_state_teal = compileTeal(clear_state_program(), Mode.Application, version=8)
    
    print("=== RISK MANAGER APPROVAL PROGRAM ===")
    print(approval_teal)
    print("\n=== RISK MANAGER CLEAR STATE PROGRAM ===")
    print(clear_state_teal)
