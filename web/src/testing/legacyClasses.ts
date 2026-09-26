// The legacy UI classes the kit replaced (immersion wave Ruling W4, UI4 Ruling C14), and the scanner
// the kit guard uses (placesKit.test.ts). A plain module, not a test file: a
// test module importing another test module would register its tests twice.
export const LEGACY_CLASSES = [
  'btn',
  'btn-primary',
  'btn-ghost',
  'card',
  'chip',
  'chip-active',
  'parchment',
  // UI4 Task 8: the rest of the retired kit (app.css no longer defines any of them).
  'screen',
  'scene',
  'eris-panel',
  'banner',
  'banner-olive',
  'banner-error',
];

export function legacyUses(source: string): string[] {
  const hits: string[] = [];
  const lineOf = (i: number) => source.slice(0, i).split('\n').length;
  // Markup: drop <script> and HTML comments; keep <style> for the :global() check below.
  const markup = source
    .replace(/<script[\s\S]*?<\/script>/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const style = /<style[\s\S]*?<\/style>/.exec(markup);
  const body = style ? markup.slice(0, style.index) + markup.slice(style.index).replace(style[0], (m) => m.replace(/[^\n]/g, ' ')) : markup;
  // class="a b" or class={expr}; an expression runs to the `}` that closes the attribute (followed
  // by whitespace, `>` or `/`), so a template literal's own `${x}` does not cut it short.
  for (const m of body.matchAll(/\bclass=(?:"([^"]*)"|\{([^\n]*?)\}(?=[\s>/]))/g)) {
    const raw = (m[1] ?? '') + ' ' + [...(m[2] ?? '').matchAll(/['"`]([^'"`]*)['"`]/g)].map((s) => s[1]).join(' ');
    for (const token of raw.split(/[\s{}$]+/)) if (LEGACY_CLASSES.includes(token)) hits.push(`${lineOf(m.index!)}: class ${token}`);
  }
  for (const m of body.matchAll(/\bclass:([\w-]+)/g)) if (LEGACY_CLASSES.includes(m[1])) hits.push(`${lineOf(m.index!)}: class:${m[1]}`);
  if (style) {
    for (const m of style[0].matchAll(/:global\(\s*\.([\w-]+)/g)) {
      if (LEGACY_CLASSES.includes(m[1])) hits.push(`${lineOf(style.index + m.index!)}: :global(.${m[1]})`);
    }
  }
  return hits;
}
