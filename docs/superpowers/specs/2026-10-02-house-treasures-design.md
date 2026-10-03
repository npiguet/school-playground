# The house shows its treasures (design)

Date: 2026-10-02. Status: implemented on the house-treasures branch (merging); approved in
conversation (playtest feedback of 2026-10-02).

## Why

Playtest: the rewards the hero sees in her house disappoint. Decor hangs as small round medallions,
trophies and gear only live in the « Tes trésors » dialog, and the villa and the palais are painted as
ruins although the game is set in ancient Greece at its height.

## What she sees

Every reward that belongs in a room has a fixed, dedicated place in every house, painted at full size
in the room's perspective:

- **Trophies (6 places).** One place per lieutenant (chimere, echo, hydre, lethe, protee, sirenes),
  holding the highest seal reached: a new level replaces the picture at the same place. No seal yet:
  the place is empty.
- **Gear (3 places).** Sandales d'Hermès, Égide, Foudre de Zeus, each at its own place, shown when
  owned and on display (the existing Exposer / Ranger toggle).
- **Decor (9 places).** Lanterne d'Hestia, Tapis de Pénélope, Étagère d'Alexandrie, Couronne de
  laurier (was « Trophée de la Pomme »), Fresque des Muses, Amphore peinte, Chouette de marbre,
  Mosaïque des Muses, Bouclier d'apparat, each at its own place, shown when owned and on display.
- **No display limit.** Every house has a place for every piece; the cabane's 4 / villa's 6 /
  palais's 9 limit goes. A bigger house is a grander room, not a bigger shelf.
- An empty place shows the painted empty fixture (niche, shelf, hook, pedestal, floor), nothing
  else: no silhouette, no lock.
- « Tes trésors » (the dialog), « Ton journal » and « La lyre » stay as they are. The pieces in the
  room are not tappable.

## Art

### The rooms

Three new paintings, 2048x1152 (16:9), replacing `assets/art/scenes/{cabin,villa,palais}.png` and
`web/public/art/scenes/{cabin,villa,palais}.webp`:

- **Viewpoint:** a straight-on view of the back wall (one-point perspective, horizon around the
  middle), so one front-facing cut-out per piece fits every house. A closer, less wide shot (a
  normal lens, not a wide angle), so the pieces show large: a far-off shelf made them tiny (user
  playtest of round 1, 2026-10-02).
- **Layout shared by the three rooms** (positions may shift per house, the kinds of fixture do not):
  - the hero of the room: a floor-to-ceiling cupboard of open shelving in the centre, about half
    the frame wide, 3 shelves x 3 open compartments (9 large empty compartments, each about 14-17 %
    of the frame width). The top two shelves hold the 6 trophies, the bottom shelf the 3 gear pieces
    (Égide, Sandales, Foudre);
  - decor fixtures: a hook (lanterne), a clear floor area in front (tapis), a floor corner (amphore),
    an alcove or wall space for the bookcase (étagère), wall panels (fresque, mosaïque, bouclier), a
    perch or pedestal (chouette), a shelf spot (couronne);
  - the three places' objects stay painted in: the « Tes trésors » shelf area, the journal on a desk,
    the lyre.
- **Styles:** the cabane keeps its current rustic look (wood, straw, warm light), redone from the
  front with its fixtures. The villa: a newly built villa in ancient Greek style (or a faithful
  modern replica), pristine: fresh smooth whitewashed plaster, crisp freshly painted frieze and
  columns, brand-new, no worn plaster, chips, patches or stains.
  The palais: marble, gold, mosaic floor, at its prime. No ruin, crack, moss or dilapidation.
- An empty room must look inviting (every hero starts with nothing).
- **Review gate:** 2-3 variants per room are shown to the user before the pieces are painted.
- Method: the krea2 skill (forge-neo). Sources and generation parameters next to the PNGs as today.

### The pieces

- **12 new cut-outs:** 9 decor and 3 gear, painted front-facing, in the game's painted style, at a
  consistent scale relative to each other, cut out with the art-cutout skill
  (`web/public/art/props/` or a new `web/public/art/treasures/`, WebP).
- **Trophies:** the existing `web/public/art/trophies/large/trophy-<lt>-<L>.webp` (512 px), already
  front-facing.
- The Couronne de laurier replaces the painted-apple trophy: a golden laurel wreath (it keeps the id
  `decor:trophee`; name, description and art change).
- A soft contact shadow under each standing piece (CSS, not painted) so none looks pasted on.

## Code

- **Placements:** a table per house, `TREASURE_PLACES: Record<House, Record<PieceId, Place>>`, where
  `Place = { x, y, w }` in art % (x centre, y the bottom edge, w the width), measured on the new
  paintings. It replaces `DECOR_SLOTS`, `BARE_WALLS`, `MAX_DISPLAYED_DECOR` and the medallion
  rendering (`.cabin-decor` with `<Medallion>`).
- **Rendering:** `CabinRoom.svelte` draws each shown piece as a plain image at its place (depth 0, no
  idle, no parallax), under the hotspots and their plaques. The trophy at a lieutenant's place is
  `trophyPath(lt, highest level)` (the existing `highestTrophies`).
- **Server:** `MAX_DECOR` and its check in `routers/world.py` go; displaying decor is never refused for
  lack of room. The shop's `max_decor` field goes from the API (and its client type).
- **Wording:** the houses' catalog descriptions lose « de la place pour six / neuf décors » and say
  what the room is like; `decor:trophee` becomes « Couronne de laurier » with a new description;
  MANUEL.md (« Tes trésors », the houses, the decor list) is updated to match.
- **Tests:** unit: every piece has a place in every house, inside the frame and the safe zone, clear
  of the three hotspots and their plaques, and of every other piece. e2e: a seal reached shows its
  trophy at its place, at full resolution (the large file), and a higher seal replaces it; a decor
  piece put on display appears at its place, « Ranger » removes it; more than the old limit can be
  displayed; screenshots of each house empty and full for review.

## Order

1. The rooms (variants, the user picks).
2. The pieces.
3. The code, the wording, the tests.

## Out of scope

The dragon on the camp scene; accessories; the nest (its own design, by stage).
