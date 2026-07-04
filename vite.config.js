/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Solana web3 is inherently large; split vendors so the app code and
    // each heavy dependency are cached independently by the browser.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'solana', test: /[\\/]node_modules[\\/](@solana|bs58|borsh)[\\/]/ },
            { name: 'motion', test: /[\\/]node_modules[\\/]framer-motion[\\/]/ },
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    // Frontend tests only; the Anchor program has its own suite (anchor test).
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
});
