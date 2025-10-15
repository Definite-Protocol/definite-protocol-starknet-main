/**
 * Enterprise-grade BigInt serialization utilities
 * Handles BigInt values in JSON serialization for Strkrand blockchain data
 */

export interface BigIntSerializationOptions {
  /** Whether to append 'n' suffix to BigInt strings for type identification */
  addSuffix?: boolean;
  /** Custom replacer function for additional value transformations */
  customReplacer?: (key: string, value: unknown) => unknown;
  /** Maximum depth for circular reference protection */
  maxDepth?: number;
}

/**
 * Safely stringify objects containing BigInt values
 * @param obj - Object to stringify
 * @param options - Serialization options
 * @returns JSON string with BigInt values converted to strings
 */
export function safeStringify(
  obj: unknown,
  options: BigIntSerializationOptions = {}
): string {
  const { addSuffix = false, customReplacer, maxDepth = 10 } = options;
  const seen = new WeakSet();
  let depth = 0;

  const replacer = (key: string, value: unknown): unknown => {
    // Prevent infinite recursion
    if (depth > maxDepth) {
      return '[Max Depth Exceeded]';
    }

    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]';
      }
      seen.add(value);
      depth++;
    }

    // Handle BigInt values
    if (typeof value === 'bigint') {
      return addSuffix ? value.toString() + 'n' : value.toString();
    }

    // Handle Uint8Array (common in Strkrand SDK)
    if (value instanceof Uint8Array) {
      return Array.from(value);
    }

    // Apply custom replacer if provided
    if (customReplacer) {
      value = customReplacer(key, value);
    }

    if (typeof value === 'object' && value !== null) {
      depth--;
    }

    return value;
  };

  try {
    return JSON.stringify(obj, replacer, 2);
  } catch (error) {
    console.warn('Failed to stringify object:', error);
    return String(obj);
  }
}

/**
 * Safely parse JSON strings that may contain BigInt values
 * @param jsonString - JSON string to parse
 * @param reviveBigInt - Whether to revive BigInt values from strings
 * @returns Parsed object
 */
export function safeParse(jsonString: string, reviveBigInt: boolean = false): unknown {
  try {
    return JSON.parse(jsonString, (_key, value) => {
      // Revive BigInt values if requested
      if (reviveBigInt && typeof value === 'string' && value.endsWith('n')) {
        try {
          return BigInt(value.slice(0, -1));
        } catch {
          return value;
        }
      }
      return value;
    });
  } catch (error) {
    console.warn('Failed to parse JSON:', error);
    return null;
  }
}

/**
 * Convert BigInt values in an object to numbers (with precision loss warning)
 * @param obj - Object containing BigInt values
 * @param warnOnPrecisionLoss - Whether to warn about potential precision loss
 * @returns Object with BigInt values converted to numbers
 */
export function bigIntToNumber(obj: Record<string, unknown> | unknown[] | bigint | unknown, warnOnPrecisionLoss: boolean = true): Record<string, unknown> | unknown[] | number | unknown {
  if (typeof obj === 'bigint') {
    const num = Number(obj);
    if (warnOnPrecisionLoss && BigInt(num) !== obj) {
      console.warn(`Precision loss converting BigInt ${obj} to number ${num}`);
    }
    return num;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => bigIntToNumber(item, warnOnPrecisionLoss));
  }

  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = bigIntToNumber(value, warnOnPrecisionLoss);
    }
    return result;
  }

  return obj;
}

/**
 * Safely convert Strkrand transaction data for JSON serialization
 * @param transaction - Raw transaction data from Strkrand SDK
 * @returns Serializable transaction object
 */
export function sanitizeStrkrandTransaction(transaction: unknown): Record<string, unknown> {
  if (!transaction) return {};

  const sanitized = { ...(transaction as Record<string, unknown>) };

  // Common BigInt fields in Strkrand transactions
  const bigIntFields = [
    'amount', 'fee', 'first-valid', 'last-valid', 'confirmed-round',
    'round-time', 'genesis-hash', 'asset-amount', 'close-amount'
  ];

  bigIntFields.forEach(field => {
    if (sanitized[field] && typeof sanitized[field] === 'bigint') {
      sanitized[field] = sanitized[field].toString();
    }
  });

  // Handle nested objects
  if (sanitized['payment-transaction']) {
    sanitized['payment-transaction'] = sanitizeStrkrandTransaction(sanitized['payment-transaction']);
  }

  if (sanitized['asset-transfer-transaction']) {
    sanitized['asset-transfer-transaction'] = sanitizeStrkrandTransaction(sanitized['asset-transfer-transaction']);
  }

  if (sanitized['application-transaction']) {
    sanitized['application-transaction'] = sanitizeStrkrandTransaction(sanitized['application-transaction']);
  }

  return sanitized;
}

/**
 * Create a BigInt-safe console logger
 * @param prefix - Log prefix
 * @returns Logger function that handles BigInt values
 */
export function createBigIntSafeLogger(prefix: string = '') {
  return (message: string, data?: unknown) => {
    const logPrefix = prefix ? `[${prefix}] ` : '';
    if (data) {
      console.log(`${logPrefix}${message}`, safeStringify(data));
    } else {
      console.log(`${logPrefix}${message}`);
    }
  };
}

/**
 * Middleware for handling BigInt in API responses
 * @param data - Response data that may contain BigInt values
 * @returns Sanitized response data
 */
export function sanitizeApiResponse(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(sanitizeApiResponse);
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'bigint') {
        sanitized[key] = value.toString();
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeApiResponse(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  if (typeof data === 'bigint') {
    return data.toString();
  }

  return data;
}
