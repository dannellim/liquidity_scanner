import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = 'liquidity_scanner';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${repoName}/` : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/api\/yahoo/, '/ws/screeners/v1/finance'),
      },
    },
  },
}));
