import { defineConfig } from 'vite';

export default defineConfig({
  // For GitHub Pages project sites, assets are served under /<repo>/
  // Adjust base so built asset URLs resolve correctly on Pages.
  base: '/ggm_presents_gold/',
  server: {
    port: 8010,
    open: false
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
