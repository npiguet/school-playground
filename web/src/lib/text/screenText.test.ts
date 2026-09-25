import { describe, expect, it } from 'vitest';
import { screenText } from './screenText';

describe('screenText', () => {
  it('keeps markup text and string literals, drops comments and code', () => {
    const svelte = "<script>// hidden(s)\nconst label = 'Poser'; function onKey(e) { handle(e); }</script>\n<!-- gone -->\n<p>Bonjour {n > 1 ? 'amis' : ''}</p>\n<button onclick={() => handle(e)}>x</button>\n<style>.a { color: red; }</style>";
    const text = screenText(svelte, 'svelte');
    expect(text).toContain("'Poser'");
    expect(text).toContain('Bonjour');
    expect(text).toContain("'amis'");
    expect(text).not.toMatch(/hidden|gone|handle|onKey|color/);
    expect(screenText("const a = 'quête'; // mot\nfoo(e);", 'ts')).toBe("'quête'");
  });
});
