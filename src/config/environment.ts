// Environment Configuration for Production-Ready Multi-Chain System
export interface EnvironmentConfig {
  // Network Configuration
  network: 'testnet' | 'mainnet';

  // Starknet Configuration
  starknet: {
    rpcUrl: string;
    chainId: string;
    explorerUrl: string;
  };

  // Bitcoin Configuration
  bitcoin: {
    network: 'testnet' | 'mainnet';
    explorerUrl: string;
    bridgeAddress: string;
  };

  // Protocol Configuration
  protocol: {
    hstrkTokenAddress: string; // Starknet ERC20 token
    protocolAddress: string; // Main protocol contract
    collateralTokenAddress: string; // STRK or ETH
    oracleAddress: string; // Pragma Oracle
    minimumDeposit: number; // in base units (6 decimals)
    collateralRatio: number; // 150% = 1.5
    liquidationThreshold: number; // 120% = 1.2
    exitFee: number; // 0.1% = 0.001
  };
  
  // Oracle Configuration
  oracles: {
    pragma: {
      contractAddress: string;
      updateInterval: number; // seconds
    };
    backup: {
      coinGeckoApi: string;
      binanceApi: string;
    };
  };

  // Payment Gateway Configuration
  chipiPay: {
    apiKey: string;
    apiUrl: string;
    enabled: boolean;
  };
  
  // Security Configuration
  security: {
    rateLimiting: {
      windowMs: number;
      maxRequests: number;
    };
    cors: {
      allowedOrigins: string[];
    };
    encryption: {
      algorithm: string;
      keyLength: number;
    };
  };
  
  // Monitoring Configuration
  monitoring: {
    sentryDsn?: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    metricsEndpoint?: string;
  };
  
  // Feature Flags
  features: {
    enableAdvancedAnalytics: boolean;
    enableAutoRebalancing: boolean;
    enableLiquidationEngine: boolean;
    enableMultiAssetSupport: boolean;
    enableBitcoinBridge: boolean;
    enableChipiPay: boolean;
  };
}

// Testnet Configuration (Starknet Sepolia)
const testnetConfig: EnvironmentConfig = {
  network: 'testnet',
  starknet: {
    // Using Alchemy RPC v0.8 for latest transaction support
    rpcUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/c74NJJI9JjRLdNwXjvlm9lhVJAbyJYck',
    chainId: '0x534e5f5345504f4c4941', // SN_SEPOLIA
    explorerUrl: 'https://sepolia.starkscan.co'
  },
  bitcoin: {
    network: 'testnet',
    explorerUrl: 'https://blockstream.info/testnet',
    bridgeAddress: 'tb1q...' // To be set after bridge deployment
  },
  protocol: {
    hstrkTokenAddress: '0x03b041b0d7074032d3101b271b20fecdb2312d44e404adb0637d52979483a93e', // Deployed hSTRK Token
    protocolAddress: '0x00826891ff0947da14fbd236dea07332bd56b9a98af378b00b5c6d5a3ad066e4', // Deployed Protocol Vault
    collateralTokenAddress: '0x04718f5a0Fc34cC1AF16A1cdee98fFB20C31f5cD61D6Ab07201858f4287c938D', // STRK on Sepolia
    oracleAddress: '0x04856ae56007722f43dc4a7d82a1b7c8fff6f24207376995db6854f030f41757', // Deployed Price Oracle
    minimumDeposit: 2_000_000, // 2 tokens (6 decimals)
    collateralRatio: 1.5, // 150%
    liquidationThreshold: 1.2, // 120%
    exitFee: 0.001 // 0.1%
  },
  oracles: {
    pragma: {
      contractAddress: '0x04856ae56007722f43dc4a7d82a1b7c8fff6f24207376995db6854f030f41757', // Deployed Price Oracle
      updateInterval: 300 // 5 minutes
    },
    backup: {
      coinGeckoApi: 'https://api.coingecko.com/api/v3',
      binanceApi: 'https://api.binance.com/api/v3'
    }
  },
  security: {
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100
    },
    cors: {
      allowedOrigins: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174']
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      keyLength: 32
    }
  },
  chipiPay: {
    apiKey: import.meta.env.VITE_CHIPI_PAY_API_KEY || '',
    apiUrl: 'https://api-testnet.chipi.pay/v1',
    enabled: false // Enable when API key is configured
  },
  monitoring: {
    logLevel: 'debug',
    sentryDsn: import.meta.env.VITE_SENTRY_DSN
  },
  features: {
    enableAdvancedAnalytics: true,
    enableAutoRebalancing: true,
    enableLiquidationEngine: true,
    enableMultiAssetSupport: false, // Phase 2 feature
    enableBitcoinBridge: false, // Starknet only
    enableChipiPay: false // Enable when configured
  }
};

// Mainnet Configuration (Starknet Mainnet)
const mainnetConfig: EnvironmentConfig = {
  network: 'mainnet',
  starknet: {
    // Using Blast API with RPC 0.9 for Braavos compatibility
    rpcUrl: 'https://starknet-mainnet.public.blastapi.io/rpc/v0_9',
    chainId: '0x534e5f4d41494e', // SN_MAIN
    explorerUrl: 'https://starkscan.co'
  },
  bitcoin: {
    network: 'mainnet',
    explorerUrl: 'https://blockstream.info',
    bridgeAddress: 'bc1q...' // To be set after bridge deployment
  },
  protocol: {
    hstrkTokenAddress: '0x0', // To be deployed
    protocolAddress: '0x0', // To be deployed
    collateralTokenAddress: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH on Mainnet
    oracleAddress: '0x0', // Pragma Oracle address
    minimumDeposit: 2_000_000, // 2 tokens (6 decimals)
    collateralRatio: 1.5, // 150%
    liquidationThreshold: 1.2, // 120%
    exitFee: 0.001 // 0.1%
  },
  oracles: {
    pragma: {
      contractAddress: '0x0', // Pragma Oracle on Mainnet
      updateInterval: 60 // 1 minute for production
    },
    backup: {
      coinGeckoApi: 'https://api.coingecko.com/api/v3',
      binanceApi: 'https://api.binance.com/api/v3'
    }
  },
  chipiPay: {
    apiKey: import.meta.env.VITE_CHIPI_PAY_API_KEY || '',
    apiUrl: 'https://api.chipi.pay/v1',
    enabled: true // Enable for mainnet
  },
  security: {
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 50 // Stricter for mainnet
    },
    cors: {
      allowedOrigins: ['https://definite-protocol.com', 'https://app.definite-protocol.com']
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      keyLength: 32
    }
  },
  monitoring: {
    logLevel: 'info',
    sentryDsn: import.meta.env.VITE_SENTRY_DSN,
    metricsEndpoint: import.meta.env.VITE_METRICS_ENDPOINT
  },
  features: {
    enableAdvancedAnalytics: true,
    enableAutoRebalancing: true,
    enableLiquidationEngine: true,
    enableMultiAssetSupport: true,
    enableBitcoinBridge: true,
    enableChipiPay: true
  }
};

// Environment Detection
const getEnvironment = (): 'testnet' | 'mainnet' => {
  const env = import.meta.env.VITE_NETWORK || 'testnet';
  return env as 'testnet' | 'mainnet';
};

// Export Current Configuration
export const config: EnvironmentConfig = getEnvironment() === 'mainnet' ? mainnetConfig : testnetConfig;

// Configuration Validation
export const validateConfig = (config: EnvironmentConfig): boolean => {
  try {
    // Validate required fields
    if (!config.starknet.rpcUrl || !config.starknet.chainId) {
      throw new Error('Missing required Starknet configuration');
    }
    
    if (config.protocol.collateralRatio <= 1) {
      throw new Error('Collateral ratio must be greater than 100%');
    }
    
    if (config.protocol.liquidationThreshold >= config.protocol.collateralRatio) {
      throw new Error('Liquidation threshold must be less than collateral ratio');
    }
    
    if (config.protocol.exitFee < 0 || config.protocol.exitFee > 0.1) {
      throw new Error('Exit fee must be between 0% and 10%');
    }
    
    return true;
  } catch (error) {
    console.error('Configuration validation failed:', error);
    return false;
  }
};

// Initialize and validate configuration
if (!validateConfig(config)) {
  throw new Error('Invalid configuration detected. Please check environment variables.');
}

export default config;
