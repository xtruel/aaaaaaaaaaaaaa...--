import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file build: the whole game (code, CSS, fonts) ends up in dist/index.html,
// ready for itch.io, an Electron/Tauri wrapper for Steam, or a plain browser tab.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  server: {
    port: 3001,
    host: '0.0.0.0',
  },
  build: {
    target: 'es2020',
  },
});
