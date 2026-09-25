import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

const content = fileURLToPath(new URL('../content', import.meta.url));
const lib = fileURLToPath(new URL('./src/lib', import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  resolve: { alias: { '@content': content, $lib: lib } },
  server: {
    host: true,
    port: 5173,
    fs: { allow: ['..'] },
    proxy: { '/api': process.env.API_PROXY ?? 'http://localhost:8080' },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Set explicitly (vitest 5's default): each run transforms afresh, as with vitest 3, and the
    // post-run "persist transforms with fsModuleCache" hint stays out of the gate's output.
    fsModuleCache: false,
  },
});
