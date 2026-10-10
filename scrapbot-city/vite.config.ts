import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Every browser and Electron read woff2: dropping the older woff copies keeps the single file small.
function woff2Only(): Plugin {
  return {
    name: 'woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('@fontsource') || !id.endsWith('.css')) return null;
      return code.replace(/,\s*url\([^)]*\.woff\)\s*format\('woff'\)/g, '');
    },
  };
}

// Single-file build: the whole game (code, CSS, fonts) ends up in dist/index.html,
// ready for itch.io, an Electron/Tauri wrapper for Steam, or a plain browser tab.
export default defineConfig({
  base: './',
  plugins: [woff2Only(), viteSingleFile()],
  server: {
    port: 3001,
    host: '0.0.0.0',
  },
  build: {
    target: 'es2020',
  },
});
