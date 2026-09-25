// The text a source file can put on screen (immersion wave guards, Tasks 4 and 13): Svelte markup
// text, and the string literals of scripts, markup expressions and .ts modules. Comments and code
// (a call such as `handle(e)`, an identifier such as `api.scan`) are not text. An approximation
// good enough for guards: it never needs to parse a real template perfectly, only to keep code out.

const LITERAL = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

const noJsComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const literals = (code: string) => (noJsComments(code).match(LITERAL) ?? []).join('\n');

export function screenText(source: string, kind: 'svelte' | 'ts'): string {
  if (kind === 'ts') return literals(source);
  const scripts = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => literals(m[1])).join('\n');
  let markup = source
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  // An expression keeps only its string literals (three passes cover one level of nesting).
  for (let i = 0; i < 3; i++) markup = markup.replace(/\{[^{}]*\}/g, (m) => ` ${literals(m)} `);
  return `${scripts}\n${markup}`;
}
