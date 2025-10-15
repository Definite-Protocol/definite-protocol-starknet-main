#!/usr/bin/env python3
"""
Enterprise PyTeal Imports Module
Centralized imports for all smart contracts to ensure consistency and type safety

This module provides clean, explicit imports for PyTeal components
used across the hALGO protocol smart contracts.
"""

# Core PyTeal imports - explicit for enterprise code quality
from pyteal import (
    # Core expression types
    Expr, TealType, Mode,

    # Basic types and operations
    Int, Bytes, Addr,

    # Transaction operations
    Txn, Gtxn, TxnType, TxnField, TxnObject,

    # Global and application operations
    Global, App,

    # Control flow
    Seq, Cond, If, Return, Assert, Reject,

    # Arithmetic and logic
    Add, Minus, Mul, Div, Mod,
    And, Or, Not,
    Eq, Neq, Lt, Le, Gt, Ge,

    # Byte operations
    Concat, Substring, Len, Itob, Btoi,

    # Cryptographic operations
    Sha256, Keccak256, Sha512_256,

    # Application operations
    OnComplete,

    # Scratch variables
    ScratchVar,

    # Compilation
    compileTeal,

    # Advanced operations
    InnerTxnBuilder, InnerTxn,

    # Subroutines (if available)
    # Subroutine, SubroutineFnWrapper,
)

# Type hints for enterprise code
from typing import List, Dict, Any, Optional, Union, Tuple

# Version information
PYTEAL_VERSION = "0.10.1"
TEAL_VERSION = 6

def validate_pyteal_version() -> bool:
    """Validate PyTeal version compatibility"""
    try:
        import pyteal
        return hasattr(pyteal, 'compileTeal')
    except ImportError:
        return False

def get_teal_version() -> int:
    """Get the TEAL version used for compilation"""
    return TEAL_VERSION

# Common PyTeal patterns for enterprise contracts
class PyTealPatterns:
    """Common PyTeal patterns and utilities for enterprise smart contracts"""
    
    @staticmethod
    def safe_seq(*expressions: Expr) -> Expr:
        """Create a Seq with proper expression validation"""
        if not expressions:
            return Return(Int(1))
        return Seq(*expressions)
    
    @staticmethod
    def validate_sender_is_creator() -> Expr:
        """Validate that transaction sender is the contract creator"""
        return Assert(Txn.sender() == Global.creator_address())
    
    @staticmethod
    def validate_app_call() -> Expr:
        """Validate that this is an application call"""
        return Assert(Txn.type_enum() == TxnType.ApplicationCall)
    
    @staticmethod
    def validate_payment(min_amount: int = 0) -> Expr:
        """Validate payment transaction with minimum amount"""
        return Seq(
            Assert(Txn.type_enum() == TxnType.Payment),
            Assert(Txn.amount() >= Int(min_amount)) if min_amount > 0 else Return(Int(1))
        )
    
    @staticmethod
    def safe_global_get(key: Bytes, default_value: Union[int, bytes] = 0) -> Expr:
        """Safely get global state with default value"""
        if isinstance(default_value, int):
            return App.globalGetEx(Int(0), key).value()
        else:
            return App.globalGetEx(Int(0), key).value()
    
    @staticmethod
    def safe_local_get(account: Expr, key: Bytes, default_value: Union[int, bytes] = 0) -> Expr:
        """Safely get local state with default value"""
        if isinstance(default_value, int):
            return App.localGetEx(account, Int(0), key).value()
        else:
            return App.localGetEx(account, Int(0), key).value()

# Enterprise error handling
class ContractErrors:
    """Standardized error codes for enterprise smart contracts"""
    
    # General errors
    UNAUTHORIZED = "UNAUTHORIZED"
    INVALID_AMOUNT = "INVALID_AMOUNT"
    INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE"
    CONTRACT_PAUSED = "CONTRACT_PAUSED"
    
    # Protocol specific errors
    MINIMUM_DEPOSIT_NOT_MET = "MINIMUM_DEPOSIT_NOT_MET"
    PRICE_STALE = "PRICE_STALE"
    ORACLE_NOT_AUTHORIZED = "ORACLE_NOT_AUTHORIZED"
    LIQUIDATION_THRESHOLD_EXCEEDED = "LIQUIDATION_THRESHOLD_EXCEEDED"
    
    @staticmethod
    def assert_with_error(condition: Expr, error_code: str) -> Expr:
        """Assert with standardized error reporting"""
        return Assert(condition, comment=error_code)

# Enterprise configuration
class ContractConfig:
    """Enterprise configuration constants"""
    
    # Network settings
    TESTNET_GENESIS_HASH = "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI="
    MAINNET_GENESIS_HASH = "wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8="
    
    # Protocol constants
    MIN_ALGO_BALANCE = 100000  # 0.1 ALGO minimum balance
    TRANSACTION_FEE = 1000     # 0.001 ALGO transaction fee
    
    # Time constants
    HOUR_IN_SECONDS = 3600
    DAY_IN_SECONDS = 86400
    WEEK_IN_SECONDS = 604800

# OnComplete values
NoOp = OnComplete.NoOp
OptIn = OnComplete.OptIn
CloseOut = OnComplete.CloseOut
ClearState = OnComplete.ClearState
UpdateApplication = OnComplete.UpdateApplication
DeleteApplication = OnComplete.DeleteApplication

# Export all for easy importing
__all__ = [
    # Core types
    'Expr', 'TealType', 'Mode',
    'Int', 'Bytes', 'Addr',

    # Transaction types
    'Txn', 'Gtxn', 'TxnType', 'TxnField', 'TxnObject',

    # Global operations
    'Global', 'App',

    # Control flow
    'Seq', 'Cond', 'If', 'Return', 'Assert', 'Reject',

    # Operations
    'Add', 'Minus', 'Mul', 'Div', 'Mod',
    'And', 'Or', 'Not',
    'Eq', 'Neq', 'Lt', 'Le', 'Gt', 'Ge',
    'Concat', 'Substring', 'Len', 'Itob', 'Btoi',

    # Crypto
    'Sha256', 'Keccak256', 'Sha512_256',

    # Application
    'OnComplete', 'NoOp', 'OptIn', 'CloseOut', 'ClearState', 'UpdateApplication', 'DeleteApplication',

    # Advanced
    'ScratchVar', 'compileTeal', 'InnerTxnBuilder', 'InnerTxn',

    # Enterprise utilities
    'PyTealPatterns', 'ContractErrors', 'ContractConfig',
    'validate_pyteal_version', 'get_teal_version',
]
