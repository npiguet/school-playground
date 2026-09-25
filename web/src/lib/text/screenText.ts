// The text a source file can put on screen (immersion wave guards, Tasks 4 and 13): Svelte markup
// text, and the string literals of scripts, markup expressions and .ts modules. Comments and code
// (a call such as `handle(e)`, an identifier such as `api.scan`) are not text. An approximation
// good enough for guards: it never needs to parse a real template perfectly, only to keep code out.

// A small scanner rather than regexes (B1 fix round 1): a `//` inside a string ('http://…') is not
// a comment, and a template literal keeps its text while each `${…}` keeps only the literals it
// holds, so code such as `${list.join(s)}` is not text either. Regex literals are not recognised
// (a quote inside one opens a string that stops at the end of the line).

/** Index just past the quoted string opening at `start` (an unterminated one stops at the line end). */
function quotedEnd(code: string, start: number): number {
  let i = start + 1;
  while (i < code.length) {
    const c = code[i];
    if (c === '\\') i += 2;
    else if (c === code[start]) return i + 1;
    else if (c === '\n') return i;
    else i++;
  }
  return i;
}

/** Index just past a comment opening at `i`, or `i` when none opens there. */
function commentEnd(code: string, i: number): number {
  if (code[i] !== '/') return i;
  if (code[i + 1] === '/') {
    const e = code.indexOf('\n', i);
    return e < 0 ? code.length : e;
  }
  if (code[i + 1] === '*') {
    const e = code.indexOf('*/', i + 2);
    return e < 0 ? code.length : e + 2;
  }
  return i;
}

/** Index of the `}` closing an expression that starts at `i`. */
function expressionEnd(code: string, i: number): number {
  let depth = 0;
  while (i < code.length) {
    const c = code[i];
    const skip = commentEnd(code, i);
    if (skip !== i) i = skip;
    else if (c === "'" || c === '"') i = quotedEnd(code, i);
    else if (c === '`') i = template(code, i).end;
    else if (c === '}' && depth === 0) return i;
    else {
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
    }
  }
  return i;
}

/** A template literal's text, each `${…}` replaced by the literals inside it. */
function template(code: string, start: number): { text: string; end: number } {
  let text = '`';
  let i = start + 1;
  while (i < code.length) {
    const c = code[i];
    if (c === '\\') {
      text += code.slice(i, i + 2);
      i += 2;
    } else if (c === '`') {
      return { text: text + '`', end: i + 1 };
    } else if (c === '$' && code[i + 1] === '{') {
      const end = expressionEnd(code, i + 2);
      text += ` ${literals(code.slice(i + 2, end)).replaceAll('\n', ' ')} `;
      i = end + 1;
    } else {
      text += c;
      i++;
    }
  }
  return { text, end: i };
}

/** The string literals of a piece of code, one per line; comments and code dropped. */
function literals(code: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    const skip = commentEnd(code, i);
    if (skip !== i) {
      i = skip;
    } else if (c === "'" || c === '"') {
      const end = quotedEnd(code, i);
      out.push(code.slice(i, end));
      i = end;
    } else if (c === '`') {
      const t = template(code, i);
      out.push(t.text);
      i = t.end;
    } else {
      i++;
    }
  }
  return out.join('\n');
}

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
