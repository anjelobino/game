import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 2500 },
  optimizeDeps: { exclude: ['@dimforge/rapier3d-compat'] },
});
