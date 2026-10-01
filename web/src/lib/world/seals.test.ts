import { describe, expect, it } from 'vitest';
import { MATERIALS, fightLine, sealFill, sealGauges, sealName, sealProgressLine, sealReady, sealTitle, sealTitleOf, sealsName } from './seals';
import type { SealWindow } from './types';

const next = (o: Partial<SealWindow> & { level: number }): SealWindow => ({
  days: 0, chances: 0, correct: null, complete: false,
  need: { days: 4, chances: 25, correct: 0.88 }, ...o,
});

// Spec 2026-09-29 lieutenant levels §1: on screen a level is always its material.
describe('the seals in words', () => {
  it('names each seal by its material, eliding « de » before a vowel', () => {
    expect(MATERIALS).toEqual(['bois', 'bronze', 'argent', 'or', 'orichalque']);
    expect([1, 2, 3, 4, 5].map(sealName)).toEqual(['sceau de bois', 'sceau de bronze', "sceau d'argent", "sceau d'or", "sceau d'orichalque"]);
    expect([1, 3].map(sealsName)).toEqual(['sceaux de bois', "sceaux d'argent"]);
    expect(sealTitle(2)).toBe('Sceau de bronze');
    expect([sealTitleOf('hydre', 2), sealTitleOf('echo', 3), sealTitleOf('sirenes', 1)]).toEqual(["Sceau de bronze de l'Hydre", "Sceau d'argent d'Écho", 'Sceau de bois des Sirènes']);
    for (const l of [0, 1, 2, 3, 4, 5, 6]) expect(sealTitle(l)).not.toMatch(/niveau|\d/i);
  });

  it('says what stands before the next seal (spec §5)', () => {
    const l = (level: number, n: SealWindow | null) => ({ level, next: n });
    expect(sealProgressLine('hydre', l(1, next({ level: 2, days: 2, chances: 12 })))).toBe('Encore 2 jours de garde et 13 pièges avant le sceau de bronze.');
    expect(sealProgressLine('hydre', l(1, next({ level: 2, days: 3, chances: 30 })))).toBe('Encore 1 jour de garde avant le sceau de bronze.');
    expect(sealProgressLine('protee', l(1, next({ level: 2, days: 5, chances: 24 })))).toBe('Encore 1 piège avant le sceau de bronze.');
    expect(sealProgressLine('echo', l(1, next({ level: 2, days: 4, chances: 25, correct: 0.84, complete: true })))).toBe("Il ne te reste qu'à déjouer 88\u202f% des pièges avant le sceau de bronze.");
    // Review focus 3: 22 right of 25 is exactly 88 %: the server seals it, the words agree.
    expect(sealProgressLine('echo', l(1, next({ level: 2, days: 4, chances: 25, correct: 22 / 25, complete: true })))).toBe('Tout y est\u202f: défends encore un texte, et le sceau de bronze est à toi.');
    expect(sealProgressLine('lethe', l(3, next({ level: 4, need: { days: 8, chances: 70, correct: 0.94 } })))).toBe("Encore 8 jours de garde et 70 pièges avant le sceau d'or.");
    expect(sealProgressLine('chimere', l(0, next({ level: 1, need: { days: 3, chances: 12, correct: 0.85 } })))).toBe('Pas encore croisée.');
    expect(sealProgressLine('sirenes', l(0, next({ level: 1, need: { days: 3, chances: 12, correct: 0.85 } })))).toBe('Pas encore croisées.');
    expect(sealProgressLine('protee', l(0, next({ level: 1, need: { days: 3, chances: 12, correct: 0.85 } })))).toBe('Pas encore croisé.');
    expect(sealProgressLine('hydre', l(5, null))).toBe('Il ne reste rien à conquérir ici.');
  });

  it('measures the three gauges against their targets, with the target mark', () => {
    const g = sealGauges(next({ level: 2, days: 2, chances: 20, correct: 0.84 }));
    expect(g.days).toEqual({ label: 'Jours de garde\u202f: 2 sur 4', fill: 50, ok: false });
    expect(g.chances).toEqual({ label: 'Pièges croisés\u202f: 20 sur 25', fill: 80, ok: false });
    expect(g.correct).toEqual({ label: 'Pièges déjoués\u202f: 84\u202f%, il en faut 88\u202f%', fill: 84, ok: false, mark: 88 });
    const over = sealGauges(next({ level: 2, days: 9, chances: 60, correct: 22 / 25, complete: true }));
    expect([over.days.label, over.chances.label, over.correct.ok]).toEqual(['Jours de garde\u202f: 4 sur 4', 'Pièges croisés\u202f: 25 sur 25', true]);
    expect([over.days.fill, over.chances.fill]).toEqual([100, 100]);
    expect(sealGauges(next({ level: 1 })).correct.label).toBe('Pièges déjoués\u202f: —, il en faut 88\u202f%');
    expect(sealReady(next({ level: 2, days: 4, chances: 25, correct: 22 / 25, complete: true }))).toBe(true);
    expect(sealReady(next({ level: 2, days: 4, chances: 25, correct: 0.9, complete: false }))).toBe(false);
    expect(sealFill(next({ level: 2, days: 2, chances: 25, correct: 0.44 }))).toBe(67); // (50 + 100 + 50) / 3
  });

  it('says what opens the next fight, never naming a lieutenant (spec §4, R9)', () => {
    expect(fightLine({ level: 1, missing: 2 })).toBe("Encore deux sceaux de bois et Éris t'attend.");
    expect(fightLine({ level: 1, missing: 1 })).toBe("Encore un sceau de bois et Éris t'attend.");
    expect(fightLine({ level: 3, missing: 6 })).toBe("Encore six sceaux d'argent et Éris t'attend.");
    expect(fightLine({ level: 5, missing: 7 })).toBe("Encore 7 sceaux d'orichalque et Éris t'attend.");
  });
});
