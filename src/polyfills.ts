// Enterprise-grade browser polyfills for Node.js modules
import { Buffer } from 'buffer';

// Enterprise polyfill configuration
declare global {
  interface Window {
    Buffer: typeof Buffer;
    global: typeof globalThis;
    process: {
      env: Record<string, string>;
      browser: boolean;
      version: string;
      platform: string;
      nextTick: (fn: () => void) => void;
    };
  }

  // Global Buffer declaration
  var Buffer: typeof import('buffer').Buffer;
  var global: typeof globalThis;
  var process: {
    env: Record<string, string>;
    browser: boolean;
    version: string;
    platform: string;
    nextTick: (fn: () => void) => void;
  };
}

// Enterprise-grade polyfill initialization - must run before any other modules
(function initializeEnterprisePolyfills() {
  // Buffer polyfill - make available globally immediately
  if (typeof globalThis !== 'undefined') {
    globalThis.Buffer = Buffer;
    (globalThis as any).global = globalThis;
  }

  // Window polyfills for browser environment
  if (typeof window !== 'undefined') {
    window.Buffer = Buffer;
    window.global = window;

    // Process polyfill with enterprise-grade configuration
    window.process = {
      env: import.meta.env || {},
      browser: true,
      version: '18.0.0',
      platform: 'browser',
      nextTick: (fn: () => void) => setTimeout(fn, 0)
    };

    // Make process available globally
    (globalThis as any).process = window.process;
  }

  // Self polyfills for web workers
  if (typeof self !== 'undefined' && typeof window === 'undefined') {
    (self as any).Buffer = Buffer;
    (self as any).global = self;
    (self as any).process = {
      env: {},
      browser: true,
      version: '18.0.0',
      platform: 'browser',
      nextTick: (fn: () => void) => setTimeout(fn, 0)
    };
  }

  // Enterprise logging for debugging
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    console.log('🏢 Enterprise polyfills loaded successfully');
    console.log('✅ Buffer available:', typeof globalThis.Buffer !== 'undefined');
    console.log('✅ Global available:', typeof globalThis.global !== 'undefined');
    console.log('✅ Process available:', typeof globalThis.process !== 'undefined');
  }
})();

export {};
