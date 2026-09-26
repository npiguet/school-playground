// Every French line of the battle stage (UI4), in one module: the register, plural, guilt, emoji and
// Éris guards read it, and the two B3 lanes consume it without editing the same copy (Ruling C13).
// Static lines (UI3 Ruling A9's precedent); the dialogue content files are UI5 (spec §8). Each
// section is fenced by the task that renders it; a lane edits only its own fence.
import { dossierLine, genderFor, lieutenantName, type Band } from '../world/eris';
import { plural, rateText } from '../text/french';
import type { PlayMode } from '../types';
import type { OpponentId } from './battle';
import type { Outcome } from './hp';

export function opponentName(id: OpponentId): string {
  return id === 'eris' ? 'Éris' : lieutenantName(id);
}

// ===== Stage (Task 2) =====
export const EMPRISE: Record<OpponentId, string> = {
  hydre: "L'emprise de l'Hydre",
  echo: "L'emprise d'Écho",
  chimere: "L'emprise de la Chimère",
  protee: "L'emprise de Protée",
  sirenes: "L'emprise des Sirènes",
  lethe: "L'emprise de Léthé",
  eris: "L'emprise d'Éris",
};
export const STAGE = {
  loading: 'Les Muses préparent le parchemin…',
  loadError: (e: string) => `Impossible de charger ce parchemin : ${e}`,
  counting: 'Les Muses comptent les pièges déjoués…',
  dragonAlt: 'Ton dragon',
} as const;

// ===== Muster (Task 3) =====
export const MUSTER = {
  resume: "Ton brouillon t'attend là où tu l'avais laissé.",
  continue: 'Continuer',
  restart: 'Recommencer',
  words: (n: number) => plural(n, 'mot', 'mots'),
  prophecy: (when: string) => `La Pythie a vu cette dictée pour ${when}.`,
  quest: 'Ce texte compte pour ta quête.',
  boss: "Combat contre Éris : les Yeux d'Argus restent éteints.",
  showSheet: 'Voir la feuille',
  hideSheet: 'Cacher la feuille',
  sheetAlt: (n: number) => `Page ${n} de la feuille`,
  noVoice: 'Cet appareil ne sait pas lire à voix haute. La dictée avancera toute seule, sans voix.',
  paceHeading: 'Choisis ton rythme',
  paceLocked: 'Pas pendant un combat',
  paceGlory: 'Plus le rythme est vif, plus la gloire est grande.',
  start: 'Commencer la dictée',
  grimoire: 'Grimoire corrompu',
  grimoireCaption: 'Éris a déjà recopié ce texte… avec ses dés-accords. Pas de dictée : relis et répare.',
  grimoireRule: "Pas de dictée cette fois : relis le grimoire et répare ce qu'elle a abîmé.",
  openGrimoire: 'Ouvrir le grimoire',
  corrupting: 'Éris corrompt le grimoire…',
  backToShelves: 'Retour aux parchemins',
} as const;
export const ERIS_MUSTER = {
  free: "Un parchemin de plus pour mes dés-accords. Les héros du camp n'y verront que du feu.",
  grimoire: "J'ai recopié ce parchemin à ma façon, en y semant mes dés-accords. Aucun héros du camp ne les retrouvera tous.",
} as const;
/** Éris's line at the muster (Ruling C7): her dossier line for the lieutenant on stage (its band from
 *  the camp), else her own. The boss uses CHALLENGE_LINES. */
export function musterTaunt(o: { opponent: OpponentId; band: Band | null; mode: PlayMode }): string {
  if (o.opponent !== 'eris') return dossierLine(o.opponent, o.band ?? 'none');
  return o.mode === 'grimoire' ? ERIS_MUSTER.grimoire : ERIS_MUSTER.free;
}

// ===== Dictation (Task 4) =====
export const DICTATION = {
  title: 'Dictée',
  quit: 'Quitter',
  quitAsk: 'Ton brouillon est gardé. Veux-tu vraiment quitter la dictée ?',
  quitYes: 'Oui, quitter',
  quitNo: 'Continuer la dictée',
  status: {
    idle: 'Écoute…',
    playing: 'Écoute…',
    waiting: "À toi d'écrire.",
    paused: 'En pause.',
    finished: "C'est fini ! Relis ton texte quand tu veux.",
  },
  replay: 'Réécouter',
  next: 'Suivant',
  pause: 'Pause',
  resume: 'Reprendre',
  finish: "J'ai fini d'écrire",
  placeholder: 'Écris ici ce que tu entends…',
  sentence: (done: number, total: number) => `Phrase ${done} sur ${total}`,
  chunk: (done: number, total: number) => `Groupe ${done} sur ${total}`,
  full: 'Lecture complète',
} as const;

// ===== Proofreading (Task 5) =====
export const PROOF = {
  title: 'Relecture',
  grimoireTitle: 'Grimoire corrompu',
  grimoirePrefix: 'Éris a corrompu ce grimoire.',
  stage1: "Les Yeux d'Argus éclairent une catégorie à la fois.",
  stage2: "Relis une catégorie à la fois, comme Argus te l'a appris.",
  stage4: 'À toi de jouer. Valide quand tout te semble juste.',
  count: (n: number) =>
    n === 0
      ? "Éris n'a rien trouvé à saboter cette fois. Relis une dernière fois, puis valide."
      : n === 1
        ? '1 piège est caché dans ce texte.'
        : `${n} pièges sont cachés dans ce texte.`,
  passes: "Passes d'Argus",
  nextPass: 'Passe suivante',
  bouclier: 'Bouclier de Persée',
  chouette: (left: number) => `Chouette d'Athéna (${left})`,
  fil: "Fil d'Ariane",
  whole: 'Modifier tout le texte',
  wholeLabel: 'Tout le texte',
  filNext: (verb: string) => `Touche un autre verbe pour tendre un nouveau fil${verb ? `, ou touche « ${verb} » pour le corriger` : ''}.`,
  filExit: 'Quitter le fil',
  prevSentence: 'Phrase précédente',
  nextSentence: 'Phrase suivante',
  sentencePos: (k: number, n: number) => `Phrase ${k} sur ${n}, en partant de la fin`,
  owlNone: 'La chouette ne voit plus aucun piège.',
  owlMissing: "Il manque un mot près d'ici.",
  owlHere: 'La chouette a repéré un piège ici.',
  confirmAsk: 'Il reste des passes à faire. Valider quand même ?',
  confirmYes: 'Oui, valider',
  confirmNo: 'Continuer la relecture',
  done: "J'ai terminé ma relecture",
  quit: 'Quitter',
  quitAsk: 'Ta relecture est gardée. Veux-tu vraiment quitter ?',
  quitYes: 'Oui, quitter',
  editorLabel: 'Nouveau mot',
  editorHint: 'Vide = supprimer le mot',
  editorOk: 'OK',
  tokenEdit: (w: string) => `Modifier « ${w} »`,
  tokenFil: (w: string) => `Fil d'Ariane : choisir « ${w} »`,
} as const;

// ===== Victory (Task 6) =====
export function victoryTitle(outcome: Outcome, opponent: OpponentId): string {
  if (outcome === 'rout') return 'Victoire !';
  if (outcome === 'push') {
    const many = opponent !== 'eris' && genderFor(opponent) === 'fp';
    return `${opponentName(opponent)} ${many ? 'reculent' : 'recule'} !`;
  }
  return 'Le combat continue';
}
export const VICTORY = {
  counting: 'Les Muses comptent les pièges déjoués…',
  submitError: (e: string) => `Les Muses n'ont pas pu noter cette partie (${e}).`,
  retry: 'Réessayer',
  sending: 'Envoi en cours…',
  perfect: 'Texte parfait dès la dictée !',
  caught: (c: number, d: number, rate: number | null, mode: PlayMode) =>
    mode === 'grimoire' ? `Dés-accords retrouvés : ${c} sur ${d} (${rateText(rate)})` : `Pièges déjoués : ${c} sur ${d} (${rateText(rate)})`,
  score: (s: number) => `Score : ${s}`,
  words: (ok: number, all: number) => `Mots justes : ${ok} / ${all}`,
  threads: (ok: number, all: number) => `Fils d'Ariane tendus : ${ok} sur ${all}`,
  introduced: (n: number) =>
    `Éris a profité de la relecture pour glisser ${plural(n, 'nouveau piège', 'nouveaux pièges')}. Ça arrive : « Revoir » te les montre.`,
  continue: 'Continuer',
  review: 'Revoir',
  replay: 'Rejouer ce texte',
  camp: 'Retour au camp',
  reviewTitle: 'Revoir le parchemin',
  reviewText: 'Ton texte',
  reviewTried: "Ce qu'Éris a tenté",
  foiled: 'déjoué',
  missingWord: 'Mot oublié',
  expected: (w: string) => `Attendu : « ${w} »`,
  forgotten: (w: string) => `Mot oublié : « ${w} »`,
  neutralised: 'Sa ruse ne te piège plus : trois jours de garde et 8 pièges sur 10 déjoués.',
  bossWon: 'Impossible ! Garde ta pomme, je reviendrai avec de nouvelles ruses.',
  bossLost: "Éris s'enfuit avec la pomme… pour cette fois. Le combat reste ouvert : tu la retrouveras.",
  bossTooEasy:
    "Dictée parfaite : Éris n'a rien pu saboter ! Furieuse, elle va corrompre le parchemin elle-même. Relance le combat pour démasquer ses pièges.",
} as const;
export function dragonTally(o: { draft: number; caught: number; mode: PlayMode }): string {
  if (o.draft === 0) return "Pas un piège dans ta dictée : Éris n'a rien pu glisser !";
  const [one, many] = o.mode === 'grimoire' ? ['dés-accord', 'dés-accords'] : ['piège', 'pièges'];
  const verb = o.mode === 'grimoire' ? 'retrouvé' : 'déjoué';
  if (o.caught === 0) return `Ses ${many} se sont bien cachés cette fois. Viens, on les regarde ensemble dans « Revoir ».`;
  const head = `Tu as ${verb} ${plural(o.caught, one, many)} sur ${o.draft}.`;
  const rate = o.caught / o.draft;
  if (rate >= 0.8) return `${head} Ses lieutenants s'en souviendront !`;
  if (rate >= 0.5) return `${head} Les autres se cachent encore : on les débusquera ensemble.`;
  return `${head} Chaque ${one} ${verb} en fait un de moins pour la prochaine fois.`;
}
export const DRAGON_REVIEW_HINT = 'Touche « Revoir » pour voir chaque piège, mot à mot.';

// ===== Boss (Task 7) =====
export const CHALLENGE_LINES: Record<number, string> = {
  1: 'Deux de mes ruses réduites au silence ? Voyons si mes pièges tiennent quand ils jouent tous ensemble.',
  2: 'Encore toi. Cette fois mes pièges sont mieux cachés, et le texte est long. Très long.',
  3: "Le Grand Désaccord. Toutes mes ruses, un seul texte, et la pomme d'or en jeu. Après ça, je ne reviendrai pas. (Si.)",
};
export const BOSS = {
  tier: (roman: string) => `Combat ${roman}`,
  reward: (xp: number, name: string) => `Récompense si tu gagnes : ${xp} XP · ${name}`,
  rules: "Un long texte · les Yeux d'Argus restent éteints · chaque piège trouvé reste acquis, même si Éris s'enfuit : tu pourras recommencer.",
  start: 'Affronter Éris',
  restart: 'Relancer le combat',
} as const;
