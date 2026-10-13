import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist'
  },
  resolve: {
    alias: {
      '@marzipan/updater/react/style.css': path.resolve(__dirname, '../UpdateModule/dist/react/style.css'),
      '@marzipan/updater/react': path.resolve(__dirname, '../UpdateModule/dist/react/index.js')
    }
  }
});
