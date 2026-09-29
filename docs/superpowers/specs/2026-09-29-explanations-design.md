# Sub-project 5: explanations and "what next"

Date: 2026-09-29. Last part of `2026-09-29-progression-roadmap.md`; it explains the system the
other four built. Approved in advance by the user.

## Goal

The child always knows what XP, seals, drachmes and aids are for, what to do next, and how to earn
anything not yet owned, in the camp's voice, without school or admin wording.

## 1. The dragon's "what next" line

At the camp, after its greeting, the dragon says one line about the most useful next goal. Priority,
first match wins:
1. it has hatched and has no name → the existing naming line;
2. an Éris fight is open → « Éris t'attend sur le sentier de la bataille. »;
3. a lieutenant's next seal is within reach (its window at least 70 % complete and its share at target)
   → « Encore un peu et {lieutenant} aura son sceau de {matière}. »;
4. the next dragon stage is under 20 % away → « Encore un peu de gloire et je grandis. »;
5. something on sale is affordable → « Hermès a quelque chose pour toi, et tu as de quoi payer. »;
6. the weekly goal is not reached → « Encore {n} textes cette semaine pour l'objectif. »;
7. otherwise a generic encouragement.
Every line has ≥ 3 variants in `content/dialogue/camp.json` under `camp.next.<case>`; the choice is a
pure function of the camp state (unit-tested); the line never repeats the greeting's content.

## 2. First visits

The UI5 guided tours gain steps for what changed: the muster (the pace, the five aids, leaving them
at the camp for glory, the total), the war tent (seals and their materials, the gauges), the stall
(drachmes, what is on sale and why), the nest's parure, the cabin (the house and its upgrades, the
trophy shelf). A tour already seen by a hero is re-shown once for its new steps only (a per-tour
content version in `settings.tours`). Every tour stays replayable from the lyre.

## 3. Le guide du camp

A rereadable guide in the cabin (a new entry on the lyre's panel, « Le guide du camp »), five short
sections in the dragon's voice: « La gloire et ton dragon » (XP and stages), « Les sceaux » (levels,
materials, trophies), « Les drachmes » (earning, the stall, the house), « Les aides » (the five aids
and their bonus), « Les combats contre Éris » (when they open, how to win). Numbers come from the
rules the server serves, so the guide never drifts from the rules file.

## 4. How to earn it

Everything not yet owned says how to get it, in words: empty trophy plinths (« Premier sceau :
défends des textes où l'Hydre se cache »), locked tints (« Une quête de l'Oracle »), stall items (their
seal), house upgrades (the dragon stage), gear (« Le prochain combat contre Éris »), decor. No item is
hidden; nothing uses a countdown or guilt wording.

## 5. Testing

The priority function (every case, ties), content tests (variants, register, no guilt, no emoji,
typography), the tours' new steps and the "new steps only" re-show, the guide's numbers from the
served rules, the "how to earn" line of every locked item kind; e2e: a camp showing each "what next"
case from seeded state, a tour re-shown for new steps, the guide opened from the lyre. Full gate
clean.
