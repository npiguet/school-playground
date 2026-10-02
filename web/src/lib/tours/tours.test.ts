import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MUSTER } from '../battle/lines';
import { MUSTER_TOUR_PARTS, TOUR_OF, seenEntries, seenVersion, tourSeen, tourSteps, tourVersion, toursEnabled } from './tours';

const egg = { name: null, stage: 'egg', tint: 'bronze' } as never;
const young = { name: 'Brasier', stage: 'young', tint: 'olive' } as never;

describe('the first-visit tours (spec §8, Ruling E13)', () => {
  it('belongs to every place with hotspots, not to the title', () => {
    expect(TOUR_OF).toEqual({ camp: 'camp', library: 'library', delphi: 'delphi', war: 'war', nest: 'nest', cabin: 'cabin' });
  });

  it("follows the dragon's stage and names each step's hotspot", () => {
    const e = tourSteps('camp', egg);
    expect(e.lines[0].text).toMatch(/^Toc, toc\u202f!/);
    expect(e.lines[0]).toMatchObject({ speaker: 'dragon', name: "L'œuf", key: 'tour.camp.0' });
    // UI5 playability #7: two lines of lore, not three, before the first place lights up.
    expect(e.targets).toEqual([null, null, null, 'parchemins', 'oracle', 'dossier', 'dragon', 'cabin', 'stall', 'stall', 'boss', null]);
    // UI5 playability #10: the war tour rings the portrait wall when it names the lieutenants.
    expect(tourSteps('war', young).targets).toEqual(['dossier', 'portraits', 'portraits', 'bestiary', null, null]);
    const y = tourSteps('camp', young);
    expect(y.lines[0].text).toBe('On refait le tour du camp\u202f? Suis-moi.');
    expect(y.lines).toHaveLength(e.lines.length);
    expect(tourSteps('war', young).lines.at(-1)).toMatchObject({ speaker: 'eris' });
  });

  it("counts the camp's tour's first version as seen for a hero onboarded before UI5", () => {
    expect(seenVersion({}, 'camp')).toBe(0);
    expect(seenVersion({ onboarded: true }, 'camp')).toBe(1);
    expect(tourSeen({ onboarded: true }, 'camp')).toBe(false); // the camp has new steps since
    expect(tourSeen({ onboarded: true }, 'library')).toBe(false);
    expect(tourSeen({ tours: ['library'] }, 'library')).toBe(true);
  });

  // Spec 2026-09-29 explanations §2, R8; review focus 2.
  it('versions each tour by its newest steps, and reads what a hero has seen', () => {
    expect([tourVersion('camp'), tourVersion('war'), tourVersion('nest'), tourVersion('cabin')]).toEqual([2, 2, 2, 2]);
    expect([tourVersion('library'), tourVersion('delphi')]).toEqual([1, 1]);
    expect(seenVersion({ tours: ['war'] }, 'war')).toBe(1);
    expect(seenVersion({ tours: ['war', 'war:2'] }, 'war')).toBe(2);
    expect(seenVersion({ tours: ['war:x', 'war:0', 'war:2.5', 'warrior', 'war:', 'war: 2', 'war:02', 'war:-2'] }, 'war')).toBe(0);
    expect(tourSeen({ tours: ['war'] }, 'war')).toBe(false);
    expect(tourSeen({ tours: ['war', 'war:2'] }, 'war')).toBe(true);
    expect(seenEntries('library')).toEqual(['library']);
    expect(seenEntries('cabin')).toEqual(['cabin', 'cabin:2']);
  });

  it('re-shows only the steps newer than what was seen, for the dragon on show', () => {
    expect(tourSteps('cabin', young, 1).targets).toEqual(['trophies', 'lyre', null]);
    expect(tourSteps('war', young, 1).targets).toEqual(['portraits', null]);
    expect(tourSteps('camp', young, 1).lines.map((l) => l.speaker)).toEqual(['hermes', 'dragon']);
    expect(tourSteps('camp', young, 1).targets).toEqual(['stall', 'stall']);
    expect(tourSteps('nest', egg, 1).lines.map((l) => l.text)).toEqual(['Quand je serai un jeune dragon, je porterai une parure. Hermès vend chaque pièce à son étal, dans le camp.']);
    expect(tourSteps('nest', young, 1).lines[0].text).toMatch(/^Ici, tu choisis aussi ma parure/);
    expect(tourSteps('library', young, 1).lines).toEqual([]);
    expect(tourSteps('cabin', young, 2).lines).toEqual([]);
    expect(tourSteps('cabin', young).lines).toHaveLength(6);
  });

  // Spec 2026-09-29 explanations §2 (R11): the muster's own tour, told by the dragon.
  it('walks the muster through the pace, the aids and the total', () => {
    const m = tourSteps('muster', young);
    expect(m.targets).toEqual(['pace', 'aids', 'aids', 'bonus', null]);
    expect(m.lines.every((l) => l.speaker === 'dragon')).toBe(true);
    expect(MUSTER_TOUR_PARTS).toEqual(['pace', 'aids', 'bonus']);
    expect(tourVersion('muster')).toBe(1);
  });

  // Final review M4: each part the muster tour rings is marked in the muster's markup, under that name
  // (renaming one in a component without the constant would leave the ring with nothing to land on).
  it('finds every muster tour part in the muster markup', () => {
    const markup = ['PaceMedallions', 'AidToggles', 'MusterPhase']
      .map((c) => readFileSync(`src/components/battle/${c}.svelte`, 'utf-8'))
      .join('\n');
    const marked = [...markup.matchAll(/data-tour-part="([a-z]+)"/g)].map((m) => m[1]).sort();
    expect(marked).toEqual([...MUSTER_TOUR_PARTS].sort());
  });

  // Task 3 review, ruling: « C'est parti ! » only closes the tour, so its last line points at the
  // button still to press, never at a dictation that would start by itself.
  it('ends the muster tour on the button that starts the dictation', () => {
    for (const stage of [egg, young]) {
      const last = tourSteps('muster', stage).lines.at(-1)!.text;
      expect(last).toContain(`«\u202f${MUSTER.start}\u202f»`);
      expect(last).not.toMatch(/en route/i);
    }
  });

  it('can be switched off by the e2e hook only (Ruling E10)', () => {
    expect(toursEnabled()).toBe(true);
    (globalThis as { __discordeTours?: string }).__discordeTours = 'off';
    expect(toursEnabled()).toBe(false);
    delete (globalThis as { __discordeTours?: string }).__discordeTours;
  });
});
