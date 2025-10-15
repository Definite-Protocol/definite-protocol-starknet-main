/**
 * Chipi Pay Service
 * Payment gateway integration for Starknet
 * 
 * Features:
 * - Fiat on/off ramp
 * - USDC payments on Starknet
 * - Gift card to crypto conversion
 * - Payment status tracking
 * - Transaction history
 */

import { logger } from '../utils/logger';
import { errorHandler, ErrorType } from '../utils/errorHandler';
import { MultiChainWalletService } from './multiChainWalletService';

export interface ChipiPayConfig {
  apiKey: string;
  apiUrl: string;
  network: 'mainnet' | 'testnet';
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank' | 'giftcard' | 'usdc';
  name: string;
  last4?: string;
  expiryDate?: string;
  details?: {
    last4?: string;
    email?: string;
  };
}

export interface PaymentRequest {
  amount: number;
  currency: 'USD' | 'MXN' | 'USDC';
  paymentMethodId: string;
  recipientAddress: string;
  description?: string;
}

export interface PaymentResponse {
  paymentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number;
  currency: string;
  txHash?: string;
  createdAt: number;
  completedAt?: number;
  success?: boolean;
  message?: string;
}

export interface GiftCardConversion {
  giftCardCode: string;
  amount: number;
  currency: 'USD' | 'MXN';
  recipientAddress: string;
}

export class ChipiPayService {
  private static config: ChipiPayConfig = {
    apiKey: process.env.VITE_CHIPI_PAY_API_KEY || '',
    apiUrl: 'https://api.chipi.pay/v1',
    network: 'testnet'
  };

  static setConfig(newConfig: Partial<ChipiPayConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Chipi Pay config updated', { network: this.config.network });
  }

  static async initializePayment(request: PaymentRequest): Promise<PaymentResponse | null> {
    try {
      logger.info('Initializing Chipi Pay payment', {
        amount: request.amount,
        currency: request.currency
      });

      const response = await fetch(`${this.config.apiUrl}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Network': this.config.network
        },
        body: JSON.stringify({
          amount: request.amount,
          currency: request.currency,
          payment_method_id: request.paymentMethodId,
          recipient_address: request.recipientAddress,
          description: request.description,
          blockchain: 'starknet'
        })
      });

      if (!response.ok) {
        throw new Error(`Payment initialization failed: ${response.statusText}`);
      }

      const data = await response.json();

      const paymentResponse: PaymentResponse = {
        paymentId: data.payment_id,
        status: data.status,
        amount: data.amount,
        currency: data.currency,
        txHash: data.tx_hash,
        createdAt: data.created_at,
        completedAt: data.completed_at
      };

      logger.info('Payment initialized', {
        paymentId: paymentResponse.paymentId,
        status: paymentResponse.status
      });

      return paymentResponse;
    } catch (error) {
      logger.error('Failed to initialize payment', error as Error);
      throw errorHandler.handleError(
        error as Error,
        { operation: 'initializePayment' },
        ErrorType.PAYMENT_ERROR
      );
    }
  }

  static async getPaymentStatus(paymentId: string): Promise<PaymentResponse | null> {
    try {
      const response = await fetch(`${this.config.apiUrl}/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Network': this.config.network
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get payment status: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        paymentId: data.payment_id,
        status: data.status,
        amount: data.amount,
        currency: data.currency,
        txHash: data.tx_hash,
        createdAt: data.created_at,
        completedAt: data.completed_at
      };
    } catch (error) {
      logger.error('Failed to get payment status', error as Error);
      return null;
    }
  }

  static async convertGiftCard(conversion: GiftCardConversion): Promise<PaymentResponse | null> {
    try {
      logger.info('Converting gift card to USDC', {
        amount: conversion.amount,
        currency: conversion.currency
      });

      const response = await fetch(`${this.config.apiUrl}/giftcard/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Network': this.config.network
        },
        body: JSON.stringify({
          gift_card_code: conversion.giftCardCode,
          amount: conversion.amount,
          currency: conversion.currency,
          recipient_address: conversion.recipientAddress,
          blockchain: 'starknet'
        })
      });

      if (!response.ok) {
        throw new Error(`Gift card conversion failed: ${response.statusText}`);
      }

      const data = await response.json();

      const paymentResponse: PaymentResponse = {
        paymentId: data.payment_id,
        status: data.status,
        amount: data.usdc_amount,
        currency: 'USDC',
        txHash: data.tx_hash,
        createdAt: data.created_at,
        completedAt: data.completed_at
      };

      logger.info('Gift card converted', {
        paymentId: paymentResponse.paymentId,
        status: paymentResponse.status
      });

      return paymentResponse;
    } catch (error) {
      logger.error('Failed to convert gift card', error as Error);
      throw errorHandler.handleError(
        error as Error,
        { operation: 'convertGiftCard' },
        ErrorType.PAYMENT_ERROR
      );
    }
  }

  static async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      const wallet = MultiChainWalletService.getStarknetWallet();
      
      if (!wallet) {
        throw new Error('No wallet connected');
      }

      const response = await fetch(`${this.config.apiUrl}/payment-methods`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Network': this.config.network,
          'X-Wallet-Address': wallet.address
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get payment methods: ${response.statusText}`);
      }

      const data = await response.json();

      interface ApiPaymentMethod {
        id: string;
        type: 'card' | 'bank' | 'giftcard' | 'usdc';
        name: string;
        last4?: string;
        expiry_date?: string;
      }

      return (data.payment_methods as ApiPaymentMethod[]).map((pm) => ({
        id: pm.id,
        type: pm.type,
        name: pm.name,
        last4: pm.last4,
        expiryDate: pm.expiry_date
      }));
    } catch (error) {
      logger.error('Failed to get payment methods', error as Error);
      return [];
    }
  }

  static async addPaymentMethod(
    type: 'card' | 'bank' | 'giftcard',
    details: Record<string, unknown>
  ): Promise<PaymentMethod | null> {
    try {
      const wallet = MultiChainWalletService.getStarknetWallet();
      
      if (!wallet) {
        throw new Error('No wallet connected');
      }

      const response = await fetch(`${this.config.apiUrl}/payment-methods`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Network': this.config.network,
          'X-Wallet-Address': wallet.address
        },
        body: JSON.stringify({
          type,
          ...details
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to add payment method: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        id: data.id,
        type: data.type,
        name: data.name,
        last4: data.last4,
        expiryDate: data.expiry_date
      };
    } catch (error) {
      logger.error('Failed to add payment method', error as Error);
      return null;
    }
  }

  static async buyUSDC(
    amount: number,
    currency: 'USD' | 'MXN',
    paymentMethodId: string
  ): Promise<PaymentResponse | null> {
    try {
      const wallet = MultiChainWalletService.getStarknetWallet();
      
      if (!wallet) {
        throw new Error('No Starknet wallet connected');
      }

      logger.info('Buying USDC with Chipi Pay', { amount, currency });

      const paymentRequest: PaymentRequest = {
        amount,
        currency,
        paymentMethodId,
        recipientAddress: wallet.address,
        description: `Buy ${amount} USDC`
      };

      return await this.initializePayment(paymentRequest);
    } catch (error) {
      logger.error('Failed to buy USDC', error as Error);
      return null;
    }
  }

  static async sellUSDC(
    amount: number,
    currency: 'USD' | 'MXN',
    paymentMethodId: string
  ): Promise<PaymentResponse | null> {
    try {
      const wallet = MultiChainWalletService.getStarknetWallet();
      
      if (!wallet) {
        throw new Error('No Starknet wallet connected');
      }

      logger.info('Selling USDC with Chipi Pay', { amount, currency });

      // This would require approval and transfer of USDC to Chipi Pay
      const response = await fetch(`${this.config.apiUrl}/offramp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Network': this.config.network
        },
        body: JSON.stringify({
          amount,
          currency,
          payment_method_id: paymentMethodId,
          sender_address: wallet.address,
          blockchain: 'starknet'
        })
      });

      if (!response.ok) {
        throw new Error(`USDC sell failed: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        paymentId: data.payment_id,
        status: data.status,
        amount: data.amount,
        currency: data.currency,
        txHash: data.tx_hash,
        createdAt: data.created_at,
        completedAt: data.completed_at
      };
    } catch (error) {
      logger.error('Failed to sell USDC', error as Error);
      return null;
    }
  }

  static isConfigured(): boolean {
    return this.config.apiKey !== '';
  }
}

