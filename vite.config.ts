import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    'process.env': 'import.meta.env',
    'Buffer': 'globalThis.Buffer',
    '__dirname': 'import.meta.url',
    '__filename': 'import.meta.url',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      util: 'util',
      process: 'process',
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: [
      'buffer',
      'crypto-browserify',
      'stream-browserify',
      'util',
      'process'
    ],
  },
  build: {
    rollupOptions: {
      external: [],
      output: {
        globals: {
          buffer: 'Buffer',
          global: 'globalThis',
          process: 'globalThis.process'
        }
      }
    }
  }
});
