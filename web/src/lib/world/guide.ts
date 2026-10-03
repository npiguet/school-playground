// Le guide du camp (spec 2026-09-29 explanations §3, plan R12): five short sections in the dragon's
// voice, reread from the lyre. Every number comes from what the server serves (`/api/world`: the rules
// file's values, the stages, the stall, the quest bonuses, a seal's XP, the fights' gear), so the guide
// never drifts from data/regles.json. It needs the catalogue: without it, the panel shows no number at
// all rather than a copy that may differ from the served one (SP4 final review M8). Pure.
import { AID_KEYS, AID_LABELS, LEAVE_AFTER, TAKE_AFTER, aidDesc, listFr } from '../aids';
import { PACES, PACE_LABELS } from '../dictation/script';
import { paceBonus, rulesOf } from '../rules';
import { countWord, plural, rateText, thousands } from '../text/french';
import { stageLabel, stageXp } from './dragon';
import { romanTier } from './quests';
import { MATERIALS, MAX_SEAL, sealName, sealTitle } from './seals';
import { drachmesText } from './shop';
import { DRAGON_STAGES, type DragonStage, type Slot, type WorldCatalog } from './types';

export type GuideBlock = { kind: 'p'; text: string } | { kind: 'list'; items: string[] };
export interface GuideSection {
  id: 'gloire' | 'sceaux' | 'drachmes' | 'aides' | 'eris';
  title: string;
  blocks: GuideBlock[];
}

const SLOT_ORDER: Slot[] = ['cou', 'queue', 'dos', 'tete'];
const SLOT_WHERE: Record<Slot, string> = { cou: 'le cou', queue: 'la queue', dos: 'le dos', tete: 'la tête' };

const p = (text: string): GuideBlock => ({ kind: 'p', text });
const list = (items: string[]): GuideBlock => ({ kind: 'list', items });
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const quoted = (s: string) => `\u00ab\u202f${s}\u202f\u00bb`;
/** « adulte », « illustre »: what the dragon is when a house goes on sale. */
const grown = (s: DragonStage) => lowerFirst(stageLabel(s).replace(/^Dragon /, ''));
/** « à partir du bronze », « à partir de l'argent ». */
const fromSeal = (level: number) => {
  const m = MATERIALS[Math.min(MAX_SEAL, Math.max(1, Math.round(level))) - 1];
  return /^[aeiou]/.test(m) ? `à partir de l'${m}` : `à partir du ${m}`;
};
/** « belles copies », with « une belle copie » for one. */
const counted = (n: number, one: string, many: string) => `${countWord(n, true)} ${n < 2 ? one : many}`;

/** The gods' weapons Éris's fights bring (`boss_rewards`, tier → piece), in the ladder's order. When the
 *  tiers are the first ones (1..N) the guide says « les N premières »; otherwise it pairs each piece
 *  with its fight. */
function gearSentence(catalog: WorldCatalog): string {
  const pieces = Object.entries(catalog.boss_rewards ?? {})
    .map(([tier, id]) => ({ tier: Number(tier), name: catalog.rewards[id]?.name }))
    .filter((g): g is { tier: number; name: string } => Number.isInteger(g.tier) && g.tier >= 1 && !!g.name)
    .sort((a, b) => a.tier - b.tier);
  if (pieces.length === 0) return '';
  const first = pieces.every((g, i) => g.tier === i + 1);
  if (first && pieces.length === 1) return `La première apporte aussi une arme des dieux\u202f: ${pieces[0].name}.`;
  if (first) return `Les ${countWord(pieces.length, true)} premières apportent aussi une arme des dieux\u202f: ${listFr(pieces.map((g) => g.name))}.`;
  return `Certaines apportent aussi une arme des dieux\u202f: ${pieces.map((g) => `le combat ${romanTier(g.tier)}, ${g.name}`).join('\u202f; ')}.`;
}

/** The guide's five sections, every number from the served catalogue (none of its own). */
export function guideSections(catalog: WorldCatalog): GuideSection[] {
  const r = rulesOf(catalog);
  const xp = stageXp(catalog);
  const qb = catalog.quest_bonus;
  const lx = catalog.level_xp;
  const d = r.drachmes;
  const shop = catalog.shop;
  const slotLevel = (s: Slot) => shop.slot_levels[s];
  const slotPrice = (s: Slot) => shop.accessories.find((a) => a.slot === s)!.price;
  const house = (k: 'villa' | 'palais') => shop.houses.find((x) => x.key === k)!;
  const villa = house('villa');
  const palais = house('palais');
  const decor = shop.decor[0].price;
  const paces = PACES.map((pace) => ({ pace, bonus: paceBonus(pace, 'dictation', r) })).filter((x) => x.bonus > 0);
  const firstOnSale = Math.min(...SLOT_ORDER.map(slotLevel));

  return [
    {
      id: 'gloire',
      title: 'La gloire et ton dragon',
      blocks: [
        p("Chaque texte défendu te rapporte de la gloire\u202f: un peu pour l'effort, davantage pour une copie soignée, et encore un peu pour chaque piège déjoué en relisant. Ta jauge, en haut de l'écran, la compte en XP."),
        p('La gloire ne se dépense jamais\u202f: elle me fait grandir, et je ne rapetisse jamais. Voici mes étapes\u202f:'),
        list(DRAGON_STAGES.filter((s) => s !== 'egg').map((s) => `${stageLabel(s)}\u202f: ${thousands(xp[s])} XP`)),
        p(`De la gloire en plus\u202f: ${qb.board} XP pour une quête du mur, ${qb.oracle} pour une quête de l'Oracle, ${qb.weekly} pour l'objectif de la semaine.`),
      ],
    },
    {
      id: 'sceaux',
      title: 'Les sceaux',
      blocks: [
        p("Chaque lieutenant d'Éris a cinq sceaux à gagner, un par métal\u202f: bois, bronze, argent, or et orichalque."),
        p("Un sceau se gagne sur plusieurs jours de garde, en défendant des textes où le lieutenant se cache\u202f: il faut assez de jours, assez de pièges croisés, et une bonne part de pièges déjoués dans ta copie finale."),
        list(r.levels.map((n, i) => `${sealTitle(i + 1)}\u202f: ${plural(n.days, 'jour', 'jours')} de garde, ${plural(n.chances, 'piège', 'pièges')}, ${rateText(n.correct)} déjoués`)),
        p('Seuls comptent les jours qui suivent le sceau précédent\u202f: chaque sceau demande de nouveaux textes. Un sceau gagné ne se perd jamais.'),
        p(`Chaque sceau rapporte de la gloire\u202f: ${lx} XP pour le sceau de bois, ${2 * lx} pour le bronze, et ainsi de suite jusqu'à ${MAX_SEAL * lx} pour l'orichalque. Il pose aussi un trophée à sa place dans ta maison.`),
        p('Sous la tente de guerre, trois jauges te montrent où tu en es avec chaque lieutenant.'),
      ],
    },
    {
      id: 'drachmes',
      title: 'Les drachmes',
      blocks: [
        p(`Les drachmes, elles, se dépensent. Chaque texte t'en rapporte une pour ${d.xp_per_drachme} XP gagnés, et d'autres s'y ajoutent\u202f:`),
        list([
          `Une quête du mur\u202f: ${drachmesText(d.board)}`,
          `Une quête de l'Oracle\u202f: ${drachmesText(d.oracle)}`,
          `L'objectif de la semaine\u202f: ${drachmesText(d.weekly)}`,
          `Un sceau\u202f: ${drachmesText(d.level)} pour le bois, jusqu'à ${drachmesText(MAX_SEAL * d.level)} pour l'orichalque`,
          `Un combat gagné contre Éris\u202f: ${drachmesText(d.boss)}`,
        ]),
        p(`Hermès les échange à son étal, dans le camp. Ce qu'il vend dépend de toi\u202f: chaque sceau d'un lieutenant, ${fromSeal(firstOnSale)}, met en vente une de ses parures.`),
        list(SLOT_ORDER.map((s) => `Pour ${SLOT_WHERE[s]}, au ${sealName(slotLevel(s))}\u202f: ${drachmesText(slotPrice(s))}`)),
        p(
          [
            `Le décor coûte ${drachmesText(decor)} la pièce.`,
            `La villa, ${drachmesText(villa.price)}, est en vente quand je suis ${grown(villa.stage)}\u202f;`,
            `le palais, ${drachmesText(palais.price)}, quand je suis ${grown(palais.stage)}, après la villa.`,
            'Chaque maison a une place pour chacun de tes trésors\u202f: plus elle est grande, plus la pièce est belle.',
          ].join(' '),
        ),
        p('Hermès ne presse personne\u202f: ses prix ne bougent pas, et rien ne quitte son étal.'),
      ],
    },
    {
      id: 'aides',
      title: 'Les aides',
      blocks: [
        p('Avant chaque dictée, tu choisis les aides que tu emportes pour relire\u202f:'),
        list(AID_KEYS.map((k) => `${AID_LABELS[k].name}\u202f: ${lowerFirst(aidDesc(k, r))}`)),
        p(
          [
            `Chaque aide laissée au camp ajoute ${rateText(r.aid_bonus)} de gloire.`,
            paces.length ? `Le rythme en ajoute aussi\u202f: ${listFr(paces.map((x) => `${rateText(x.bonus)} au rythme ${quoted(PACE_LABELS[x.pace].title)}`))}.` : '',
            `Un texte prophétisé, défendu avant son jour, ajoute ${rateText(r.prophecy_bonus)}.`,
          ]
            .filter(Boolean)
            .join(' '),
        ),
        p("Ce bonus s'ajoute à la gloire de ta copie et de tes pièges déjoués, pas à celle de l'effort\u202f: il compte surtout quand ta copie est soignée."),
        p(
          [
            'Tu décides toujours.',
            `Après ${counted(LEAVE_AFTER, 'belle copie', 'belles copies')} de suite avec les mêmes aides, je te proposerai d'en laisser une au camp\u202f;`,
            `après ${counted(TAKE_AFTER, 'copie à reprendre', 'copies à reprendre')}, d'en reprendre une.`,
            'Tu peux toujours dire non.',
          ].join(' '),
        ),
      ],
    },
    {
      id: 'eris',
      title: 'Les combats contre Éris',
      blocks: [
        p("Éris revient se battre quand assez de sceaux sont posés sur ses lieutenants. Chaque combat s'ouvre après la victoire du précédent\u202f:"),
        list(
          r.fights.map((f, i) => {
            const who = f.count === 'all' ? 'tous les lieutenants' : f.count === 1 ? 'un lieutenant' : `${countWord(f.count)} lieutenants`;
            return `Combat ${romanTier(i + 1)}\u202f: ${who} au ${sealName(f.level)}`;
          }),
        ),
        p(`Pour la faire fuir, ta copie doit garder ${plural(r.fight_max_per_100, 'faute', 'fautes')} au plus pour 100 mots. Sinon, tu pourras revenir l'affronter quand tu voudras.`),
        p(
          [
            `Chaque victoire rapporte ${qb.boss} XP et ${drachmesText(d.boss)}.`,
            gearSentence(catalog),
          ]
            .filter(Boolean)
            .join(' '),
        ),
        p('Un combat gagné le reste pour toujours.'),
      ],
    },
  ];
}
