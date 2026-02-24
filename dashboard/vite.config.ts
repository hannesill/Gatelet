import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:4001',
    },
  },
  build: {
    outDir: '../dist/dashboard',
    emptyOutDir: true,
  },
});
