// Self-tests of the shared copy rules (copyRules.ts): the agreement rule flags a word said to the
// player and lets the same word through when it agrees with a noun.
import { describe, expect, it } from 'vitest';
import { AGREEING, GENDERED, erisSelfMasculine } from './copyRules';

// Each word agreeing with a feminine noun, as the camp's copy may rightly say it.
const WITH_A_NOUN: Record<string, string> = {
  prête: 'La potion est prête.',
  sûre: 'Une chose est sûre : Éris reviendra.',
  arrêtée: 'La dictée est arrêtée.',
  piégée: 'Cette phrase est piégée.',
  seule: 'La dictée avancera toute seule, sans voix. Une seule catégorie reste.',
  contente: 'La Pythie est contente de te voir.',
  fatiguée: 'La chouette est fatiguée ce soir.',
  // Final review M10: the masculine forms, agreeing with a masculine noun.
  prêt: 'Le dragon est prêt.',
  sûr: "C'est sûr : Éris reviendra.",
  arrêté: 'Le texte est arrêté.',
  piégé: 'Ce mot est piégé.',
  seul: 'Un seul mot reste.',
  content: 'Le dragon est content de te voir.',
  fatigué: 'Le hibou est fatigué ce soir.',
};

const TO_THE_PLAYER = [
  (w: string) => `Tu es ${w} ?`,
  (w: string) => `Es-tu bien ${w} ?`,
  (w: string) => `Tu n'es pas ${w}.`,
  (w: string) => `T'es ${w} !`,
  (w: string) => `Tu te sens ${w} ?`,
  (w: string) => `Sois ${w}.`,
  (w: string) => `Te voilà ${w} !`,
  (w: string) => `Tu étais ${w}.`,
  (w: string) => `Tu seras ${w} demain.`,
  (w: string) => `Tu n’es plus toute ${w}.`,
  (w: string) => `Tu n’es plus tout ${w}.`,
];

describe('the agreement rule (self-test)', () => {
  it('flags every word when it is said to the player', () => {
    for (const w of AGREEING) for (const say of TO_THE_PLAYER) expect(GENDERED.test(say(w)), say(w)).toBe(true);
  });

  it('lets every word through when it agrees with a noun', () => {
    expect(Object.keys(WITH_A_NOUN).sort()).toEqual([...AGREEING].sort());
    for (const s of Object.values(WITH_A_NOUN)) expect(GENDERED.test(s), s).toBe(false);
  });

  it('flags Éris describing herself in the masculine, in every frame (UI5 playability #3)', () => {
    const masculine: [string, string][] = [
      ["(Et j'en ai glissé 2 pendant ta relecture. Sournois, je sais.)", 'sournois'],
      ['Je note, vexé.', 'vexé'],
      ['Je suis furieux.', 'furieux'],
      ['Je reste bien ravi de ma ruse.', 'ravi'],
      ['Me voilà vaincu !', 'vaincu'],
      ['Moi, battu !', 'battu'],
      ["Jaloux, je l'avoue.", 'jaloux'],
    ];
    for (const [s, w] of masculine) expect(erisSelfMasculine(s), s).toEqual([w]);
    for (const s of [
      "(Et j'en ai glissé 2 pendant ta relecture. Sournoise, je sais.)",
      'Je note, vexée.',
      'Je suis furieuse.',
      'Je reste bien ravie de ma ruse.',
      'Me voilà vaincue !',
      'Je suis triste. Je suis là. Oui, je sais. Moi, jamais.',
      'Mes lieutenants sont fiers. Protée est vexé.',
    ]) {
      expect(erisSelfMasculine(s), s).toEqual([]);
    }
  });

  it('keeps « héros » out of the vocative, and inside a sentence', () => {
    expect(GENDERED.test('Bienvenue, héros !')).toBe(true);
    expect(GENDERED.test('Cher héros, entre.')).toBe(true);
    expect(GENDERED.test('Les héros du camp ne lâchent jamais rien.')).toBe(false);
  });
});
