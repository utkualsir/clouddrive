import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: true,
    port: 5173,
    hmr: {
      // Explicit HMR host prevents the proxy from interfering with Vite's own WebSocket
      host: 'localhost',
      port: 5173,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // No ws:true — that would hook into the upgrade event and break HMR.
        // The app WebSocket connects directly to port 3001 instead.
      },
    },
  },
});
