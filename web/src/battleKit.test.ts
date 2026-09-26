// UI4 (Rulings C13, C14): the battle stage is built from the kit, like the places (Ruling W4): the
// placesKit check over components/battle/ and the two battle screens.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { legacyUses } from './testing/legacyClasses';

// Files still waiting for their task. It only shrinks: a file listed here must exist and still use
// a legacy class. Lane P's files, then the fence line, then lane V's (Ruling C13): each lane removes
// only its own lines, so the two merge without a conflict. Task 8 asserts it is empty.
const PENDING = new Set<string>([
  'src/components/battle/ProofPhase.svelte',
  'src/components/battle/WordEditor.svelte',
  // --- lane V (Tasks 6-7) below this line ---
  'src/components/battle/BossMuster.svelte',
]);

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.svelte')) out.push(p);
  }
  return out;
}

const files = [...walk('src/components/battle'), 'src/screens/Play.svelte', 'src/screens/Boss.svelte'];

describe('the battle uses the kit, never the legacy UI classes (Ruling C14)', () => {
  it('finds no legacy class outside the pending files', () => {
    const report: string[] = [];
    for (const f of files) {
      if (PENDING.has(f)) continue;
      for (const hit of legacyUses(readFileSync(f, 'utf-8'))) report.push(`${f}:${hit}`);
    }
    expect(report).toEqual([]);
  });

  it('keeps the pending list honest: each file exists and still needs its task', () => {
    for (const f of PENDING) {
      expect(existsSync(f), `${f} moved: update PENDING`).toBe(true);
      expect(legacyUses(readFileSync(f, 'utf-8')).length, `${f} is clean: remove it from PENDING`).toBeGreaterThan(0);
    }
  });
});
