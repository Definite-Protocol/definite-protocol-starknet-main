import { HSTRKService } from '../services/hstrkService';

describe('HSTRKService', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Initialize service with test configuration
    HSTRKService.initialize({
      hstrkAssetId: 123456789,
      protocolAddress: 'TESTPROTOCOLADDRESS123456789',
      collateralRatio: 1.5,
      liquidationThreshold: 1.2,
      exitFeeRate: 0.001,
      minimumDeposit: 2_000_000 // 2 STRK (matches new smart contract requirement)
    });
  });

  describe('getMintQuote', () => {
    it('should calculate correct mint quote for 1:1 ratio', async () => {
      const algoAmount = 50_000_000; // 50 STRK
      const slippage = 0.01; // 1%
      
      const quote = await HSTRKService.getMintQuote(algoAmount, slippage);
      
      expect(quote.algoAmount).toBe(algoAmount);
      expect(quote.hstrkAmount).toBe(algoAmount); // 1:1 ratio
      expect(quote.exchangeRate).toBe(1.0);
      expect(quote.slippage).toBe(slippage);
      expect(quote.minimumReceived).toBe(algoAmount * (1 - slippage));
    });

    it('should handle different slippage values', async () => {
      const algoAmount = 20_000_000; // 20 STRK
      const slippage = 0.05; // 5%
      
      const quote = await HSTRKService.getMintQuote(algoAmount, slippage);
      
      expect(quote.minimumReceived).toBe(algoAmount * 0.95);
    });
  });

  describe('getRedeemQuote', () => {
    it('should calculate correct redeem quote with exit fee', async () => {
      const hstrkAmount = 30_000_000; // 30 hSTRK
      const slippage = 0.01; // 1%
      
      const quote = await HSTRKService.getRedeemQuote(hstrkAmount, slippage);
      
      expect(quote.hstrkAmount).toBe(hstrkAmount);
      expect(quote.exchangeRate).toBe(1.0);
      expect(quote.exitFee).toBe(hstrkAmount * 0.001); // 0.1% exit fee
      expect(quote.algoAmount).toBe(hstrkAmount * 0.999); // After exit fee
    });
  });

  describe('mintHSTRK', () => {
    it('should reject amounts below minimum deposit', async () => {
      const userAddress = 'TESTUSERADDRESS123456789';
      const smallAmount = 5_000_000; // 5 STRK (below minimum)
      
      const result = await HSTRKService.mintHSTRK(userAddress, smallAmount);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Minimum deposit');
    });

    it('should successfully mint hSTRK for valid amounts', async () => {
      const userAddress = 'TESTUSERADDRESS123456789';
      const validAmount = 15_000_000; // 15 STRK
      
      const result = await HSTRKService.mintHSTRK(userAddress, validAmount);
      
      expect(result.success).toBe(true);
      expect(result.txId).toBeDefined();
      
      // Check that mint history was recorded
      const history = HSTRKService.getMintHistory(userAddress);
      expect(history).toHaveLength(1);
      expect(history[0].algoAmount).toBe(validAmount);
      expect(history[0].hstrkAmount).toBe(validAmount); // 1:1 ratio
    });
  });

  describe('getUserPosition', () => {
    it('should return null for users with no position', async () => {
      const userAddress = 'NEWUSERADDRESS123456789';
      
      const position = await HSTRKService.getUserPosition(userAddress);
      
      expect(position).toBeNull();
    });

    it('should calculate position correctly after mint', async () => {
      const userAddress = 'TESTUSERADDRESS123456789';
      const mintAmount = 20_000_000; // 20 STRK
      
      // Mint some hSTRK
      await HSTRKService.mintHSTRK(userAddress, mintAmount);
      
      const position = await HSTRKService.getUserPosition(userAddress);
      
      expect(position).not.toBeNull();
      expect(position!.algoDeposited).toBe(mintAmount);
      expect(position!.hstrkMinted).toBe(mintAmount);
      expect(position!.collateralRatio).toBe(1.0); // 1:1 ratio
      expect(position!.healthFactor).toBeCloseTo(0.833); // 1.0 / 1.2
    });

    it('should update position after redeem', async () => {
      const userAddress = 'TESTUSERADDRESS123456789';
      const mintAmount = 30_000_000; // 30 STRK
      const redeemAmount = 10_000_000; // 10 hSTRK
      
      // Mint and then redeem
      await HSTRKService.mintHSTRK(userAddress, mintAmount);
      await HSTRKService.redeemSTRK(userAddress, redeemAmount);
      
      const position = await HSTRKService.getUserPosition(userAddress);
      
      expect(position).not.toBeNull();
      expect(position!.algoDeposited).toBeCloseTo(20_000_000 - (redeemAmount * 0.001)); // After exit fee
      expect(position!.hstrkMinted).toBe(20_000_000); // 30 - 10
    });
  });

  describe('getProtocolConfig', () => {
    it('should return correct configuration', () => {
      const config = HSTRKService.getConfig();
      
      expect(config.collateralRatio).toBe(1.5);
      expect(config.liquidationThreshold).toBe(1.2);
      expect(config.exitFeeRate).toBe(0.001);
      expect(config.minimumDeposit).toBe(2_000_000);
    });
  });

  describe('transaction history', () => {
    it('should track mint and redeem history separately', async () => {
      const userAddress = 'TESTUSERADDRESS123456789';
      
      // Perform some transactions
      await HSTRKService.mintHSTRK(userAddress, 15_000_000);
      await HSTRKService.mintHSTRK(userAddress, 25_000_000);
      await HSTRKService.redeemSTRK(userAddress, 10_000_000);
      
      const mintHistory = HSTRKService.getMintHistory(userAddress);
      const redeemHistory = HSTRKService.getRedeemHistory(userAddress);
      
      expect(mintHistory).toHaveLength(2);
      expect(redeemHistory).toHaveLength(1);
      
      expect(mintHistory[0].algoAmount).toBe(15_000_000);
      expect(mintHistory[1].algoAmount).toBe(25_000_000);
      expect(redeemHistory[0].hstrkAmount).toBe(10_000_000);
    });
  });
});

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});
