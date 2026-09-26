// The journal's words (UI3 Ruling B6): what the Muses do at each help stage, Éris's tricks told by
// the monster that plays them, and the texts defended, said the camp's way (the old Stats said
// « niveau N sur 4 », « Comme en classe », a « Réussite » column and points, school and scoreboard
// register; UI3b playability #1, #2, #14).
import { genderFor, lieutenantName } from './eris';
import { LIEUTENANT_ORDER, type LieutenantKey } from './types';
import { longDate } from '../text/french';

export const HELP_STAGES = [1, 2, 3, 4] as const;

// Playability #2: one sentence in the Muses' voice per stage, never a numbered step (« niveau N sur
// 4 » in another form), and never « seule » (no adjective agreeing with the player).
const LINES: Record<number, string> = {
  1: "Les yeux d'Argus te montrent chaque piège.",
  2: 'Les Muses te disent quelles ruses chercher, mais pas où elles se cachent.',
  3: 'Les Muses te disent seulement combien de pièges se cachent.',
  4: "Tu relis sans l'aide des Muses.",
};

/** How the help changes, under the stage's line. */
export const HELP_RULE = "Plus tu déjoues de pièges, moins les Muses t'aident.";

export function helpStageLine(stage: number): string {
  return LINES[stage] ?? '';
}

/** Who plays each of Éris's tricks, and the rule it bends in plain words (the grammar term is the
 *  small print under the monster, playability #1). A trick no lieutenant owns is one of Éris's own
 *  « petites ruses » (the dossier's word). `lib/explain.ts` keeps its own labels for the corrections. */
const RUSES: Record<string, { owner: LieutenantKey | null; rule: string }> = {
  'agreement:verb': { owner: 'hydre', rule: "l'accord du verbe avec son sujet" },
  'agreement:number': { owner: 'hydre', rule: "l'accord en nombre" },
  'agreement:gender': { owner: 'chimere', rule: "l'accord en genre" },
  'agreement:participle': { owner: 'protee', rule: 'les participes passés' },
  homophone: { owner: 'echo', rule: 'les mots qui sonnent pareil\u202f: a ou à, et ou est' },
  'derived:sirenes': { owner: 'sirenes', rule: 'le sujet éloigné de son verbe' },
  'derived:lethe': { owner: 'lethe', rule: 'la fin du texte, quand on relit moins bien' },
  'agreement:other': { owner: null, rule: 'les autres accords' },
  accent: { owner: null, rule: 'les accents' },
  punctuation_case: { owner: null, rule: 'les majuscules et la ponctuation' },
  lexical: { owner: null, rule: "l'orthographe des mots" },
};

export interface JournalRuse {
  /** The lieutenant's key, or 'eris' for her own small tricks (LieutenantBadge shows her). */
  key: LieutenantKey | 'eris';
  title: string;
  line: string;
  rules: string;
  /** Laurel leaves lit, out of five: the share foiled (playability #1, never a « Réussite » %). */
  leaves: number;
}

/** « tu as déjoué 15 de ses 16 pièges », agreed with the owner (« leurs » for the Sirènes). */
export function ruseLine(caught: number, traps: number, owner: LieutenantKey | null): string {
  const plural = owner !== null && genderFor(owner) === 'fp';
  const one = plural ? 'leur' : 'son';
  const many = plural ? 'leurs' : 'ses';
  if (traps === 1) return caught >= 1 ? `tu as déjoué ${one} piège` : `tu n'as pas encore déjoué ${one} piège`;
  if (caught === 0) return `tu n'as encore déjoué aucun de ${many} ${traps} pièges`;
  if (caught >= traps) return `tu as déjoué ${many} ${traps} pièges`;
  return `tu as déjoué ${caught} de ${many} ${traps} pièges`;
}

/** Éris's tricks one by one in the journal: one entry per monster (its tricks summed), in the camp's
 *  order, then Éris's own small tricks; only what has set a trap so far. */
export function journalRuses(categories: { category: string; errors_in_draft: number; caught: number }[]): JournalRuse[] {
  const byOwner = new Map<LieutenantKey | null, { traps: number; caught: number; rules: string[] }>();
  for (const c of categories) {
    if (c.errors_in_draft <= 0) continue;
    const ruse = RUSES[c.category] ?? { owner: null, rule: c.category };
    const acc = byOwner.get(ruse.owner) ?? { traps: 0, caught: 0, rules: [] };
    acc.traps += c.errors_in_draft;
    acc.caught += Math.min(c.caught, c.errors_in_draft);
    acc.rules.push(ruse.rule);
    byOwner.set(ruse.owner, acc);
  }
  const owners: (LieutenantKey | null)[] = [...LIEUTENANT_ORDER, null];
  return owners.flatMap((owner) => {
    const acc = byOwner.get(owner);
    if (!acc) return [];
    return [
      {
        key: owner ?? 'eris',
        title: owner ? lieutenantName(owner) : 'Ses petites ruses',
        line: ruseLine(acc.caught, acc.traps, owner),
        rules: acc.rules.join(', '),
        leaves: Math.round((acc.caught / acc.traps) * 5),
      },
    ];
  });
}

/** The day a defence was finished, on the hero's own clock (the server stores UTC: a text finished
 *  at 00:30 at home belongs to that day, not to the one before), as YYYY-MM-DD. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export interface DefenceGroup {
  key: string;
  title: string;
  grimoire: boolean;
  line: string;
}

/** The last defences, one entry per text (playability #14: six dated rows of the same title read as
 *  an activity log): « 6 défenses, la dernière le mercredi 5 août ». Counted as defences, so no
 *  participle has to agree with a title it can't know the gender of. The grimoire's rounds of a text
 *  are their own entry, stamped. Newest first, as the server sends them. */
export function defenceGroups(
  sessions: { text_id: number; title: string; finished_at: string; mode: string }[],
  today: Date = new Date(),
): DefenceGroup[] {
  const groups = new Map<string, { title: string; grimoire: boolean; count: number; last: string }>();
  for (const s of sessions) {
    const grimoire = s.mode === 'grimoire';
    const key = `${s.text_id}-${grimoire ? 'g' : 'd'}`;
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { title: s.title, grimoire, count: 1, last: longDate(localDay(s.finished_at), today) });
  }
  return [...groups].map(([key, g]) => ({
    key,
    title: g.title,
    grimoire: g.grimoire,
    line: g.count === 1 ? `une défense, le ${g.last}` : `${g.count} défenses, la dernière le ${g.last}`,
  }));
}
