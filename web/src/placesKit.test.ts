// Immersion wave Ruling W4 (playability #1), UI4 Ruling C14: the app is built from kit classes only.
// Fails on a legacy class (testing/legacyClasses.ts: .btn, .card, .chip, .parchment, .screen,
// .scene, .eris-panel, .banner...) used in the markup (class attribute or class: directive) or
// reached through :global() in the <style> of any component or screen: the places, the battle
// (UI4 Task 8 folded battleKit.test.ts in here once its pending list was empty) and everything else.
// app.css no longer defines them (app.css.test.ts).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { legacyUses } from './testing/legacyClasses';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.svelte')) out.push(p);
  }
  return out;
}

const files = [...walk('src/components'), ...walk('src/screens'), 'src/App.svelte'];

describe('the app uses the kit, never the legacy UI classes (Rulings W4, C14)', () => {
  it('scans the places, the battle and the screens', () => {
    for (const f of ['src/components/places/delphi/TabletsPanel.svelte', 'src/components/battle/BattleStage.svelte', 'src/screens/Play.svelte']) {
      expect(files).toContain(f);
    }
  });

  it('finds no legacy class', () => {
    const report: string[] = [];
    for (const f of files) {
      for (const hit of legacyUses(readFileSync(f, 'utf-8'))) report.push(`${f}:${hit}`);
    }
    expect(report).toEqual([]);
  });

  it('catches every legacy form (self-test)', () => {
    const planted = [
      '<button class="btn btn-primary">x</button>',
      '<div class="card text-card">x</div>',
      '<button class="chip" class:chip-active={on}>x</button>',
      "<span class={`chip ${x}`}>x</span>",
      '<style>.grid :global(.chip) { min-height: 48px; }</style>',
    ].join('\n');
    expect(legacyUses(planted)).toHaveLength(7);
    expect(legacyUses('<main class="screen"><div class="kit-sheet eris-panel banner">x</div></main>')).toHaveLength(3);
    expect(legacyUses('<button class="kit-bronze is-quiet">x</button><div class="kit-cubby battle-scene">y</div>')).toEqual([]);
    expect(legacyUses('<script>const btn = "btn";</script><!-- class="card" -->')).toEqual([]);
  });
});
