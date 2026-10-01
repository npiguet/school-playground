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

  it('reads a template literal without the code of its ${…} parts (B1 fix round 1)', () => {
    expect(screenText('const a = `${list.join(s)} · ${n}`;', 'ts')).toBe('`   ·   `');
    expect(screenText("const a = `${n} ${n > 1 ? 'quêtes' : 'quête(s)'}`;", 'ts')).toBe("`    'quêtes' 'quête(s)' `");
    expect(screenText('const a = `${f({ a: `x${y}z` })}`;', 'ts')).toBe('` `x  z` `');
  });

  it('keeps a // inside a string: it is not a comment (B1 fix round 1)', () => {
    expect(screenText("const u = 'http://a.b/quête(s)'; // mot(s)", 'ts')).toBe("'http://a.b/quête(s)'");
    expect(screenText('const u = "a // b"; /* c(s) */ const v = \'d\';', 'ts')).toBe('"a // b"\n\'d\'');
  });

  it('drops a style attribute (CSS, never text) whether quoted or a computed expression (UI5 Task 8)', () => {
    expect(screenText('<p style="color: red; width: 2px">Bonjour</p>', 'svelte')).not.toMatch(/color|width/);
    expect(screenText('<img style={`filter: ${f(t)}; width: ${n}px`} alt="Ton dragon" />', 'svelte')).not.toMatch(/filter|width/);
    expect(screenText('<img style={`filter: ${f(t)}; width: ${n}px`} alt="Ton dragon" />', 'svelte')).toContain('Ton dragon');
  });

  it('drops a block marker’s head expression (control flow, never text) (UI5 Task 8)', () => {
    const text = screenText('{#key `${a.id}:${b.gen}`}<p>Victoire\u202f!</p>{/key}', 'svelte');
    expect(text).not.toMatch(/[ \u00a0]:/);
    expect(text).toContain('Victoire\u202f!');
  });
});
