// Immersion wave Ruling W4 (playability #1), UI4 Ruling C14: the app is built from kit classes only.
// Fails on a legacy class (testing/legacyClasses.ts: .btn, .card, .chip, .parchment, .screen,
// .scene, .eris-panel, .banner...) used in the markup (class attribute or class: directive) or
// reached through :global() in the <style> of any component or screen: the places, the battle
// (UI4 Task 8 folded battleKit.test.ts in here once its pending list was empty) and everything else.
// app.css no longer defines them (app.css.test.ts).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LEGACY_TONES, legacyUses } from './testing/legacyClasses';

const TONE_USERS = [
  'src/components/PinGate.svelte',
  'src/components/juice/Gauge.svelte',
  'src/components/places/cabin/JournalPanel.svelte',
  'src/components/places/delphi/PythiaPanel.svelte',
  'src/components/places/delphi/TabletsPanel.svelte',
  'src/components/places/library/DeskPanel.svelte',
  'src/components/places/library/LensPanel.svelte',
  'src/components/places/library/PortalPanel.svelte',
  'src/components/places/library/PortalWorkPanel.svelte',
  'src/components/places/library/ShelvesPanel.svelte',
  'src/components/places/nest/CarePanel.svelte',
  'src/components/places/title/HeroForm.svelte',
  'src/components/places/war/CodexPagePanel.svelte',
  'src/components/places/war/DossierPanel.svelte',
  'src/components/places/war/PortraitPanel.svelte',
  // Not a user: it re-inks the panels' `.muted` lines on a table overlay (:global).
  'src/components/scene/Overlay.svelte',
];

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

  // Final review M17: `.muted` and `.orange` stay in app.css as plain text tones for the panels
  // below (a recorded deviation from Ruling C14). The list only shrinks: no other file may use them.
  it('keeps the two legacy text tones to the panels that still use them', () => {
    const users = files.filter((f) => legacyUses(readFileSync(f, 'utf-8'), LEGACY_TONES).length > 0).sort();
    for (const f of users) expect(TONE_USERS, `${f} starts using .muted/.orange: use the kit's tones`).toContain(f);
    for (const f of TONE_USERS) expect(users, `${f} no longer uses them: drop it from TONE_USERS`).toContain(f);
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
