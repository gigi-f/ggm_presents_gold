import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8010,
    open: false
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
