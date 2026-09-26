import { describe, expect, it } from 'vitest';
import { FORBIDDEN } from '../world/eris';
import { rateText } from '../text/french';
import * as L from './lines';

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
    const bad = /\b(prête|sûre|arrêtée|piégée)\b|(^|[,!?«]\s*)(cher |jeune |petite? )?héro(s|ïne)\s*[,!]/iu;
    for (const s of allLines()) expect(bad.test(s), s).toBe(false);
  });

  it('keeps Éris on her own tricks', () => {
    for (const s of [...Object.values(L.CHALLENGE_LINES), L.ERIS_MUSTER.free, L.ERIS_MUSTER.grimoire]) {
      for (const f of FORBIDDEN) expect(s.toLowerCase().includes(f), `${f} in ${s}`).toBe(false);
    }
  });

  it('keeps every static voice line short enough for its plate', () => {
    for (const s of [...Object.values(L.CHALLENGE_LINES), L.ERIS_MUSTER.free, L.ERIS_MUSTER.grimoire, L.DRAGON_REVIEW_HINT]) {
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
    expect(L.victoryTitle('rout', 'hydre')).toBe('Victoire !');
    expect(L.victoryTitle('push', 'hydre')).toBe("L'Hydre recule !");
    expect(L.victoryTitle('push', 'sirenes')).toBe('Les Sirènes reculent !');
    expect(L.victoryTitle('push', 'eris')).toBe('Éris recule !');
    expect(L.victoryTitle('standoff', 'echo')).toBe('Le combat continue');
  });

  it('lets the dragon tell the tally in words', () => {
    expect(L.dragonTally({ draft: 0, caught: 0, mode: 'dictation' })).toBe("Pas un piège dans ta dictée : Éris n'a rien pu glisser !");
    expect(L.dragonTally({ draft: 5, caught: 5, mode: 'dictation' })).toBe("Tu as déjoué 5 pièges sur 5. Ses lieutenants s'en souviendront !");
    expect(L.dragonTally({ draft: 2, caught: 1, mode: 'dictation' })).toBe('Tu as déjoué 1 piège sur 2. Les autres se cachent encore : on les débusquera ensemble.');
    expect(L.dragonTally({ draft: 4, caught: 1, mode: 'grimoire' })).toBe(
      'Tu as retrouvé 1 dés-accord sur 4. Chaque dés-accord retrouvé en fait un de moins pour la prochaine fois.',
    );
    expect(L.dragonTally({ draft: 3, caught: 0, mode: 'dictation' })).toBe('Ses pièges se sont bien cachés cette fois. Viens, on les regarde ensemble dans « Revoir ».');
  });

  it('keeps the wordings the e2e reads', () => {
    expect(L.VICTORY.caught(1, 2, 0.5, 'dictation')).toBe(`Pièges déjoués : 1 sur 2 (${rateText(0.5)})`);
    expect(L.VICTORY.caught(3, 4, 0.75, 'grimoire')).toBe(`Dés-accords retrouvés : 3 sur 4 (${rateText(0.75)})`);
    expect([L.MUSTER.words(84), L.MUSTER.words(1)]).toEqual(['84 mots', '1 mot']);
  });
});
