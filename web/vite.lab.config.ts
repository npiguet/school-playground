// The living dragon's lab (plan Ruling R8): its own build, into dist-lab/ (gitignored), never part of
// the game's image. Build: scripts/npm.sh exec -- vite build --config vite.lab.config.ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@content': fileURLToPath(new URL('../content', import.meta.url)),
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist-lab',
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('./lab.html', import.meta.url)) },
  },
});
