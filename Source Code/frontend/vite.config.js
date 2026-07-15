import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The local server deliberately keeps stable asset filenames so its folder does
// not grow after every build. Add a fresh query version per build instead:
// browsers receive the current UI while only one app.js/app.css remains on disk.
const cacheVersion = Date.now().toString(36);
const cacheBuster = () => ({
  name: 'cache-bust-local-assets',
  transformIndexHtml: {
    order: 'post',
    handler: (html) =>
      html.replace(/(\/assets\/app\.(?:js|css))(?!\?)/g, `$1?v=${cacheVersion}`),
  },
});

export default defineConfig({
  plugins: [react(), cacheBuster()],
  base: '/',
  build: {
    outDir: '../static',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/chunks/[name]-[hash].js',
        assetFileNames: (asset) =>
          asset.name?.endsWith('.css') ? 'assets/app.css' : 'assets/[name][extname]',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/captures': 'http://127.0.0.1:8787',
      '/exports': 'http://127.0.0.1:8787',
    },
  },
});
