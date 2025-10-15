// Enterprise-Grade Logging System
import { config } from '../config/environment';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
  userId?: string;
  sessionId?: string;
  transactionId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  bufferSize: number;
  flushInterval: number;
}

class Logger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private sessionId: string;
  private flushTimer?: NodeJS.Timeout;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.sessionId = this.generateSessionId();
    this.startFlushTimer();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startFlushTimer(): void {
    if (this.config.enableRemote && this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
    userId?: string,
    transactionId?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
      userId,
      sessionId: this.sessionId,
      transactionId
    };
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const timestamp = entry.timestamp;

    // Enterprise-grade BigInt serialization handling
    const safeStringify = (obj: unknown): string => {
      try {
        return JSON.stringify(obj, (_key, value) => {
          if (typeof value === 'bigint') {
            return value.toString() + 'n';
          }
          return value;
        });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        // Fallback for circular references or other serialization issues
        return String(obj);
      }
    };

    const context = entry.context ? ` | Context: ${safeStringify(entry.context)}` : '';
    const error = entry.error ? ` | Error: ${entry.error.message}` : '';

    return `[${timestamp}] ${levelName}: ${entry.message}${context}${error}`;
  }

  private logToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const message = this.formatConsoleMessage(entry);
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message);
        break;
      case LogLevel.INFO:
        console.info(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.ERROR:
        console.error(message);
        if (entry.error) {
          console.error(entry.error.stack);
        }
        break;
    }
  }

  private addToBuffer(entry: LogEntry): void {
    this.buffer.push(entry);
    
    if (this.buffer.length >= this.config.bufferSize) {
      this.flush();
    }
  }

  private async sendToRemote(entries: LogEntry[]): Promise<void> {
    if (!this.config.remoteEndpoint) return;

    try {
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entries,
          source: 'definite-protocol-ui',
          version: import.meta.env.VITE_APP_VERSION || '1.0.0'
        })
      });
    } catch (error) {
      console.error('Failed to send logs to remote endpoint:', error);
    }
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
    userId?: string,
    transactionId?: string
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, context, error, userId, transactionId);
    
    this.logToConsole(entry);
    
    if (this.config.enableRemote) {
      this.addToBuffer(entry);
    }
  }

  public debug(message: string, context?: Record<string, unknown>, userId?: string): void {
    this.log(LogLevel.DEBUG, message, context, undefined, userId);
  }

  public info(message: string, context?: Record<string, unknown>, userId?: string): void {
    this.log(LogLevel.INFO, message, context, undefined, userId);
  }

  public warn(message: string, context?: Record<string, unknown>, userId?: string): void {
    this.log(LogLevel.WARN, message, context, undefined, userId);
  }

  public error(message: string, error?: Error, context?: Record<string, unknown>, userId?: string): void {
    this.log(LogLevel.ERROR, message, context, error, userId);
  }

  public transaction(
    message: string,
    transactionId: string,
    context?: Record<string, unknown>,
    userId?: string
  ): void {
    this.log(LogLevel.INFO, message, context, undefined, userId, transactionId);
  }

  public security(message: string, context?: Record<string, unknown>, userId?: string): void {
    this.log(LogLevel.WARN, `[SECURITY] ${message}`, context, undefined, userId);
  }

  public performance(
    operation: string,
    duration: number,
    context?: Record<string, unknown>,
    userId?: string
  ): void {
    this.log(LogLevel.INFO, `[PERFORMANCE] ${operation} completed in ${duration}ms`, {
      ...context,
      duration,
      operation
    }, undefined, userId);
  }

  public async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    if (this.config.enableRemote) {
      await this.sendToRemote(entries);
    }
  }

  public setUserId(userId: string): void {
    this.info('User session started', { userId });
  }

  public clearUserId(): void {
    this.info('User session ended');
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}

// Create logger configuration based on environment
const createLoggerConfig = (): LoggerConfig => {
  const levelMap: Record<string, LogLevel> = {
    debug: LogLevel.DEBUG,
    info: LogLevel.INFO,
    warn: LogLevel.WARN,
    error: LogLevel.ERROR
  };

  return {
    level: levelMap[config.monitoring.logLevel] || LogLevel.INFO,
    enableConsole: true,
    enableRemote: !!config.monitoring.metricsEndpoint,
    remoteEndpoint: config.monitoring.metricsEndpoint,
    bufferSize: 50,
    flushInterval: 30000 // 30 seconds
  };
};

// Create and export singleton logger instance
export const logger = new Logger(createLoggerConfig());

// Performance measurement utility
export const measurePerformance = async <T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>,
  userId?: string
): Promise<T> => {
  const startTime = performance.now();
  
  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    
    logger.performance(operation, duration, context, userId);
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    logger.error(`${operation} failed after ${duration}ms`, error as Error, context, userId);
    
    throw error;
  }
};

// Error boundary logger
export const logError = (error: Error, errorInfo?: Record<string, unknown>, userId?: string): void => {
  logger.error('React Error Boundary caught an error', error, {
    errorInfo,
    stack: error.stack,
    componentStack: errorInfo?.componentStack
  }, userId);
};

export default logger;
