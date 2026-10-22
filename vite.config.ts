import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/release/**', '**/data/**', '**/tests/**', '**/*.db*', '**/*.tmp'],
    },
  },
  // Prevent Vite from packaging Electron-only modules
  optimizeDeps: {
    exclude: ['better-sqlite3'],
  },
});
