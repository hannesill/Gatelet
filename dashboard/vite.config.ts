import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (!res.headersSent) {
              res.writeHead(503);
              res.end();
            }
          });
        },
      },
    },
  },
  build: {
    outDir: '../dist/dashboard',
    emptyOutDir: true,
  },
});
