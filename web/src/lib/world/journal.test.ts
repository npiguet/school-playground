import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HELP_RULE, HELP_STAGES, defenceGroups, helpStageLine, journalRuses, localDay, ruseLine } from './journal';

describe("the journal's words (UI3 Ruling B6; the register guard's « niveau » carry)", () => {
  it("says what the Muses do at each of the four stages in their own voice, with no school word or step number (playability #2)", () => {
    expect(HELP_STAGES).toEqual([1, 2, 3, 4]);
    expect(HELP_STAGES.map(helpStageLine)).toEqual([
      "Les yeux d'Argus te montrent chaque piège.",
      'Les Muses te disent quelles ruses chercher, mais pas où elles se cachent.',
      'Les Muses te disent seulement combien de pièges se cachent.',
      "Tu relis sans l'aide des Muses.",
    ]);
    expect(HELP_RULE).toBe("Plus tu déjoues de pièges, moins les Muses t'aident.");
    expect(helpStageLine(9)).toBe('');
    for (const s of HELP_STAGES) expect(helpStageLine(s)).not.toMatch(/niveau|classe|école|étape|\d|\bseule\b/i);
  });
});

describe("Éris's tricks, one by one (playability #1: a monster and its laurels, never a gradebook row)", () => {
  it('names the monster first, sums its tricks, and keeps the grammar as small print', () => {
    const rows = journalRuses([
      { category: 'homophone', errors_in_draft: 4, caught: 1 },
      { category: 'agreement:verb', errors_in_draft: 12, caught: 11 },
      { category: 'agreement:number', errors_in_draft: 4, caught: 4 },
      { category: 'accent', errors_in_draft: 2, caught: 2 },
      { category: 'agreement:gender', errors_in_draft: 0, caught: 0 },
    ]);
    expect(rows).toEqual([
      { key: 'hydre', title: "L'Hydre", line: 'tu as déjoué 15 de ses 16 pièges', rules: "l'accord du verbe avec son sujet, l'accord en nombre", leaves: 5 },
      { key: 'echo', title: 'Écho', line: 'tu as déjoué 1 de ses 4 pièges', rules: 'les mots qui sonnent pareil : a ou à, et ou est', leaves: 1 },
      { key: 'eris', title: 'Ses petites ruses', line: 'tu as déjoué ses 2 pièges', rules: 'les accents', leaves: 5 },
    ]);
  });

  it("gives the derived tricks their monsters, never a raw key", () => {
    const rows = journalRuses([
      { category: 'derived:sirenes', errors_in_draft: 3, caught: 0 },
      { category: 'derived:lethe', errors_in_draft: 1, caught: 1 },
    ]);
    expect(rows.map((r) => [r.key, r.title, r.line, r.leaves])).toEqual([
      ['sirenes', 'Les Sirènes', "tu n'as encore déjoué aucun de leurs 3 pièges", 0],
      ['lethe', 'Léthé', 'tu as déjoué son piège', 5],
    ]);
    for (const r of rows) expect(r.rules).not.toMatch(/derived|:/);
  });

  it('agrees a single trap and a plural owner', () => {
    expect(ruseLine(0, 1, 'hydre')).toBe("tu n'as pas encore déjoué son piège");
    expect(ruseLine(1, 1, 'sirenes')).toBe('tu as déjoué leur piège');
    expect(ruseLine(4, 5, 'sirenes')).toBe('tu as déjoué 4 de leurs 5 pièges');
  });
});

describe('the last defences (playability #14)', () => {
  // The hero's clock: Zurich is UTC+2 in September, so 22:30 UTC is already the next day at home.
  let tz: string | undefined;
  beforeEach(() => {
    tz = process.env.TZ;
    process.env.TZ = 'Europe/Zurich';
  });
  afterEach(() => {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  });
  const today = new Date(2026, 8, 26);

  it('dates a text finished at 00:30 local time on that local day, not the UTC one', () => {
    expect(localDay('2026-09-21T22:30:00+00:00')).toBe('2026-09-22');
    expect(defenceGroups([{ text_id: 1, title: 'La veillée', finished_at: '2026-09-21T22:30:00+00:00', mode: 'dictation' }], today)).toEqual([
      { key: '1:d', title: 'La veillée', grimoire: false, line: 'une défense, le mardi 22 septembre' },
    ]);
  });

  it('groups a text defended several times under its latest date, with no points, the grimoire apart', () => {
    const groups = defenceGroups(
      [
        { text_id: 7, title: 'La veillée', finished_at: '2026-09-25T10:00:00+00:00', mode: 'dictation' },
        { text_id: 8, title: 'Le berger', finished_at: '2026-09-24T10:00:00+00:00', mode: 'dictation' },
        { text_id: 7, title: 'La veillée', finished_at: '2026-09-23T10:00:00+00:00', mode: 'dictation' },
        { text_id: 7, title: 'La veillée', finished_at: '2026-09-22T10:00:00+00:00', mode: 'grimoire' },
      ],
      today,
    );
    expect(groups).toEqual([
      { key: '7:d', title: 'La veillée', grimoire: false, line: '2 défenses, la dernière le vendredi 25 septembre' },
      { key: '8:d', title: 'Le berger', grimoire: false, line: 'une défense, le jeudi 24 septembre' },
      { key: '7:g', title: 'La veillée', grimoire: true, line: 'une défense, le mardi 22 septembre' },
    ]);
    for (const g of groups) expect(g.line).not.toMatch(/point|%/);
  });
});
