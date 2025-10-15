use starknet::ContractAddress;
use starknet::storage::{
    Map, StoragePointerReadAccess, StoragePointerWriteAccess,
    StorageMapReadAccess, StorageMapWriteAccess
};

/// Price data structure
#[derive(Drop, Serde, Copy, starknet::Store)]
pub struct PriceData {
    /// Price in 8 decimals (e.g., 1 STRK = 100000000 = $1.00)
    pub price: u256,
    /// Timestamp of last update
    pub timestamp: u64,
    /// Number of sources that provided this price
    pub sources_count: u8,
    /// Confidence score (0-100)
    pub confidence: u8,
}

/// Aggregation mode for multiple price sources
#[derive(Drop, Serde, Copy, starknet::Store)]
pub enum AggregationMode {
    #[default]
    Median,
    Mean,
    WeightedAverage,
}

#[starknet::interface]
pub trait IPriceOracle<TContractState> {
    /// Get current price for an asset
    fn get_price(self: @TContractState, asset: ContractAddress) -> PriceData;
    
    /// Get price with staleness check
    fn get_price_with_staleness_check(
        self: @TContractState, 
        asset: ContractAddress, 
        max_staleness: u64
    ) -> PriceData;
    
    /// Update price from Pragma Network
    fn update_price_from_pragma(ref self: TContractState, asset: ContractAddress);
    
    /// Update price from DEX TWAP as fallback
    fn update_price_from_dex_twap(ref self: TContractState, asset: ContractAddress);
    
    /// Set trusted price source
    fn set_trusted_source(ref self: TContractState, source: ContractAddress, trusted: bool);
    
    /// Set aggregation mode
    fn set_aggregation_mode(ref self: TContractState, mode: AggregationMode);
    
    /// Set maximum staleness threshold
    fn set_max_staleness(ref self: TContractState, max_staleness: u64);
    
    /// Set price update threshold (basis points)
    fn set_update_threshold(ref self: TContractState, threshold_bps: u16);
    
    /// Emergency price update by owner
    fn emergency_price_update(
        ref self: TContractState, 
        asset: ContractAddress, 
        price: u256, 
        confidence: u8
    );
    
    /// Check if price is stale
    fn is_price_stale(self: @TContractState, asset: ContractAddress, max_staleness: u64) -> bool;
}

#[starknet::contract]
pub mod PriceOracle {
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess,
        StoragePointerReadAccess, StoragePointerWriteAccess
    };
    use core::num::traits::Zero;
    use super::{PriceData, AggregationMode};

    #[storage]
    struct Storage {
        /// Owner of the contract
        owner: ContractAddress,
        /// Asset address -> Price data mapping
        price_feeds: Map<ContractAddress, PriceData>,
        /// Trusted price sources
        trusted_sources: Map<ContractAddress, bool>,
        /// Aggregation mode for multiple sources
        aggregation_mode: AggregationMode,
        /// Maximum staleness in seconds (default: 300 = 5 minutes)
        max_staleness: u64,
        /// Price update threshold in basis points (default: 50 = 0.5%)
        update_threshold_bps: u16,
        /// Pragma Network oracle address
        pragma_oracle: ContractAddress,
        /// DEX addresses for TWAP fallback
        ekubo_pool: ContractAddress,
        myswap_pool: ContractAddress,
        jediswap_pool: ContractAddress,
        /// Last valid prices for emergency fallback
        last_valid_prices: Map<ContractAddress, PriceData>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        /// Emitted when price is updated
        PriceUpdated: PriceUpdated,
        /// Emitted when trusted source is modified
        TrustedSourceUpdated: TrustedSourceUpdated,
        /// Emitted when aggregation mode is changed
        AggregationModeUpdated: AggregationModeUpdated,
        /// Emitted when staleness threshold is updated
        MaxStalenessUpdated: MaxStalenessUpdated,
        /// Emitted when update threshold is changed
        UpdateThresholdUpdated: UpdateThresholdUpdated,
        /// Emitted when emergency price update occurs
        EmergencyPriceUpdate: EmergencyPriceUpdate,
        /// Emitted when price source fails
        PriceSourceFailed: PriceSourceFailed,
    }

    #[derive(Drop, starknet::Event)]
    struct PriceUpdated {
        #[key]
        pub asset: ContractAddress,
        pub price: u256,
        pub timestamp: u64,
        pub sources_count: u8,
        pub confidence: u8,
        pub source: felt252, // 'pragma' or 'dex_twap' or 'emergency'
    }

    #[derive(Drop, starknet::Event)]
    struct TrustedSourceUpdated {
        #[key]
        pub source: ContractAddress,
        pub trusted: bool,
    }

    #[derive(Drop, starknet::Event)]
    struct AggregationModeUpdated {
        pub old_mode: AggregationMode,
        pub new_mode: AggregationMode,
    }

    #[derive(Drop, starknet::Event)]
    struct MaxStalenessUpdated {
        pub old_staleness: u64,
        pub new_staleness: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct UpdateThresholdUpdated {
        pub old_threshold: u16,
        pub new_threshold: u16,
    }

    #[derive(Drop, starknet::Event)]
    struct EmergencyPriceUpdate {
        #[key]
        pub asset: ContractAddress,
        pub price: u256,
        pub updater: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct PriceSourceFailed {
        pub source: felt252,
        #[key]
        pub asset: ContractAddress,
        pub reason: felt252,
    }

    mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'Oracle: zero address';
        pub const STALE_PRICE: felt252 = 'Oracle: stale price';
        pub const NO_PRICE_DATA: felt252 = 'Oracle: no price data';
        pub const INSUFFICIENT_SOURCES: felt252 = 'Oracle: insufficient sources';
        pub const INVALID_CONFIDENCE: felt252 = 'Oracle: invalid confidence';
        pub const PRICE_DEVIATION_TOO_HIGH: felt252 = 'Oracle: price deviation high';
        pub const INVALID_THRESHOLD: felt252 = 'Oracle: invalid threshold';
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        pragma_oracle: ContractAddress,
        ekubo_pool: ContractAddress,
        myswap_pool: ContractAddress,
        jediswap_pool: ContractAddress,
    ) {
        assert(!owner.is_zero(), Errors::ZERO_ADDRESS);
        self.owner.write(owner);

        // Set oracle addresses
        assert(!pragma_oracle.is_zero(), Errors::ZERO_ADDRESS);
        self.pragma_oracle.write(pragma_oracle);
        self.ekubo_pool.write(ekubo_pool);
        self.myswap_pool.write(myswap_pool);
        self.jediswap_pool.write(jediswap_pool);

        // Set default parameters
        self.aggregation_mode.write(AggregationMode::Median);
        self.max_staleness.write(300); // 5 minutes
        self.update_threshold_bps.write(50); // 0.5%
    }



    #[abi(embed_v0)]
    impl PriceOracleImpl of super::IPriceOracle<ContractState> {
        fn get_price(self: @ContractState, asset: ContractAddress) -> PriceData {
            let price_data = self.price_feeds.read(asset);
            assert(price_data.timestamp != 0, Errors::NO_PRICE_DATA);
            price_data
        }

        fn get_price_with_staleness_check(
            self: @ContractState, 
            asset: ContractAddress, 
            max_staleness: u64
        ) -> PriceData {
            let price_data = self.get_price(asset);
            assert(!self._is_stale(price_data.timestamp, max_staleness), Errors::STALE_PRICE);
            price_data
        }

        fn update_price_from_pragma(ref self: ContractState, asset: ContractAddress) {
            // This would integrate with actual Pragma Network oracle
            // For now, implementing the structure
            let current_time = get_block_timestamp();
            
            // Simulate Pragma price fetch (in production, this would call Pragma oracle)
            let pragma_price = self._fetch_pragma_price(asset);
            
            if pragma_price.price > 0 && pragma_price.confidence >= 70 {
                self._update_price_internal(asset, pragma_price, 'pragma');
            } else {
                self.emit(PriceSourceFailed { 
                    source: 'pragma', 
                    asset, 
                    reason: 'low_confidence' 
                });
                // Fallback to DEX TWAP
                self.update_price_from_dex_twap(asset);
            }
        }

        fn update_price_from_dex_twap(ref self: ContractState, asset: ContractAddress) {
            let current_time = get_block_timestamp();
            
            // Fetch prices from multiple DEXs
            let ekubo_price = self._fetch_dex_price(self.ekubo_pool.read(), asset);
            let myswap_price = self._fetch_dex_price(self.myswap_pool.read(), asset);
            let jediswap_price = self._fetch_dex_price(self.jediswap_pool.read(), asset);
            
            // Calculate weighted average
            let aggregated_price = self._aggregate_dex_prices(ekubo_price, myswap_price, jediswap_price);
            
            if aggregated_price.price > 0 {
                self._update_price_internal(asset, aggregated_price, 'dex_twap');
            } else {
                self.emit(PriceSourceFailed { 
                    source: 'dex_twap', 
                    asset, 
                    reason: 'no_liquidity' 
                });
                // Use last valid price if available and not too stale
                self._use_last_valid_price(asset);
            }
        }

        fn set_trusted_source(ref self: ContractState, source: ContractAddress, trusted: bool) {
            self._check_owner();
            self.trusted_sources.write(source, trusted);
            self.emit(TrustedSourceUpdated { source, trusted });
        }

        fn set_aggregation_mode(ref self: ContractState, mode: AggregationMode) {
            self._check_owner();
            let old_mode = self.aggregation_mode.read();
            self.aggregation_mode.write(mode);
            self.emit(AggregationModeUpdated { old_mode, new_mode: mode });
        }

        fn set_max_staleness(ref self: ContractState, max_staleness: u64) {
            self._check_owner();
            let old_staleness = self.max_staleness.read();
            self.max_staleness.write(max_staleness);
            self.emit(MaxStalenessUpdated { old_staleness, new_staleness: max_staleness });
        }

        fn set_update_threshold(ref self: ContractState, threshold_bps: u16) {
            self._check_owner();
            assert(threshold_bps <= 1000, Errors::INVALID_THRESHOLD); // Max 10%
            let old_threshold = self.update_threshold_bps.read();
            self.update_threshold_bps.write(threshold_bps);
            self.emit(UpdateThresholdUpdated { old_threshold, new_threshold: threshold_bps });
        }

        fn emergency_price_update(
            ref self: ContractState,
            asset: ContractAddress,
            price: u256,
            confidence: u8
        ) {
            self._check_owner();
            assert(confidence <= 100, Errors::INVALID_CONFIDENCE);
            
            let current_time = get_block_timestamp();
            let price_data = PriceData {
                price,
                timestamp: current_time,
                sources_count: 1,
                confidence,
            };
            
            self.price_feeds.write(asset, price_data);
            self.last_valid_prices.write(asset, price_data);
            
            self.emit(EmergencyPriceUpdate { 
                asset, 
                price, 
                updater: get_caller_address() 
            });
            
            self.emit(PriceUpdated {
                asset,
                price,
                timestamp: current_time,
                sources_count: 1,
                confidence,
                source: 'emergency',
            });
        }

        fn is_price_stale(self: @ContractState, asset: ContractAddress, max_staleness: u64) -> bool {
            let price_data = self.price_feeds.read(asset);
            if price_data.timestamp == 0 {
                return true;
            }
            self._is_stale(price_data.timestamp, max_staleness)
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Check if timestamp is stale
        fn _is_stale(self: @ContractState, timestamp: u64, max_staleness: u64) -> bool {
            let current_time = get_block_timestamp();
            current_time - timestamp > max_staleness
        }

        /// Update price internal logic
        fn _update_price_internal(
            ref self: ContractState,
            asset: ContractAddress,
            price_data: PriceData,
            source: felt252
        ) {
            // Validate price deviation if we have existing price
            let existing_price = self.price_feeds.read(asset);
            if existing_price.timestamp != 0 {
                self._validate_price_deviation(existing_price.price, price_data.price);
            }

            // Update price feed
            self.price_feeds.write(asset, price_data);

            // Store as last valid price
            self.last_valid_prices.write(asset, price_data);

            self.emit(PriceUpdated {
                asset,
                price: price_data.price,
                timestamp: price_data.timestamp,
                sources_count: price_data.sources_count,
                confidence: price_data.confidence,
                source,
            });
        }

        /// Validate price deviation is within acceptable range
        fn _validate_price_deviation(self: @ContractState, old_price: u256, new_price: u256) {
            let threshold_bps = self.update_threshold_bps.read();
            let max_deviation = old_price * threshold_bps.into() / 10000;

            let deviation = if new_price > old_price {
                new_price - old_price
            } else {
                old_price - new_price
            };

            // Allow deviation up to 20% for extreme market conditions
            let max_allowed_deviation = old_price * 2000 / 10000; // 20%
            assert(deviation <= max_allowed_deviation, Errors::PRICE_DEVIATION_TOO_HIGH);
        }

        /// Fetch price from Pragma Network (placeholder for actual integration)
        fn _fetch_pragma_price(self: @ContractState, asset: ContractAddress) -> PriceData {
            // In production, this would call Pragma Network oracle
            // For now, returning placeholder data
            PriceData {
                price: 100000000, // $1.00 in 8 decimals
                timestamp: get_block_timestamp(),
                sources_count: 3,
                confidence: 85,
            }
        }

        /// Fetch price from DEX (placeholder for actual integration)
        fn _fetch_dex_price(self: @ContractState, pool: ContractAddress, asset: ContractAddress) -> PriceData {
            // In production, this would call DEX pool for TWAP
            if pool.is_zero() {
                return PriceData {
                    price: 0,
                    timestamp: 0,
                    sources_count: 0,
                    confidence: 0,
                };
            }

            PriceData {
                price: 99500000, // $0.995 in 8 decimals
                timestamp: get_block_timestamp(),
                sources_count: 1,
                confidence: 75,
            }
        }

        /// Aggregate prices from multiple DEXs
        fn _aggregate_dex_prices(
            self: @ContractState,
            ekubo_price: PriceData,
            myswap_price: PriceData,
            jediswap_price: PriceData,
        ) -> PriceData {
            let mut valid_prices: Array<PriceData> = ArrayTrait::new();

            if ekubo_price.price > 0 { valid_prices.append(ekubo_price); }
            if myswap_price.price > 0 { valid_prices.append(myswap_price); }
            if jediswap_price.price > 0 { valid_prices.append(jediswap_price); }

            if valid_prices.len() == 0 {
                return PriceData {
                    price: 0,
                    timestamp: 0,
                    sources_count: 0,
                    confidence: 0,
                };
            }

            // Simple weighted average (in production, would use liquidity weights)
            let mut total_price: u256 = 0;
            let mut total_confidence: u256 = 0;
            let sources_count = valid_prices.len();

            let mut i = 0;
            while i < sources_count {
                let price_data = *valid_prices.at(i);
                total_price += price_data.price;
                total_confidence += price_data.confidence.into();
                i += 1;
            };

            PriceData {
                price: total_price / sources_count.into(),
                timestamp: get_block_timestamp(),
                sources_count: sources_count.try_into().unwrap(),
                confidence: (total_confidence / sources_count.into()).try_into().unwrap(),
            }
        }

        /// Use last valid price as emergency fallback
        fn _use_last_valid_price(ref self: ContractState, asset: ContractAddress) {
            let last_valid = self.last_valid_prices.read(asset);
            if last_valid.timestamp != 0 && !self._is_stale(last_valid.timestamp, 600) { // 10 min max
                self.price_feeds.write(asset, last_valid);
                self.emit(PriceUpdated {
                    asset,
                    price: last_valid.price,
                    timestamp: last_valid.timestamp,
                    sources_count: last_valid.sources_count,
                    confidence: last_valid.confidence,
                    source: 'fallback',
                });
            } else {
                self.emit(PriceSourceFailed {
                    source: 'fallback',
                    asset,
                    reason: 'no_valid_price'
                });
            }
        }

        // Internal function to check owner
        fn _check_owner(self: @ContractState) {
            let caller = get_caller_address();
            let owner = self.owner.read();
            assert(caller == owner, 'Oracle: caller is not owner');
        }
    }
}
