// The camp's copy rules, shared by the guards that scan the sources (registerGuard, noGuilt,
// lib/battle/lines.test.ts) and the dialogue content test (lib/dialogue/content.test.ts), which
// checks the content files those source scans never read.

/** Immersion wave (spec §1 "not a school application"): the camp's words, not the school's, the
 *  office's or the IT department's. */
export const BANNED: [RegExp, string][] = [
  [/\bfacultatif\b/i, 'admin word: say what it does instead'],
  [/\bprofils?\b/i, 'admin word: « héros » or « bouclier »'],
  [/\bHarmoS\b/, 'school system'],
  [/comme à l'école/i, 'school register'],
  // No trailing \b: after « é » (not a \w character) it would never match « Scanné ».
  [/\bscann(?:er|é|ée)(?!\p{L})/iu, 'technical word: « déchiffrer »'],
  [/\bsauvegarder\b/i, 'technical word: « poser sur l\'étagère »'],
  [/jamais joué/i, 'say « Jamais défendu »'],
  [/\bréviser\b/i, 'school register: « Te préparer »'],
  [/≈/, 'catalogue metadata'],
  [/multipliée par/i, 'mechanic-speak'],
  [/domaine public/i, 'credits live in ASSETS-LICENSES.md (Ruling W9)'],
  // Singular and plural (« Autres niveaux » became « Autres classes », controller ruling after the
  // B5 batch): « niveau 3 », « à ce niveau », a « Niveau » heading, « Autres niveaux » are not.
  [/\bniveaux?\b/i, 'school register: a medallion says the class (« Ta classe », « Autres classes »)'],
  [/\btableau des quêtes\b/i, 'one name: « Le mur des quêtes » (Ruling W13)'],
];

/** The banned words found in `text`, each with its reason. */
export const banned = (text: string): string[] => BANNED.filter(([re]) => re.test(text)).map(([re, why]) => `${re} (${why})`);

/** Plan Global Constraints (Ethics): nothing is lost and no guilt wording. Only the participles:
 *  « Il manque un mot » (a neutral hint) and « ratisser » are fine. Global: use with matchAll/match. */
export const GUILT = /(?<![\p{L}])(manquée?s?|ratée?s?|perdue?s?)(?![\p{L}])/giu;

/** Rulings C7, C8: never an adjective or participle agreeing with the player (« prête », « sûre »,
 *  « seule »…; « perdue » is GUILT's), never « héros » as a vocative addressed to her. */
export const GENDERED = /\b(prête|sûre|arrêtée|piégée|seule|contente|fatiguée)\b|(^|[,!?«]\s*)(cher |jeune |petite? )?héro(s|ïne)\s*[,!]/iu;
