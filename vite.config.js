import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = 'liquidity_scanner';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${repoName}/` : '/',
  plugins: [react()],
}));
