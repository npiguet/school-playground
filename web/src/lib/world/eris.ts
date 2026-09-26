// Éris's voice: dossier lines templated by lieutenant × band (spec §2, §3.6; plan Decision 19).
// Taunts target only her own tricks, never the player's ability - the FORBIDDEN list and its
// unit test (eris.test.ts) are the guardrail. Pure functions/data only, no DOM/store access, so
// this lane's screens (Dossier, Lieutenant) can stay thin.
import type { LieutenantKey, LieutenantState } from './types';
import { levelIndex } from '../levels';
import { plural } from '../text/french';

export type Band = 'none' | 'strong' | 'contested' | 'weak' | 'neutralised';

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

/** Agrees a past-participle/adjective stem (e.g. "neutralisé") with a lieutenant's gender:
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

/** Bands a lieutenant's dossier line on its all-time catch rate (Decision 19 thresholds), unless
 *  it is permanently neutralised (Decision 3) - that always wins. */
export function bandFor(l: LieutenantState): Band {
  if (l.neutralised) return 'neutralised';
  const { traps, rate } = l.all_time;
  if (traps < 3 || rate === null) return 'none';
  return rate < 0.4 ? 'strong' : rate < 0.8 ? 'contested' : 'weak';
}

const LINES: Record<LieutenantKey, Record<Band, string>> = {
  hydre: {
    none: "Mon Hydre n'a pas encore montré ses têtes dans ces textes. Patience : elles repoussent vite.",
    strong: 'Les têtes de mon Hydre se glissent dans les pluriels et personne ne les remarque. Délicieux.',
    contested: "Une tête coupée sur deux. L'Hydre s'énerve, et moi aussi.",
    weak: 'Mon Hydre ne trouve presque plus de verbe où se cacher. Je vais devoir la nourrir.',
    neutralised: "L'Hydre est neutralisée. Je refuse d'en parler.",
  },
  echo: {
    none: 'Écho attend son heure : a ou à, et ou est… elle répète, et on la croit.',
    strong: 'Écho murmure et ses mots passent pour vrais. Mon meilleur tour.',
    contested: 'Écho se fait démasquer une fois sur deux. Elle boude dans sa grotte.',
    weak: 'Écho n\'ose presque plus répéter. Ses échos s\'éteignent, quelle tristesse.',
    neutralised: "Écho est réduite au silence. Ce n'est pas une grande perte. (Si.)",
  },
  chimere: {
    none: 'Ma Chimère n\'a pas encore rugi ici. Ses têtes se disputent le genre de chaque mot.',
    strong: 'Un masculin ici, un féminin là : ma Chimère brouille tout et personne ne bronche.',
    contested: 'La Chimère perd une tête sur deux. Elle ne sait plus laquelle rugir.',
    weak: 'Ma Chimère se fait attraper presque à chaque fois. Ses trois têtes en rougissent.',
    neutralised: "La Chimère est neutralisée. Bellérophon n'aurait pas fait mieux… oubliez ce que j'ai dit.",
  },
  protee: {
    none: 'Protée dort au fond de la mer. Ses participes changent de forme quand on les regarde.',
    strong: 'Protée change de forme sous les yeux de tout le monde et personne ne le retient. Un artiste.',
    contested: 'On retient Protée une fois sur deux. Il glisse encore, mais moins bien.',
    weak: "Protée n'arrive presque plus à se transformer sans être attrapé. Vexant.",
    neutralised: "Protée est neutralisé. On l'a tenu jusqu'à ce qu'il reprenne sa vraie forme. Je déteste ça.",
  },
  sirenes: {
    none: "Mes Sirènes n'ont pas encore chanté : elles éloignent le sujet de son verbe et attendent.",
    strong: 'Le chant des Sirènes fait oublier le sujet à tout le monde. Mon plus beau tour.',
    contested: 'Une phrase sur deux résiste au chant des Sirènes. Elles chantent plus fort.',
    weak: "Les Sirènes chantent dans le vide. Quelqu'un s'attache au mât, c'est agaçant.",
    neutralised: "Les Sirènes sont neutralisées. Elles n'ont plus de voix, et moi plus de calme.",
  },
  lethe: {
    none: "Léthé attend la fin des textes. C'est là que la vigilance s'endort.",
    strong: 'Dans le dernier tiers, Léthé fait tout oublier. Personne ne relit jusqu\'au bout. Exquis.',
    contested: 'Léthé endort la fin des textes une fois sur deux. Elle trouve ça insuffisant.',
    weak: "Léthé n'endort presque plus personne. La fin des textes est relue. Scandaleux.",
    neutralised: "Léthé est neutralisée. Personne n'oublie plus la fin. Moi, j'aimerais oublier cette page.",
  },
};

export function dossierLine(key: LieutenantKey, band: Band): string {
  return LINES[key][band];
}

export function dossierIntro(name: string, sessions: number): string {
  if (sessions === 0) return `Dossier « ${name} ». Rien à signaler pour l'instant. Ça ne durera pas.`;
  return `Dossier « ${name} ». ${plural(sessions, 'texte surveillé', 'textes surveillés')} de près. Voici où mes ruses passent encore.`;
}

/** Éris on her small tricks (accents, letters, capitals), in words, never a count (UI3b playability
 *  #3: the journal is the one place for the totals). */
export function smallTricksLine(traps: number, caught: number): string {
  if (traps === 0) return "Mes petites ruses (accents, lettres, majuscules) n'ont pas encore servi.";
  const rate = caught / traps;
  if (rate < 0.4) return 'Mes petites ruses (accents, lettres, majuscules) passent encore presque toutes. Je note.';
  if (rate < 0.8) return 'Mes petites ruses (accents, lettres, majuscules) : une sur deux se fait prendre. Je note.';
  return 'Mes petites ruses (accents, lettres, majuscules) se font presque toutes prendre. Je note, vexée.';
}

/** The object pronoun of a lieutenant (« la neutraliser », « le neutraliser », « les neutraliser »). */
export function objectPronounFor(key: LieutenantKey): string {
  const g = GENDER[key];
  return g === 'fp' ? 'les' : g === 'f' ? 'la' : 'le';
}

/** The neutralisation rule as a sentence (UI3b playability #12): the portrait's gauges measure it. */
export function neutraliseRule(key: LieutenantKey): string {
  return `Pour ${objectPronounFor(key)} neutraliser : 3 jours de garde, 10 pièges croisés, et 8 sur 10 déjoués.`;
}

/** What still stands between the hero and a lieutenant, in Éris's words, for its sheet in her file
 *  (UI3b playability #3: one sentence and one gauge, no numbers repeated three ways). Empty once it
 *  is neutralised (the stamp says it). The window is the server's 3-day / 10-trap / 80 % rule. */
export function erisProgressLine(key: LieutenantKey, l: Pick<LieutenantState, 'neutralised' | 'all_time' | 'window'>): string {
  if (l.neutralised) return '';
  if (l.all_time.traps === 0 && l.window.traps === 0) return `Pas encore ${agree('croisé', key)}.`;
  const falls = GENDER[key] === 'fp' ? "qu'elles tombent" : GENDER[key] === 'f' ? "qu'elle tombe" : "qu'il tombe";
  const days = Math.max(0, 3 - l.window.days);
  const traps = Math.max(0, 10 - l.window.traps);
  const parts = [
    days > 0 ? `${plural(days, 'jour', 'jours')} de garde` : null,
    traps > 0 ? `${plural(traps, 'piège', 'pièges')} à croiser` : null,
  ].filter((p): p is string => p !== null);
  if (parts.length > 0) return `Encore ${parts.join(' et ')} avant ${falls}.`;
  return `Il ne te reste qu'à déjouer 8 pièges sur 10 avant ${falls}.`;
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

/** The short caption on a locked sheet or tablet. */
export function sleepingCaption(key: LieutenantKey): string {
  return GENDER[key] === 'fp' ? 'Dorment encore' : 'Dort encore';
}

/** The short caption of a lieutenant that stirs again (a revenge quest waits). */
export function stirringCaption(key: LieutenantKey): string {
  return GENDER[key] === 'fp' ? "S'agitent" : "S'agite";
}

export function campGreeting(hour: number): string {
  return hour < 5 ? 'Bonne nuit au camp.' : hour < 12 ? 'Bonjour au camp.' : hour < 18 ? 'Bel après-midi au camp.' : 'Bonsoir au camp.';
}
