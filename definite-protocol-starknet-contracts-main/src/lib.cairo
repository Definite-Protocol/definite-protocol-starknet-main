// Definite Protocol - Delta-neutral hedging system for Starknet
pub mod tokens {
    pub mod hstrk_token;
}

pub mod oracle {
    pub mod price_oracle;
}

pub mod vault {
    pub mod protocol_vault;
}

pub mod hedging {
    pub mod perpetual_hedge_minimal;
    pub mod options_strategy_minimal;
}

pub mod risk {
    pub mod risk_manager;
}

pub mod rebalancing {
    pub mod rebalancing_engine_minimal;
}

// Legacy modules for reference
// pub mod erc20 {
//     pub mod mock_erc20;
// }
// pub mod token_sender;
