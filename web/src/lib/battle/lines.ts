// Every French line of the battle stage (UI4), in one module: the register, plural, guilt, emoji and
// Éris guards read it, and the two B3 lanes consume it without editing the same copy (Ruling C13).
// UI copy (UI5 Ruling E11): the characters' event lines (Éris at the muster and after the reckoning,
// the dragon's explanation intros) live in content/dialogue since UI5 (spec §8). Each section is
// fenced by the task that renders it; a lane edits only its own fence.
import { genderFor, lieutenantName } from '../world/eris';
import { plural } from '../text/french';
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
  loadError: (e: string) => `Impossible de charger ce parchemin\u202f: ${e}`,
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
  boss: "Combat contre Éris\u202f: les Yeux d'Argus restent éteints.",
  showSheet: 'Voir la feuille',
  hideSheet: 'Cacher la feuille',
  sheetAlt: (n: number) => `Page ${n} de la feuille`,
  paceHeading: 'Choisis ton rythme',
  paceLocked: 'Pas pendant un combat',
  paceGlory: 'Plus le rythme est vif, plus la gloire est grande.',
  start: 'Commencer la dictée',
  grimoire: 'Grimoire corrompu',
  grimoireCaption: 'Éris a déjà recopié ce texte… avec ses dés-accords. Pas de dictée\u202f: relis et répare.',
  grimoireRule: "Pas de dictée cette fois\u202f: relis le grimoire et répare ce qu'elle a abîmé.",
  openGrimoire: 'Ouvrir le grimoire',
  corrupting: 'Éris corrompt le grimoire…',
  backToShelves: 'Retour aux parchemins',
  // UI5 Ruling E7: a muted voice keeps the dictation's pace but reads nothing aloud.
  voiceMuted: 'La voix de la dictée est en sourdine.',
  voiceBack: 'Rendre la voix',
} as const;

// ===== Dictation (Task 4) =====
export const DICTATION = {
  /** UI4 playability #11: the heading is the text's title; the phase, in the fiction, under it. */
  cue: 'Écris ce que dit la voix.',
  quit: 'Quitter',
  quitAsk: 'Ton brouillon est gardé. Veux-tu vraiment quitter la dictée\u202f?',
  quitYes: 'Oui, quitter',
  quitNo: 'Continuer la dictée',
  status: {
    idle: 'Écoute…',
    playing: 'Écoute…',
    waiting: "À toi d'écrire.",
    paused: 'En pause.',
    silenced: "La voix s'est tue.",
    finished: "C'est fini\u202f! Relis ton texte quand tu veux.",
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

// ===== The voice (Kokoro plan, Task 8) =====
/** Éris's card when the voice cannot be heard (spec 2026-09-27 §5.3). Her gloat is the content key
 *  `battle.voice.lost`; the waiting line is `battle.voice.wait` (Ruling K5). The cause is for the parent. */
export const VOICE_LOST = {
  askParent: 'Appelle un parent\u202f: lui seul peut rompre ce sortilège.',
  retry: 'Réessayer',
  toCamp: 'Retour au camp',
  cause: {
    unreachable: 'voix\u202f: serveur injoignable',
    server: 'voix\u202f: erreur du serveur',
  },
} as const;

// ===== Proofreading (Task 5) =====
export const PROOF = {
  /** Screen readers' name of the parchment's section; the heading is the text's own title. */
  title: 'Relecture',
  grimoirePrefix: 'Éris a corrompu ce grimoire.',
  /** UI4 playability #11: the phase, in the fiction, before the help stage's sentence. */
  cue: "Traque les pièges d'Éris.",
  stage1: "Les Yeux d'Argus éclairent une catégorie à la fois.",
  stage2: "Relis une catégorie à la fois, comme Argus te l'a appris.",
  stage4: 'À toi de jouer. Quand tout te semble juste, dis-le.',
  count: (n: number) =>
    n === 0
      ? "Éris n'a rien trouvé à saboter cette fois. Relis une dernière fois, puis valide."
      : n === 1
        ? '1 piège est caché dans ce texte.'
        : `${n} pièges sont cachés dans ce texte.`,
  passes: "Passes d'Argus",
  nextPass: 'Passe suivante',
  bouclier: 'Bouclier de Persée',
  // UI4 playability #19: the count rides on the emblem's coin in both layouts, never in brackets.
  chouette: "Chouette d'Athéna",
  chouetteLeft: (left: number) => plural(left, 'indice', 'indices'),
  fil: "Fil d'Ariane",
  whole: 'Modifier tout le texte',
  wholeLabel: 'Tout le texte',
  filNext: (verb: string) => `Touche un autre verbe pour tendre un nouveau fil${verb ? `, ou touche «\u202f${verb}\u202f» pour le corriger` : ''}.`,
  filExit: 'Quitter le fil',
  // UI4 playability #6: the directions as they are on the page, the position in text order.
  prevSentence: 'Plus haut',
  nextSentence: 'Plus bas',
  sentencePos: (k: number, n: number) => `Phrase ${k} sur ${n}`,
  bouclierNote: 'Le Bouclier de Persée te fait lire à rebours, de la dernière phrase à la première.',
  owlNone: 'La chouette ne voit plus aucun piège.',
  owlMissing: "Il manque un mot près d'ici.",
  owlHere: 'La chouette a repéré un piège ici.',
  confirmAsk: 'Il reste des passes à faire. Valider quand même\u202f?',
  confirmYes: 'Oui, valider',
  confirmNo: 'Continuer la relecture',
  done: "J'ai terminé ma relecture",
  quit: 'Quitter',
  quitAsk: 'Ta relecture est gardée. Veux-tu vraiment quitter\u202f?',
  quitYes: 'Oui, quitter',
  editorLabel: 'Nouveau mot',
  editorHint: 'Efface tout pour retirer le mot',
  editorOk: 'OK',
  tokenEdit: (w: string) => `Modifier «\u202f${w}\u202f»`,
  tokenFil: (w: string) => `Fil d'Ariane\u202f: choisir «\u202f${w}\u202f»`,
  // Lane P fix round 1: the compact bar's short stage-3 count, and its tools' hover titles.
  countShort: (n: number) => plural(n, 'piège', 'pièges'),
  prevPass: 'Passe précédente',
} as const;

// ===== Victory (Task 6) =====
export function victoryTitle(outcome: Outcome, opponent: OpponentId): string {
  if (outcome === 'rout') return 'Victoire\u202f!';
  if (outcome === 'push') {
    const many = opponent !== 'eris' && genderFor(opponent) === 'fp';
    return `${opponentName(opponent)} ${many ? 'reculent' : 'recule'}\u202f!`;
  }
  return 'Le combat continue';
}
export const VICTORY = {
  counting: 'Les Muses comptent les pièges déjoués…',
  submitError: (e: string) => `Les Muses n'ont pas pu noter cette partie (${e}).`,
  retry: 'Réessayer',
  sending: 'Envoi en cours…',
  perfect: 'Texte parfait dès la dictée\u202f!',
  // UI4 playability #1: the tally in the game's words, never a marked test. No percentage here (the
  // « Revoir » scroll and the journal keep the rate), and no « 0 sur n »: her traps hid this time.
  caught: (c: number, d: number, mode: PlayMode) =>
    c === 0
      ? `${mode === 'grimoire' ? 'Ses dés-accords' : 'Ses pièges'} se sont bien cachés cette fois`
      : `${mode === 'grimoire' ? 'Dés-accords retrouvés' : 'Pièges déjoués'}\u202f: ${c} sur ${d}`,
  /** The score is the glory the muster promised (« Plus le rythme est vif, plus la gloire est grande »). */
  score: (s: number) => `Gloire gagnée\u202f: ${s}`,
  words: (ok: number, all: number) =>
    ok === all
      ? 'Pas un mot de travers\u202f!'
      : ok === 0
        ? 'Aucun mot ne tient encore\u202f: on reprend ensemble'
        : `${plural(ok, 'mot', 'mots')} sur ${all} ${ok === 1 ? 'tient' : 'tiennent'} bon`,
  threads: (ok: number, all: number) => `Fils d'Ariane tendus\u202f: ${ok} sur ${all}`,
  /** UI4 playability #2: the headline is everything she earned; the tags below break it down. */
  xpGain: (xp: number) => `+${xp} XP`,
  // Under the branch after a rank-up; the ribbon below already says « Nouveau rang : … ».
  rankFresh: 'Les feuilles repoussent',
  treasure: (name: string) => `Nouveau trésor\u202f: ${name}`,
  /** The boss's reward (#4). No article: the treasures' names take le, la, l' or les. */
  bossReward: (name: string) => `Ta récompense\u202f: ${name}\u202f!`,
  nameAsk: "Comment vas-tu l'appeler\u202f?",
  namePlaceholder: 'Son nom…',
  nameSave: "C'est son nom",
  // UI4 playability #16: the dragon speaks for itself, and the way home says what it does.
  nudgeDragon: "(Il bâille.) Vingt-cinq minutes qu'on chasse les pièges… On souffle un peu\u202f?",
  nudgeEgg: "(L'œuf frémit.) Vingt-cinq minutes qu'on chasse les pièges… On souffle un peu\u202f?",
  nudgeHome: 'On rentre souffler',
  nudgeMore: 'Encore un texte',
  /** UI5 (Ruling E14): Éris's own aside after her victory line, for the traps she slipped in. She is a
   *  goddess: « Sournoise » (UI5 playability #3; copyRules' erisSelfMasculine checks every Éris line). */
  erisIntroduced: (n: number) => `(Et j'en ai glissé ${n} pendant ta relecture. Sournoise, je sais.)`,
  introduced: (n: number) =>
    `Éris a profité de la relecture pour glisser ${plural(n, 'nouveau piège', 'nouveaux pièges')}. Ça arrive\u202f: «\u202fRevoir\u202f» te les montre.`,
  continue: 'Continuer',
  review: 'Revoir',
  replay: 'Rejouer ce texte',
  camp: 'Retour au camp',
  reviewTitle: 'Revoir le parchemin',
  reviewText: 'Ton texte',
  reviewTried: "Ce qu'Éris a tenté",
  foiled: 'déjoué',
  missingWord: 'Mot oublié',
  dragonName: 'Nom du dragon',
  tokTrap: (w: string) => `${w}\u202f: piège, touche pour voir`,
  tokFoiled: (w: string) => `${w}\u202f: déjoué, touche pour voir`,
  expected: (w: string) => `Il fallait\u202f: «\u202f${w}\u202f»`,
  forgotten: (w: string) => `Mot oublié\u202f: «\u202f${w}\u202f»`,
  neutralised: 'Sa ruse ne te piège plus\u202f: trois jours de garde et 8 pièges sur 10 déjoués.',
  bossWon: 'Impossible\u202f! Garde ta pomme, je reviendrai avec de nouvelles ruses.',
  // UI4 playability #10: her exit, in her own voice on her plate (it was a narrator's note).
  bossLost: "Ha\u202f! Je garde ma pomme… pour cette fois. Le combat reste ouvert\u202f: reviens m'affronter quand tu veux.",
  bossTooEasy:
    "Dictée parfaite\u202f: Éris n'a rien pu saboter\u202f! Furieuse, elle va corrompre le parchemin elle-même. Relance le combat pour démasquer ses pièges.",
} as const;
export function dragonTally(o: { draft: number; caught: number; mode: PlayMode }): string {
  if (o.draft === 0) return "Pas un piège dans ta dictée\u202f: Éris n'a rien pu glisser\u202f!";
  const [one, many] = o.mode === 'grimoire' ? ['dés-accord', 'dés-accords'] : ['piège', 'pièges'];
  const verb = o.mode === 'grimoire' ? 'retrouvé' : 'déjoué';
  if (o.caught === 0) return `Ses ${many} se sont bien cachés cette fois. Viens, on les regarde ensemble dans «\u202fRevoir\u202f».`;
  const head = `Tu as ${verb} ${plural(o.caught, one, many)} sur ${o.draft}.`;
  const rate = o.caught / o.draft;
  if (rate >= 0.8) return `${head} Ses lieutenants s'en souviendront\u202f!`;
  // UI4 playability #7: one left is « le dernier » (piège and dés-accord are both masculine).
  const rest =
    o.draft - o.caught === 1
      ? 'Le dernier se cache encore\u202f: on le débusquera ensemble.'
      : 'Les autres se cachent encore\u202f: on les débusquera ensemble.';
  if (rate >= 0.5) return `${head} ${rest}`;
  return `${head} Chaque ${one} ${verb} en fait un de moins pour la prochaine fois.`;
}
export const DRAGON_REVIEW_HINT = 'Touche «\u202fRevoir\u202f» pour voir chaque piège, mot à mot.';

// ===== Boss (Task 7) =====
export const CHALLENGE_LINES: Record<number, string> = {
  1: 'Deux de mes ruses réduites au silence\u202f? Voyons si mes pièges tiennent quand ils jouent tous ensemble.',
  2: 'Encore toi. Cette fois mes pièges sont mieux cachés, et le texte est long. Très long.',
  3: "Le Grand Désaccord. Toutes mes ruses, un seul texte, et la pomme d'or en jeu. Après ça, je ne reviendrai pas. (Si.)",
};
export const BOSS = {
  tier: (roman: string) => `Combat ${roman}`,
  reward: (xp: number, name: string) => `Récompense si tu gagnes\u202f: ${xp} XP · ${name}`,
  rules: "Un long texte, sans les Yeux d'Argus. Chaque piège que tu trouves reste acquis\u202f: si Éris s'enfuit, tu pourras revenir l'affronter.",
  start: 'Affronter Éris',
  restart: 'Relancer le combat',
} as const;
