/**
 * Chipi Pay Hook
 * Payment gateway operations
 * Production-ready with fiat on/off ramp
 */

import { useState, useEffect, useCallback } from 'react';
import { ChipiPayService, PaymentMethod, PaymentResponse } from '../services/chipiPayService';
import { useMultiChainWallet } from './useMultiChainWallet';
import { logger } from '../utils/logger';

interface ChipiPayState {
  paymentMethods: PaymentMethod[];
  loading: boolean;
  error: string | null;
}

interface PaymentState {
  isProcessing: boolean;
  payment: PaymentResponse | null;
  error: string | null;
}

export const useChipiPay = () => {
  const { starknetWallet, isStarknetConnected } = useMultiChainWallet();

  const [state, setState] = useState<ChipiPayState>({
    paymentMethods: [],
    loading: false,
    error: null
  });

  const [paymentState, setPaymentState] = useState<PaymentState>({
    isProcessing: false,
    payment: null,
    error: null
  });

  // Check if Chipi Pay is configured
  const isConfigured = ChipiPayService.isConfigured();

  // Load payment methods
  const loadPaymentMethods = useCallback(async () => {
    if (!isStarknetConnected || !isConfigured) {
      logger.debug('Chipi Pay not available');
      return;
    }

    logger.info('Loading Chipi Pay payment methods');
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const methods = await ChipiPayService.getPaymentMethods();
      setState(prev => ({ ...prev, paymentMethods: methods, loading: false }));
      logger.info('Payment methods loaded', { count: methods.length });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load payment methods';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      logger.error('Failed to load payment methods', error as Error);
    }
  }, [isStarknetConnected, isConfigured]);

  // Load payment methods when wallet connects
  useEffect(() => {
    if (isStarknetConnected && isConfigured) {
      loadPaymentMethods();
    }
  }, [isStarknetConnected, isConfigured, loadPaymentMethods]);

  // Add payment method
  const addPaymentMethod = useCallback(async (
    type: 'card' | 'bank' | 'giftcard',
    details: Record<string, unknown>
  ) => {
    if (!isStarknetConnected) {
      throw new Error('Starknet wallet not connected');
    }

    logger.info('Adding payment method', { type });

    try {
      const method = await ChipiPayService.addPaymentMethod(type, details);
      
      if (method) {
        setState(prev => ({
          ...prev,
          paymentMethods: [...prev.paymentMethods, method]
        }));
        logger.info('Payment method added', { id: method.id });
        return method;
      } else {
        throw new Error('Failed to add payment method');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add payment method';
      logger.error('Failed to add payment method', error as Error);
      throw new Error(errorMessage);
    }
  }, [isStarknetConnected]);

  // Buy USDC
  const buyUSDC = useCallback(async (
    amount: number,
    currency: 'USD' | 'MXN',
    paymentMethodId: string
  ) => {
    if (!isStarknetConnected) {
      throw new Error('Starknet wallet not connected');
    }

    logger.info('Buying USDC', { amount, currency });
    setPaymentState({ isProcessing: true, payment: null, error: null });

    try {
      const payment = await ChipiPayService.buyUSDC(amount, currency, paymentMethodId);

      if (payment) {
        logger.info('USDC purchase initiated', { paymentId: payment.paymentId });
        setPaymentState({ isProcessing: false, payment, error: null });
        return payment;
      } else {
        throw new Error('Payment failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to buy USDC';
      setPaymentState({ isProcessing: false, payment: null, error: errorMessage });
      logger.error('Failed to buy USDC', error as Error);
      throw error;
    }
  }, [isStarknetConnected]);

  // Sell USDC
  const sellUSDC = useCallback(async (
    amount: number,
    currency: 'USD' | 'MXN',
    paymentMethodId: string
  ) => {
    if (!isStarknetConnected) {
      throw new Error('Starknet wallet not connected');
    }

    logger.info('Selling USDC', { amount, currency });
    setPaymentState({ isProcessing: true, payment: null, error: null });

    try {
      const payment = await ChipiPayService.sellUSDC(amount, currency, paymentMethodId);

      if (payment) {
        logger.info('USDC sale initiated', { paymentId: payment.paymentId });
        setPaymentState({ isProcessing: false, payment, error: null });
        return payment;
      } else {
        throw new Error('Payment failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sell USDC';
      setPaymentState({ isProcessing: false, payment: null, error: errorMessage });
      logger.error('Failed to sell USDC', error as Error);
      throw error;
    }
  }, [isStarknetConnected]);

  // Convert gift card
  const convertGiftCard = useCallback(async (
    giftCardCode: string,
    amount: number,
    currency: 'USD' | 'MXN'
  ) => {
    if (!isStarknetConnected || !starknetWallet?.address) {
      throw new Error('Starknet wallet not connected');
    }

    logger.info('Converting gift card', { amount, currency });
    setPaymentState({ isProcessing: true, payment: null, error: null });

    try {
      const payment = await ChipiPayService.convertGiftCard({
        giftCardCode,
        amount,
        currency,
        recipientAddress: starknetWallet.address
      });

      if (payment) {
        logger.info('Gift card converted', { paymentId: payment.paymentId });
        setPaymentState({ isProcessing: false, payment, error: null });
        return payment;
      } else {
        throw new Error('Conversion failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to convert gift card';
      setPaymentState({ isProcessing: false, payment: null, error: errorMessage });
      logger.error('Failed to convert gift card', error as Error);
      throw error;
    }
  }, [isStarknetConnected, starknetWallet?.address]);

  // Check payment status
  const checkPaymentStatus = useCallback(async (paymentId: string) => {
    try {
      const payment = await ChipiPayService.getPaymentStatus(paymentId);
      if (payment) {
        setPaymentState(prev => ({ ...prev, payment }));
      }
      return payment;
    } catch (error) {
      logger.error('Failed to check payment status', error as Error);
      return null;
    }
  }, []);

  // Clear payment state
  const clearPaymentState = () => setPaymentState({ isProcessing: false, payment: null, error: null });

  return {
    // State
    ...state,
    paymentState,

    // Actions
    loadPaymentMethods,
    addPaymentMethod,
    buyUSDC,
    sellUSDC,
    convertGiftCard,
    checkPaymentStatus,
    clearPaymentState,

    // Computed values
    isConfigured,
    isConnected: isStarknetConnected,
    canUseChipiPay: isStarknetConnected && isConfigured,
    hasPaymentMethods: state.paymentMethods.length > 0
  };
};

