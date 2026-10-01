// Le guide du camp (spec 2026-09-29 explanations §3, plan R12): five short sections in the dragon's
// voice, reread from the lyre. Every number comes from what the server serves (`/api/world`: the rules
// file's values, the stages, the stall, the quest bonuses, a seal's XP, the fights' gear), so the guide
// never drifts from data/regles.json; the defaults below only speak until the catalogue has come. Pure.
import { AID_KEYS, AID_LABELS, LEAVE_AFTER, TAKE_AFTER, aidDesc, listFr } from '../aids';
import { PACES, PACE_LABELS } from '../dictation/script';
import { paceBonus, rulesOf } from '../rules';
import { plural, rateText, thousands } from '../text/french';
import { stageLabel, stageXp } from './dragon';
import { romanTier } from './quests';
import { MAX_SEAL, sealName, sealTitle } from './seals';
import { drachmesText } from './shop';
import { DRAGON_STAGES, type DragonStage, type House, type Slot, type WorldCatalog } from './types';

export type GuideBlock = { kind: 'p'; text: string } | { kind: 'list'; items: string[] };
export interface GuideSection {
  id: 'gloire' | 'sceaux' | 'drachmes' | 'aides' | 'eris';
  title: string;
  blocks: GuideBlock[];
}

// The server's defaults (catalog.py QUEST_BONUS, seals.py LEVEL_XP, shop.py prices), until /api/world has come.
const QUEST_BONUS = { board: 60, oracle: 150, weekly: 40, boss: 300 };
const LEVEL_XP = 100;
const SLOT_ORDER: Slot[] = ['cou', 'queue', 'dos', 'tete'];
const SLOT_LEVEL: Record<Slot, number> = { cou: 2, queue: 3, dos: 4, tete: 5 };
const SLOT_PRICE: Record<Slot, number> = { cou: 40, queue: 60, dos: 90, tete: 130 };
const SLOT_WHERE: Record<Slot, string> = { cou: 'le cou', queue: 'la queue', dos: 'le dos', tete: 'la tête' };
const HOUSES = { villa: { stage: 'adult' as DragonStage, price: 300 }, palais: { stage: 'illustre' as DragonStage, price: 800 } };
const WALLS: Record<House, number> = { cabin: 4, villa: 6, palais: 9 };
const DECOR_PRICE = 50;

const WORDS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six'];
const count = (n: number, feminine = false) => (n === 1 && feminine ? 'une' : n < WORDS.length ? WORDS[n] : String(n));
const p = (text: string): GuideBlock => ({ kind: 'p', text });
const list = (items: string[]): GuideBlock => ({ kind: 'list', items });
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const quoted = (s: string) => `\u00ab\u202f${s}\u202f\u00bb`;
/** « adulte », « illustre »: what the dragon is when a house goes on sale. */
const grown = (s: DragonStage) => lowerFirst(stageLabel(s).replace(/^Dragon /, ''));

export function guideSections(catalog: WorldCatalog | null): GuideSection[] {
  const r = rulesOf(catalog);
  const xp = stageXp(catalog);
  const qb = { ...QUEST_BONUS, ...(catalog?.quest_bonus ?? {}) };
  const lx = catalog?.level_xp ?? LEVEL_XP;
  const d = r.drachmes;
  const shop = catalog?.shop ?? null;
  const slotLevel = (s: Slot) => shop?.slot_levels[s] ?? SLOT_LEVEL[s];
  const slotPrice = (s: Slot) => shop?.accessories.find((a) => a.slot === s)?.price ?? SLOT_PRICE[s];
  const house = (k: 'villa' | 'palais') => {
    const h = shop?.houses.find((x) => x.key === k);
    return { stage: h?.stage ?? HOUSES[k].stage, price: h?.price ?? HOUSES[k].price };
  };
  const villa = house('villa');
  const palais = house('palais');
  const walls = shop?.max_decor ?? WALLS;
  const decor = shop?.decor[0]?.price ?? DECOR_PRICE;
  const paces = PACES.map((pace) => ({ pace, bonus: paceBonus(pace, 'dictation', r) })).filter((x) => x.bonus > 0);
  const gear = Object.keys(catalog?.boss_rewards ?? {})
    .sort((a, b) => Number(a) - Number(b))
    .map((tier) => catalog?.rewards[catalog.boss_rewards[tier]]?.name)
    .filter((n): n is string => !!n);

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
        p(`Chaque sceau rapporte de la gloire\u202f: ${lx} XP pour le sceau de bois, ${2 * lx} pour le bronze, et ainsi de suite jusqu'à ${MAX_SEAL * lx} pour l'orichalque. Il pose aussi un trophée sur l'étagère de ta cabane.`),
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
        p("Hermès les échange à son étal, dans le camp. Ce qu'il vend dépend de toi\u202f: chaque sceau d'un lieutenant, à partir du bronze, met en vente une de ses parures."),
        list(SLOT_ORDER.map((s) => `Pour ${SLOT_WHERE[s]}, au ${sealName(slotLevel(s))}\u202f: ${drachmesText(slotPrice(s))}`)),
        p(
          `Le décor coûte ${drachmesText(decor)} la pièce. La villa, ${drachmesText(villa.price)}, est en vente quand je suis ${grown(villa.stage)}\u202f; le palais, ${drachmesText(palais.price)}, quand je suis ${grown(palais.stage)}, après la villa. Plus la maison est grande, plus ses murs portent de décor\u202f: ${walls.cabin} pièces dans la cabane, ${walls.villa} dans la villa, ${walls.palais} dans le palais.`,
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
          `Tu décides toujours. Après ${count(LEAVE_AFTER, true)} ${LEAVE_AFTER < 2 ? 'belle copie' : 'belles copies'} de suite avec les mêmes aides, je te proposerai d'en laisser une au camp\u202f; après ${count(TAKE_AFTER, true)} ${TAKE_AFTER < 2 ? 'copie à reprendre' : 'copies à reprendre'}, d'en reprendre une. Tu peux toujours dire non.`,
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
            const who = f.count === 'all' ? 'tous les lieutenants' : f.count === 1 ? 'un lieutenant' : `${count(f.count)} lieutenants`;
            return `Combat ${romanTier(i + 1)}\u202f: ${who} au ${sealName(f.level)}`;
          }),
        ),
        p(`Pour la faire fuir, ta copie doit garder ${plural(r.fight_max_per_100, 'faute', 'fautes')} au plus pour 100 mots. Sinon, tu pourras revenir l'affronter quand tu voudras.`),
        p(
          [
            `Chaque victoire rapporte ${qb.boss} XP et ${drachmesText(d.boss)}.`,
            gear.length === 1 ? `La première apporte aussi une arme des dieux\u202f: ${gear[0]}.` : '',
            gear.length > 1 ? `Les ${count(gear.length, true)} premières apportent aussi une arme des dieux\u202f: ${listFr(gear)}.` : '',
          ]
            .filter(Boolean)
            .join(' '),
        ),
        p('Un combat gagné le reste pour toujours.'),
      ],
    },
  ];
}
