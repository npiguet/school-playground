# Progression redesign: roadmap and agreed decisions

Date: 2026-09-29. Status: agreed with the user in brainstorming; each sub-project gets its own spec,
plan and build. This file records the decisions that later specs must honour.

## Why

A strong speller exhausts the dragon, the relics and all three Éris fights in one to three weeks
(everything hangs on neutralising 5 lieutenants with a 3-day / 10-trap / 80 % catch-rate rule),
then only XP titles and a few weeks of Oracle cosmetics remain. The gates measure how many of
one's own mistakes are fixed while rereading, while school grades only the mistakes left in the
handed-in copy. The game never explains what XP, ruses or rewards are for.

## Order

| # | Sub-project | Spec |
|---|---|---|
| 1 | Scoring, XP and the review aids | `2026-09-29-scoring-xp-design.md` |
| 3 | Dragon growth from XP | to write |
| 2 | Lieutenant levels (replace neutralisation) | to write |
| 4 | Drachmes, Hermès's stall, house upgrades, dragon accessories | to write |
| 5 | Explanations and "what next" | to write |
| art | One continuous art track for all of the above, started first | `2026-09-29-art-design.md` |

3 comes before 2 because neutralisation drives the dragon stages today: the dragon must grow from
XP before neutralisation is removed. The house upgrades live in 4 because they are bought with
drachmes. The art track runs in parallel with the code so the local Forge instance is freed early.

## Decisions for the later sub-projects

**Dragon growth (3).** Six stages: Œuf, Dragonnet, Jeune dragon, Dragon adulte, Dragon illustre
(renowned for its deeds: bigger, armour-like scales), Dragon ancestral (the scholar: silvered horn tips and muzzle, whiskers, an open scroll). The stage
follows total XP on a rising curve that lasts from 5H to 8H and beyond; the XP ranks merge into the
stages. A stage never goes down.

**Lieutenant levels (2).** Five levels per lieutenant, each a material: bois, bronze, argent, or,
orichalque. A level is reached on the per-lieutenant final-text measure (sub-project 1) over a
window that asks more effort and accuracy at each level; all thresholds live in `data/regles.json`.
Neutralisation, the "stirring" state and the +200 XP mastery bonus are removed; a lieutenant already
neutralised becomes level 1 and keeps its relic. Each level gives the lieutenant's trophy in that
level's material (30 trophies, more detailed at each level: wood very simple, orichalcum intricate).
Levels 2 to 5 put one piece of the lieutenant's accessory set on sale (sub-project 4). The Éris
fights recur and unlock on counts across lieutenants, never one named lieutenant ("at least 2 at
level 1", "all at level 1", "at least 2 at level 2", ...), the ladder in `data/regles.json`; a fight
is won on the whole-text measure.

**Drachmes, stall, house, accessories (4).** XP is never spent; drachmes are earned per session and
from quests and spent at l'étal d'Hermès, a stall painted into the camp. Skill decides what is for
sale (a lieutenant's level puts its piece on sale); trophies stay automatic. The house has three
interiors, Cabane, Villa, Palais: two upgrades bought with drachmes, each on sale from a dragon
stage, each interior with more wall space for decor. Accessories: four slots (cou, queue, dos,
tête), worn from the Jeune dragon stage on, one themed set of four per lieutenant (the list is in
the art spec); they are overlays that the dragon's CSS tint does not recolour. Prices are tuned
after real play.

**Explanations (5).** A "what next" line from the dragon at the camp, a first-visit explanation in
each place, a rereadable guide, and "how to earn it" on every item not yet won.
