import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['@babylonjs/havok']
  },
  server: {
    port: 3001,
    host: true,
    open: false
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  }
});
