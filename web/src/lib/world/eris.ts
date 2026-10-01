// Éris's voice: dossier lines templated by lieutenant × band (spec §2, §3.6; spec 2026-09-29 lieutenant levels §5).
// Taunts target only her own tricks, never the player's ability - the FORBIDDEN list and its
// unit test (eris.test.ts) are the guardrail. Pure functions/data only, no DOM/store access, so
// this lane's screens (Dossier, Lieutenant) can stay thin.
import { stageLabel } from './dragon';
import type { DragonStage, LieutenantKey, LieutenantState } from './types';
import { levelIndex } from '../levels';
import { plural } from '../text/french';

export type Band = 'none' | 'strong' | 'contested' | 'weak' | 'bois' | 'argent' | 'orichalque';

// Narrative gender for French agreement (I7): l'Hydre, Écho, la Chimère, les Sirènes and Léthé
// (a personification) are feminine; Protée alone is masculine. Mirrors the `gender` field on
// `server/app/world/catalog.py`'s LIEUTENANTS. Kept as static data here (not read from the
// world catalog fetched over the network) so this pure, store-free module can be used before
// that catalog has loaded, and so every screen agrees on the same source of truth.
export type Gender = 'f' | 'm' | 'fp';

const GENDER: Record<LieutenantKey, Gender> = {
  hydre: 'f',
  echo: 'f',
  chimere: 'f',
  protee: 'm',
  sirenes: 'fp',
  lethe: 'f',
};

// The camp's names (catalog.py `LIEUTENANTS[*].name`), static like GENDER so the module stays
// store-free.
const NAMES: Record<LieutenantKey, string> = {
  hydre: "L'Hydre",
  echo: 'Écho',
  chimere: 'La Chimère',
  protee: 'Protée',
  sirenes: 'Les Sirènes',
  lethe: 'Léthé',
};

/** A lieutenant's name as the camp says it. */
export function lieutenantName(key: LieutenantKey): string {
  return NAMES[key];
}

export function genderFor(key: LieutenantKey): Gender {
  return GENDER[key];
}

/** Agrees a past-participle/adjective stem (e.g. "croisé") with a lieutenant's gender:
 *  "-e" feminine, "-es" feminine plural, unchanged masculine. */
export function agree(base: string, key: LieutenantKey): string {
  const g = GENDER[key];
  return g === 'fp' ? `${base}es` : g === 'f' ? `${base}e` : base;
}

/** The stressed/disjunctive pronoun ("contre lui/elle/elles") for a lieutenant. */
export function pronounFor(key: LieutenantKey): string {
  const g = GENDER[key];
  return g === 'fp' ? 'elles' : g === 'f' ? 'elle' : 'lui';
}

/** The picker's "that one" confirm label ("C'est celui-là" / "C'est celle-là" / "Ce sont
 *  celles-là"), agreeing both the demonstrative pronoun and the verb. */
export function confirmChoiceLabel(key: LieutenantKey): string {
  const g = GENDER[key];
  if (g === 'fp') return 'Ce sont celles-là';
  return g === 'f' ? "C'est celle-là" : "C'est celui-là";
}

// Words/phrases that would turn a taunt about Éris's own tricks into one about the player -
// never allowed in a dossier line (Decision 19). Checked in lowercase.
export const FORBIDDEN = [
  'nul',
  'nulle',
  'mauvais',
  'mauvaise',
  'incapable',
  'bête',
  'idiot',
  'idiote',
  'tu es',
  "tu n'es",
  'tu ne sais',
  "tu n'arrives",
  'faible',
];

/** Bands a lieutenant's dossier line (R11): before the first seal on its all-time catch rate
 *  (Decision 19 thresholds); then on its seal group: bois-bronze, argent-or, orichalque. */
export function bandFor(l: Pick<LieutenantState, 'level' | 'all_time'>): Band {
  if (l.level >= 5) return 'orichalque';
  if (l.level >= 3) return 'argent';
  if (l.level >= 1) return 'bois';
  const { traps, rate } = l.all_time;
  if (traps < 3 || rate === null) return 'none';
  return rate < 0.4 ? 'strong' : rate < 0.8 ? 'contested' : 'weak';
}

const LINES: Record<LieutenantKey, Record<Band, string>> = {
  hydre: {
    none: "Mon Hydre n'a pas encore montré ses têtes dans ces textes. Patience\u202f: elles repoussent vite.",
    strong: 'Les têtes de mon Hydre se glissent dans les pluriels et personne ne les remarque. Délicieux.',
    contested: "Une tête coupée sur deux. L'Hydre s'énerve, et moi aussi.",
    weak: 'Mon Hydre ne trouve presque plus de verbe où se cacher. Je vais devoir la nourrir.',
    bois: 'Mon Hydre porte un sceau. Ses têtes repoussent quand même, je les arrose tous les soirs.',
    argent: "Mon Hydre ne sort plus ses têtes qu'une à une. Et encore, on les compte.",
    orichalque: "Cinq sceaux sur mon Hydre. Elle n'a plus une tête à montrer. Je ne veux plus en parler.",
  },
  echo: {
    none: 'Écho attend son heure\u202f: a ou à, et ou est… elle répète, et on la croit.',
    strong: 'Écho murmure et ses mots passent pour vrais. Mon meilleur tour.',
    contested: 'Écho se fait démasquer une fois sur deux. Elle boude dans sa grotte.',
    weak: 'Écho n\'ose presque plus répéter. Ses échos s\'éteignent, quelle tristesse.',
    bois: "Écho porte un sceau. Elle répète encore, mais on l'écoute de moins en moins.",
    argent: 'Écho chuchote a ou à, et on lui répond juste. Elle boude au fond de sa grotte.',
    orichalque: 'Cinq sceaux sur Écho. Même son écho se tait. Je vais devoir trouver une autre voix.',
  },
  chimere: {
    none: 'Ma Chimère n\'a pas encore rugi ici. Ses têtes se disputent le genre de chaque mot.',
    strong: 'Un masculin ici, un féminin là\u202f: ma Chimère brouille tout et personne ne bronche.',
    contested: 'La Chimère perd une tête sur deux. Elle ne sait plus laquelle rugir.',
    weak: 'Ma Chimère se fait attraper presque à chaque fois. Ses trois têtes en rougissent.',
    bois: 'Un sceau sur ma Chimère. Ses trois têtes cherchent qui a laissé passer ce masculin.',
    argent: 'Ma Chimère rugit en masculin, on lui répond en féminin, et juste. C\'est agaçant.',
    orichalque: 'Cinq sceaux sur ma Chimère. Elle ne rugit plus du tout. Bellérophon serait jaloux… non, rien.',
  },
  protee: {
    none: 'Protée dort au fond de la mer. Ses participes changent de forme quand on les regarde.',
    strong: 'Protée change de forme sous les yeux de tout le monde et personne ne le retient. Un artiste.',
    contested: 'On retient Protée une fois sur deux. Il glisse encore, mais moins bien.',
    weak: "Protée n'arrive presque plus à se transformer sans être attrapé. Vexant.",
    bois: 'Protée porte un sceau. Il change encore de forme, mais on le reconnaît sous chacune.',
    argent: 'On tient Protée sous toutes ses formes, -é, -ée, -és. Il en invente une nouvelle chaque nuit.',
    orichalque: "Cinq sceaux sur Protée. Il garde sa vraie forme et refuse d'en changer. Quel ennui.",
  },
  sirenes: {
    none: "Mes Sirènes n'ont pas encore chanté\u202f: elles éloignent le sujet de son verbe et attendent.",
    strong: 'Le chant des Sirènes fait oublier le sujet à tout le monde. Mon plus beau tour.',
    contested: 'Une phrase sur deux résiste au chant des Sirènes. Elles chantent plus fort.',
    weak: "Les Sirènes chantent dans le vide. Quelqu'un s'attache au mât, c'est agaçant.",
    bois: 'Un sceau sur mes Sirènes. Elles chantent toujours, mais le camp a trouvé la cire.',
    argent: 'Mes Sirènes éloignent le sujet, et on le ramène à son verbe. Elles chantent faux, de rage.',
    orichalque: "Cinq sceaux sur mes Sirènes. Plus personne ne se jette à l'eau pour elles. Quel gâchis.",
  },
  lethe: {
    none: "Léthé attend la fin des textes. C'est là que la vigilance s'endort.",
    strong: 'Dans le dernier tiers, Léthé fait tout oublier. Personne ne relit jusqu\'au bout. Exquis.',
    contested: 'Léthé endort la fin des textes une fois sur deux. Elle trouve ça insuffisant.',
    weak: "Léthé n'endort presque plus personne. La fin des textes est relue. Scandaleux.",
    bois: 'Léthé porte un sceau. Elle endort encore la fin des textes, mais on se réveille à temps.',
    argent: "Léthé verse son eau sur le dernier tiers, et on relit jusqu'au bout. Elle n'en revient pas.",
    orichalque: "Cinq sceaux sur Léthé. On n'oublie plus rien, pas même la dernière ligne. Moi, j'aimerais oublier ça.",
  },
};

export function dossierLine(key: LieutenantKey, band: Band): string {
  return LINES[key][band];
}

export function dossierIntro(name: string, sessions: number): string {
  if (sessions === 0) return `Dossier «\u202f${name}\u202f». Rien à signaler pour l'instant. Ça ne durera pas.`;
  return `Dossier «\u202f${name}\u202f». ${plural(sessions, 'texte surveillé', 'textes surveillés')} de près. Voici où mes ruses passent encore.`;
}

/** Éris on her small tricks (accents, letters, capitals), in words, never a count (UI3b playability
 *  #3: the journal is the one place for the totals). */
export function smallTricksLine(traps: number, caught: number): string {
  if (traps === 0) return "Mes petites ruses (accents, lettres, majuscules) n'ont pas encore servi.";
  const rate = caught / traps;
  if (rate < 0.4) return 'Mes petites ruses (accents, lettres, majuscules) passent encore presque toutes. Je note.';
  if (rate < 0.8) return 'Mes petites ruses (accents, lettres, majuscules)\u202f: une sur deux se fait prendre. Je note.';
  return 'Mes petites ruses (accents, lettres, majuscules) se font presque toutes prendre. Je note, vexée.';
}

// The class each lieutenant wakes at (catalog.py `LIEUTENANTS[*].min_level`), static like GENDER.
const WAKES_AT: Record<LieutenantKey, string> = { hydre: '5H', echo: '5H', chimere: '5H', protee: '8H', sirenes: '5H', lethe: '5H' };
const YEARS: Record<number, string> = { 1: 'dans un an', 2: 'dans deux ans', 3: 'dans trois ans' };

/** Why a lieutenant still sleeps and when it wakes (UI3 Ruling B11; UI3b playability #20: in the
 *  story's words, not « une classe plus grande »): the server wakes each one at its `min_level`, so
 *  with the hero's class the dragon says how many years that is. One source for the war tent's
 *  locked sheets, the dossier's sleeping rows and the quest wall's asleep tablets; the server's
 *  409 says the same (world.py `sleeping_line`). */
export function sleepingLine(key: LieutenantKey, level?: string): string {
  const years = level && levelIndex(level) >= 0 ? levelIndex(WAKES_AT[key]) - levelIndex(level) : 0;
  const when = YEARS[years] ?? 'dans quelques années';
  const name = NAMES[key];
  const g = GENDER[key];
  if (g === 'fp') return `${name} dorment encore. Elles se réveilleront ${when}.`;
  return `${name} dort encore. ${g === 'f' ? 'Elle' : 'Il'} se réveillera ${when}.`;
}

/** Whether a lieutenant is awake at the hero's class (the server's `lieutenants_for_level`); an unknown
 *  or empty class reads as awake, so nobody is hidden while the profile loads. */
export function isAwake(key: LieutenantKey, level: string): boolean {
  return levelIndex(level) < 0 || levelIndex(level) >= levelIndex(WAKES_AT[key]);
}

/** The short caption on a locked sheet or tablet. */
export function sleepingCaption(key: LieutenantKey): string {
  return GENDER[key] === 'fp' ? 'Dorment encore' : 'Dort encore';
}

/** What Éris would rather not say about the hero's dragon (the dossier's « Ce qu'elle préfère taire »).
 *  Spec 2026-09-29 dragon growth §2: the rank titles are gone; the dragon's stage says how far the
 *  hero has come. */
export function dragonAside(stage: DragonStage): string {
  if (stage === 'egg') return "Ton dragon dort encore dans sa coquille. Qu'il y reste.";
  return `Ton dragon a grandi\u202f: ${stageLabel(stage).toLowerCase()}. Je fais semblant de ne pas l'avoir vu.`;
}
