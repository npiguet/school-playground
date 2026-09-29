# Sub-project 2: lieutenant levels

Date: 2026-09-29. Part of `2026-09-29-progression-roadmap.md`; comes after sub-projects 1 (the
per-lieutenant final-text measure, the rules file) and 3 (the dragon no longer depends on
neutralisation). Art (30 trophies) from the art track, Phase 3. Approved in advance by the user.

## Goal

Replace the one-time neutralisation with five levels per lieutenant that ask more effort and
accuracy each time, pay a trophy in a richer material at each level, and unlock the Éris fights on
counts across lieutenants.

## 1. Levels

Five levels, each a material: 1 bois, 2 bronze, 3 argent, 4 or, 5 orichalque. On screen a level is
always its material: « le sceau de bronze de l'Hydre », « Sceau d'argent » (never « niveau », school
register).

**How a level is reached.** For lieutenant *k* at level *L* (0 = none yet), level *L+1* is judged on
a window built from the per-day stats of *k*'s categories, **only days strictly after the day level L
was reached** (so every level takes new work): take the most recent days with at least one chance,
newest first, until the window holds at least `days` days and `chances` chances; the level is reached
when the window is complete and its correct share (1 − (missed + introduced) ÷ chances) is at least
`correct`. Levels go one at a time; one session can raise a lieutenant by at most one level.

| Level | days | chances | correct |
|---|---|---|---|
| 1 bois | 3 | 12 | 85 % |
| 2 bronze | 4 | 25 | 88 % |
| 3 argent | 6 | 45 | 91 % |
| 4 or | 8 | 70 | 94 % |
| 5 orichalque | 10 | 100 | 97 % |

Defaults; all in `data/regles.json` (`levels`). A level is never lost.

**Rewards per level:** the lieutenant's trophy in that material (reward id `trophy:<k>:<L>`, painted
art from the art track) and `100 × L` XP (reason `level`, chip « Sceau de bronze : l'Hydre +200 »).
Levels 2 to 5 also put one accessory of the lieutenant's set on sale (sub-project 4 reads the
levels; nothing else to store here).

## 2. What goes

Neutralisation (`mastery` table use, `is_neutralised`, `neutralised_set`, the +200 mastery XP, the
relic grant), `MASTERY` in the catalogue, `neutraliseRule`, the « Neutralisé » captions and stamps,
the dossier's `neutralised` band, the camp plaque's neutralised seals. The `mastery` table stays in the
database (no destructive migration) but is no longer written.

## 3. Migration (006)

A table `lieutenant_level(profile_id, lieutenant, level, reached_at, PRIMARY KEY(profile_id,
lieutenant))`. For every `mastery` row: level 1 reached at its `neutralised_at`; its relic reward row
is replaced by `trophy:<k>:1` with the same `granted_at` and `equipped`. Profiles keep all XP.

## 4. Éris fights

The fights recur. The ladder, over the lieutenants **available at the hero's class** (Protée only
from 8H), in `data/regles.json` (`fights`), defaults for each level L = 1..5 in order: « at least 2 at
level L », then « all at level L » (10 fights). A fight opens when its condition holds and every
earlier fight is won; won fights stay won when a class change adds a lieutenant. Winning is sub-
project 1's whole-text rule. Rewards: 300 XP each; the first three keep the Sandales d'Hermès, the
Égide and the Foudre de Zeus; the later ones pay XP only until sub-project 4 adds drachmes. The camp's
battle caption says what opens the next fight in words (« Encore deux sceaux de bois et Éris
t'attend. »), never naming one lieutenant as required.

## 5. Screens

- **War tent sheets and portrait**: the lieutenant's current seal (material emblem: the level-L
  trophy icon, a plain outline before level 1), and three gauges for the next level (days, chances,
  correct share against its target), in words under them (« Encore 2 jours de garde et 13 pièges
  avant le sceau de bronze. »). At level 5: « Sceau d'orichalque. Il ne reste rien à conquérir ici. »
- **Éris's dossier** bands on the level instead of neutralised: her line per lieutenant and level
  group (none / bois-bronze / argent-or / orichalque), in her voice, targeting her own tricks.
- **Camp plaque of the war tent**: the number of seals won across lieutenants.
- **Trophy shelf** (cabin): per lieutenant the highest trophy on display, the lower ones in its
  close view; a lieutenant with no level shows an empty plinth with « Premier sceau : ... » in words.
- **Oracle scrolls and battle opponent**: « not neutralised » becomes « lowest level first ».
- **Bestiary**: a monster's page unlocks at level 1 or a finished quest against it.
- **Victory**: a level-up reveal (the trophy icon, « Sceau de bronze ! »), like today's relic reveal.

## 6. Testing

Server: the window rule (only days after the previous level, one level per session, the thresholds
from the rules file), rewards, migration 006 on a pre-006 copy, the fight ladder (counts across
lieutenants, Protée at 8H, won fights kept). Client: gauges and lines, dossier bands, shelf, victory
reveal, the art test with the trophy icons and the raised web budget (written as a number in the
test). e2e: a level-up through seeded stats, the shelf, the battle caption. Full gate clean.
