// Scenes UI spec §4: standalone PWA, black-translucent status bar, full-bleed, landscape.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Resolved relative to this test file (not the process cwd), so the test passes regardless of
// which directory vitest is invoked from.
const webPath = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

describe('standalone PWA shell', () => {
  it('draws under a translucent status bar with safe-area support', () => {
    const html = readFileSync(webPath('../index.html'), 'utf-8');
    expect(html).toMatch(/name="apple-mobile-web-app-status-bar-style" content="black-translucent"/);
    expect(html).toMatch(/viewport-fit=cover/);
  });
  it('installs as a landscape standalone app with a night splash', () => {
    const manifest = JSON.parse(readFileSync(webPath('../public/manifest.json'), 'utf-8'));
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('landscape');
    expect(manifest.background_color).toBe('#15121a');
  });
});
