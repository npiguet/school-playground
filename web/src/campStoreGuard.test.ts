// Final review I2: `campStore` is shared across heroes, so a snapshot of the previous hero can sit
// in `campStore.data` after a profile switch. Every reader goes through `campFor(profile.id)`, which
// ignores another hero's snapshot; only the store module itself touches `campStore.data`.
// Final review M1 (and its recommendation 1): one percent formatter, `rateText` (lib/text/french.ts),
// so a rate reads and wraps the same way in every place.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(svelte|ts)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const SOURCES = walk('src');

/** `file:line` for each line of `files` matching `re`. */
function hits(files: string[], re: RegExp): string[] {
  const out: string[] = [];
  for (const f of files) {
    readFileSync(f, 'utf-8')
      .split('\n')
      .forEach((line, i) => {
        if (re.test(line)) out.push(`${f}:${i + 1}: ${line.trim()}`);
      });
  }
  return out;
}

export const CAMP_DATA = /\bcampStore\.data\b/;

describe('the camp snapshot is read through campFor only (final review I2)', () => {
  it('touches campStore.data only inside the store module', () => {
    expect(hits(SOURCES.filter((f) => !f.endsWith('lib/world/campStore.svelte.ts')), CAMP_DATA)).toEqual([]);
  });

  it('catches a planted read', () => {
    expect(CAMP_DATA.test('const d = campStore.data?.dragon;')).toBe(true);
    expect(CAMP_DATA.test('const d = campFor(profile.id)?.dragon;')).toBe(false);
  });
});

describe('one percent formatter (final review M1)', () => {
  const SPACES = ' ' + String.fromCharCode(0xa0, 0x202f);
  const TEMPLATE_PERCENT = new RegExp(`}[${SPACES}]+%`);
  // A space, a no-break space or a narrow no-break space between a template's `}` and « % ».
  it('builds no « n % » outside rateText', () => {
    expect(hits(SOURCES.filter((f) => !f.endsWith('lib/text/french.ts')), TEMPLATE_PERCENT)).toEqual([]);
  });

  it('catches a planted one', () => {
    expect(TEMPLATE_PERCENT.test('`${Math.round(r * 100)}' + String.fromCharCode(0x202f) + '%`')).toBe(true);
    expect(TEMPLATE_PERCENT.test('({pct} %)')).toBe(true);
    expect(TEMPLATE_PERCENT.test('{rateText(rate)}')).toBe(false);
  });
});
