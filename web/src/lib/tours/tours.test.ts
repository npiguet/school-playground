import { describe, expect, it } from 'vitest';
import { TOUR_OF, tourSeen, tourSteps, toursEnabled } from './tours';

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
    expect(e.targets).toEqual([null, null, null, 'parchemins', 'oracle', 'dossier', 'dragon', 'cabin', 'boss', null]);
    // UI5 playability #10: the war tour rings the portrait wall when it names the lieutenants.
    expect(tourSteps('war', young).targets).toEqual(['dossier', 'portraits', 'bestiary', null]);
    const y = tourSteps('camp', young);
    expect(y.lines[0].text).toBe('On refait le tour du camp\u202f? Suis-moi.');
    expect(y.lines).toHaveLength(e.lines.length);
    expect(tourSteps('war', young).lines.at(-1)).toMatchObject({ speaker: 'eris' });
  });

  it("counts the camp's tour as seen for a hero onboarded before UI5", () => {
    expect(tourSeen({}, 'camp')).toBe(false);
    expect(tourSeen({ onboarded: true }, 'camp')).toBe(true);
    expect(tourSeen({ onboarded: true }, 'library')).toBe(false);
    expect(tourSeen({ tours: ['library'] }, 'library')).toBe(true);
  });

  it('can be switched off by the e2e hook only (Ruling E10)', () => {
    expect(toursEnabled()).toBe(true);
    (globalThis as { __discordeTours?: string }).__discordeTours = 'off';
    expect(toursEnabled()).toBe(false);
    delete (globalThis as { __discordeTours?: string }).__discordeTours;
  });
});
