import { describe, expect, it } from 'vitest';
import {
  MATERIALS,
  bonusChipLabel,
  codexStamp,
  fightLine,
  firstSealLine,
  highestTrophies,
  levelChipLabel,
  levelUpLine,
  levelUps,
  sealCry,
  sealFill,
  sealGauges,
  sealName,
  sealProgressLine,
  sealReady,
  sealTitle,
  sealTitleOf,
  sealsName,
  trophyId,
} from './seals';
import type { SealWindow } from './types';
import { swissDay } from '../swissDay';

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

  it('says the next seal waits for tomorrow when the last one was won today (R3: today no longer counts, final review I3)', () => {
    // 23:30 UTC on 30 September is already 1 October in Zurich: the seal's day is the Swiss one.
    const now = new Date('2026-10-01T09:00:00Z');
    const won = (at: string, level = 1, need = { days: 4, chances: 25, correct: 0.88 }) => ({
      level,
      level_reached_at: at,
      next: next({ level: level + 1, need }),
    });
    expect(swissDay(0, new Date('2026-09-30T23:30:00Z'))).toBe(swissDay(0, now));
    expect(sealProgressLine('hydre', won('2026-09-30T23:30:00+00:00'), now)).toBe('Le sceau de bronze se prépare dès demain\u202f: 4 jours de garde et 25 pièges.');
    expect(sealProgressLine('echo', won('2026-10-01T12:00:00+00:00', 3, { days: 1, chances: 1, correct: 0.94 }), now)).toBe("Le sceau d'or se prépare dès demain\u202f: 1 jour de garde et 1 piège.");
    // Won an earlier Swiss day (21:30 UTC on 30 September is still the 30th in Zurich): the usual words.
    expect(sealProgressLine('hydre', won('2026-09-30T21:30:00+00:00'), now)).toBe('Encore 4 jours de garde et 25 pièges avant le sceau de bronze.');
    // The fifth seal won today: nothing is left, as any other day.
    expect(sealProgressLine('hydre', { level: 5, level_reached_at: '2026-10-01T12:00:00+00:00', next: null }, now)).toBe('Il ne reste rien à conquérir ici.');
  });

  it("stamps the codex from the seal, else from the first seal's window, as the gauges count (final review M7)", () => {
    expect(codexStamp({ level: 2, next: next({ level: 3 }) })).toBe('Sceau de bronze');
    expect(codexStamp({ level: 0, next: next({ level: 1, days: 1, chances: 3 }) })).toBe('En cours');
    expect(codexStamp({ level: 0, next: next({ level: 1 }) })).toBe('À découvrir');
    expect(codexStamp(null)).toBe('À découvrir');
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

  it('reveals a seal on the victory: its cry, its line, its chip (spec §1, §5, R16)', () => {
    expect(sealCry(2)).toBe('Sceau de bronze\u202f!');
    expect(levelUpLine('hydre', 2)).toBe("Tu poses le sceau de bronze sur l'Hydre. Son trophée t'attend dans ta cabane.");
    expect(levelUpLine('sirenes', 3)).toBe("Tu poses le sceau d'argent sur les Sirènes. Leur trophée t'attend dans ta cabane.");
    expect(levelUpLine('echo', 1)).toBe("Tu poses le sceau de bois sur Écho. Son trophée t'attend dans ta cabane.");
    expect(levelChipLabel(2, "L'Hydre")).toBe("Sceau de bronze\u202f: l'Hydre");
    expect(levelChipLabel(5, 'Les Sirènes')).toBe("Sceau d'orichalque\u202f: les Sirènes");
  });

  // Review focus 5: a victory saved before the seals carries `neutralised`, no `levels`.
  it('reads the seals of a victory, and of one saved before the change', () => {
    const up = { lieutenant: 'hydre', level: 2, reward_id: 'trophy:hydre:2' };
    expect(levelUps({ levels: [up], neutralised: ['echo'] })).toEqual([up]);
    expect(levelUps({ neutralised: ['echo'] })).toEqual([{ lieutenant: 'echo', level: 1, reward_id: 'trophy:echo:1' }]);
    expect(levelUps({ levels: [{ lieutenant: 'medusa', level: 1, reward_id: 'x' }] })).toEqual([]);
    expect(levelUps({})).toEqual([]);
  });

  it('builds a trophy id in one place, and keeps two seals won in one victory apart', () => {
    expect(trophyId('hydre', 2)).toBe('trophy:hydre:2');
    const two = [
      { lieutenant: 'hydre', level: 2, reward_id: trophyId('hydre', 2) },
      { lieutenant: 'echo', level: 1, reward_id: trophyId('echo', 1) },
    ];
    expect(levelUps({ levels: two })).toEqual(two);
    const names = { hydre: "L'Hydre", echo: 'Écho' };
    const chips = [
      { reason: 'level', amount: 200, lieutenant: 'hydre', level: 2 },
      { reason: 'level', amount: 100, lieutenant: 'echo', level: 1 },
    ].map((b) => bonusChipLabel(b, names));
    expect(chips).toEqual(["Sceau de bronze\u202f: l'Hydre", 'Sceau de bois\u202f: Écho']);
    expect(two.map((u) => levelUpLine(u.lieutenant as 'hydre' | 'echo', u.level))).toEqual([
      "Tu poses le sceau de bronze sur l'Hydre. Son trophée t'attend dans ta cabane.",
      "Tu poses le sceau de bois sur Écho. Son trophée t'attend dans ta cabane.",
    ]);
  });

  it('finds the highest trophy of each lieutenant on the shelf, and says the first seal (R15)', () => {
    const owned = ['trophy:hydre:1', 'trophy:hydre:2', 'trophy:echo:1', 'tint:jade', 'trophy:medusa:3', 'trophy:lethe:9'].map((id) => ({ id }));
    expect(highestTrophies(owned)).toEqual({ hydre: 2, echo: 1 });
    expect(firstSealLine({ days: 3, chances: 12, correct: 0.85 })).toBe('Premier sceau\u202f: 3 jours de garde et 12 pièges, dont 85\u202f% déjoués.');
    expect(firstSealLine({ days: 1, chances: 1, correct: 0.5 })).toBe('Premier sceau\u202f: 1 jour de garde et 1 piège, dont 50\u202f% déjoués.');
  });

  it('labels every chip of the victory, the saved ones included', () => {
    const names = { hydre: "L'Hydre" };
    expect(bonusChipLabel({ reason: 'level', amount: 200, lieutenant: 'hydre', level: 2 }, names)).toBe("Sceau de bronze\u202f: l'Hydre");
    expect(bonusChipLabel({ reason: 'level', amount: 100, lieutenant: 'echo', level: 1 }, {})).toBe('Sceau de bois\u202f: Écho');
    expect(bonusChipLabel({ reason: 'mastery', amount: 200 }, names)).toBe('Premier sceau');
    expect(bonusChipLabel({ reason: 'pace', amount: 8 }, names)).toBe('Rythme');
    expect(bonusChipLabel({ reason: 'mystery', amount: 1 }, names)).toBe('mystery');
  });
});
