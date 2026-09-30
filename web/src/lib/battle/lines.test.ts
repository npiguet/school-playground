import { describe, expect, it } from 'vitest';
import { FORBIDDEN, dossierLine, smallTricksLine, type Band } from '../world/eris';
import { LIEUTENANT_ORDER } from '../world/types';
import { GENDERED, erisSelfMasculine } from '../../testing/copyRules';
import { outcomeOf } from './hp';
import * as L from './lines';

const BANDS: Band[] = ['none', 'strong', 'contested', 'weak', 'neutralised'];

// Every string reachable from lines.ts, functions called with representative arguments.
function allLines(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') {
      for (const args of [[0], [1], [2], [3, 5], [1, 2, 0.5, 'dictation'], [1, 2, 0.5, 'grimoire'], ['chantent']]) {
        try {
          walk((v as (...a: unknown[]) => unknown)(...args));
        } catch {
          /* a signature these arguments do not fit */
        }
      }
    } else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x);
  };
  for (const v of Object.values(L)) walk(v);
  return out.filter((s) => /\p{L}/u.test(s));
}

describe('the battle speaks the camp, kindly (Rulings C7, C8)', () => {
  it('never addresses the player by an agreeing adjective or « héros »', () => {
    for (const s of allLines()) expect(GENDERED.test(s), s).toBe(false);
  });

  it('keeps Éris on her own tricks', () => {
    // Her muster and reckoning lines live in content/dialogue (UI5): content.test.ts checks them.
    for (const s of [...Object.values(L.CHALLENGE_LINES), L.VICTORY.bossWon, L.VICTORY.bossLost, L.VICTORY.erisIntroduced(2)]) {
      for (const f of FORBIDDEN) expect(s.toLowerCase().includes(f), `${f} in ${s}`).toBe(false);
    }
  });

  it('lets Éris agree with herself in the feminine (UI5 playability #3)', () => {
    const eris = [
      ...Object.values(L.CHALLENGE_LINES),
      L.VICTORY.bossWon,
      L.VICTORY.bossLost,
      L.VICTORY.erisIntroduced(2),
      ...LIEUTENANT_ORDER.flatMap((k) => BANDS.map((b) => dossierLine(k, b))),
      ...[[0, 0], [10, 1], [10, 5], [10, 9]].map(([t, c]) => smallTricksLine(t, c)),
    ];
    for (const s of eris) expect(erisSelfMasculine(s), s).toEqual([]);
    expect(L.VICTORY.erisIntroduced(2)).toContain('Sournoise, je sais.');
  });

  it('keeps every static voice line short enough for its plate', () => {
    for (const s of [...Object.values(L.CHALLENGE_LINES), L.DRAGON_REVIEW_HINT, L.MUSTER.voiceMuted]) {
      expect(s.length, s).toBeLessThanOrEqual(160);
    }
  });

  it('names the hold of every opponent, elided and agreed', () => {
    expect(L.EMPRISE).toEqual({
      hydre: "L'emprise de l'Hydre",
      echo: "L'emprise d'Écho",
      chimere: "L'emprise de la Chimère",
      protee: "L'emprise de Protée",
      sirenes: "L'emprise des Sirènes",
      lethe: "L'emprise de Léthé",
      eris: "L'emprise d'Éris",
    });
  });

  it('titles every outcome without a loss', () => {
    expect(L.victoryTitle('rout', 'hydre')).toBe('Victoire\u202f!');
    expect(L.victoryTitle('push', 'hydre')).toBe("L'Hydre recule\u202f!");
    expect(L.victoryTitle('push', 'sirenes')).toBe('Les Sirènes reculent\u202f!');
    expect(L.victoryTitle('push', 'eris')).toBe('Éris recule\u202f!');
    expect(L.victoryTitle('standoff', 'echo')).toBe('Le combat continue');
  });

  // Closing item 2: c18c showed « Éris recule ! » (a half-victory title) over her line about keeping
  // the apple. Each boss outcome now gets a title and a line that agree: a win is the only "Victoire",
  // and a genuine loss has a title that never claims she was pushed back, matching her own line
  // about the fight staying open.
  it('gives each boss outcome a title and a line that agree with each other', () => {
    const won = outcomeOf({ draft: 5, caught: 5 }, { won: true });
    expect(L.victoryTitle(won, 'eris')).toBe('Victoire\u202f!');
    expect(L.VICTORY.bossWon).not.toMatch(/recule|reculent/);

    // A genuine loss, whatever she caught along the way (never the "push" half-victory title).
    for (const caught of [0, 3, 5]) {
      const lost = outcomeOf({ draft: 5, caught }, { won: false });
      expect(L.victoryTitle(lost, 'eris'), `caught ${caught}`).toBe('Le combat continue');
    }
    // Her line keeps the apple - the title must never say she was pushed back.
    expect(L.VICTORY.bossLost).toMatch(/pomme/);
    expect(L.VICTORY.bossLost).not.toMatch(/recule|reculent/);
  });

  it('lets the dragon tell the tally in words', () => {
    expect(L.dragonTally({ draft: 0, caught: 0, mode: 'dictation' })).toBe("Pas un piège dans ta dictée\u202f: Éris n'a rien pu glisser\u202f!");
    expect(L.dragonTally({ draft: 5, caught: 5, mode: 'dictation' })).toBe("Tu as déjoué 5 pièges sur 5. Ses lieutenants s'en souviendront\u202f!");
    // UI4 playability #7: one trap left is « le dernier », never « les autres ».
    expect(L.dragonTally({ draft: 2, caught: 1, mode: 'dictation' })).toBe('Tu as déjoué 1 piège sur 2. Le dernier se cache encore\u202f: on le débusquera ensemble.');
    expect(L.dragonTally({ draft: 3, caught: 2, mode: 'grimoire' })).toBe('Tu as retrouvé 2 dés-accords sur 3. Le dernier se cache encore\u202f: on le débusquera ensemble.');
    expect(L.dragonTally({ draft: 4, caught: 2, mode: 'dictation' })).toBe('Tu as déjoué 2 pièges sur 4. Les autres se cachent encore\u202f: on les débusquera ensemble.');
    expect(L.dragonTally({ draft: 4, caught: 1, mode: 'grimoire' })).toBe(
      'Tu as retrouvé 1 dés-accord sur 4. Chaque dés-accord retrouvé en fait un de moins pour la prochaine fois.',
    );
    expect(L.dragonTally({ draft: 3, caught: 0, mode: 'dictation' })).toBe('Ses pièges se sont bien cachés cette fois. Viens, on les regarde ensemble dans «\u202fRevoir\u202f».');
  });

  it('keeps the wordings the e2e reads', () => {
    expect(L.VICTORY.caught(1, 2, 'dictation')).toBe('Pièges déjoués\u202f: 1 sur 2');
    expect(L.VICTORY.caught(3, 4, 'grimoire')).toBe('Dés-accords retrouvés\u202f: 3 sur 4');
    expect([L.MUSTER.words(84), L.MUSTER.words(1)]).toEqual(['84 mots', '1 mot']);
    expect(L.MUSTER.continueAt('Pas à pas')).toBe('Continuer — Pas à pas');
  });

  it('tells the muster its bonuses and its suggestion (spec 2026-09-29 §5)', () => {
    expect([L.MUSTER.bonusTag(0.25), L.MUSTER.total(0.65), L.MUSTER.prophecyTag(0.5)]).toEqual(['+25\u202f%', 'Gloire de ce combat\u202f: +65\u202f%', 'Prophétie +50\u202f%']);
    expect(L.MUSTER.suggestLeave('la chouette')).toBe('Tu pourrais laisser la chouette au camp.');
    expect(L.MUSTER.suggestTake("les yeux d'Argus")).toBe("Tu pourrais reprendre les yeux d'Argus avec toi.");
    expect(L.MUSTER.aidsReminder(['la chouette', "le fil d'Ariane"])).toBe("Tes aides\u202f: la chouette et le fil d'Ariane.");
    expect(L.MUSTER.aidsReminder([])).toBe('Aucune aide\u202f: toutes sont restées au camp.');
  });

  // UI4 playability #1: the victory tally is the game's, not a marked test.
  it('tells the tally without a score, a percentage or a fraction', () => {
    const tally = [
      L.VICTORY.caught(0, 2, 'dictation'),
      L.VICTORY.caught(0, 3, 'grimoire'),
      L.VICTORY.caught(1, 2, 'dictation'),
      L.VICTORY.copy(3, 150, 'belle'),
      L.VICTORY.words(12, 13),
      L.VICTORY.words(1, 13),
      L.VICTORY.words(13, 13),
      L.VICTORY.words(0, 13),
    ];
    for (const s of tally) expect(s, s).not.toMatch(/Score|%|\d\s*\/\s*\d|\b0 sur\b/);
    expect(L.VICTORY.caught(0, 2, 'dictation')).toBe('Ses pièges se sont bien cachés cette fois');
    expect(L.VICTORY.caught(0, 3, 'grimoire')).toBe('Ses dés-accords se sont bien cachés cette fois');
    expect(L.VICTORY.copy(3, 150, 'belle')).toBe('Ta copie\u202f: 3 fautes sur 150 mots. Une belle copie.');
    expect(L.VICTORY.copy(0, 120, 'belle')).toBe('Ta copie\u202f: pas une faute sur 120 mots. Une belle copie.');
    expect(L.VICTORY.copy(1, 13, 'correcte')).toBe('Ta copie\u202f: 1 faute sur 13 mots. Une copie correcte.');
    expect(L.VICTORY.copy(12, 100, 'reprendre')).toBe('Ta copie\u202f: 12 fautes sur 100 mots. Une copie à reprendre.');
    // Never a grade out of 6 (spec 2026-09-29 §2).
    for (const v of ['belle', 'correcte', 'reprendre'] as const) expect(L.VICTORY.copy(2, 60, v)).not.toMatch(/\bsur 6\b|\/\s*6\b|note/);
    expect(L.VICTORY.words(12, 13)).toBe('12 mots sur 13 tiennent bon');
    expect(L.VICTORY.words(1, 13)).toBe('1 mot sur 13 tient bon');
    expect(L.VICTORY.words(13, 13)).toBe('Pas un mot de travers\u202f!');
  });

  it('says under the title what the aids taken will do, and nothing of the ones left (spec 2026-09-29 §3)', () => {
    expect(L.proofSentence(true, null)).toBe("Les Yeux d'Argus éclairent une catégorie à la fois.");
    expect(L.proofSentence(false, 2)).toBe('2 pièges sont cachés dans ce texte.');
    expect(L.proofSentence(true, 1)).toBe("Les Yeux d'Argus éclairent une catégorie à la fois. 1 piège est caché dans ce texte.");
    expect(L.proofSentence(false, null)).toBe('À toi de jouer. Quand tout te semble juste, dis-le.');
  });

  it('walks the Bouclier in text order, naming the directions on the page', () => {
    expect([L.PROOF.prevSentence, L.PROOF.nextSentence, L.PROOF.sentencePos(24, 24)]).toEqual(['Plus haut', 'Plus bas', 'Phrase 24 sur 24']);
  });

  it("states the fight's rule from the rules file, and nothing of Argus (spec 2026-09-29 §2, §3)", () => {
    expect(L.MUSTER.boss(4)).toBe("Combat contre Éris\u202f: elle s'enfuit si ta copie garde 4 fautes au plus pour 100 mots.");
    expect(L.MUSTER.boss(1)).toBe("Combat contre Éris\u202f: elle s'enfuit si ta copie garde 1 faute au plus pour 100 mots.");
    expect(L.BOSS.rules(4)).toBe("Un long texte. Si ta copie garde 4 fautes au plus pour 100 mots, Éris s'enfuit\u202f; sinon, tu pourras revenir l'affronter.");
    for (const s of [L.MUSTER.boss(4), L.BOSS.rules(4)]) expect(s).not.toMatch(/Argus/);
  });
});
