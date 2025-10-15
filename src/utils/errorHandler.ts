// Enterprise Error Handling System
import { logger } from './logger';

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  BLOCKCHAIN_ERROR = 'BLOCKCHAIN_ERROR',
  WALLET_ERROR = 'WALLET_ERROR',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  ORACLE_ERROR = 'ORACLE_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  PAYMENT_ERROR = 'PAYMENT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ErrorContext {
  userId?: string;
  transactionId?: string;
  walletAddress?: string;
  operation?: string;
  timestamp: string;
  userAgent?: string;
  url?: string;
  additionalData?: Record<string, unknown>;
}

export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  code: string;
  context: ErrorContext;
  originalError?: Error;
  retryable: boolean;
  actionRequired?: string;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorQueue: AppError[] = [];
  private maxQueueSize = 100;

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private createContext(additionalContext?: Partial<ErrorContext>): ErrorContext {
    return {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...additionalContext
    };
  }

  private getUserFriendlyMessage(type: ErrorType): string {
    const messages: Record<ErrorType, string> = {
      [ErrorType.NETWORK_ERROR]: 'Network connection issue. Please check your internet connection and try again.',
      [ErrorType.VALIDATION_ERROR]: 'Please check your input and try again.',
      [ErrorType.AUTHENTICATION_ERROR]: 'Please connect your wallet to continue.',
      [ErrorType.AUTHORIZATION_ERROR]: 'You do not have permission to perform this action.',
      [ErrorType.BLOCKCHAIN_ERROR]: 'Blockchain network issue. Please try again in a few moments.',
      [ErrorType.WALLET_ERROR]: 'Wallet connection issue. Please reconnect your wallet.',
      [ErrorType.CONTRACT_ERROR]: 'Smart contract interaction failed. Please try again.',
      [ErrorType.ORACLE_ERROR]: 'Price feed temporarily unavailable. Please try again.',
      [ErrorType.RATE_LIMIT_ERROR]: 'Too many requests. Please wait a moment before trying again.',
      [ErrorType.INSUFFICIENT_FUNDS]: 'Insufficient funds to complete this transaction.',
      [ErrorType.TRANSACTION_FAILED]: 'Transaction failed. Please check your wallet and try again.',
      [ErrorType.PAYMENT_ERROR]: 'Payment processing failed. Please check your payment method and try again.',
      [ErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
    };

    return messages[type] || messages[ErrorType.UNKNOWN_ERROR];
  }

  private determineErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorType.NETWORK_ERROR;
    }
    
    if (message.includes('wallet') || message.includes('connect')) {
      return ErrorType.WALLET_ERROR;
    }
    
    if (message.includes('insufficient') || message.includes('balance')) {
      return ErrorType.INSUFFICIENT_FUNDS;
    }
    
    if (message.includes('transaction') || message.includes('txn')) {
      return ErrorType.TRANSACTION_FAILED;
    }
    
    if (message.includes('contract') || message.includes('app call')) {
      return ErrorType.CONTRACT_ERROR;
    }
    
    if (message.includes('oracle') || message.includes('price')) {
      return ErrorType.ORACLE_ERROR;
    }
    
    if (message.includes('rate limit') || message.includes('too many')) {
      return ErrorType.RATE_LIMIT_ERROR;
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION_ERROR;
    }
    
    return ErrorType.UNKNOWN_ERROR;
  }

  private determineSeverity(type: ErrorType): ErrorSeverity {
    const severityMap: Record<ErrorType, ErrorSeverity> = {
      [ErrorType.NETWORK_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.VALIDATION_ERROR]: ErrorSeverity.LOW,
      [ErrorType.AUTHENTICATION_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.AUTHORIZATION_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.BLOCKCHAIN_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.WALLET_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.CONTRACT_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.ORACLE_ERROR]: ErrorSeverity.HIGH,
      [ErrorType.RATE_LIMIT_ERROR]: ErrorSeverity.LOW,
      [ErrorType.INSUFFICIENT_FUNDS]: ErrorSeverity.LOW,
      [ErrorType.TRANSACTION_FAILED]: ErrorSeverity.MEDIUM,
      [ErrorType.PAYMENT_ERROR]: ErrorSeverity.MEDIUM,
      [ErrorType.UNKNOWN_ERROR]: ErrorSeverity.MEDIUM
    };

    return severityMap[type] || ErrorSeverity.MEDIUM;
  }

  private isRetryable(type: ErrorType): boolean {
    const retryableTypes = [
      ErrorType.NETWORK_ERROR,
      ErrorType.BLOCKCHAIN_ERROR,
      ErrorType.ORACLE_ERROR,
      ErrorType.RATE_LIMIT_ERROR,
      ErrorType.TRANSACTION_FAILED
    ];

    return retryableTypes.includes(type);
  }

  private getActionRequired(type: ErrorType): string | undefined {
    const actions: Partial<Record<ErrorType, string>> = {
      [ErrorType.AUTHENTICATION_ERROR]: 'Connect your wallet',
      [ErrorType.WALLET_ERROR]: 'Reconnect your wallet',
      [ErrorType.INSUFFICIENT_FUNDS]: 'Add more funds to your wallet',
      [ErrorType.RATE_LIMIT_ERROR]: 'Wait before retrying'
    };

    return actions[type];
  }

  public handleError(
    error: Error,
    context?: Partial<ErrorContext>,
    customType?: ErrorType
  ): AppError {
    const type = customType || this.determineErrorType(error);
    const severity = this.determineSeverity(type);
    const errorContext = this.createContext(context);
    
    const appError: AppError = {
      type,
      severity,
      message: error.message,
      userMessage: this.getUserFriendlyMessage(type),
      code: `${type}_${Date.now()}`,
      context: errorContext,
      originalError: error,
      retryable: this.isRetryable(type),
      actionRequired: this.getActionRequired(type)
    };

    // Log the error
    logger.error(
      `Error handled: ${type}`,
      error,
      {
        errorCode: appError.code,
        severity,
        retryable: appError.retryable,
        ...errorContext
      },
      context?.userId
    );

    // Add to error queue for monitoring
    this.addToQueue(appError);

    return appError;
  }

  public handleAsyncError<T>(
    promise: Promise<T>,
    context?: Partial<ErrorContext>,
    customType?: ErrorType
  ): Promise<T> {
    return promise.catch((error) => {
      const appError = this.handleError(error, context, customType);
      throw appError;
    });
  }

  public createValidationError(
    message: string,
    field?: string,
    context?: Partial<ErrorContext>
  ): AppError {
    const error = new Error(message);
    return this.handleError(error, {
      ...context,
      additionalData: { field }
    }, ErrorType.VALIDATION_ERROR);
  }

  public createNetworkError(
    message: string,
    context?: Partial<ErrorContext>
  ): AppError {
    const error = new Error(message);
    return this.handleError(error, context, ErrorType.NETWORK_ERROR);
  }

  public createWalletError(
    message: string,
    context?: Partial<ErrorContext>
  ): AppError {
    const error = new Error(message);
    return this.handleError(error, context, ErrorType.WALLET_ERROR);
  }

  public createTransactionError(
    message: string,
    transactionId?: string,
    context?: Partial<ErrorContext>
  ): AppError {
    const error = new Error(message);
    return this.handleError(error, {
      ...context,
      transactionId
    }, ErrorType.TRANSACTION_FAILED);
  }

  private addToQueue(error: AppError): void {
    this.errorQueue.push(error);
    
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift(); // Remove oldest error
    }
  }

  public getRecentErrors(count: number = 10): AppError[] {
    return this.errorQueue.slice(-count);
  }

  public getErrorsByType(type: ErrorType): AppError[] {
    return this.errorQueue.filter(error => error.type === type);
  }

  public clearErrors(): void {
    this.errorQueue = [];
  }

  public getErrorStats(): Record<ErrorType, number> {
    const stats: Record<ErrorType, number> = {} as Record<ErrorType, number>;
    
    Object.values(ErrorType).forEach(type => {
      stats[type] = 0;
    });
    
    this.errorQueue.forEach(error => {
      stats[error.type]++;
    });
    
    return stats;
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Utility functions for common error scenarios
export const handleWalletError = (error: Error, context?: Partial<ErrorContext>): AppError => {
  return errorHandler.createWalletError(error.message, context);
};

export const handleTransactionError = (
  error: Error,
  transactionId?: string,
  context?: Partial<ErrorContext>
): AppError => {
  return errorHandler.createTransactionError(error.message, transactionId, context);
};

export const handleValidationError = (
  message: string,
  field?: string,
  context?: Partial<ErrorContext>
): AppError => {
  return errorHandler.createValidationError(message, field, context);
};

export const handleNetworkError = (error: Error, context?: Partial<ErrorContext>): AppError => {
  return errorHandler.createNetworkError(error.message, context);
};

export default errorHandler;
