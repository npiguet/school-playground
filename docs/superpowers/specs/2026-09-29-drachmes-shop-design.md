# Sub-project 4: drachmes, Hermès's stall, the house, the dragon's accessories

Date: 2026-09-29. Part of `2026-09-29-progression-roadmap.md`; after sub-projects 1, 3 and 2 (it
reads XP, dragon stages and lieutenant levels). Art from the art track (Phases 2-4). Approved in
advance by the user.

## Goal

Something to choose and save up for: a spendable currency, a merchant in the camp, a house that grows
richer, and a dragon the child dresses. Skill decides what is on sale; the child decides what to buy.

## 1. Drachmes

XP is never spent; drachmes are. Earned (defaults, all in `data/regles.json` `drachmes`):

| Source | Drachmes |
|---|---|
| a session | round(session XP ÷ 10) |
| a board quest / an Oracle quest | 5 / 15 |
| the weekly goal | 5 |
| a lieutenant level L | 10 × L |
| an Éris fight won | 30 |

A ledger table `drachme_event(profile_id, amount, reason, ref, created_at)` like `xp_event`; the
balance is its sum and can never go below zero (a purchase is refused with 409 when short). At
migration every profile receives a starting grant of floor(total XP ÷ 10) (reason `grant`), so
existing play is rewarded. The balance shows on the HUD next to the XP gauge (the drachme coin icon
and the number) and at the stall. The victory's chips add « +N drachmes ».

## 2. L'étal d'Hermès

A new camp hotspot on the stall painted into the camp background (art Phase 3), labelled « L'étal
d'Hermès », opening a place panel with the Hermès cut-out and three shelves:

- **Parures du dragon**: the 24 accessories (list in the art spec), grouped by lieutenant. An item is
  on sale once its lieutenant reaches its level (cou 2, queue 3, dos 4, tête 5); before that it shows
  its silhouette and « Au sceau de bronze de l'Hydre » in words. Protée's set appears from 8H.
- **La maison**: « La villa » (on sale once the dragon is adult) and « Le palais » (once illustre,
  and after the villa).
- **Décor**: four new pieces for the walls (art Phase 3): « Amphore peinte », « Chouette de marbre »,
  « Mosaïque des Muses », « Bouclier d'apparat ».

Prices (defaults, rules file `prices`): accessories 40 / 60 / 90 / 130 for the cou / queue / dos /
tête piece; decor 50 each; the villa 300, the palais 800. Buying asks one confirmation (« Acheter la
couronne de pavots pour 130 drachmes ? »), then Hermès says a line (content file, ≥ 3 variants) and
the item is owned (a `reward` row, kinds `accessory`, `decor`, `house`). Hermès never pushes: no
discount, no timer, no « dernière chance ».

## 3. The house

The cabin place shows the highest owned interior: `cabin` (Cabane), `villa`, `palais` (art Phase 3,
same room plan, so the hotspots keep their roles; each interior has its own hotspot shapes and decor
slots). Decor slots: cabane 4, villa 6, palais 9 (`MAX_DISPLAYED_DECOR` becomes per interior, on the
server and the client). The place's name follows: « Ta cabane », « Ta villa », « Ton palais ».

## 4. Dressing the dragon

- The nest's care panel gains « Parure »: four slots (cou, queue, dos, tête), each with the owned
  pieces for it and « Rien ». One piece per slot; saved on the server (`reward.equipped`, one
  equipped accessory per slot enforced).
- `Dragon.svelte` draws the equipped overlays on top of the tinted dragon, **unfiltered**, from the
  manifest `web/public/art/dragon/accessories.json` (per item and stage: the cropped WebP and its x/y
  offset in the stage picture, as fractions so it scales). Overlays show from `young` on; on the egg
  and the hatchling they are kept but not drawn. Draw order: queue, dos, cou, tête.
- The dragon appears dressed everywhere it appears (camp, nest, victory, dialogue portraits use the
  cut-out without overlays: portraits are small and cropped).

## 5. Data

Migration 007: `drachme_event`; the starting grant. Reward kinds `accessory`, `house`, new decor ids;
the catalogue (`catalog.py`) lists items with slot, lieutenant, level, price.

## 6. Testing

Server: earning per source, the grant, purchases (on sale rules, balance, 409 when short or not on
sale, idempotent re-buy refused), equip rules (one per slot, only owned), house order, per-interior
decor limits. Client: stall shelves and states, confirm, HUD balance, parure panel, overlay rendering
per stage with tints (unit test on the manifest math), cabin interiors. e2e: earn → buy → wear → see
it in the camp; buy the villa; hang a sixth decor piece in the villa. Art test: manifest entries exist
and fit; the raised web budget written as a number. Full gate clean.
