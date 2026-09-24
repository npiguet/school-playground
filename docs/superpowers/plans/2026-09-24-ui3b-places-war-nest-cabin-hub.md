# La Discorde — UI3b "Places II: war tent, nest, cabin, the real hub" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish UI3: the war tent (lieutenants' portraits, Éris's file, the bestiary codex), the dragon's nest and the cabin (trophies, journal, lamp and lyre, the hero panel) become painted places with routed overlays and full feature parity, the camp moves onto `hub_camp.webp` with its six places, the legacy top nav retires from every place, and an iPad review walk plus the full gate close the milestone.

**Architecture:** Same engine and conventions as UI3a (`2026-09-24-ui3a-places-title-library-delphi.md`, which must be complete first): `placeFor(route)` maps each legacy route to "its place + its overlay", legacy screens move with `git mv` into `web/src/components/places/<place>/*Panel.svelte`, each place is a `PlaceScene` with hand-authored `*.shapes.ts` checked by `?debug`. This plan adds the `war-tent` route, three scene screens (`WarTent`, `Nest`, `CabinRoom`), rewrites the camp's scene data for the new art, and finishes the UI3 walk begun in UI3a.

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite 7, vitest 3 (node env), Playwright 1.55.0 (WebKit `desktop` 1280×720, `ipad` 1180×820 touch), Docker Desktop + Git Bash wrapper scripts. No new npm dependency, no server change.

**Spec:** `docs/superpowers/specs/2026-09-24-scenes-ui-design.md` — binding (§2, §3, §4, §6, §9 UI3, §10). The UI3a plan's Global Constraints and Rulings A1–A18 hold here unchanged and are not repeated in full; the Rulings below (B-series) extend them. Repo-root `CLAUDE.md` is binding (no "pre-existing" problems, zero svelte-check warnings, no emoji — `web/src/noEmoji.test.ts` enforces it).

## Global Constraints

- **Scope (spec §9.3):** "UI3 Places: Title, Library, Delphi, War tent, Dragon's nest, Cabin scenes + overlays with full feature parity." UI3b covers the war tent, the nest, the cabin and the hub remap. Out of UI3: audio + dialogue content files (UI5; static `DialogueBox` lines are fine), the battle stage (UI4: Play, Boss, Grimoire, Results, ProgressionReveal keep their layout and the legacy `TopBar`).
- **Mechanics unchanged (spec §1):** "Mechanics, pedagogy, API, server: unchanged." UI3b changes no server file.
- **Feature parity (spec §3):** "Any existing functionality on a screen must remain reachable in its new home (feature parity is a review gate)." The Parity map below is the checklist.
- **Language:** UI and game text in French (use every French string of this plan verbatim); code, comments, docs, commit messages in English.
- **Routing (spec §2.3):** "the in-house hash router and all current route names/paths stay; every scene and overlay has a route, so Back, reload and deep links keep working. New routes may be added (e.g. a title scene) but none removed without a ruling."
- **Forms (spec §2.4):** "Form elements stay real HTML (inputs, textareas, selects) [...] restyled as semi-transparent parchment / bronze / marble." Every overlay body is `.kit-form` (UI3a Ruling A8).
- **Stage (spec §4, UI1 Ruling 3):** art 16:9 `object-fit: cover`; every interactive element inside the 4:3 safe zone (art x 12.5–87.5 %); hotspots at y ≥ 14 %; no hotspot on the dialogue dock (x 27–87.5 %, y 80–100 %). Hotspot shapes are hand-authored from `docs/art/scenes.md` (±2 %) and checked with `?debug`.
- **Motion (spec §4):** "honour `prefers-reduced-motion` (no parallax, no bob, fades only)"; parallax ≤ 3 depth layers, pointer and device tilt (UI3a Task 7).
- **Performance (spec §4):** "≤ 600 KB WebP per scene background; preload likely next scenes" (`budget.test.ts`, extended through `SCENES`).
- **Ethics:** no red (e2e `redScan`); orange is Éris's; nothing lost, no guilt wording (`manqué|raté|perdu`); every reward and every lock says in advance how to get past it.
- **No emoji (CLAUDE.md):** painted icons (`ART.icons.*`), the shared `Icon` SVGs or words; the guard test must stay green.
- **Accessibility:** touch targets ≥ 48 px; every hotspot a real focusable `<button>` with a visible label; `alt` on every image; overlays are `aria-modal` with the scene `inert`.
- **Toolchain:** every command through `scripts/*.sh` from the repo root in Git Bash (`scripts/npm.sh run test -- <file>`, `scripts/npm.sh run check`, `scripts/playwright.sh <filter> [--project=<name>]`, `scripts/playwright.sh --config playwright.playability.config.ts playability-ui3`, `scripts/check.sh`). vitest runs in the `node` environment (logic in `.ts`, components via svelte-check + Playwright).
- **Legacy CSS:** new code never uses the class names `scene` or `screen` (the global `.scene` stays for Boss until UI4).
- **Commits:** branch `scenes`; **always** `git add <paths> && git commit -m "..." -- <paths>` (a `git mv`/`git rm` names both paths); never `git add -A`, `git stash`, `git reset`, `git checkout`, `git clean`. End every message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` (or your harness's trailer).
- **Verification:** run each task's commands and paste the real output in your report; any failing or flaky test is yours to fix or to report as an open item.

## Rulings taken by this plan (the spec is silent; do not re-ask)

- **B1 Places and routes (extends A1).**

  | Route (name → path) | Place | Overlay (`PanelId`) |
  |---|---|---|
  | **new** `war-tent` → `#/p/:id/tente-de-guerre` | war | none |
  | `dossier` → `#/p/:id/dossier` | war | `dossier` (map table: Éris's file) |
  | `bestiaire` → `#/p/:id/bestiaire` | war | `codex` (bestiary codex) |
  | `bestiaire-entry` → `#/p/:id/bestiaire/:key` | war | `page` (a codex page) |
  | `lieutenant` → `#/p/:id/monstres/:key` | war | `portrait` (a lieutenant's sheet) |
  | `dragon` → `#/p/:id/dragon` (+ `?panel=soin`) | nest | none (`soin`: name and tint) |
  | `cabin` → `#/p/:id/cabane` (+ `?panel=tresors` / `?panel=heros`) | cabin | none (`tresors`: rewards; `heros`: the hero panel) |
  | `stats` → `#/p/:id/stats` | cabin | `journal` |
  | `settings` → `#/p/:id/settings` | cabin | `lyre` |

  `camp?panel=heros` stays as a route: once the hero is onboarded, the camp replaces it with `cabane?panel=heros` (B2). After UI3b only `play`, `grimoire` and `boss` return `null` from `placeFor`.
- **B2 The hero panel lives in the cabin (carry #4).** Overlay `heros` on the cabin (same test ids `overlay-heros`, `hero-settings`, `hero-journal`, `hero-switch`); the HUD's hero chip on every place is its shortcut (`heroPanelHref` → `#/p/:id/cabane?panel=heros`, opened with `openPanel`, so its seal steps back to wherever the chip was tapped). Medallions: « Réglages » → the lyre overlay, « Ton journal » → the journal overlay (stats; it pointed at the dossier before, and the dossier now has its own place, the war tent's map table), « Changer de héros » → the title.
- **B3 The hub on `hub_camp.webp` (carry #17, rec. 1–8).** Six places, ids kept from UI1 Ruling 4: `dragon` (nest → `dragon`), `oracle` (the path to Delphi → `delphi`), `parchemins` (library tent → `library-tent`), `dossier` (war tent → `war-tent`), `cabin` (→ `cabin`), `boss` (path to battle → `boss`). `quests` and `bestiary` leave the hub (their homes are the Delphi tablets and the war tent's codex); their information moves onto plaques: the oracle plaque carries the active-quest badge, the war-tent plaque the foiled-tricks badge. Every plaque is pinned by a leader line. Captions only for news (`campNews`, at most three, in the order battle, oracle, parchemins, dragon, war tent). Exactly one "next step" glow (`nextStepPlace`, the same priority as the greeting's last line). The path to battle is always visible and **locked** (lock icon, greyed glow) until Éris can be fought; a tap on it makes the dragon say how many tricks remain. The weekly banner sits in the open sky (art x 40–65, y 14.5–18.5). The dragon cut-out sits in the painted nest (x 17, feet at y 55) and its dialogue portrait is the same cut-out. The prophecy card leaves the hub (UI3a put it on Delphi's altar); the oracle plaque's caption announces it.
- **B4 War tent portraits.** Each lieutenant is a hotspot on its blank parchment sheet, its painted cut-out in the sheet, its name inked on the sheet (`labelPos: 'on'`). A lieutenant still asleep at the hero's level is **locked**: the dragon says « X dort encore à ce niveau. Ses ruses viendront plus tard. ». Stirring (`stirring`) glows; neutralised shows « Neutralisé(e) ». The map table opens the dossier (`table` overlay), the lectern the codex (`codex` overlay).
- **B5 The nest.** The stage chip (`dragon-stage`), the growth gauge and what the dragon is up to sit in the scene on a parchment; naming and tints are the `soin` overlay. The dragon greets once per page load with its stage line.
- **B6 The cabin.** Displayed decor hangs on the walls as reward medallions (it hung over the camp-fire banner before, carry #12's "the Cabin banner shows the camp fire"). The trophy shelf opens `tresors`, the journal `journal` (stats), the lamp and lyre `lyre` (settings; the single mute stays, A17).
- **B7 The top nav retires from the places (carry rec. 8).** After UI3b, `TopBar` is used only by Play and Boss (UI4 restages them). Loading/error states of the profile gate in `App.svelte` become banners on the night backdrop instead of legacy `.screen` pages.
- **B8 The walk.** UI3a's `playability-ui3.spec.ts` gains sections (hub, war tent, nest, cabin) and `?debug` shots; the whole walk reruns, so every `docs/reviews/ui3/` screenshot reflects the finished milestone, including the two locked-place steps (carry #16/M9).

## Parity map (UI3b screens)

| Screen | Features, links, forms, states | New home |
|---|---|---|
| Dossier | Éris's smug portrait + intro bubble (« Éris feuillette son dossier… »); « Ses points faibles »: one row per lieutenant (sleeping row « X dort encore à ce niveau. », open row: icon, name, « Neutralisé(e) » chip, Éris's line `dossier-line-*`, « Pièges tendus / déjoués / taux », 3-day gauge) → lieutenant page; camp loading/error; `dossier-small-tricks` (small tricks line, « Mots qu'elle vise » chips, link « Voir les chiffres bruts » → stats); « Ce qu'elle préfère taire » (best rate, total caught, rank); stats error | War tent map table → `dossier` overlay « Le dossier d'Éris » (table variant, wide), rows open the `portrait` overlay (Task 3) |
| Bestiaire | subtitle; grid of entries (art, name, teaser, status chip « À découvrir » / « En cours » / « Neutralisé(e) », locked myth chip `bestiary-locked`) → entry | War tent lectern → `codex` overlay « Bestiaire » (codex variant) (Task 3) |
| BestiaireEntry | art, « Le mythe » (facts or teaser + « Mythe à débloquer… »), « Sources », « Au camp » fiction block, « Voir la ruse et la quête » → lieutenant; unknown entry text | `page` overlay (codex variant, title = entry name) (Task 3) |
| Lieutenant | portrait on a battle backdrop, technique, Éris's line, neutralised banner + relic medallion + date, « … s'agite à nouveau » line, gauges (days, traps, rate with 80 % marker), « Lancer une quête » / « Quête en cours », toast « Quête affichée au tableau. », reward line, « Ouvrir son grimoire corrompu », « Textes conseillés » list → play; unknown key; loading/error | War tent portrait sheets → `portrait` overlay (title = the lieutenant's name) (Task 2) |
| DragonScreen | dragon art at its stage and tint; stage chip `dragon-stage` + growth gauge; « Nom » (egg: « Tu lui donneras un nom quand il éclora. »; input + « Garder ce nom », errors, toast); « Teinte »: six swatches, locked ones with the painted lock and « À gagner : quête de l'Oracle », optimistic change; loading/error | Nest scene: the dragon cut-out (tinted), the growth parchment (stage, gauge, activity) in the scene; `soin` overlay for name and tints (Task 4) |
| Cabin | banner with displayed decor; « Ta cabane » title; empty line « Ta cabane attend ses premiers trésors… »; four sections (Reliques, Armes et armures divines, Objets de la cabane, Teintes) of reward cards (painted medallion or tinted egg, name, desc, « Comment l'obtenir : … », « Exposer » / « Ranger »); load/equip errors | Cabin scene: displayed decor on the walls; trophy shelf → `tresors` overlay « Tes trésors » with every section (Task 5) |
| Stats | subtitle; « Aide des Muses : niveau N sur 4 » + description; « Par catégorie » table; « Mots-pièges » chips with box; « Dernières parties » (title, date, score, rate, « Grimoire » chip); « Totaux »; loading/error; empty lines | Journal on the desk → `journal` overlay « Ton journal » (Task 6) |
| Settings | « Voix de la dictée » (select, « Écouter un essai », no-voice help in words), « Niveau », « Son » mute checkbox, « Objectif de la semaine » select 2–5, « Code » (new code, « Retirer le code »), error, toast « C'est noté. », « Enregistrer » | Lamp and lyre → `lyre` overlay « Réglages » (Task 6) |
| Camp (UI1 hub) | eight places; weekly ribbon; prophecy card + « Réviser »; greeting; HUD; hero panel `?panel=heros`; onboarding; exit veil | Six places on `hub_camp.webp` (B3); ribbon in the sky; prophecy on Delphi's altar (UI3a Task 12) + oracle caption; greeting, HUD, onboarding, veil unchanged; hero panel in the cabin (B2) (Tasks 6, 7) |

## UI1 carry items handled here

| Carry item | Task |
|---|---|
| #4 hero panel into the cabin, shortcut from the HUD | 6 |
| #12 titles echo hub labels (« La tente de guerre », « Le nid du dragon », « Ta cabane »); the cabin's own art | 2, 4, 5 |
| #16 / M9 walk + e2e step on a locked place | 2 (sleeping lieutenant), 7 (battle path), 9 (walk) |
| #17 labels pinned to landmarks, re-map to `hub_camp.webp` | 7 |
| Rec. 1–7 (re-map, six places + badges, clip edges + clamp, sky banner, news captions, one glow, dragon in the nest) | 7 |
| Rec. 8 scene transitions + retire the old top nav | 8 (every place is a `SceneStage`; `TopBar` only on Play/Boss) |

## File map

| File | Responsibility | Task |
|---|---|---|
| `web/src/lib/routes.ts` (+ test), `web/src/lib/world/places.ts` (+ test), `web/src/lib/scene/types.ts` | `war-tent` route, B1 place map, scene ids | 1 |
| `web/src/lib/world/scenes/speakers.ts` (+ test) | the dragon as a dialogue speaker (shared by camp, war tent, nest) | 1 |
| `web/src/lib/world/scenes/{war.ts,war.shapes.ts}` (+ test), `screens/WarTent.svelte`, `components/places/war/PortraitPanel.svelte`, `components/scene/Hotspot.svelte` (lock icon) | war tent + lieutenant sheets | 2 |
| `components/places/war/{DossierPanel,CodexPanel,CodexPagePanel}.svelte` | Éris's file, the bestiary | 3 |
| `web/src/lib/world/scenes/{nest.ts,nest.shapes.ts}` (+ test), `screens/Nest.svelte`, `components/places/nest/CarePanel.svelte` | dragon's nest | 4 |
| `web/src/lib/world/scenes/{cabin.ts,cabin.shapes.ts}` (+ test), `screens/CabinRoom.svelte`, `components/places/cabin/TrophiesPanel.svelte` | cabin + trophies | 5 |
| `components/places/cabin/{JournalPanel,LyrePanel,HeroPanel}.svelte`, `lib/scene/panelNav.ts`, `screens/Camp.svelte` | journal, settings, hero panel | 6 |
| `web/src/lib/world/scenes/{camp.ts,camp.shapes.ts,camp.test.ts}`, `screens/Camp.svelte`, `web/e2e/scenes-camp.spec.ts` | the hub on `hub_camp.webp` | 7 |
| `web/src/App.svelte`, `web/e2e/scenes-parity.spec.ts` | profile-gate states, parity sweep | 8 |
| `web/e2e/scenes-{war,nest,cabin}.spec.ts` | per-scene e2e (both projects) | 2–6 |
| `web/e2e/playability-ui3.spec.ts`, `docs/reviews/ui3/*.png` | the complete review walk | 9 |

---

### Task 1: The war-tent route, the rest of the place map, the dragon as a speaker

**Files:**
- Modify: `web/src/lib/routes.ts`, `web/src/lib/routes.test.ts`, `web/src/lib/world/places.ts`, `web/src/lib/world/places.test.ts`, `web/src/lib/scene/types.ts`
- Create: `web/src/lib/world/scenes/speakers.ts`, `web/src/lib/world/scenes/speakers.test.ts`

**Interfaces:**
- Consumes: UI3a Task 1 (`placeFor`, `sceneHref`, `PlaceId`, `PanelId`), UI3a Task 2 (`SceneId`).
- Produces:
  - `RouteName` gains `'war-tent'` (`#/p/:profileId/tente-de-guerre`).
  - `SceneId` = `'camp' | 'title' | 'library' | 'delphi' | 'war' | 'nest' | 'cabin'`.
  - `PlaceId` = `'title' | 'camp' | 'library' | 'delphi' | 'war' | 'nest' | 'cabin'`; `PanelId` gains `'dossier' | 'codex' | 'page' | 'portrait' | 'soin' | 'tresors' | 'journal' | 'lyre'`; `placeFor` implements Ruling B1; `sceneHref('war'|'nest'|'cabin', id)` = `#/p/<id>/tente-de-guerre` | `#/p/<id>/dragon` | `#/p/<id>/cabane`.
  - `speakers.ts`: `export function dragonSpeaker(d: DragonOut): Omit<DialogueLine, 'text'>` and `export function dragonSays(d: DragonOut, text: string): DialogueLine`.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/routes.test.ts`: in `matches every screen` add `expect(matchRoute('#/p/3/tente-de-guerre')).toEqual({ name: 'war-tent', params: { profileId: '3' }, query: {} });` and in `builds hrefs` add `expect(href('war-tent', { profileId: '3' })).toBe('#/p/3/tente-de-guerre');`.

`web/src/lib/world/places.test.ts`: replace the test « leaves the battle routes and the places UI3b builds to their current screens » by:

```ts
  it('opens the war tent: the map table, the codex and the portrait sheets', () => {
    expect(at('#/p/3/tente-de-guerre')).toEqual({ place: 'war', panel: null });
    expect(at('#/p/3/dossier')).toEqual({ place: 'war', panel: 'dossier' });
    expect(at('#/p/3/bestiaire')).toEqual({ place: 'war', panel: 'codex' });
    expect(at('#/p/3/bestiaire/echo')).toEqual({ place: 'war', panel: 'page' });
    expect(at('#/p/3/monstres/hydre')).toEqual({ place: 'war', panel: 'portrait' });
  });

  it('opens the nest and the cabin, with their overlays', () => {
    expect(at('#/p/3/dragon')).toEqual({ place: 'nest', panel: null });
    expect(at('#/p/3/dragon?panel=soin')).toEqual({ place: 'nest', panel: 'soin' });
    expect(at('#/p/3/cabane')).toEqual({ place: 'cabin', panel: null });
    expect(at('#/p/3/cabane?panel=tresors')).toEqual({ place: 'cabin', panel: 'tresors' });
    expect(at('#/p/3/cabane?panel=heros')).toEqual({ place: 'cabin', panel: 'heros' });
    expect(at('#/p/3/stats')).toEqual({ place: 'cabin', panel: 'journal' });
    expect(at('#/p/3/settings')).toEqual({ place: 'cabin', panel: 'lyre' });
  });

  it('leaves only the battle routes to their legacy screens (UI4)', () => {
    for (const h of ['#/p/3/play/1', '#/p/3/grimoire/1', '#/p/3/eris']) expect(at(h), h).toBeNull();
  });
```

and add to `knows the bare scene an overlay closes onto`:

```ts
    expect(sceneHref('war', 3)).toBe('#/p/3/tente-de-guerre');
    expect(sceneHref('nest', 3)).toBe('#/p/3/dragon');
    expect(sceneHref('cabin', 3)).toBe('#/p/3/cabane');
```

`web/src/lib/world/scenes/speakers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { DragonOut } from '../types';
import { dragonSays, dragonSpeaker } from './speakers';

const egg = { name: null, tint: 'bronze', stage: 'egg' } as DragonOut;

describe('the dragon as a speaker (UI1 greeting, reused by the places)', () => {
  it('is « L\'œuf » before it hatches, its name after, « Ton dragon » while unnamed', () => {
    expect(dragonSpeaker(egg)).toEqual({ speaker: 'dragon', name: "L'œuf", portrait: '/art/dragon/dragon_egg_cut.webp', portraitFilter: 'none' });
    expect(dragonSpeaker({ ...egg, stage: 'hatchling' }).name).toBe('Ton dragon');
    expect(dragonSpeaker({ ...egg, stage: 'young', name: 'Braise', tint: 'ecume' })).toMatchObject({
      name: 'Braise',
      portrait: '/art/dragon/dragon_young_cut.webp',
      portraitFilter: 'hue-rotate(190deg) saturate(.9)',
    });
  });

  it('says a line', () => {
    expect(dragonSays(egg, 'Bonjour.')).toMatchObject({ speaker: 'dragon', text: 'Bonjour.' });
  });
});
```

Run: `scripts/npm.sh run test -- src/lib/routes.test.ts src/lib/world/places.test.ts src/lib/world/scenes/speakers.test.ts`
Expected: FAIL (`war-tent` unmatched, `placeFor` returns null for the new routes, `./speakers` missing).

- [ ] **Step 2: Route, scene ids, place map**

`web/src/lib/routes.ts`: add `| 'war-tent'` to `RouteName`; add after the `delphi` pattern `{ name: 'war-tent', segments: ['p', { param: 'profileId' }, 'tente-de-guerre'] },`; add to `href()`:

```ts
      case 'war-tent':
        return `#/p/${params.profileId}/tente-de-guerre`;
```

`web/src/lib/scene/types.ts`: `export type SceneId = 'camp' | 'title' | 'library' | 'delphi' | 'war' | 'nest' | 'cabin';`

`web/src/lib/world/places.ts`:
- `export type PlaceId = 'title' | 'camp' | 'library' | 'delphi' | 'war' | 'nest' | 'cabin';`
- add to `PanelId`: `| 'dossier' | 'codex' | 'page' | 'portrait' | 'soin' | 'tresors' | 'journal' | 'lyre'`;
- add to `placeFor`'s switch, before `default`:

```ts
    case 'war-tent':
      return { place: 'war', panel: null };
    case 'dossier':
      return { place: 'war', panel: 'dossier' };
    case 'bestiaire':
      return { place: 'war', panel: 'codex' };
    case 'bestiaire-entry':
      return { place: 'war', panel: 'page' };
    case 'lieutenant':
      return { place: 'war', panel: 'portrait' };
    case 'dragon':
      return { place: 'nest', panel: route.query.panel === 'soin' ? 'soin' : null };
    case 'cabin': {
      const p = route.query.panel;
      return { place: 'cabin', panel: p === 'tresors' || p === 'heros' ? p : null };
    }
    case 'stats':
      return { place: 'cabin', panel: 'journal' };
    case 'settings':
      return { place: 'cabin', panel: 'lyre' };
```

- add to `sceneHref`'s switch:

```ts
    case 'war':
      return href('war-tent', p);
    case 'nest':
      return href('dragon', p);
    case 'cabin':
      return href('cabin', p);
```

(`App.svelte` still renders the legacy screens for these routes: its `route.name` branches come before the place branches. Tasks 2–6 swap them one by one.)

- [ ] **Step 3: The dragon as a speaker**

`web/src/lib/world/scenes/speakers.ts`:

```ts
// The dragon narrates (scenes UI spec §2.5): its name, or « L'œuf » before it hatches, and its own
// tinted cut-out as the dialogue portrait (carry rec. 7: the same image as its scene layer).
import { ART } from '../art';
import { TINT_FILTERS } from '../dragon';
import type { DragonOut } from '../types';
import type { DialogueLine } from '../../scene/types';

export function dragonSpeaker(d: DragonOut): Omit<DialogueLine, 'text'> {
  return {
    speaker: 'dragon',
    name: d.name ?? (d.stage === 'egg' ? "L'œuf" : 'Ton dragon'),
    portrait: ART.dragon[d.stage],
    portraitFilter: TINT_FILTERS[d.tint],
  };
}

export function dragonSays(d: DragonOut, text: string): DialogueLine {
  return { ...dragonSpeaker(d), text };
}
```

In `web/src/lib/world/scenes/camp.ts`, make `campGreeting` use it (same output): replace its local `who` object by `const who = dragonSpeaker(camp.dragon);` (import from `./speakers`; drop the `TINT_FILTERS` import if now unused).

- [ ] **Step 4: Verify**

Run: `scripts/npm.sh run test` — Expected: all pass (camp's greeting test proves the refactor is neutral).
Run: `scripts/npm.sh run check` — Expected: `0 errors and 0 warnings`.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/routes.ts web/src/lib/routes.test.ts web/src/lib/world/places.ts web/src/lib/world/places.test.ts web/src/lib/scene/types.ts web/src/lib/world/scenes/speakers.ts web/src/lib/world/scenes/speakers.test.ts web/src/lib/world/scenes/camp.ts
git commit -m "UI3b: war-tent route, place map for the war tent, nest and cabin, the dragon as a speaker

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/routes.ts web/src/lib/routes.test.ts web/src/lib/world/places.ts web/src/lib/world/places.test.ts web/src/lib/scene/types.ts web/src/lib/world/scenes/speakers.ts web/src/lib/world/scenes/speakers.test.ts web/src/lib/world/scenes/camp.ts
```

### Task 2: The war tent and the lieutenants' portrait sheets (first locked places)

**Files:**
- Create: `web/src/lib/world/scenes/war.shapes.ts`, `web/src/lib/world/scenes/war.ts`, `web/src/lib/world/scenes/war.test.ts`, `web/src/screens/WarTent.svelte`
- Move: `web/src/screens/Lieutenant.svelte` → `web/src/components/places/war/PortraitPanel.svelte` (`git mv`)
- Modify: `web/src/components/scene/Hotspot.svelte` (lock icon), `web/src/lib/world/scenes/index.ts`, `web/src/App.svelte`
- Create: `web/e2e/scenes-war.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`placeFor` → `{ place: 'war', panel }`, `sceneHref('war')`, `dragonSays`), UI3a (`PlaceScene`, `Hotspot` with `onLocked`, `Overlay`, `DialogueBox`, `hotspotHref`, `openPanel`, `closePanel`, `MARK_ICONS.lock`, e2e helpers), `agree` (`web/src/lib/world/eris.ts`), `LIEUTENANT_ORDER`, `LieutenantKey`.
- Produces:
  - `war.ts`: `export const LIEUTENANT_NAMES: Record<LieutenantKey, string>`, `export const WAR_HOTSPOTS: HotspotDef[]` (ids `hydre`, `echo`, `chimere`, `protee`, `sirenes`, `lethe` → `lieutenant` with `params.key`, `labelPos: 'on'`; `dossier` → `dossier`; `bestiary` → `bestiaire`), `export const WAR_SCENE: SceneDef` (id `war`, plaque « La tente de guerre »), `export function sleepingLine(key: LieutenantKey): string`.
  - `WarTent.svelte` props `{ profile: Profile; panel: PanelId | null; params: Record<string, string> }`; test ids `scene-war`, `war-<key>`, `war-dossier`, `war-bestiary`, `war-sheet-<key>`, `overlay-portrait` (Task 3 adds `overlay-dossier`, `overlay-codex`, `overlay-codex-page`).
  - `PortraitPanel.svelte` props `{ profile: Profile; lieutenantKey: string }` (legacy test ids `lieutenant-gauge-days`, `lieutenant-gauge-traps`, `lieutenant-rate`, `lieutenant-quest`, `lieutenant-grimoire`, `lieutenant-text-*`, `lieutenant-neutralised` unchanged).
  - `Hotspot.svelte`: a locked hotspot shows the painted lock (`img.hotspot-lock`) on its plaque.

- [ ] **Step 1: Write the failing scene-data test**

`web/src/lib/world/scenes/war.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, LieutenantState } from '../types';
import { LIEUTENANT_NAMES, WAR_HOTSPOTS, WAR_SCENE, sleepingLine } from './war';

const lt = (key: string, over: Partial<LieutenantState> = {}) =>
  ({ key, name: key, available: true, neutralised: false, stirring: false, active_quest_id: null, ...over }) as LieutenantState;
const state = (id: string, lieutenants: LieutenantState[]) =>
  WAR_HOTSPOTS.find((h) => h.id === id)!.state({ camp: { lieutenants } as CampResponse, catalog: null });

describe('war tent (UI3 Ruling B4)', () => {
  it('is a valid scene whose plaque echoes the hub label', () => {
    expect(validateScene(WAR_SCENE)).toEqual([]);
    expect(WAR_SCENE).toMatchObject({ id: 'war', title: 'La tente de guerre', background: '/art/scenes/war_tent.webp' });
  });

  it('pins the six lieutenants to their sheets, the file to the map table, the codex to the lectern', () => {
    expect(WAR_HOTSPOTS.map((h) => [h.id, h.target, h.params?.key ?? null, h.labelPos])).toEqual([
      ['hydre', 'lieutenant', 'hydre', 'on'],
      ['echo', 'lieutenant', 'echo', 'on'],
      ['chimere', 'lieutenant', 'chimere', 'on'],
      ['protee', 'lieutenant', 'protee', 'on'],
      ['sirenes', 'lieutenant', 'sirenes', 'on'],
      ['lethe', 'lieutenant', 'lethe', 'on'],
      ['dossier', 'dossier', null, 'above'],
      ['bestiary', 'bestiaire', null, 'above'],
    ]);
    expect(LIEUTENANT_NAMES.protee).toBe('Protée');
  });

  it('locks a sleeping lieutenant, glows on a stirring one, inks « Neutralisée » on a foiled one', () => {
    expect(state('protee', [lt('protee', { available: false })])).toMatchObject({ locked: true, caption: 'Dort encore' });
    expect(state('echo', [lt('echo', { stirring: true })])).toMatchObject({ locked: false, isNew: true, caption: "S'agite" });
    expect(state('hydre', [lt('hydre', { neutralised: true })])).toMatchObject({ caption: 'Neutralisée' });
    expect(state('protee', [lt('protee', { neutralised: true })])).toMatchObject({ caption: 'Neutralisé' });
    expect(state('chimere', [lt('chimere', { active_quest_id: 4 })])).toMatchObject({ caption: 'Quête en cours' });
  });

  it('says why a sheet is closed', () => {
    expect(sleepingLine('protee')).toBe('Protée dort encore à ce niveau. Ses ruses viendront plus tard.');
  });
});
```

Run: `scripts/npm.sh run test -- src/lib/world/scenes/war.test.ts` — Expected: FAIL (`Cannot find module './war'`).

- [ ] **Step 2: Scene data**

`web/src/lib/world/scenes/war.shapes.ts`:

```ts
// Hotspot geometry of the war tent (war_tent.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md (six blank sheets: columns x 21.5-27.5 / 30-36 / 39-45, rows y 22-37 / 40-55;
// map table x 20-68 kept above y 78; lectern and codex x 69-85) and checked with `?debug`.
import type { ShapeMap } from '../../scene/types';

export const WAR_SHAPES = {
  hydre: { kind: 'polygon', points: [[21.5, 22], [27.5, 22], [27.5, 37], [21.5, 37]] },
  echo: { kind: 'polygon', points: [[30, 22], [36, 22], [36, 37], [30, 37]] },
  chimere: { kind: 'polygon', points: [[39, 22], [45, 22], [45, 37], [39, 37]] },
  protee: { kind: 'polygon', points: [[21.5, 40], [27.5, 40], [27.5, 55], [21.5, 55]] },
  sirenes: { kind: 'polygon', points: [[30, 40], [36, 40], [36, 55], [30, 55]] },
  lethe: { kind: 'polygon', points: [[39, 40], [45, 40], [45, 55], [39, 55]] },
  dossier: { kind: 'polygon', points: [[20, 64], [66, 64], [68, 78], [18, 78]] },
  bestiary: { kind: 'polygon', points: [[69, 42], [85, 42], [85, 78], [69, 78]] },
} satisfies ShapeMap;
```

`web/src/lib/world/scenes/war.ts`:

```ts
// The war tent (scenes UI spec §3 "War tent scene", UI3 Ruling B4): the lieutenants' portraits
// pinned to the canvas (a sheet opens the lieutenant's page), the map table (Éris's file) and the
// bestiary codex on its lectern. A lieutenant still asleep at the hero's level is a locked place.
import { ART } from '../art';
import { agree } from '../eris';
import { LIEUTENANT_ORDER, type LieutenantKey } from '../types';
import { IDLE_HOTSPOT, type HotspotDef, type HotspotState, type SceneContext, type SceneDef } from '../../scene/types';
import { WAR_SHAPES } from './war.shapes';

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

/** The camp's names for Éris's lieutenants (catalog.py LIEUTENANTS[*].name). */
export const LIEUTENANT_NAMES: Record<LieutenantKey, string> = {
  hydre: "L'Hydre",
  echo: 'Écho',
  chimere: 'La Chimère',
  protee: 'Protée',
  sirenes: 'Les Sirènes',
  lethe: 'Léthé',
};

function sheetState(key: LieutenantKey) {
  return ({ camp }: SceneContext): HotspotState => {
    const l = camp?.lieutenants.find((x) => x.key === key);
    if (!l) return st();
    if (!l.available) return st({ locked: true, caption: 'Dort encore' });
    if (l.neutralised) return st({ caption: agree('Neutralisé', key) });
    if (l.stirring) return st({ isNew: true, caption: "S'agite" });
    if (l.active_quest_id !== null) return st({ caption: 'Quête en cours' });
    return st();
  };
}

export const WAR_HOTSPOTS: HotspotDef[] = [
  ...LIEUTENANT_ORDER.map(
    (key): HotspotDef => ({
      id: key,
      label: LIEUTENANT_NAMES[key],
      target: 'lieutenant',
      params: { key },
      shape: WAR_SHAPES[key],
      labelPos: 'on',
      state: sheetState(key),
    }),
  ),
  {
    id: 'dossier',
    label: "Le dossier d'Éris",
    target: 'dossier',
    shape: WAR_SHAPES.dossier,
    labelPos: 'above',
    leader: true,
    state: () => st(),
  },
  {
    id: 'bestiary',
    label: 'Le bestiaire',
    target: 'bestiaire',
    shape: WAR_SHAPES.bestiary,
    labelPos: 'above',
    leader: true,
    state: () => st(),
  },
];

export const WAR_SCENE: SceneDef = {
  id: 'war',
  title: 'La tente de guerre',
  background: ART.scenes.warTent,
  layers: [],
  hotspots: WAR_HOTSPOTS,
  ambience: { particles: 'dust', music: null },
  narrator: { enter: 'war.enter', firstVisit: 'war.first' },
  preload: [],
};

/** What the dragon says when a sleeping lieutenant's sheet is tapped (Ruling B4). */
export function sleepingLine(key: LieutenantKey): string {
  return `${LIEUTENANT_NAMES[key]} dort encore à ce niveau. Ses ruses viendront plus tard.`;
}
```

In `web/src/lib/world/scenes/index.ts` add `WAR_SCENE` to `SCENES`.

Run: `scripts/npm.sh run test -- src/lib/world/scenes/` — Expected: PASS.

- [ ] **Step 3: The painted lock on a locked plaque**

In `web/src/components/scene/Hotspot.svelte` import `MARK_ICONS` from `../../lib/world/art`, and inside `.hotspot-name`, before the optional `def.icon` image, add `{#if status.locked}<img class="hotspot-icon hotspot-lock" src={MARK_ICONS.lock} alt="" draggable="false" />{/if}`; add to the style `.label-on .hotspot-lock { width: 16px; height: 16px; }`.

- [ ] **Step 4: The portrait sheet panel (UI3a Ruling A3)**

```bash
mkdir -p web/src/components/places/war
git mv web/src/screens/Lieutenant.svelte web/src/components/places/war/PortraitPanel.svelte
sed -i "s#'\.\./components/#'../../#g; s#'\.\./lib/#'../../../lib/#g" web/src/components/places/war/PortraitPanel.svelte
```

In `PortraitPanel.svelte`:
- delete the `TopBar` import and element; `<div class="screen">` → `<div class="panel-portrait">`;
- the portrait header drops the legacy global class: `<div class="scene header" style="background-image:url({ART.scenes.battle})">` → `<div class="portrait-header" style="background-image:url({ART.scenes.battle})">`; in `<style>` rename the `.header` rule to `.portrait-header` and add to it `position: relative; overflow: hidden; border-radius: var(--radius); background-size: cover; background-position: center bottom;`.

Everything else stays (technique, Éris's line, neutralised banner with the relic medallion, gauges, « Lancer une quête », toast, grimoire, recommended texts).

- [ ] **Step 5: Write `web/src/screens/WarTent.svelte`**

```svelte
<script lang="ts">
  // The war tent (scenes UI spec §3, UI3 Ruling B4): each lieutenant's portrait is pinned to a
  // parchment sheet (tap → the lieutenant's page, #/p/:id/monstres/:key), the map table holds
  // Éris's file (#/p/:id/dossier), the codex on its lectern the bestiary (#/p/:id/bestiaire).
  // A sleeping lieutenant is a locked place: the dragon says why.
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import DialogueBox from '../components/scene/DialogueBox.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import PortraitPanel from '../components/places/war/PortraitPanel.svelte';
  import { LIEUTENANT_NAMES, WAR_SCENE, sleepingLine } from '../lib/world/scenes/war';
  import { dragonSays } from '../lib/world/scenes/speakers';
  import { ART } from '../lib/world/art';
  import { shapeBox } from '../lib/scene/geometry';
  import { closePanel, hotspotHref, openPanel } from '../lib/scene/panelNav';
  import { sceneHref, type PanelId } from '../lib/world/places';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import { campStore } from '../lib/world/campStore.svelte';
  import { LIEUTENANT_ORDER, type LieutenantKey } from '../lib/world/types';
  import type { DialogueLine, HotspotDef } from '../lib/scene/types';
  import type { Profile } from '../lib/types';

  let { profile, panel, params }: { profile: Profile; panel: PanelId | null; params: Record<string, string> } = $props();

  let debug = $state(false);
  let line = $state<DialogueLine[] | null>(null);
  // The same /camp snapshot PlaceScene loads (ignoring one that belongs to the previous hero).
  const camp = $derived(campStore.data && campStore.data.profile.id === profile.id ? campStore.data : null);

  const sheets = LIEUTENANT_ORDER.map((key) => ({ key, box: shapeBox(WAR_SCENE.hotspots.find((h) => h.id === key)!.shape) }));
  const portraitKey = $derived(params.key ?? '');
  const portraitTitle = $derived(LIEUTENANT_NAMES[portraitKey as LieutenantKey] ?? 'Un lieutenant inconnu');

  function activate(def: HotspotDef) {
    const to = hotspotHref(def, profile.id);
    if (!to) return;
    unlockAudio();
    playSfx('tap');
    openPanel(to);
  }

  function explainLocked(def: HotspotDef) {
    if (!camp) return;
    unlockAudio();
    line = [dragonSays(camp.dragon, sleepingLine(def.id as LieutenantKey))];
  }

  const close = () => closePanel(sceneHref('war', profile.id));
</script>

<PlaceScene {profile} scene={WAR_SCENE} bind:debug>
  {#snippet children(ctx)}
    {#each sheets as s (s.key)}
      {@const l = ctx.camp?.lieutenants.find((x) => x.key === s.key)}
      <div
        class="war-sheet"
        class:asleep={l !== undefined && !l.available}
        data-testid="war-sheet-{s.key}"
        style="left:{s.box.x}%;top:{s.box.y}%;width:{s.box.w}%;height:{s.box.h}%"
        aria-hidden="true"
      >
        <img src={ART.lieutenants[s.key]} alt="" draggable="false" />
        {#if l?.neutralised}<span class="war-seal"></span>{/if}
      </div>
    {/each}
    {#each WAR_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="war" onActivate={activate} onLocked={explainLocked} />
    {/each}
    {#if line}
      <DialogueBox lines={line} onDone={() => (line = null)} />
    {/if}
  {/snippet}
</PlaceScene>

{#if panel === 'portrait'}
  <Overlay variant="scroll" size="wide" title={portraitTitle} testId="overlay-portrait" onClose={close} returnFocus={`[data-testid="war-${portraitKey}"]`}>
    {#key portraitKey}
      <PortraitPanel {profile} lieutenantKey={portraitKey} />
    {/key}
  </Overlay>
{/if}

<style>
  /* A lieutenant's painted cut-out on its blank sheet (the sheets are part of the art); the name is
     inked on the sheet by the hotspot's `on` label. */
  .war-sheet {
    position: absolute;
    z-index: 2;
    overflow: hidden;
    pointer-events: none;
  }
  .war-sheet img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 10%;
    mix-blend-mode: multiply;
  }
  .war-sheet.asleep img {
    filter: grayscale(1);
    opacity: 0.45;
  }
  /* A gold seal pressed on a foiled lieutenant's sheet. */
  .war-seal {
    position: absolute;
    top: 6%;
    right: 8%;
    width: 30%;
    aspect-ratio: 1;
    border-radius: 50%;
    border: 2px solid var(--bronze-dark);
    background: radial-gradient(circle at 35% 30%, var(--gold-light), var(--gold) 70%);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }
</style>
```

- [ ] **Step 6: Route the war tent's lieutenant sheets**

In `web/src/App.svelte` import `WarTent from './screens/WarTent.svelte'`, delete the `lieutenant` branch and the `Lieutenant` import, and add after the still-legacy `dossier`, `bestiaire`, `bestiaire-entry` branches:

```svelte
      {:else if view?.place === 'war'}
        <WarTent profile={gateProfile} panel={view.panel} params={route.params} />
```

- [ ] **Step 7: Write the war tent e2e (both projects)**

`web/e2e/scenes-war.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { closeOverlay, createProfileApi, expectCamp, expectInSafeZone, expectScene, labelOverlaps, redScan } from './helpers';

// UI3b Task 2 (scenes spec §3 War tent, §10): the lieutenants' portrait sheets, the first locked
// places (carry #16/M9). desktop + ipad.

const SHEETS = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'];
const PLACES = [...SHEETS.map((k) => `war-${k}`), 'war-dossier', 'war-bestiary'];
const heroName = (project: string) => `Guerre-${project}-${Date.now() % 1e6}`;

async function openTent(page: Page, id: number) {
  await page.goto(`/#/p/${id}/tente-de-guerre`);
  await expectScene(page, 'war');
  await expect(page.getByTestId('hud-xp')).toBeVisible();
}

async function tap(page: Page, testId: string, project: string) {
  const el = page.getByTestId(testId);
  if (project === 'ipad') await el.tap();
  else await el.click();
}

test('the war tent: six sheets with their painted lieutenants, the file, the codex, the exit', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await expect(page.locator('.stage-plaque')).toHaveText('La tente de guerre');
  for (const k of SHEETS) {
    await expect(page.getByTestId(`war-${k}`)).toBeVisible();
    await expect(page.getByTestId(`war-sheet-${k}`).locator('img')).toHaveAttribute('src', `/art/lieutenants/${k}_cut.webp`);
  }
  await expect(page.getByTestId('war-hydre')).toHaveAccessibleName(/L'Hydre/);
  await expect(page.getByTestId('war-dossier')).toHaveAccessibleName(/Le dossier d'Éris/);
  await expect(page.getByTestId('war-bestiary')).toHaveAccessibleName(/Le bestiaire/);
  await tap(page, 'scene-exit', testInfo.project.name);
  await expectCamp(page);
});

test('a sheet opens its lieutenant: gauges, a quest, the seal and Back close it', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page, 'war-hydre', testInfo.project.name);
  await expect(page).toHaveURL(/\/monstres\/hydre$/);
  const sheet = page.getByTestId('overlay-portrait');
  await expect(sheet.getByRole('heading', { name: "L'Hydre" })).toBeVisible();
  await expect(sheet.getByTestId('lieutenant-gauge-days')).toContainText('0/3');
  await sheet.getByTestId('lieutenant-quest').click();
  await expect(sheet.getByRole('status')).toHaveText('Quête affichée au tableau.');
  await expect(sheet.getByTestId('lieutenant-quest')).toContainText('Quête en cours');
  expect(await redScan(page)).toEqual([]);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-de-guerre$/);
  await expect(page.getByTestId('war-hydre')).toContainText('Quête en cours');
  await tap(page, 'war-echo', testInfo.project.name);
  await page.goBack();
  await expect(page.getByTestId('overlay-portrait')).toHaveCount(0);
  await page.goto(`/#/p/${id}/monstres/lethe`);
  await expect(page.getByTestId('overlay-portrait').getByRole('heading', { name: 'Léthé' })).toBeVisible();
});

test('a lieutenant asleep at the hero\'s level is a locked place: the dragon says why', async ({ page, request }, testInfo) => {
  // Protée wakes at 8H (catalog.py min_level): a 7H hero finds him asleep.
  const id = await createProfileApi(request, heroName(testInfo.project.name), '7H');
  await openTent(page, id);
  const protee = page.getByTestId('war-protee');
  await expect(protee).toHaveAttribute('aria-disabled', 'true');
  await expect(protee).toContainText('Dort encore');
  await expect(protee.locator('img.hotspot-lock')).toHaveAttribute('src', '/art/icons/lock.webp');
  await tap(page, 'war-protee', testInfo.project.name);
  await expect(page).toHaveURL(/\/tente-de-guerre$/);
  await expect(page.getByTestId('dialogue-text')).toHaveText('Protée dort encore à ce niveau. Ses ruses viendront plus tard.');
  await page.getByTestId('dialogue-skip').click();
  // The other places still open (the one-tap guard was never taken by the locked tap).
  await tap(page, 'war-hydre', testInfo.project.name);
  await expect(page).toHaveURL(/\/monstres\/hydre$/);
});

test('places and labels sit in the safe zone, labels never cover another place', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await openTent(page, id);
    await expectInSafeZone(page, 'war', PLACES);
    expect(await labelOverlaps(page, 'war'), `${size.width}x${size.height}`).toEqual([]);
  }
});

test('war tent: ?debug outlines eight places; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-de-guerre?debug`);
  await expectScene(page, 'war');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(8);
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});
```

- [ ] **Step 8: Verify**

Run: `scripts/npm.sh run test` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `scripts/playwright.sh scenes-war` — Expected: 5 tests × 2 projects pass. If the safe-zone or overlap assertions fail, tune `war.shapes.ts` within ±2 % and confirm with a `?debug` screenshot.
Run: `scripts/playwright.sh world --project=desktop` — Expected: 9 passed (step 3 opens `#/p/:id/monstres/hydre`, now the war tent with the sheet overlay).

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/world/scenes/war.shapes.ts web/src/lib/world/scenes/war.ts web/src/lib/world/scenes/war.test.ts web/src/lib/world/scenes/index.ts web/src/screens/WarTent.svelte web/src/components/places/war/PortraitPanel.svelte web/src/components/scene/Hotspot.svelte web/src/App.svelte web/e2e/scenes-war.spec.ts
git commit -m "UI3b: the war tent - lieutenants' portrait sheets as places, sleeping ones locked with the dragon's word

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/scenes/war.shapes.ts web/src/lib/world/scenes/war.ts web/src/lib/world/scenes/war.test.ts web/src/lib/world/scenes/index.ts web/src/screens/WarTent.svelte web/src/screens/Lieutenant.svelte web/src/components/places/war/PortraitPanel.svelte web/src/components/scene/Hotspot.svelte web/src/App.svelte web/e2e/scenes-war.spec.ts
```

### Task 3: Éris's file on the map table, the bestiary codex on the lectern

**Files:**
- Move: `web/src/screens/Dossier.svelte` → `web/src/components/places/war/DossierPanel.svelte`; `web/src/screens/Bestiaire.svelte` → `web/src/components/places/war/CodexPanel.svelte`; `web/src/screens/BestiaireEntry.svelte` → `web/src/components/places/war/CodexPagePanel.svelte` (`git mv`)
- Modify: `web/src/screens/WarTent.svelte`, `web/src/App.svelte`
- Modify: `web/e2e/scenes-war.spec.ts`, `web/e2e/world.spec.ts`, `web/e2e/scenes-camp.spec.ts`

**Interfaces:**
- Consumes: Task 2 (`WarTent.svelte`, its `close()`, `params`), UI3a (`openPanel`, `Overlay` variants `table` / `codex`, `size="wide"`), `entry(key)` (`web/src/lib/world/bestiary.ts`).
- Produces: `DossierPanel.svelte`, `CodexPanel.svelte` props `{ profile: Profile }`; `CodexPagePanel.svelte` props `{ profile: Profile; entryKey: string }`; overlays `overlay-dossier` (« Le dossier d'Éris », `table`, wide), `overlay-codex` (« Bestiaire », `codex`, wide), `overlay-codex-page` (entry name, `codex`). Legacy test ids (`dossier-line-*`, `dossier-small-tricks`, `bestiary-card-*`, `bestiary-locked`) unchanged. Rows, cards and « Voir la ruse et la quête » open the next overlay with `openPanel` (its seal steps back).

- [ ] **Step 1: Write the failing e2e**

Append to `web/e2e/scenes-war.spec.ts`:

```ts
test('the map table opens Éris\'s file; a row opens its lieutenant; the seal steps back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page, 'war-dossier', testInfo.project.name);
  await expect(page).toHaveURL(/\/dossier$/);
  const file = page.getByTestId('overlay-dossier');
  await expect(file.getByRole('heading', { name: "Le dossier d'Éris" })).toBeVisible();
  await expect(file.getByRole('heading', { name: 'Ses points faibles' })).toBeVisible();
  await expect(file.getByTestId('dossier-line-hydre')).toBeVisible();
  await expect(file.getByTestId('dossier-small-tricks')).toContainText('Voir les chiffres bruts');
  await expect(file.locator('[data-lieutenant="hydre"] img')).toHaveAttribute('src', '/art/icons/lt-hydre.webp');
  expect(await redScan(page)).toEqual([]);
  await file.getByTestId('dossier-line-hydre').click();
  await expect(page).toHaveURL(/\/monstres\/hydre$/);
  await expect(page.getByTestId('overlay-portrait')).toBeVisible();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/dossier$/);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-de-guerre$/);
});

test('the lectern opens the bestiary; a page tells the myth apart from the camp\'s fiction', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page, 'war-bestiary', testInfo.project.name);
  await expect(page).toHaveURL(/\/bestiaire$/);
  const codex = page.getByTestId('overlay-codex');
  await expect(codex.getByRole('heading', { name: 'Bestiaire' })).toBeVisible();
  await expect(codex.getByTestId('bestiary-card-hydre').getByTestId('bestiary-locked')).toBeVisible();
  await codex.getByTestId('bestiary-card-argus').click();
  await expect(page).toHaveURL(/\/bestiaire\/argus$/);
  const leaf = page.getByTestId('overlay-codex-page');
  await expect(leaf.getByRole('heading', { name: 'Le mythe' })).toBeVisible();
  await expect(leaf.getByRole('heading', { name: 'Au camp' })).toBeVisible();
  await closeOverlay(page);
  await codex.getByTestId('bestiary-card-hydre').click();
  await leaf.getByRole('button', { name: 'Voir la ruse et la quête' }).click();
  await expect(page).toHaveURL(/\/monstres\/hydre$/);
  expect(await redScan(page)).toEqual([]);
});
```

Run: `scripts/playwright.sh scenes-war` — Expected: the two new tests FAIL (no `overlay-dossier` / `overlay-codex`).

- [ ] **Step 2: Move the three screens into panels (UI3a Ruling A3)**

```bash
git mv web/src/screens/Dossier.svelte web/src/components/places/war/DossierPanel.svelte
git mv web/src/screens/Bestiaire.svelte web/src/components/places/war/CodexPanel.svelte
git mv web/src/screens/BestiaireEntry.svelte web/src/components/places/war/CodexPagePanel.svelte
sed -i "s#'\.\./components/#'../../#g; s#'\.\./lib/#'../../../lib/#g" web/src/components/places/war/DossierPanel.svelte web/src/components/places/war/CodexPanel.svelte web/src/components/places/war/CodexPagePanel.svelte
```

In each: delete the `TopBar` import and element; import `openPanel` from `../../../lib/scene/panelNav` and drop `navigate` if it becomes unused; then:
- `DossierPanel.svelte`: `<div class="screen dossier">` → `<div class="panel-dossier dossier">`; `goLieutenant` becomes `openPanel(href('lieutenant', { profileId, key }))`. The link « Voir les chiffres bruts » stays an `<a href>` to `stats` (the cabin's journal after Task 6).
- `CodexPanel.svelte`: `<div class="screen">` → `<div class="panel-codex">`; `open(key)` becomes `openPanel(href('bestiaire-entry', { profileId, key }))`.
- `CodexPagePanel.svelte`: `<div class="screen entry">` → `<div class="panel-codex-page entry">`; `openLieutenant()` becomes `openPanel(href('lieutenant', { profileId, key: entryKey }))`.

- [ ] **Step 3: Open them on the tent**

In `web/src/screens/WarTent.svelte` import the three panels and `entry` from `../lib/world/bestiary`, add `const pageKey = $derived(params.key ?? '');` and `const pageTitle = $derived(entry(pageKey)?.name ?? 'Bestiaire');`, and extend the overlay chain:

```svelte
{#if panel === 'portrait'}
  <Overlay variant="scroll" size="wide" title={portraitTitle} testId="overlay-portrait" onClose={close} returnFocus={`[data-testid="war-${portraitKey}"]`}>
    {#key portraitKey}
      <PortraitPanel {profile} lieutenantKey={portraitKey} />
    {/key}
  </Overlay>
{:else if panel === 'dossier'}
  <Overlay variant="table" size="wide" title="Le dossier d'Éris" testId="overlay-dossier" onClose={close} returnFocus={'[data-testid="war-dossier"]'}>
    <DossierPanel {profile} />
  </Overlay>
{:else if panel === 'codex'}
  <Overlay variant="codex" size="wide" title="Bestiaire" testId="overlay-codex" onClose={close} returnFocus={'[data-testid="war-bestiary"]'}>
    <CodexPanel {profile} />
  </Overlay>
{:else if panel === 'page'}
  <Overlay variant="codex" title={pageTitle} testId="overlay-codex-page" onClose={close} returnFocus={'[data-testid="war-bestiary"]'}>
    {#key pageKey}
      <CodexPagePanel {profile} entryKey={pageKey} />
    {/key}
  </Overlay>
{/if}
```

In `web/src/App.svelte` delete the `dossier`, `bestiaire` and `bestiaire-entry` branches and the `Dossier`, `Bestiaire`, `BestiaireEntry` imports.

- [ ] **Step 4: Migrate the specs that went through the legacy dossier**

- `web/e2e/world.spec.ts` step 3: replace `await page.goto(\`/#/p/${profileId}/dossier\`); await page.getByTestId('topbar-camp').click();` by `await page.goto(\`/#/p/${profileId}/camp\`);` (the following `expectCamp` stays). Steps 6 and 9 keep their `#/p/:id/dossier` and `#/p/:id/bestiaire/hydre` deep links: they now open the overlays with the same test ids and headings.
- `web/e2e/scenes-camp.spec.ts`, test « legacy screens stay usable in portrait »: the dossier is a place now; the legacy screens are the battle ones:

```ts
  await page.goto(`/#/p/${id}/eris`);
  await expect(page.getByTestId('topbar-camp')).toBeVisible();
  await expect(page.getByTestId('rotate-screen')).toHaveCount(0);
```

- [ ] **Step 5: Verify**

Run: `scripts/npm.sh run test` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `scripts/playwright.sh scenes-war` — Expected: 7 tests × 2 projects pass.
Run: `scripts/playwright.sh --project=desktop` — Expected: all pass (`happy-path` and `grimoire` still reach the dossier overlay through the hero panel's « Ton journal » until Task 6 moves that medallion).

- [ ] **Step 6: Commit**

```bash
git add web/src/components/places/war/DossierPanel.svelte web/src/components/places/war/CodexPanel.svelte web/src/components/places/war/CodexPagePanel.svelte web/src/screens/WarTent.svelte web/src/App.svelte web/e2e/scenes-war.spec.ts web/e2e/world.spec.ts web/e2e/scenes-camp.spec.ts
git commit -m "UI3b: Éris's file on the map table, the bestiary codex on the lectern

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/screens/Dossier.svelte web/src/screens/Bestiaire.svelte web/src/screens/BestiaireEntry.svelte web/src/components/places/war/DossierPanel.svelte web/src/components/places/war/CodexPanel.svelte web/src/components/places/war/CodexPagePanel.svelte web/src/screens/WarTent.svelte web/src/App.svelte web/e2e/scenes-war.spec.ts web/e2e/world.spec.ts web/e2e/scenes-camp.spec.ts
```

### Task 4: The dragon's nest

**Files:**
- Create: `web/src/lib/world/scenes/nest.shapes.ts`, `web/src/lib/world/scenes/nest.ts`, `web/src/lib/world/scenes/nest.test.ts`, `web/src/screens/Nest.svelte`
- Move: `web/src/screens/DragonScreen.svelte` → `web/src/components/places/nest/CarePanel.svelte` (`git mv`)
- Modify: `web/src/lib/world/scenes/index.ts`, `web/src/App.svelte`
- Create: `web/e2e/scenes-nest.spec.ts`
- Modify: `web/e2e/world.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`placeFor` → `{ place: 'nest', panel: 'soin' | null }`, `sceneHref('nest')`, `dragonSays`), UI3a (`PlaceScene`, `SceneLayer`, `Hotspot`, `Overlay`, `DialogueBox`, keyed greetings, `hotspotHref`, `openPanel`, `closePanel`), `stageLabel`, `stageLine`, `stageActivity`, `TINT_FILTERS` (`web/src/lib/world/dragon.ts`), `dragonCaption` (`web/src/lib/world/scenes/camp.ts`), `Gauge` (`web/src/components/juice/Gauge.svelte`).
- Produces:
  - `nest.ts`: `export const NEST_HOTSPOTS: HotspotDef[]` (one: `dragon` → `dragon` with `query: { panel: 'soin' }`), `export const NEST_SCENE: SceneDef` (id `nest`, plaque « Le nid du dragon »), `export function nestDragonLayer(stage: DragonStage): Omit<SceneLayerDef, 'id' | 'src' | 'alt'>`, `export function growth(d: DragonOut): { value: number; max: number; label: string }`, `export function nestGreeting(d: DragonOut): DialogueLine[]`.
  - `Nest.svelte` props `{ profile: Profile; panel: PanelId | null }`; test ids `scene-nest`, `nest-dragon`, `nest-dragon-layer`, `nest-growth`, `dragon-stage` (moved from the legacy screen), `overlay-care`.
  - `CarePanel.svelte` props `{ profile: Profile }` (legacy test ids `dragon-name-input`, `dragon-name-save`, `dragon-tint-*` unchanged).

- [ ] **Step 1: Write the failing scene-data test**

`web/src/lib/world/scenes/nest.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, DragonOut } from '../types';
import { NEST_HOTSPOTS, NEST_SCENE, growth, nestDragonLayer, nestGreeting } from './nest';

const egg = { name: null, tint: 'bronze', stage: 'egg', neutralised: 0, available: 6, next_stage_at: 1, unlocked_tints: ['bronze'] } as DragonOut;
const state = (d: DragonOut) => NEST_HOTSPOTS[0].state({ camp: { dragon: d } as CampResponse, catalog: null });

describe('dragon\'s nest (UI3 Ruling B5)', () => {
  it('is a valid scene whose plaque echoes the hub label; the dragon opens its care overlay', () => {
    expect(validateScene(NEST_SCENE)).toEqual([]);
    expect(NEST_SCENE).toMatchObject({ id: 'nest', title: 'Le nid du dragon', background: '/art/scenes/nest.webp' });
    expect(NEST_HOTSPOTS.map((h) => [h.id, h.target, h.query])).toEqual([['dragon', 'dragon', { panel: 'soin' }]]);
  });

  it('seats the dragon in the straw bed, bigger as it grows', () => {
    expect(nestDragonLayer('egg')).toMatchObject({ x: 50, y: 62, depth: 1 });
    const widths = (['egg', 'hatchling', 'young', 'adult'] as const).map((s) => nestDragonLayer(s).scale);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
    expect(widths[3]).toBeLessThanOrEqual(34);
  });

  it('asks for a name once it has hatched, and says who it is otherwise', () => {
    expect(state(egg)).toMatchObject({ isNew: false, caption: 'Un œuf de dragon' });
    expect(state({ ...egg, stage: 'hatchling' })).toMatchObject({ isNew: true, caption: 'Il attend un nom' });
    expect(state({ ...egg, stage: 'young', name: 'Braise' })).toMatchObject({ isNew: false, caption: 'Braise' });
  });

  it('measures growth to the next stage in words, with a real plural', () => {
    expect(growth(egg)).toEqual({ value: 0, max: 1, label: 'Prochaine étape : 1 technique neutralisée' });
    expect(growth({ ...egg, stage: 'hatchling', neutralised: 1, next_stage_at: 3 })).toEqual({
      value: 1,
      max: 3,
      label: 'Prochaine étape : 3 techniques neutralisées',
    });
    expect(growth({ ...egg, stage: 'adult', neutralised: 6, next_stage_at: null })).toEqual({ value: 6, max: 6, label: 'Étape finale atteinte' });
  });

  it('greets with its stage line', () => {
    expect(nestGreeting(egg).map((l) => l.text)).toEqual(["L'œuf frémit chaque fois qu'un piège d'Éris est déjoué."]);
  });
});
```

Run: `scripts/npm.sh run test -- src/lib/world/scenes/nest.test.ts` — Expected: FAIL (`Cannot find module './nest'`).

- [ ] **Step 2: Scene data**

`web/src/lib/world/scenes/nest.shapes.ts`:

```ts
// Hotspot geometry of the dragon's nest (nest.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md (dragon spot x 34-68, y 30-66; feet at about y 62, centred at x 50) and
// checked with `?debug`.
import type { ShapeMap } from '../../scene/types';

export const NEST_SHAPES = {
  dragon: { kind: 'ellipse', cx: 51, cy: 47, rx: 17, ry: 19 },
} satisfies ShapeMap;
```

`web/src/lib/world/scenes/nest.ts`:

```ts
// The dragon's nest (scenes UI spec §3 "Dragon's nest scene", UI3 Ruling B5): the dragon at its
// stage, in its tint, in the straw bed; its growth on a parchment in the scene; its name and tint
// in the `soin` overlay (#/p/:id/dragon?panel=soin).
import { ART } from '../art';
import { stageLine } from '../dragon';
import type { DragonOut, DragonStage } from '../types';
import { IDLE_HOTSPOT, type DialogueLine, type HotspotDef, type HotspotState, type SceneDef, type SceneLayerDef } from '../../scene/types';
import { dragonCaption } from './camp';
import { dragonSays } from './speakers';
import { NEST_SHAPES } from './nest.shapes';

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

export const NEST_HOTSPOTS: HotspotDef[] = [
  {
    id: 'dragon',
    label: 'Ton dragon',
    target: 'dragon',
    query: { panel: 'soin' },
    shape: NEST_SHAPES.dragon,
    labelPos: 'below',
    leader: true,
    state: ({ camp }) => {
      if (!camp) return st();
      const d = camp.dragon;
      if (d.stage !== 'egg' && !d.name) return st({ isNew: true, caption: 'Il attend un nom' });
      return st({ caption: dragonCaption(d) });
    },
  },
];

export const NEST_SCENE: SceneDef = {
  id: 'nest',
  title: 'Le nid du dragon',
  background: ART.scenes.nest,
  layers: [],
  hotspots: NEST_HOTSPOTS,
  ambience: { particles: 'embers', music: null },
  narrator: { enter: 'nest.enter', firstVisit: 'nest.first' },
  preload: [],
};

const WIDTH: Record<DragonStage, number> = { egg: 10, hatchling: 16, young: 21, adult: 26 };

/** The dragon's cut-out in the straw bed (docs/art/scenes.md: feet at y 62, centred at x 50; the
 *  adult about 45 % of the picture's height). Rendered by Nest.svelte (its image and tint vary). */
export function nestDragonLayer(stage: DragonStage): Omit<SceneLayerDef, 'id' | 'src' | 'alt'> {
  return { x: 50, y: 62, scale: WIDTH[stage], depth: 1, idle: 'breathe' };
}

/** The growth gauge (was DragonScreen's), in words with a real plural (no « technique(s) »). */
export function growth(d: DragonOut): { value: number; max: number; label: string } {
  const max = d.next_stage_at ?? Math.max(1, d.available);
  if (d.next_stage_at === null) return { value: d.neutralised, max, label: 'Étape finale atteinte' };
  const n = d.next_stage_at;
  return { value: d.neutralised, max, label: `Prochaine étape : ${n} ${n === 1 ? 'technique neutralisée' : 'techniques neutralisées'}` };
}

export function nestGreeting(d: DragonOut): DialogueLine[] {
  return [dragonSays(d, stageLine(d.stage, d.name, Math.max(0, d.available - d.neutralised)))];
}
```

In `web/src/lib/world/scenes/index.ts` add `NEST_SCENE` to `SCENES`.

Run: `scripts/npm.sh run test -- src/lib/world/scenes/` — Expected: PASS.

- [ ] **Step 3: The care panel (UI3a Ruling A3)**

```bash
mkdir -p web/src/components/places/nest
git mv web/src/screens/DragonScreen.svelte web/src/components/places/nest/CarePanel.svelte
sed -i "s#'\.\./components/#'../../#g; s#'\.\./lib/#'../../../lib/#g" web/src/components/places/nest/CarePanel.svelte
```

In `CarePanel.svelte`:
- delete the `TopBar` import and element;
- delete the painted banner block `<div class="scene" style="background-image:url({ART.scenes.camp})"> ... <Dragon .../> ... </div>` and the `<div class="stage-block">...</div>` block (the nest shows the dragon, its stage and its growth);
- delete what only they used: the `Dragon`, `Gauge` and `stageLabel` imports, `viewportWidth` with its resize `$effect`, `dragonSize`, `gaugeMax`, `gaugeLabel`;
- `<div class="screen dragon-screen">` → `<div class="panel-care dragon-screen">`;
- in `<style>` delete the `.scene`, `.portrait` and `.stage-block` rules.

The « Nom » and « Teinte » sections (egg message, name input, « Garder ce nom », errors, toast, six swatches with the painted lock) stay.

- [ ] **Step 4: Write `web/src/screens/Nest.svelte`**

```svelte
<script lang="ts">
  // The dragon's nest (scenes UI spec §3, UI3 Ruling B5): the dragon in the straw bed at its stage
  // and tint, its growth on a parchment, a tap on it opens its care (#/p/:id/dragon?panel=soin:
  // name and tint). It greets once per page load with its stage line.
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import SceneLayer from '../components/scene/SceneLayer.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import DialogueBox from '../components/scene/DialogueBox.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import Gauge from '../components/juice/Gauge.svelte';
  import CarePanel from '../components/places/nest/CarePanel.svelte';
  import { NEST_SCENE, growth, nestDragonLayer, nestGreeting } from '../lib/world/scenes/nest';
  import { ART } from '../lib/world/art';
  import { TINT_FILTERS, stageActivity, stageLabel } from '../lib/world/dragon';
  import { campStore } from '../lib/world/campStore.svelte';
  import { closePanel, hotspotHref, openPanel } from '../lib/scene/panelNav';
  import { markGreetedKey, shouldGreetKey } from '../lib/scene/greeting';
  import { sceneHref, type PanelId } from '../lib/world/places';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import type { DialogueLine, HotspotDef } from '../lib/scene/types';
  import type { Profile } from '../lib/types';

  let { profile, panel }: { profile: Profile; panel: PanelId | null } = $props();

  let debug = $state(false);
  let greeting = $state<DialogueLine[] | null>(null);
  const camp = $derived(campStore.data && campStore.data.profile.id === profile.id ? campStore.data : null);
  const dragon = $derived(camp?.dragon ?? null);

  $effect(() => {
    const key = `nest:${profile.id}`;
    if (!dragon || debug || !shouldGreetKey(key)) return;
    markGreetedKey(key);
    greeting = nestGreeting(dragon);
  });

  function activate(def: HotspotDef) {
    const to = hotspotHref(def, profile.id);
    if (!to) return;
    unlockAudio();
    playSfx('tap');
    openPanel(to);
  }

  const close = () => closePanel(sceneHref('nest', profile.id));
</script>

<PlaceScene {profile} scene={NEST_SCENE} bind:debug>
  {#snippet children(ctx)}
    {#if dragon}
      {@const g = growth(dragon)}
      <SceneLayer
        layer={{ id: 'dragon', src: ART.dragon[dragon.stage], alt: dragon.name ?? 'Ton dragon', ...nestDragonLayer(dragon.stage) }}
        filter={TINT_FILTERS[dragon.tint]}
        testId="nest-dragon-layer"
      />
      <div class="kit-parchment nest-growth" data-testid="nest-growth">
        <span class="kit-plaque nest-stage" data-testid="dragon-stage">{stageLabel(dragon.stage)}</span>
        <Gauge value={g.value} max={g.max} label={g.label} />
        <p class="nest-activity">{stageActivity(dragon.stage)}</p>
      </div>
    {/if}
    {#each NEST_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="nest" onActivate={activate} />
    {/each}
    {#if greeting}
      <DialogueBox lines={greeting} onDone={() => (greeting = null)} />
    {/if}
  {/snippet}
</PlaceScene>

{#if panel === 'soin'}
  <Overlay variant="scroll" title={dragon?.name ?? 'Ton dragon'} testId="overlay-care" onClose={close} returnFocus={'[data-testid="nest-dragon"]'}>
    <CarePanel {profile} />
  </Overlay>
{/if}

<style>
  /* The growth parchment on the cliff, left of the nest (art x 13.5-30.5, y 18-36): inside the
     safe zone, clear of the dragon's place (x 34+) and the HUD band. */
  .nest-growth {
    position: absolute;
    left: 13.5%;
    top: 18%;
    width: 17%;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    text-align: center;
  }
  .nest-stage {
    font-size: 15px;
  }
  .nest-activity {
    margin: 0;
    font-style: italic;
  }
</style>
```

- [ ] **Step 5: Route the nest**

In `web/src/App.svelte` import `Nest from './screens/Nest.svelte'`, delete the `dragon` branch and the `DragonScreen` import, and add with the other place branches:

```svelte
      {:else if view?.place === 'nest'}
        <Nest profile={gateProfile} panel={view.panel} />
```

- [ ] **Step 6: Migrate the world spec**

`web/e2e/world.spec.ts`:
- step 5: `await page.goto(\`/#/p/${profileId}/dragon\`);` → `await page.goto(\`/#/p/${profileId}/dragon?panel=soin\`);`; `await expect(page.locator('img.dragon')).toHaveAttribute('style', /hue-rotate\(190deg\)/);` → `await expect(page.getByTestId('nest-dragon-layer').locator('img')).toHaveAttribute('style', /hue-rotate\(190deg\)/);`.
- step 6: keep `await page.goto(\`/#/p/${profileId}/dragon\`);` + the `dragon-stage` « Dragonnet » assertion (in the scene now), then add `await page.goto(\`/#/p/${profileId}/dragon?panel=soin\`);` before `dragon-name-input`; the reload keeps the overlay (deep link).

- [ ] **Step 7: Write the nest e2e (both projects)**

`web/e2e/scenes-nest.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { closeOverlay, createProfileApi, expectCamp, expectInSafeZone, expectScene, measureBoxes, redScan } from './helpers';

// UI3b Task 4 (scenes spec §3 Dragon's nest, §10). desktop + ipad.

const heroName = (project: string) => `Nid-${project}-${Date.now() % 1e6}`;

async function tap(page: Page, testId: string, project: string) {
  const el = page.getByTestId(testId);
  if (project === 'ipad') await el.tap();
  else await el.click();
}

test('the nest: the egg in the straw, its growth, its greeting; the exit leads back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon`);
  await expectScene(page, 'nest');
  await expect(page.locator('.stage-plaque')).toHaveText('Le nid du dragon');
  await expect(page.getByTestId('dialogue-text')).toHaveText("L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.");
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('nest-dragon-layer').locator('img')).toHaveAttribute('src', '/art/dragon/dragon_egg_cut.webp');
  await expect(page.getByTestId('dragon-stage')).toHaveText('Œuf');
  await expect(page.getByTestId('nest-growth')).toContainText('Prochaine étape : 1 technique neutralisée');
  await expect(page.getByTestId('nest-growth')).toContainText('Frémit');
  await expect(page.getByTestId('nest-dragon')).toContainText('Un œuf de dragon');
  const b = await measureBoxes(page, { growth: '[data-testid="nest-growth"]', dragon: '[data-testid="nest-dragon"]' });
  expect(b.growth!.x + b.growth!.width, 'growth parchment left of the dragon').toBeLessThanOrEqual(b.dragon!.x);
  await tap(page, 'scene-exit', testInfo.project.name);
  await expectCamp(page);
});

test('the dragon opens its care: the egg waits for a name, locked tints wear the painted lock', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon?debug`); // ?debug: no greeting in the way
  await expectScene(page, 'nest');
  await tap(page, 'nest-dragon', testInfo.project.name);
  await expect(page).toHaveURL(/\/dragon\?panel=soin$/);
  const care = page.getByTestId('overlay-care');
  await expect(care.getByRole('heading', { name: 'Ton dragon' })).toBeVisible();
  await expect(care).toContainText('Tu lui donneras un nom quand il éclora.');
  await expect(care.getByTestId('dragon-tint-bronze')).toBeVisible();
  await expect(care.getByTestId('dragon-tint-ecume')).toBeDisabled();
  await expect(care.getByTestId('dragon-tint-ecume').locator('img[src="/art/icons/lock.webp"]')).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/dragon\?debug$|\/dragon$/);
});

test('the HUD dragon leads to the nest; place and label sit in the safe zone', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await page.getByTestId('hud-dragon').click();
  await expect(page).toHaveURL(/\/dragon$/);
  await expectScene(page, 'nest');
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await expectScene(page, 'nest');
    await expectInSafeZone(page, 'nest', ['nest-dragon']);
  }
});

test('nest: ?debug outlines the dragon; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon?debug`);
  await expectScene(page, 'nest');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(1);
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});
```

- [ ] **Step 8: Verify**

Run: `scripts/npm.sh run test` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `scripts/playwright.sh scenes-nest` — Expected: 4 tests × 2 projects pass.
Run: `scripts/playwright.sh world --project=desktop` — Expected: 9 passed (tint change, hatch, naming and reload through the nest).

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/world/scenes/nest.shapes.ts web/src/lib/world/scenes/nest.ts web/src/lib/world/scenes/nest.test.ts web/src/lib/world/scenes/index.ts web/src/screens/Nest.svelte web/src/components/places/nest/CarePanel.svelte web/src/App.svelte web/e2e/scenes-nest.spec.ts web/e2e/world.spec.ts
git commit -m "UI3b: the dragon's nest - the dragon in the straw, its growth in the scene, name and tint as an overlay

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/scenes/nest.shapes.ts web/src/lib/world/scenes/nest.ts web/src/lib/world/scenes/nest.test.ts web/src/lib/world/scenes/index.ts web/src/screens/Nest.svelte web/src/screens/DragonScreen.svelte web/src/components/places/nest/CarePanel.svelte web/src/App.svelte web/e2e/scenes-nest.spec.ts web/e2e/world.spec.ts
```

### Task 5: The cabin and its trophy shelf

**Files:**
- Create: `web/src/lib/world/scenes/cabin.shapes.ts`, `web/src/lib/world/scenes/cabin.ts`, `web/src/lib/world/scenes/cabin.test.ts`, `web/src/screens/CabinRoom.svelte`
- Move: `web/src/screens/Cabin.svelte` → `web/src/components/places/cabin/TrophiesPanel.svelte` (`git mv`)
- Modify: `web/src/lib/world/scenes/index.ts`, `web/src/App.svelte`
- Create: `web/e2e/scenes-cabin.spec.ts`
- Modify: `web/e2e/world.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`placeFor` → `{ place: 'cabin', panel }`, `sceneHref('cabin')`), UI3a (`PlaceScene`, `Hotspot`, `Overlay`, `Medallion` with `rewardId`, `hotspotHref`, `openPanel`, `closePanel`), `worldApi.rewards(profileId)`, `treasureCaption` (`web/src/lib/world/scenes/camp.ts`).
- Produces:
  - `cabin.ts`: `export const CABIN_HOTSPOTS: HotspotDef[]` (ids `trophies` → `cabin` + `query: { panel: 'tresors' }`, `journal` → `stats`, `lyre` → `settings`), `export const CABIN_SCENE: SceneDef` (id `cabin`, plaque « Ta cabane »), `export const DECOR_SLOTS: { x: number; y: number }[]` (4 wall spots, art %, medallion centres).
  - `CabinRoom.svelte` props `{ profile: Profile; panel: PanelId | null }`; test ids `scene-cabin`, `cabin-trophies`, `cabin-journal`, `cabin-lyre`, `cabin-decor-<rewardId>`, `overlay-trophies` (Task 6 adds `overlay-journal`, `overlay-lyre`, `overlay-heros`).
  - `TrophiesPanel.svelte` props `{ profile: Profile }` (legacy test ids `cabin-reward-*`, `cabin-equip-*` unchanged).

- [ ] **Step 1: Write the failing scene-data test**

`web/src/lib/world/scenes/cabin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { boxesOverlap, shapeBox } from '../../scene/geometry';
import { validateScene } from '../../scene/validate';
import type { CampResponse } from '../types';
import { CABIN_HOTSPOTS, CABIN_SCENE, DECOR_SLOTS } from './cabin';

describe('the cabin (UI3 Ruling B6)', () => {
  it('is a valid scene whose plaque echoes the hub label', () => {
    expect(validateScene(CABIN_SCENE)).toEqual([]);
    expect(CABIN_SCENE).toMatchObject({ id: 'cabin', title: 'Ta cabane', background: '/art/scenes/cabin.webp' });
  });

  it('opens the trophies, the journal (stats) and the lamp and lyre (settings)', () => {
    expect(CABIN_HOTSPOTS.map((h) => [h.id, h.target, h.query ?? null])).toEqual([
      ['trophies', 'cabin', { panel: 'tresors' }],
      ['journal', 'stats', null],
      ['lyre', 'settings', null],
    ]);
    const trophies = CABIN_HOTSPOTS[0].state({ camp: { rewards_count: 2 } as CampResponse, catalog: null });
    expect(trophies.caption).toBe('2 trésors');
  });

  it('hangs the displayed decor on free wall spots inside the safe zone', () => {
    expect(DECOR_SLOTS).toHaveLength(4);
    for (const s of DECOR_SLOTS) {
      expect(s.x).toBeGreaterThan(14.5);
      expect(s.x).toBeLessThan(85.5);
      const spot = { x: s.x - 2, y: s.y - 3.5, w: 4, h: 7 };
      for (const h of CABIN_HOTSPOTS) expect(boxesOverlap(spot, shapeBox(h.shape)), `${s.x},${s.y} vs ${h.id}`).toBe(false);
    }
  });
});
```

Run: `scripts/npm.sh run test -- src/lib/world/scenes/cabin.test.ts` — Expected: FAIL (`Cannot find module './cabin'`).

- [ ] **Step 2: Scene data**

`web/src/lib/world/scenes/cabin.shapes.ts`:

```ts
// Hotspot geometry of the cabin (cabin.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md (trophy shelf clipped to x 12.5-41 and below the HUD band; the journal on the
// desk; the lamp and the lyre on the small table) and checked with `?debug`.
import type { ShapeMap } from '../../scene/types';

export const CABIN_SHAPES = {
  trophies: { kind: 'polygon', points: [[12.5, 14], [40, 14], [40, 64], [12.5, 64]] },
  journal: { kind: 'polygon', points: [[41, 47], [58, 47], [58, 78], [41, 78]] },
  lyre: { kind: 'polygon', points: [[59, 38], [73, 38], [73, 70], [59, 70]] },
} satisfies ShapeMap;
```

`web/src/lib/world/scenes/cabin.ts`:

```ts
// The hero's cabin (scenes UI spec §3 "Cabin scene", UI3 Ruling B6): the trophy shelf (rewards),
// the journal on the desk (stats), the lamp and the lyre (settings). Displayed decor hangs on the
// walls. The hero panel is an overlay here too (Ruling B2, Task 6).
import { ART } from '../art';
import { IDLE_HOTSPOT, type HotspotDef, type HotspotState, type SceneDef } from '../../scene/types';
import { treasureCaption } from './camp';
import { CABIN_SHAPES } from './cabin.shapes';

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

export const CABIN_HOTSPOTS: HotspotDef[] = [
  {
    id: 'trophies',
    label: 'Tes trésors',
    target: 'cabin',
    query: { panel: 'tresors' },
    shape: CABIN_SHAPES.trophies,
    labelPos: 'below',
    leader: true,
    state: ({ camp }) => st({ caption: camp ? treasureCaption(camp.rewards_count) : null }),
  },
  {
    id: 'journal',
    label: 'Ton journal',
    target: 'stats',
    shape: CABIN_SHAPES.journal,
    labelPos: 'above',
    leader: true,
    state: () => st(),
  },
  {
    id: 'lyre',
    label: 'La lampe et la lyre',
    target: 'settings',
    shape: CABIN_SHAPES.lyre,
    labelPos: 'above',
    leader: true,
    state: () => st(),
  },
];

export const CABIN_SCENE: SceneDef = {
  id: 'cabin',
  title: 'Ta cabane',
  background: ART.scenes.cabin,
  layers: [],
  hotspots: CABIN_HOTSPOTS,
  ambience: { particles: 'dust', music: null },
  narrator: { enter: 'cabin.enter', firstVisit: 'cabin.first' },
  preload: [],
};

/** Free wall spots for the displayed decor (medallion centres, art %): the back wall between the
 *  windows, the right-hand wall, the wall above the desk. Cycled if more decor is displayed. */
export const DECOR_SLOTS: { x: number; y: number }[] = [
  { x: 63.5, y: 22 },
  { x: 80, y: 26 },
  { x: 80, y: 42 },
  { x: 46, y: 30 },
];
```

In `web/src/lib/world/scenes/index.ts` add `CABIN_SCENE` to `SCENES`.

Run: `scripts/npm.sh run test -- src/lib/world/scenes/` — Expected: PASS.

- [ ] **Step 3: The trophies panel (UI3a Ruling A3)**

```bash
mkdir -p web/src/components/places/cabin
git mv web/src/screens/Cabin.svelte web/src/components/places/cabin/TrophiesPanel.svelte
sed -i "s#'\.\./components/#'../../#g; s#'\.\./lib/#'../../../lib/#g" web/src/components/places/cabin/TrophiesPanel.svelte
```

In `TrophiesPanel.svelte`:
- delete the `TopBar` import and element;
- delete the banner block `<div class="scene" style="background-image:url({ART.scenes.camp})"> ... decor pins ... <h1>Ta cabane</h1></div>` (the displayed decor now hangs in the cabin itself) and what only it used: `DECOR_SLOTS`, `equippedDecor`;
- `<div class="screen cabin">` → `<div class="panel-trophies cabin">`;
- in `<style>` delete the `.scene`, `.scene h1` and `.decor-pin` rules.

The empty line, the four sections, the reward cards (painted medallion or tinted egg, name, description, « Comment l'obtenir : … », « Exposer » / « Ranger »), and both error lines stay.

- [ ] **Step 4: Write `web/src/screens/CabinRoom.svelte`**

```svelte
<script lang="ts">
  // The hero's cabin (scenes UI spec §3, UI3 Ruling B6): the trophy shelf opens the rewards
  // (#/p/:id/cabane?panel=tresors), the journal the stats (#/p/:id/stats), the lamp and lyre the
  // settings (#/p/:id/settings). Displayed decor hangs on the walls; it is reloaded each time an
  // overlay closes (the shelf is where it is put on display or away).
  import PlaceScene from '../components/scene/PlaceScene.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import Medallion from '../components/juice/Medallion.svelte';
  import TrophiesPanel from '../components/places/cabin/TrophiesPanel.svelte';
  import { CABIN_SCENE, DECOR_SLOTS } from '../lib/world/scenes/cabin';
  import { worldApi } from '../lib/world/api';
  import { closePanel, hotspotHref, openPanel } from '../lib/scene/panelNav';
  import { sceneHref, type PanelId } from '../lib/world/places';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import type { HotspotDef } from '../lib/scene/types';
  import type { RewardOut } from '../lib/world/types';
  import type { Profile } from '../lib/types';

  let { profile, panel }: { profile: Profile; panel: PanelId | null } = $props();

  let owned = $state<RewardOut[]>([]);
  const displayed = $derived(owned.filter((r) => r.kind === 'decor' && r.equipped));

  $effect(() => {
    if (panel !== null) return;
    worldApi
      .rewards(profile.id)
      .then((list) => (owned = list))
      .catch(() => (owned = []));
  });

  function activate(def: HotspotDef) {
    const to = hotspotHref(def, profile.id);
    if (!to) return;
    unlockAudio();
    playSfx('tap');
    openPanel(to);
  }

  const close = () => closePanel(sceneHref('cabin', profile.id));
</script>

<PlaceScene {profile} scene={CABIN_SCENE}>
  {#snippet children(ctx)}
    {#each displayed as r, i (r.id)}
      {@const slot = DECOR_SLOTS[i % DECOR_SLOTS.length]}
      <div class="cabin-decor" data-testid="cabin-decor-{r.id}" style="left:{slot.x}%;top:{slot.y}%" title={r.name}>
        <Medallion rewardId={r.id} kind="decor" size={52} />
      </div>
    {/each}
    {#each CABIN_SCENE.hotspots as def (def.id)}
      <Hotspot {def} status={def.state(ctx)} sceneId="cabin" onActivate={activate} />
    {/each}
  {/snippet}
</PlaceScene>

{#if panel === 'tresors'}
  <Overlay variant="scroll" size="wide" title="Tes trésors" testId="overlay-trophies" onClose={close} returnFocus={'[data-testid="cabin-trophies"]'}>
    <TrophiesPanel {profile} />
  </Overlay>
{/if}

<style>
  .cabin-decor {
    position: absolute;
    z-index: 2;
    transform: translate(-50%, -50%);
    pointer-events: none;
    filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.4));
  }
</style>
```

(`RewardOut` carries `id`, `kind`, `name`, `equipped`: see `web/src/lib/world/types.ts`.)

- [ ] **Step 5: Route the cabin**

In `web/src/App.svelte` import `CabinRoom from './screens/CabinRoom.svelte'`, delete the `cabin` branch and the `Cabin` import, and add after the still-legacy `stats` and `settings` branches:

```svelte
      {:else if view?.place === 'cabin'}
        <CabinRoom profile={gateProfile} panel={view.panel} />
```

- [ ] **Step 6: Migrate the world spec**

`web/e2e/world.spec.ts`, steps 5 and 7: `await page.goto(\`/#/p/${profileId}/cabane\`);` → `await page.goto(\`/#/p/${profileId}/cabane?panel=tresors\`);` (the `cabin-reward-*`/`cabin-equip-*` assertions are unchanged). In step 7, after « Ranger » shows, add: `await closeOverlay(page); await expect(page.getByTestId('cabin-decor-sandales_hermes')).toHaveCount(0);` — gear is not decor, it never hangs on the wall (import `closeOverlay`).

- [ ] **Step 7: Write the cabin e2e (both projects)**

`web/e2e/scenes-cabin.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { closeOverlay, createProfileApi, expectCamp, expectInSafeZone, expectScene, labelOverlaps, redScan } from './helpers';

// UI3b Tasks 5-6 (scenes spec §3 Cabin, §10). desktop + ipad.

const PLACES = ['cabin-trophies', 'cabin-journal', 'cabin-lyre'];
const heroName = (project: string) => `Cabane-${project}-${Date.now() % 1e6}`;

async function openCabin(page: Page, id: number) {
  await page.goto(`/#/p/${id}/cabane`);
  await expectScene(page, 'cabin');
  await expect(page.getByTestId('hud-xp')).toBeVisible();
}

async function tap(page: Page, testId: string, project: string) {
  const el = page.getByTestId(testId);
  if (project === 'ipad') await el.tap();
  else await el.click();
}

test('the cabin: its own room, three places, the exit', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  await expect(page.locator('.stage-plaque')).toHaveText('Ta cabane');
  await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', '/art/scenes/cabin.webp');
  for (const p of PLACES) await expect(page.getByTestId(p)).toBeVisible();
  await expect(page.getByTestId('cabin-trophies')).toContainText('Aucun trésor encore');
  await tap(page, 'scene-exit', testInfo.project.name);
  await expectCamp(page);
});

test('the trophy shelf opens every reward, known in advance', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  await tap(page, 'cabin-trophies', testInfo.project.name);
  await expect(page).toHaveURL(/\/cabane\?panel=tresors$/);
  const shelf = page.getByTestId('overlay-trophies');
  await expect(shelf.getByRole('heading', { name: 'Tes trésors' })).toBeVisible();
  for (const section of ['Reliques', 'Armes et armures divines', 'Objets de la cabane', 'Teintes']) {
    await expect(shelf.getByRole('heading', { name: section })).toBeVisible();
  }
  await expect(shelf.getByTestId('cabin-reward-sandales_hermes')).toHaveAttribute('data-owned', 'false');
  await expect(shelf.getByTestId('cabin-reward-sandales_hermes')).toContainText("Comment l'obtenir");
  await expect(shelf.getByTestId('cabin-reward-sandales_hermes').locator('.medallion')).toHaveAttribute('aria-label', 'Récompense à découvrir');
  expect(await redScan(page)).toEqual([]);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/cabane$/);
});

test('places and labels sit in the safe zone, labels never cover another place', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await openCabin(page, id);
    await expectInSafeZone(page, 'cabin', PLACES);
    expect(await labelOverlaps(page, 'cabin'), `${size.width}x${size.height}`).toEqual([]);
  }
});

test('cabin: ?debug outlines three places; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/cabane?debug`);
  await expectScene(page, 'cabin');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(3);
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});
```

- [ ] **Step 8: Verify**

Run: `scripts/npm.sh run test` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `scripts/playwright.sh scenes-cabin` — Expected: 4 tests × 2 projects pass.
Run: `scripts/playwright.sh world --project=desktop` — Expected: 9 passed (owned tint, won sandals, « Exposer » / « Ranger » through the shelf).

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/world/scenes/cabin.shapes.ts web/src/lib/world/scenes/cabin.ts web/src/lib/world/scenes/cabin.test.ts web/src/lib/world/scenes/index.ts web/src/screens/CabinRoom.svelte web/src/components/places/cabin/TrophiesPanel.svelte web/src/App.svelte web/e2e/scenes-cabin.spec.ts web/e2e/world.spec.ts
git commit -m "UI3b: the cabin - its own room, the trophy shelf overlay, displayed decor on the walls

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/scenes/cabin.shapes.ts web/src/lib/world/scenes/cabin.ts web/src/lib/world/scenes/cabin.test.ts web/src/lib/world/scenes/index.ts web/src/screens/CabinRoom.svelte web/src/screens/Cabin.svelte web/src/components/places/cabin/TrophiesPanel.svelte web/src/App.svelte web/e2e/scenes-cabin.spec.ts web/e2e/world.spec.ts
```

### Task 6: The journal, the lamp and lyre, and the hero panel moves into the cabin

**Files:**
- Move: `web/src/screens/Stats.svelte` → `web/src/components/places/cabin/JournalPanel.svelte`; `web/src/screens/Settings.svelte` → `web/src/components/places/cabin/LyrePanel.svelte` (`git mv`)
- Create: `web/src/components/places/cabin/HeroPanel.svelte`
- Modify: `web/src/screens/CabinRoom.svelte`, `web/src/screens/Camp.svelte`, `web/src/lib/scene/panelNav.ts`, `web/src/lib/scene/panelNav.test.ts`, `web/src/App.svelte`
- Modify: `web/e2e/scenes-cabin.spec.ts`, `web/e2e/scenes-camp.spec.ts`, `web/e2e/happy-path.spec.ts`, `web/e2e/grimoire.spec.ts`

**Interfaces:**
- Consumes: Task 5 (`CabinRoom.svelte`, its `close()`), UI3a (`openPanel`, `closePanel`, `replaceRoute`, `Icon`, `Avatar`, `clearProfile`).
- Produces:
  - `heroPanelHref(profileId)` now returns `#/p/<id>/cabane?panel=heros` (Ruling B2); the camp replaces `#/p/<id>/camp?panel=heros` with it once the hero is onboarded.
  - `HeroPanel.svelte` props `{ profile: Profile }` (test ids `hero-settings`, `hero-journal`, `hero-switch`; links « Réglages », « Ton journal », « Changer de héros »).
  - `JournalPanel.svelte`, `LyrePanel.svelte` props `{ profile: Profile }`; overlays `overlay-journal` (« Ton journal », wide), `overlay-lyre` (« Réglages »), `overlay-heros` (« Ton héros »).

- [ ] **Step 1: Write the failing tests**

`web/src/lib/scene/panelNav.test.ts`: the hero-chip expectation becomes `expect(heroPanelHref(3)).toBe('#/p/3/cabane?panel=heros');`.

Append to `web/e2e/scenes-cabin.spec.ts`:

```ts
test('the journal opens the stats; the lamp and lyre open the settings', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  await tap(page, 'cabin-journal', testInfo.project.name);
  await expect(page).toHaveURL(/\/stats$/);
  const journal = page.getByTestId('overlay-journal');
  await expect(journal.getByRole('heading', { name: 'Ton journal' })).toBeVisible();
  await expect(journal.getByRole('heading', { name: /Aide des Muses : niveau \d sur 4/ })).toBeVisible();
  await expect(journal.getByRole('heading', { name: 'Totaux' })).toBeVisible();
  await closeOverlay(page);
  await tap(page, 'cabin-lyre', testInfo.project.name);
  await expect(page).toHaveURL(/\/settings$/);
  const lyre = page.getByTestId('overlay-lyre');
  await expect(lyre.getByRole('heading', { name: 'Réglages' })).toBeVisible();
  for (const label of ['Ton niveau', 'Textes par semaine', 'Nouveau code (quatre chiffres)']) await expect(lyre.getByLabel(label)).toBeVisible();
  // The settings' mute and the HUD lyre are one switch (UI3a Ruling A17: the sliders are UI5).
  const mute = lyre.getByLabel('Couper les sons du jeu (la dictée reste lue)');
  await expect(mute).not.toBeChecked();
  await mute.check();
  await expect(page.getByTestId('hud-mute')).toHaveAttribute('aria-pressed', 'true');
  await lyre.getByLabel('Textes par semaine').selectOption('4');
  await lyre.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(lyre.getByRole('status')).toHaveText("C'est noté.");
  expect(await redScan(page)).toEqual([]);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/cabane$/);
});

test('the HUD hero chip opens the hero panel in the cabin from any place; its seal steps back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-parchemins`);
  await expectScene(page, 'library');
  await page.getByTestId('dialogue-skip').click();
  await page.getByTestId('hud-hero').click();
  await expect(page).toHaveURL(/\/cabane\?panel=heros$/);
  const panel = page.getByTestId('overlay-heros');
  await expect(panel.getByRole('heading', { name: 'Ton héros' })).toBeVisible();
  for (const name of ['Réglages', 'Ton journal', 'Changer de héros']) await expect(panel.getByRole('link', { name })).toBeVisible();
  await expect(page.getByTestId('scene-cabin')).toHaveAttribute('inert', '');
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await page.getByTestId('hud-hero').click();
  await panel.getByRole('link', { name: 'Ton journal' }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await closeOverlay(page); // steps back to the hero panel it came from
  await expect(panel).toBeVisible();
});
```

Run: `scripts/npm.sh run test -- src/lib/scene/panelNav.test.ts` — Expected: FAIL. `scripts/playwright.sh scenes-cabin` — Expected: the two new tests FAIL.

- [ ] **Step 2: Move the two screens into panels (UI3a Ruling A3)**

```bash
git mv web/src/screens/Stats.svelte web/src/components/places/cabin/JournalPanel.svelte
git mv web/src/screens/Settings.svelte web/src/components/places/cabin/LyrePanel.svelte
sed -i "s#'\.\./components/#'../../#g; s#'\.\./lib/#'../../../lib/#g" web/src/components/places/cabin/JournalPanel.svelte web/src/components/places/cabin/LyrePanel.svelte
```

In each: delete the `TopBar` import and element; `<div class="screen">` → `<div class="panel-journal">` (JournalPanel) / `<div class="panel-lyre">` (LyrePanel). Nothing else changes.

- [ ] **Step 3: The hero panel component**

`web/src/components/places/cabin/HeroPanel.svelte` (the UI1 camp overlay's content, moved; the medallions open the cabin's own overlays with `openPanel`, so each seal steps back to this panel):

```svelte
<script lang="ts">
  // The hero panel (UI1 Ruling 6, carry #4 → UI3 Ruling B2): three bronze medallions. It lives in
  // the cabin; the HUD's hero chip is its shortcut from every place.
  import Avatar from '../../Avatar.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { clearProfile } from '../../../lib/profileStore.svelte';
  import { openPanel } from '../../../lib/scene/panelNav';
  import { href } from '../../../lib/routes';
  import type { Profile } from '../../../lib/types';

  let { profile }: { profile: Profile } = $props();

  const profileId = $derived(String(profile.id));

  function inCabin(e: MouseEvent, path: string) {
    e.preventDefault();
    openPanel(path);
  }
</script>

<div class="hero-panel">
  <Avatar avatar={profile.avatar} size={72} ring />
  <p class="hero-name">{profile.name}</p>
  <nav class="medallions" aria-label="Ton héros">
    <a class="medallion" data-testid="hero-settings" href={href('settings', { profileId })} onclick={(e) => inCabin(e, href('settings', { profileId }))}>
      <span class="medallion-disc" aria-hidden="true"><Icon name="lyre" size={34} /></span>
      <span class="medallion-caption">Réglages</span>
    </a>
    <a class="medallion" data-testid="hero-journal" href={href('stats', { profileId })} onclick={(e) => inCabin(e, href('stats', { profileId }))}>
      <span class="medallion-disc" aria-hidden="true"><Icon name="journal" size={34} /></span>
      <span class="medallion-caption">Ton journal</span>
    </a>
    <a class="medallion" data-testid="hero-switch" href={href('profiles')} onclick={() => clearProfile()}>
      <span class="medallion-disc" aria-hidden="true"><Icon name="shield" size={34} /></span>
      <span class="medallion-caption">Changer de héros</span>
    </a>
  </nav>
</div>

<style>
  .hero-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .hero-name {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 20px;
  }
  .medallions {
    display: flex;
    justify-content: center;
    gap: 28px;
    margin-top: 4px;
  }
  .medallion {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 96px;
    color: var(--ink);
    text-decoration: none;
  }
  .medallion-disc {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 68px;
    height: 68px;
    border-radius: 50%;
    border: 2px solid var(--bronze-dark);
    background: radial-gradient(circle at 35% 30%, var(--bronze-light), var(--bronze) 55%, var(--bronze-dark));
    color: var(--bronze-ink);
    box-shadow:
      inset 0 0 0 4px rgba(255, 240, 200, 0.2),
      0 4px 10px rgba(0, 0, 0, 0.3);
    transition: transform 0.1s ease;
  }
  .medallion:active .medallion-disc {
    transform: translateY(1px);
  }
  .medallion:focus-visible {
    outline: none;
  }
  .medallion:focus-visible .medallion-disc {
    outline: 3px solid var(--gold-light);
    outline-offset: 3px;
  }
  .medallion-caption {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 16px;
  }
</style>
```

- [ ] **Step 4: Three more overlays in the cabin; the hero chip points there**

`web/src/screens/CabinRoom.svelte`: import `JournalPanel`, `LyrePanel`, `HeroPanel` from `../components/places/cabin/` and extend the overlay chain:

```svelte
{#if panel === 'tresors'}
  <Overlay variant="scroll" size="wide" title="Tes trésors" testId="overlay-trophies" onClose={close} returnFocus={'[data-testid="cabin-trophies"]'}>
    <TrophiesPanel {profile} />
  </Overlay>
{:else if panel === 'journal'}
  <Overlay variant="scroll" size="wide" title="Ton journal" testId="overlay-journal" onClose={close} returnFocus={'[data-testid="cabin-journal"]'}>
    <JournalPanel {profile} />
  </Overlay>
{:else if panel === 'lyre'}
  <Overlay variant="scroll" title="Réglages" testId="overlay-lyre" onClose={close} returnFocus={'[data-testid="cabin-lyre"]'}>
    <LyrePanel {profile} />
  </Overlay>
{:else if panel === 'heros'}
  <Overlay variant="scroll" title="Ton héros" testId="overlay-heros" onClose={close} returnFocus={'[data-testid="hud-hero"]'}>
    <HeroPanel {profile} />
  </Overlay>
{/if}
```

`web/src/lib/scene/panelNav.ts`: `heroPanelHref` returns `href('cabin', { profileId: String(profileId) }, { panel: 'heros' })` and its comment becomes `/** Where the HUD's hero chip leads: the hero panel in the cabin (UI3 Ruling B2, carry #4). */`.

`web/src/screens/Camp.svelte`:
- delete the whole `{#if panel === 'heros' && profile.settings.onboarded} <Overlay ...> ... </Overlay> {/if}` block, `closeHeroPanel()`, and the hero-panel CSS rules (`.hero-panel`, `.hero-name`, `.medallions`, `.medallion*`); delete imports left unused (`Overlay`, `Avatar`, `Icon`, `clearProfile`, `closePanel`);
- keep `panel` and add (import `replaceRoute` from `../lib/router.svelte` and `heroPanelHref` is already imported):

```ts
  // UI3 Ruling B2: `?panel=heros` stays a route; once the Muses' welcome is over (fix wave 3: the
  // onboarding takes precedence) it hands over to the hero panel in the cabin.
  $effect(() => {
    if (panel === 'heros' && profile.settings.onboarded) replaceRoute(heroPanelHref(profile.id));
  });
```

`web/src/App.svelte`: delete the `stats` and `settings` branches and the `Stats`, `Settings` imports.

- [ ] **Step 5: Migrate the specs that used the camp's hero panel**

- `web/e2e/scenes-camp.spec.ts`, test « the hero panel: its own route, medallions, focus kept inside, closing never leaves a Back trap »: rename it « the hero chip opens the hero panel in the cabin; closing steps back, a deep link hands over »; keep its console/pageerror and focus-count setup, and change only these expectations:
  - `const stage = page.getByTestId('scene-camp');` → `const stage = page.getByTestId('scene-cabin');`
  - `await expect(page).toHaveURL(/\/camp\?panel=heros$/);` → `await expect(page).toHaveURL(/\/cabane\?panel=heros$/);`
  - the two deep links `/#/p/${id}/camp?panel=heros` stay (they prove the hand-over); after each `overlay-close` click expect `toHaveURL(/\/cabane$/)` instead of `/\/camp$/`, and for the first one replace the final Back check by `await page.goBack(); await expect(page).not.toHaveURL(/panel=heros/);`;
  - the last lines stay: `panel.getByRole('link', { name: 'Réglages' }).click()` → `toHaveURL(/\/settings$/)`.
  Everything about Escape, Tab staying in the panel, the paused particles (`fx-canvas` of the cabin), focus handed back to `hud-hero` once, and Back from the camp leading to `/parchemins` keeps its assertion.
- In the same file, test « no red on the hub, its greeting or the hero panel »: unchanged (the panel now opens in the cabin, `overlay-heros` is the same test id).
- `web/e2e/happy-path.spec.ts`: replace the tail from `await page.getByTestId('hud-hero').click();` to the last line by:

```ts
  await page.getByTestId('hud-hero').click();
  await page.getByTestId('hero-journal').click();
  await expect(page.getByRole('heading', { name: 'Ton journal' })).toBeVisible();
  await expect(page.getByText(/1 parties?/).first()).toBeVisible();
  await expect(page.getByText("Accord du verbe avec son sujet (L'Hydre)").first()).toBeVisible();
```

  (and update its comment: « Ton journal » is the stats, in the cabin, UI3 Ruling B2).
- `web/e2e/grimoire.spec.ts`: same replacement of its tail, ending with `await expect(page.getByText('Grimoire').first()).toBeVisible();` and `expect(t.id).toBeGreaterThan(0);`.

- [ ] **Step 6: Verify**

Run: `scripts/npm.sh run test` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `scripts/playwright.sh scenes-` — Expected: every `scenes-*` spec passes on both projects.
Run: `scripts/playwright.sh --project=desktop` — Expected: all pass (`profiles.spec` « Changer de héros » now goes through the cabin's hero panel; `happy-path` and `grimoire` read the journal).

- [ ] **Step 7: Commit**

```bash
git add web/src/components/places/cabin/JournalPanel.svelte web/src/components/places/cabin/LyrePanel.svelte web/src/components/places/cabin/HeroPanel.svelte web/src/screens/CabinRoom.svelte web/src/screens/Camp.svelte web/src/lib/scene/panelNav.ts web/src/lib/scene/panelNav.test.ts web/src/App.svelte web/e2e/scenes-cabin.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/happy-path.spec.ts web/e2e/grimoire.spec.ts
git commit -m "UI3b: journal and lamp-and-lyre overlays; the hero panel moves into the cabin, the HUD chip is its shortcut

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/screens/Stats.svelte web/src/screens/Settings.svelte web/src/components/places/cabin/JournalPanel.svelte web/src/components/places/cabin/LyrePanel.svelte web/src/components/places/cabin/HeroPanel.svelte web/src/screens/CabinRoom.svelte web/src/screens/Camp.svelte web/src/lib/scene/panelNav.ts web/src/lib/scene/panelNav.test.ts web/src/App.svelte web/e2e/scenes-cabin.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/happy-path.spec.ts web/e2e/grimoire.spec.ts
```

### Task 7: The hub on `hub_camp.webp` (six places, pins, news captions, one glow, the locked path to battle)

**Files:**
- Modify (full replacement below): `web/src/lib/world/scenes/camp.shapes.ts`, `web/src/lib/world/scenes/camp.ts`, `web/src/lib/world/scenes/camp.test.ts`
- Modify: `web/src/screens/Camp.svelte`, `web/src/lib/world/scenes/title.ts` (preload)
- Modify: `web/e2e/scenes-camp.spec.ts`, `web/e2e/scenes-delphi.spec.ts`, `web/e2e/world.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`dragonSays`, `dragonSpeaker`), Tasks 2–6 (the `war-tent`, `dragon`, `cabin` places exist), UI3a (`Hotspot` `onLocked`, lock icon from Task 2, `ART.scenes.hubCamp`, `bossRewardName` logic).
- Produces (`web/src/lib/world/scenes/camp.ts`):
  - `export type CampHotspotId = 'dragon' | 'oracle' | 'parchemins' | 'dossier' | 'cabin' | 'boss'`; `export const CAMP_HOTSPOTS: HotspotDef[]`; `export const CAMP_SCENE: SceneDef` (background `/art/scenes/hub_camp.webp`).
  - `export function campNews(camp: CampResponse, catalog: WorldCatalog | null): Partial<Record<CampHotspotId, string>>` (≤ 3 captions, priority boss → oracle → parchemins → dragon → dossier).
  - `export function nextStepPlace(camp: CampResponse): 'oracle' | 'boss' | 'parchemins'`, `export function nextStepLine(camp: CampResponse): string` (same priority).
  - `export function bossLocked(camp: CampResponse): boolean`, `export function bossLockLine(camp: CampResponse): string`, `export function campDragonLayer(stage: DragonStage): Omit<SceneLayerDef, 'id' | 'src' | 'alt'>`.
  - Kept for the other places: `dragonCaption`, `bossRewardName`, `treasureCaption`, `prophecyWhen`, `nearestProphecy`, `weeklyCaption`, `campGreeting`. Removed: `CAMP_DRAGON_LAYER`, `bestiaryCaption`.
  - Test ids: `camp-<id>` for the six places, `camp-oracle-badge`, `camp-dossier-badge`, `camp-weekly`, `camp-status`; `camp-quests`, `camp-bestiary`, `camp-prophecy`, `camp-column` are gone.

- [ ] **Step 1: Write the failing scene-data test**

Replace `web/src/lib/world/scenes/camp.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, LieutenantState, QuestOut, WorldCatalog } from '../types';
import {
  CAMP_HOTSPOTS,
  CAMP_SCENE,
  bossLockLine,
  campDragonLayer,
  campGreeting,
  campNews,
  dragonCaption,
  nearestProphecy,
  nextStepLine,
  nextStepPlace,
  prophecyWhen,
  treasureCaption,
  weeklyCaption,
} from './camp';

function camp(over: Partial<CampResponse> = {}): CampResponse {
  return {
    profile: { id: 7, name: 'Ariane' } as CampResponse['profile'],
    xp: { total: 0, rank: 1, title: 'Recrue du camp', next_threshold: 150, rank_floor: 0 },
    dragon: { name: null, tint: 'bronze', stage: 'egg', neutralised: 0, available: 6, next_stage_at: 1, unlocked_tints: ['bronze'] },
    lieutenants: [],
    quests: [],
    oracle: { week: '2026-W39', status: 'sealed', reward_id: null },
    prophecies: [],
    weekly: { week: '2026-W39', target: 3, done: 0, reached: false },
    boss: { tier_available: null, tiers_won: [], active_quest_id: null },
    rewards_count: 0,
    small_tricks: { traps: 0, caught: 0 },
    ...over,
  };
}
const catalog = {
  boss_rewards: { '1': 'sandales' },
  rewards: { sandales: { id: 'sandales', kind: 'gear', name: "Sandales d'Hermès", desc: '', source: '' } },
} as unknown as WorldCatalog;
const state = (id: string, c: CampResponse | null, cat: WorldCatalog | null = null) =>
  CAMP_HOTSPOTS.find((h) => h.id === id)!.state({ camp: c, catalog: cat });
const ready = (over: Partial<CampResponse> = {}) => camp({ boss: { tier_available: 1, tiers_won: [], active_quest_id: null }, ...over });
const seasoned = { total: 40, rank: 1, title: 'Recrue du camp', next_threshold: 150, rank_floor: 0 };
const chosen = { week: 'w', status: 'chosen' as const, reward_id: null };
const hatchling = { ...camp().dragon, stage: 'hatchling' as const };
const echoStirs = [{ key: 'echo', name: 'Écho', stirring: true, neutralised: false }] as LieutenantState[];
const prophecy = (days: number) => [{ text_id: 1, title: 'La mer', due_date: '2026-09-27', days_left: days }];

describe('the hub on hub_camp.webp (UI3 Ruling B3)', () => {
  it('is a valid scene with the six places of the painted camp, each pinned to its landmark', () => {
    expect(validateScene(CAMP_SCENE)).toEqual([]);
    expect(CAMP_SCENE).toMatchObject({ title: 'Le camp', background: '/art/scenes/hub_camp.webp' });
    expect(Object.fromEntries(CAMP_HOTSPOTS.map((h) => [h.id, h.target]))).toEqual({
      dragon: 'dragon',
      oracle: 'delphi',
      parchemins: 'library-tent',
      dossier: 'war-tent',
      cabin: 'cabin',
      boss: 'boss',
    });
    for (const h of CAMP_HOTSPOTS) expect(h.leader, h.id).toBe(true);
  });

  it('always shows the path to battle, locked until Éris can be fought', () => {
    for (const h of CAMP_HOTSPOTS) expect(h.state({ camp: null, catalog: null }).visible, h.id).toBe(true);
    expect(state('boss', null).locked).toBe(true);
    expect(state('boss', camp())).toMatchObject({ locked: true, caption: null, isNew: false });
    expect(state('boss', ready(), catalog)).toMatchObject({ locked: false, isNew: true, caption: "Combat 1 : Sandales d'Hermès" });
    expect(state('boss', ready(), null).caption).toBe('Combat 1 : une récompense');
  });

  it('explains the locked path in the dragon\'s words', () => {
    expect(bossLockLine(camp())).toBe('Éris se cache encore. Déjoue encore 2 ruses et elle sortira.');
    expect(bossLockLine(camp({ dragon: { ...camp().dragon, neutralised: 1 } }))).toBe('Éris se cache encore. Déjoue encore une ruse et elle sortira.');
    expect(bossLockLine(camp({ boss: { tier_available: null, tiers_won: [1, 2, 3], active_quest_id: null } }))).toBe(
      'Éris est vaincue trois fois. Elle boude, loin du camp.',
    );
  });

  it('captions only the places with news, three at most, in priority order', () => {
    expect(campNews(camp({ xp: seasoned, oracle: chosen }), null)).toEqual({});
    const busy = ready({ prophecies: prophecy(2), dragon: hatchling, lieutenants: echoStirs });
    expect(campNews(busy, catalog)).toEqual({
      boss: "Combat 1 : Sandales d'Hermès",
      oracle: 'Une prophétie, dans 2 jours',
      parchemins: 'Choisis un texte à défendre',
    });
    expect(state('dragon', busy, catalog).caption).toBeNull();
    expect(campNews(camp({ xp: seasoned, dragon: hatchling, lieutenants: echoStirs }), null)).toEqual({
      oracle: 'Trois rouleaux scellés',
      dragon: 'Il attend un nom',
      dossier: "Écho s'agite",
    });
  });

  it('glows on exactly one place, the next step the greeting names', () => {
    const cases = [camp(), ready(), camp({ prophecies: prophecy(3) }), camp({ xp: seasoned }), camp({ xp: seasoned, oracle: chosen })];
    for (const c of cases) {
      const glowing = CAMP_HOTSPOTS.filter((h) => h.state({ camp: c, catalog }).isNew).map((h) => h.id);
      expect(glowing).toEqual([nextStepPlace(c)]);
    }
    expect(cases.map(nextStepPlace)).toEqual(['parchemins', 'boss', 'oracle', 'oracle', 'parchemins']);
    expect(nextStepLine(camp({ prophecies: prophecy(3) }))).toBe('La Pythie a vu ta prochaine épreuve, dans 3 jours. Viens la réviser !');
    expect(nextStepLine(ready())).toBe("Le sentier de la bataille est ouvert : Éris t'attend.");
    expect(nextStepLine(camp({ xp: seasoned }))).toBe("La Pythie t'attend à Delphes : trois rouleaux scellés.");
    expect(nextStepLine(camp())).toBe("Les parchemins t'attendent, sous la tente.");
  });

  it('carries the quest count on the Delphi plaque and the foiled tricks on the war-tent plaque', () => {
    const quests = [{ status: 'active' }, { status: 'active' }, { status: 'done' }] as QuestOut[];
    expect(state('oracle', camp({ quests })).badge).toBe(2);
    expect(state('oracle', camp()).badge).toBeNull();
    const lieutenants = [{ key: 'hydre', neutralised: true }, { key: 'echo', neutralised: false }] as LieutenantState[];
    expect(state('dossier', camp({ lieutenants })).badge).toBe(1);
    expect(state('dossier', camp()).badge).toBeNull();
  });

  it('greets with three static dragon lines, the last one pointing at the next step', () => {
    const lines = campGreeting('Ariane', camp());
    expect(lines.map((l) => l.text)).toEqual([
      'Bienvenue au camp, Ariane.',
      "L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.",
      "Les parchemins t'attendent, sous la tente.",
    ]);
    expect(lines[0]).toMatchObject({ speaker: 'dragon', name: "L'œuf", portrait: '/art/dragon/dragon_egg_cut.webp', portraitFilter: 'none' });
  });

  it('seats the dragon in the painted nest, on a shallow plane; preloads the tent and the temple', () => {
    expect(campDragonLayer('egg')).toMatchObject({ x: 17, y: 55, depth: 1 });
    expect(campDragonLayer('adult').scale).toBeGreaterThan(campDragonLayer('egg').scale);
    expect(CAMP_SCENE.preload).toEqual(['/art/scenes/library_tent.webp', '/art/scenes/delphi.webp']);
  });

  it('keeps the words the other places use', () => {
    expect(dragonCaption(camp().dragon)).toBe('Un œuf de dragon');
    expect([0, 1, 2].map(treasureCaption)).toEqual(['Aucun trésor encore', '1 trésor', '2 trésors']);
    expect([0, 1, 3].map(prophecyWhen)).toEqual(["aujourd'hui", 'demain', 'dans 3 jours']);
    expect(weeklyCaption({ week: 'w', target: 3, done: 1, reached: false })).toBe('Cette semaine : 1 / 3 parchemins défendus');
    expect(weeklyCaption({ week: 'w', target: 3, done: 3, reached: true })).toBe('Objectif atteint ! Les Muses sont fières.');
    const two = [
      { text_id: 2, title: 'Les fées', due_date: '2026-10-01', days_left: 7 },
      { text_id: 1, title: 'La mer', due_date: '2026-09-27', days_left: 3 },
    ];
    expect(nearestProphecy(camp({ prophecies: two }))?.title).toBe('La mer');
  });
});
```

Run: `scripts/npm.sh run test -- src/lib/world/scenes/camp.test.ts` — Expected: FAIL (missing exports, old targets, old background).

- [ ] **Step 2: New shapes**

Replace `web/src/lib/world/scenes/camp.shapes.ts` with:

```ts
// Hotspot geometry of the hub (hub_camp.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md and checked with `?debug` (UI3 Ruling B3). The nest and the cabin overhang
// the 4:3 safe zone in the art and are clipped at 12.5 / 87.5. The library tent's box starts at
// its eaves (y 42) and the oracle's ends at the upper stairs (y 31), so the oracle's plaque fits
// between them; the war tent's box starts under the spear tips (y 43), so the battle path's
// plaque fits above it.
import type { ShapeMap } from '../../scene/types';

export const CAMP_SHAPES = {
  dragon: { kind: 'polygon', points: [[12.5, 44], [23, 42], [25, 50], [24, 66], [12.5, 66]] },
  oracle: { kind: 'polygon', points: [[22.5, 14], [36, 14], [36, 22], [33, 31], [27, 31], [22.5, 22]] },
  parchemins: { kind: 'polygon', points: [[33, 42], [51, 42], [51, 61], [33, 61]] },
  dossier: { kind: 'polygon', points: [[54, 43], [74, 43], [74, 72], [54, 72]] },
  boss: { kind: 'polygon', points: [[65, 20], [75, 20], [75, 33], [65, 33]] },
  cabin: { kind: 'polygon', points: [[76, 56], [86, 54], [87.5, 60], [87.5, 78], [76, 78]] },
} satisfies ShapeMap;
```

- [ ] **Step 3: New scene data**

Replace `web/src/lib/world/scenes/camp.ts` with:

```ts
// The camp as a hub scene on hub_camp.webp (scenes UI spec §3 "Hub scene", UI3 Ruling B3): six
// places pinned to their painted landmarks, captions only where there is news (three at most), one
// "next step" glow, the path to battle locked until Éris can be fought.
import { ART } from '../art';
import { stageLabel, stageLine } from '../dragon';
import type { CampResponse, DragonOut, DragonStage, WorldCatalog } from '../types';
import { IDLE_HOTSPOT, type DialogueLine, type HotspotDef, type HotspotState, type SceneContext, type SceneDef, type SceneLayerDef } from '../../scene/types';
import { dragonSpeaker } from './speakers';
import { CAMP_SHAPES } from './camp.shapes';

export type CampHotspotId = keyof typeof CAMP_SHAPES;

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

/** The dragon's identity: its name, else what it is (the nest's caption). */
export function dragonCaption(d: DragonOut): string {
  return d.name ?? (d.stage === 'egg' ? 'Un œuf de dragon' : stageLabel(d.stage));
}

/** The boss reward "known in advance" (SP3 decisions 9/12), or a generic phrase. */
export function bossRewardName(camp: CampResponse, catalog: WorldCatalog | null): string {
  const tier = camp.boss.tier_available;
  if (tier === null) return 'une récompense';
  const rewardId = catalog?.boss_rewards[String(tier)];
  const name = rewardId ? catalog?.rewards[rewardId]?.name : undefined;
  return name ?? 'une récompense';
}

/** « 1 trésor », « 2 trésors », « Aucun trésor encore » (the cabin's shelf). */
export function treasureCaption(n: number): string {
  if (n <= 0) return 'Aucun trésor encore';
  return n === 1 ? '1 trésor' : `${n} trésors`;
}

/** When a prophecy falls due, in words. */
export function prophecyWhen(daysLeft: number): string {
  if (daysLeft <= 0) return "aujourd'hui";
  if (daysLeft === 1) return 'demain';
  return `dans ${daysLeft} jours`;
}

/** The prophecy falling due first (shown on Delphi's altar). */
export function nearestProphecy(camp: CampResponse): CampResponse['prophecies'][number] | null {
  const list = camp.prophecies;
  return list.length ? [...list].sort((a, b) => a.due_date.localeCompare(b.due_date))[0] : null;
}

/** The weekly goal banner, in-world words. */
export function weeklyCaption(w: CampResponse['weekly']): string {
  if (w.reached) return 'Objectif atteint ! Les Muses sont fières.';
  return `Cette semaine : ${w.done} / ${w.target} parchemins défendus`;
}

const engaged = (camp: CampResponse) => camp.quests.some((q) => q.kind === 'boss' && q.status === 'active');

/** Éris hides until enough tricks are foiled (the quest board's rule, SP3 decision 8). */
export function bossLocked(camp: CampResponse): boolean {
  return camp.boss.tier_available === null && camp.boss.active_quest_id === null;
}

function bossRemaining(camp: CampResponse): number {
  const won = camp.boss.tiers_won.length;
  const need = Math.ceil((camp.dragon.available * (won + 1)) / 3);
  return Math.max(0, need - camp.dragon.neutralised);
}

/** What the dragon says when the locked path to battle is tapped. */
export function bossLockLine(camp: CampResponse): string {
  if (camp.boss.tiers_won.length >= 3) return 'Éris est vaincue trois fois. Elle boude, loin du camp.';
  const n = bossRemaining(camp);
  if (n <= 0) return 'Éris se cache encore. Continue de défendre tes textes.';
  return `Éris se cache encore. Déjoue ${n === 1 ? 'encore une ruse' : `encore ${n} ruses`} et elle sortira.`;
}

/** The one place the hub points at (carry rec. 6); the greeting's last line names the same. */
export function nextStepPlace(camp: CampResponse): 'oracle' | 'boss' | 'parchemins' {
  const p = nearestProphecy(camp);
  if (p && p.days_left <= 7) return 'oracle';
  if (camp.boss.tier_available !== null && !engaged(camp)) return 'boss';
  if (camp.xp.total === 0) return 'parchemins';
  if (camp.oracle.status === 'sealed') return 'oracle';
  return 'parchemins';
}

export function nextStepLine(camp: CampResponse): string {
  const step = nextStepPlace(camp);
  if (step === 'boss') return "Le sentier de la bataille est ouvert : Éris t'attend.";
  if (step === 'oracle') {
    const p = nearestProphecy(camp);
    if (p && p.days_left <= 7) return `La Pythie a vu ta prochaine épreuve, ${prophecyWhen(p.days_left)}. Viens la réviser !`;
    return "La Pythie t'attend à Delphes : trois rouleaux scellés.";
  }
  return "Les parchemins t'attendent, sous la tente.";
}

/** Captions only where there is news (carry rec. 5), three at most, by priority. */
export function campNews(camp: CampResponse, catalog: WorldCatalog | null): Partial<Record<CampHotspotId, string>> {
  const p = nearestProphecy(camp);
  const stirring = camp.lieutenants.find((l) => l.stirring);
  const all: [CampHotspotId, string | null][] = [
    [
      'boss',
      bossLocked(camp)
        ? null
        : engaged(camp)
          ? 'Un combat est déjà engagé contre Éris.'
          : `Combat ${camp.boss.tier_available} : ${bossRewardName(camp, catalog)}`,
    ],
    ['oracle', p && p.days_left <= 7 ? `Une prophétie, ${prophecyWhen(p.days_left)}` : camp.oracle.status === 'sealed' ? 'Trois rouleaux scellés' : null],
    ['parchemins', camp.xp.total === 0 ? 'Choisis un texte à défendre' : null],
    ['dragon', camp.dragon.stage !== 'egg' && !camp.dragon.name ? 'Il attend un nom' : null],
    ['dossier', stirring ? `${stirring.name} s'agite` : null],
  ];
  return Object.fromEntries(all.filter((e): e is [CampHotspotId, string] => e[1] !== null).slice(0, 3));
}

function place(id: CampHotspotId, extra: (camp: CampResponse) => Partial<HotspotState> = () => ({})) {
  return ({ camp, catalog }: SceneContext): HotspotState => {
    if (!camp) return st();
    return st({ caption: campNews(camp, catalog)[id] ?? null, isNew: nextStepPlace(camp) === id, ...extra(camp) });
  };
}

export const CAMP_HOTSPOTS: HotspotDef[] = [
  { id: 'dragon', label: 'Le nid du dragon', target: 'dragon', shape: CAMP_SHAPES.dragon, labelPos: 'below', leader: true, state: place('dragon') },
  {
    id: 'oracle',
    label: 'Le chemin de Delphes',
    target: 'delphi',
    shape: CAMP_SHAPES.oracle,
    labelPos: 'below',
    leader: true,
    state: place('oracle', (camp) => {
      const n = camp.quests.filter((q) => q.status === 'active').length;
      return { badge: n > 0 ? n : null };
    }),
  },
  { id: 'parchemins', label: 'La tente des parchemins', target: 'library-tent', shape: CAMP_SHAPES.parchemins, labelPos: 'below', leader: true, state: place('parchemins') },
  {
    id: 'dossier',
    label: 'La tente de guerre',
    target: 'war-tent',
    shape: CAMP_SHAPES.dossier,
    labelPos: 'below',
    leader: true,
    state: place('dossier', (camp) => {
      const n = camp.lieutenants.filter((l) => l.neutralised).length;
      return { badge: n > 0 ? n : null };
    }),
  },
  { id: 'cabin', label: 'Ta cabane', target: 'cabin', shape: CAMP_SHAPES.cabin, labelPos: 'above', leader: true, state: place('cabin') },
  {
    id: 'boss',
    label: 'Le sentier de la bataille',
    target: 'boss',
    shape: CAMP_SHAPES.boss,
    labelPos: 'below',
    leader: true,
    state: (ctx) => (ctx.camp ? place('boss', (camp) => ({ locked: bossLocked(camp) }))(ctx) : st({ locked: true })),
  },
];

export const CAMP_SCENE: SceneDef = {
  id: 'camp',
  title: 'Le camp',
  background: ART.scenes.hubCamp,
  layers: [],
  hotspots: CAMP_HOTSPOTS,
  ambience: { particles: 'embers', music: null },
  narrator: { enter: 'camp.enter', firstVisit: 'camp.first' },
  // Carry rec. 9: the two places the hub leads to most (the tent, the temple).
  preload: [ART.scenes.libraryTent, ART.scenes.delphi],
};

const WIDTH: Record<DragonStage, number> = { egg: 6, hatchling: 7, young: 8, adult: 9 };

/** The dragon's cut-out seated in the painted nest (carry rec. 7: docs/art/scenes.md ≈ (17, 50),
 *  feet on the straw at y 55). Depth 1 keeps it inside its place's box (UI1 final review M2). */
export function campDragonLayer(stage: DragonStage): Omit<SceneLayerDef, 'id' | 'src' | 'alt'> {
  return { x: 17, y: 55, scale: WIDTH[stage], depth: 1, idle: 'breathe' };
}

/** The static greeting (dialogue content files arrive in UI5). */
export function campGreeting(profileName: string, camp: CampResponse): DialogueLine[] {
  const d = camp.dragon;
  const who = dragonSpeaker(d);
  return [
    { ...who, text: `Bienvenue au camp, ${profileName}.` },
    { ...who, text: stageLine(d.stage, d.name, Math.max(0, d.available - d.neutralised)) },
    { ...who, text: nextStepLine(camp) },
  ];
}
```

In `web/src/lib/world/scenes/title.ts`, `TITLE_SCENE.preload` becomes `[ART.scenes.hubCamp]` (the gate now opens onto the new hub art).

Run: `scripts/npm.sh run test -- src/lib/world/scenes/` — Expected: PASS (camp, nest and cabin still import `dragonCaption`/`treasureCaption`).

- [ ] **Step 4: The camp screen on the new art**

In `web/src/screens/Camp.svelte`:
- import `campDragonLayer`, `bossLockLine` (drop `CAMP_DRAGON_LAYER`, `nearestProphecy as pickProphecy`, `prophecyWhen`), and `dragonSays` from `../lib/world/scenes/speakers`;
- `dragonLayer` becomes `{ id: 'dragon', src: ART.dragon[camp.dragon.stage], alt: camp.dragon.name ?? 'Ton dragon', ...campDragonLayer(camp.dragon.stage) }`;
- delete `nearestProphecy`, `review()` and the whole `<div class="camp-column" ...>` block with its `.camp-column`, `.prophecy*` rules; keep its loading/error states as a banner in the sky:

```svelte
  {#if !camp}
    <div class="kit-parchment camp-status" data-testid="camp-status">
      {#if campStore.loading}
        <p>Les Muses préparent le camp…</p>
      {:else if campStore.error}
        <p>Impossible de rejoindre le camp : {campStore.error}</p>
        <button type="button" class="kit-bronze" onclick={() => refreshCamp(profile.id)}>Réessayer</button>
      {/if}
    </div>
  {/if}
```

  with the style

```css
  /* Loading / error, in the open sky under the weekly banner (x 38-62, y 22-27: clear of every
     place and plaque, UI3 Ruling B3). */
  .camp-status {
    position: absolute;
    left: 50%;
    top: 22%;
    transform: translateX(-50%);
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    font-size: 15px;
  }
  .camp-status p {
    margin: 0;
  }
```

- the weekly ribbon moves into the open sky (carry rec. 4): its rule gets `top: 14.5%;` and its comment becomes `/* The weekly ribbon (playability #6, #7), in the open sky under the « Le camp » plaque (carry rec. 4: x 40-65, y 8-18), clear of every place and plaque. */`;
- the path to battle explains itself when locked (carry #16/M9):

```ts
  function explainLocked() {
    if (!camp) return;
    unlockAudio();
    greeting = [dragonSays(camp.dragon, bossLockLine(camp))];
  }
```

  and every `<Hotspot ...>` gets `onLocked={explainLocked}`.

- [ ] **Step 5: Rewrite the hub e2e for six places**

In `web/e2e/scenes-camp.spec.ts`:
- `PLACES` becomes:

```ts
const PLACES: { id: string; path: RegExp; name: RegExp }[] = [
  { id: 'dragon', path: /\/dragon$/, name: /Le nid du dragon/ },
  { id: 'oracle', path: /\/temple$/, name: /Le chemin de Delphes/ },
  { id: 'parchemins', path: /\/tente-parchemins$/, name: /La tente des parchemins/ },
  { id: 'dossier', path: /\/tente-de-guerre$/, name: /La tente de guerre/ },
  { id: 'cabin', path: /\/cabane$/, name: /Ta cabane/ },
];
const ALL = [...PLACES.map((p) => `camp-${p.id}`), 'camp-boss'];
```

- « every place routes to its screen and Back returns to the hub »: its final `toHaveCount(0)` on `camp-boss` becomes:

```ts
  // UI3 Ruling B3: the path to battle is always there, locked until Éris can be fought.
  const boss = page.getByTestId('camp-boss');
  await expect(boss).toHaveAttribute('aria-disabled', 'true');
  await expect(boss.locator('img.hotspot-lock')).toHaveAttribute('src', '/art/icons/lock.webp');
```

- add after it:

```ts
test('the locked path to battle: the dragon says how many tricks remain', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  await page.getByTestId('dialogue-skip').click();
  if (testInfo.project.name === 'ipad') await page.getByTestId('camp-boss').tap();
  else await page.getByTestId('camp-boss').click();
  await expect(page).toHaveURL(/\/camp$/);
  await expect(page.getByTestId('dialogue-text')).toHaveText('Éris se cache encore. Déjoue encore 2 ruses et elle sortira.');
  await page.getByTestId('dialogue-skip').click();
  await page.getByTestId('camp-parchemins').click(); // the guard was never taken
  await expect(page).toHaveURL(/\/tente-parchemins$/);
});
```

- « places and their labels sit inside the visible safe zone and work from the keyboard »: replace the manual box measurement by a loop over `[{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]` doing `await page.setViewportSize(size); await openCamp(page, id); await expectInSafeZone(page, 'camp', ALL); expect(await labelOverlaps(page, 'camp'), \`${size.width}x${size.height}\`).toEqual([]);`; keep the scroll-clip check and the keyboard Enter on `camp-parchemins` (URL `/tente-parchemins`).
- « HUD: laurel, dragon, sound toggle… »: replace `await expect(page.getByTestId('camp-dragon')).toContainText('Un œuf de dragon · Frémit');` by `await expect(page.getByTestId('camp-dragon-layer').locator('img')).toHaveAttribute('src', '/art/dragon/dragon_egg_cut.webp');` (the dragon's activity now lives in the nest).
- « the path to battle appears once Éris can be fought; badges sit on their plaque »: the `camp-dragon` line becomes `await expect(page.getByTestId('camp-dragon-layer').locator('img')).not.toHaveAttribute('src', /dragon_egg/);`; the badge checks read `camp-oracle-badge` (1 quest: the chimère board quest) against `[data-testid="camp-oracle"] .hotspot-label`, and add `await expect(page.getByTestId('camp-dossier-badge')).toHaveText('2');` (two lieutenants foiled by `readyTheBattle`); add `await expect(page.getByTestId('camp-boss')).not.toHaveAttribute('aria-disabled', 'true');`.
- replace the test « the weekly ribbon and the prophecy never overlap a hotspot or its label » by:

```ts
test('the weekly banner hangs in the open sky, clear of every place and plaque', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await page.goto(`/#/p/${id}/camp?debug`);
    await expectCamp(page);
    await expect(page.getByTestId('camp-weekly')).toBeVisible();
    const { art, weekly, hotspots } = await page.evaluate(() => {
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      return {
        art: rect(document.querySelector('[data-testid="scene-camp"] .art')!),
        weekly: rect(document.querySelector('[data-testid="camp-weekly"]')!),
        hotspots: Array.from(document.querySelectorAll('button.hotspot[data-testid^="camp-"]')).map((el) => ({
          testId: el.getAttribute('data-testid'),
          box: rect(el),
          labelBox: rect(el.querySelector('.hotspot-label')!),
        })),
      };
    });
    const at = `${size.width}x${size.height}`;
    expect((weekly.x - art.x) / art.width, `banner left at ${at}`).toBeGreaterThanOrEqual(0.36);
    expect((weekly.x + weekly.width - art.x) / art.width, `banner right at ${at}`).toBeLessThanOrEqual(0.67);
    expect((weekly.y + weekly.height - art.y) / art.height, `banner bottom at ${at}`).toBeLessThanOrEqual(0.2);
    for (const h of hotspots) {
      expect(boxesIntersect(weekly, h.box), `banner vs ${h.testId} at ${at}`).toBe(false);
      expect(boxesIntersect(weekly, h.labelBox), `banner vs ${h.testId}'s label at ${at}`).toBe(false);
    }
  }
});
```

- delete the test « a long prophecy title never pushes « Réviser » out of view » and the now unused `onlyOwnProphecy` helper (the card lives on Delphi's altar: its test moves to `scenes-delphi.spec.ts` below).
- import `expectInSafeZone`, `labelOverlaps` from `./helpers`.

Append to `web/e2e/scenes-delphi.spec.ts`:

```ts
test('a long prophecy title never pushes « Réviser » off the altar', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  // The server's own maximum title length (server/app/schemas.py: max_length=120).
  const longTitle = `${testInfo.project.name} ${'Prophétie ancienne des mers et des montagnes lointaines '.repeat(3)}`.slice(0, 120);
  const text = await createText(request, { title: longTitle, body: BODY, level: '10H', due_date: '2099-01-01' });
  await onlyOwnProphecy(page, text.id);
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(size);
    await page.goto(`/#/p/${id}/temple?debug`);
    await expectScene(page, 'delphi');
    await expect(page.getByTestId('delphi-prophecy')).toContainText(longTitle);
    const b = await measureBoxes(page, { card: '[data-testid="delphi-prophecy"]', button: '[data-testid="delphi-prophecy"] button' });
    const at = `${size.width}x${size.height}`;
    expect(b.button!.y, `Réviser top in the card at ${at}`).toBeGreaterThanOrEqual(b.card!.y);
    expect(b.button!.y + b.button!.height, `Réviser bottom in the card at ${at}`).toBeLessThanOrEqual(b.card!.y + b.card!.height + 0.5);
    expect(b.button!.y + b.button!.height, `Réviser on screen at ${at}`).toBeLessThanOrEqual(size.height);
  }
});
```

- [ ] **Step 6: Migrate the world spec**

`web/e2e/world.spec.ts`:
- step 1: `await expect(page.getByTestId('camp-dragon')).toContainText('Un œuf de dragon');` → `await expect(page.getByTestId('camp-dragon-layer').locator('img')).toHaveAttribute('src', '/art/dragon/dragon_egg_cut.webp');`
- step 3: `await page.getByTestId('camp-quests').click();` → `await page.getByTestId('camp-oracle').click(); await expectScene(page, 'delphi'); await page.getByTestId('delphi-tablets').click();`
- step 6: `await expect(page.getByTestId('camp-dragon')).toContainText('Braise');` → `await expect(page.getByTestId('camp-dragon-layer').locator('img')).toHaveAttribute('alt', 'Braise');`
- step 7: `await expect(page.getByTestId('camp-boss')).toContainText("Sandales d'Hermès");` stays (it is news); nothing else changes.

- [ ] **Step 7: Verify**

Run: `scripts/npm.sh run test` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `scripts/playwright.sh scenes-` — Expected: every `scenes-*` spec passes on both projects. If `expectInSafeZone` or `labelOverlaps` fails at one size, tune `camp.shapes.ts` within ±2 % (never across another place's box), take a `/?debug#/p/<id>/camp` screenshot to confirm each outline still sits on its landmark, and rerun.
Run: `scripts/playwright.sh --project=desktop` — Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/world/scenes/camp.shapes.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/world/scenes/title.ts web/src/screens/Camp.svelte web/e2e/scenes-camp.spec.ts web/e2e/scenes-delphi.spec.ts web/e2e/world.spec.ts
git commit -m "UI3b: the hub on hub_camp.webp - six pinned places, news captions, one glow, the locked path to battle

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/lib/world/scenes/camp.shapes.ts web/src/lib/world/scenes/camp.ts web/src/lib/world/scenes/camp.test.ts web/src/lib/world/scenes/title.ts web/src/screens/Camp.svelte web/e2e/scenes-camp.spec.ts web/e2e/scenes-delphi.spec.ts web/e2e/world.spec.ts
```

### Task 8: The legacy screens retire (top nav, profile gate) and a parity sweep of every route

**Files:**
- Create: `web/src/screens/screens.test.ts`, `web/e2e/scenes-parity.spec.ts`
- Modify: `web/src/App.svelte`

**Interfaces:**
- Consumes: every place of UI3a/UI3b and their test ids (Parity maps of both plans).
- Produces: `App.svelte` profile-gate states with test ids `gate-loading`, `gate-error`; the invariants of `screens.test.ts` (the screen list, `TopBar` only in Play and Boss, no legacy `screen`/`scene` class in a place).

- [ ] **Step 1: Write the failing invariant test**

`web/src/screens/screens.test.ts`:

```ts
// UI3 end state (spec §3, carry rec. 8, UI3 Ruling B7): every screen is a place scene except the two
// battle screens UI4 restages; the legacy top nav survives only there; no place uses the legacy
// `.screen` page or `.scene` banner classes.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.svelte')) out.push(p);
  }
  return out;
}

const LEGACY_CLASS = /class="(?:[^"]*\s)?(?:screen|scene)(?:\s[^"]*)?"/;

describe('UI3: the places replaced the screens', () => {
  it('keeps exactly the place scenes and the two battle screens', () => {
    expect(readdirSync('src/screens').filter((f) => f.endsWith('.svelte')).sort()).toEqual([
      'Boss.svelte',
      'CabinRoom.svelte',
      'Camp.svelte',
      'Delphi.svelte',
      'LibraryTent.svelte',
      'Nest.svelte',
      'Play.svelte',
      'Title.svelte',
      'WarTent.svelte',
    ]);
  });

  it('keeps the legacy top nav only on Play and Boss', () => {
    const users = walk('src').filter((f) => /import TopBar from/.test(readFileSync(f, 'utf-8')));
    expect(users.map((f) => basename(f)).sort()).toEqual(['Boss.svelte', 'Play.svelte']);
  });

  it('uses no legacy .screen / .scene class in a place', () => {
    const places = [...walk('src/components/places'), ...walk('src/screens').filter((f) => !/(Boss|Play)\.svelte$/.test(f))];
    for (const f of places) expect(readFileSync(f, 'utf-8'), f).not.toMatch(LEGACY_CLASS);
  });

  it('shows the profile gate on the night backdrop, not on a legacy page', () => {
    const app = readFileSync('src/App.svelte', 'utf-8');
    expect(app).not.toMatch(LEGACY_CLASS);
    expect(app).toContain('data-testid="gate-loading"');
    expect(app).toContain('data-testid="gate-error"');
  });
});
```

Run: `scripts/npm.sh run test -- src/screens/screens.test.ts` — Expected: the first three PASS (Tasks 2–7 removed every other screen); the fourth FAILS (`App.svelte` still wraps the gate states in `<div class="screen">`). If one of the first three fails, a move of an earlier task left something behind: fix it here.

- [ ] **Step 2: The profile gate on the night backdrop**

In `web/src/App.svelte` import `href` from `./lib/routes` and replace

```svelte
    {#if gateLoading && !gateProfile}
      <div class="screen"><p class="muted">Les Muses cherchent ce héros…</p></div>
    {:else if gateError}
      <div class="screen"><p class="orange">Impossible de charger ce héros : {gateError}</p></div>
```

with

```svelte
    {#if gateLoading && !gateProfile}
      <div class="gate-night"><p class="kit-banner" data-testid="gate-loading">Les Muses cherchent ce héros…</p></div>
    {:else if gateError}
      <div class="gate-night">
        <p class="kit-banner" data-testid="gate-error">Impossible de charger ce héros : {gateError}</p>
        <a class="kit-bronze" href={href('profiles')}>Changer de héros</a>
      </div>
```

and add to its `<style>`:

```css
  /* UI3 Ruling B7: the profile gate's states on the night stage colour, never a white page. */
  .gate-night {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
    background: var(--night);
  }
```

Run: `scripts/npm.sh run test -- src/screens/screens.test.ts` — Expected: PASS.

- [ ] **Step 3: The parity sweep (both projects)**

`web/e2e/scenes-parity.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { createProfileApi, redScan, waitForSceneSettled } from './helpers';

// UI3 feature-parity gate (scenes spec §3 "feature parity is a review gate", §2.3 "every scene and
// overlay has a route"): every route of the app, opened by deep link, shows its place, its overlay
// and a control that proves the legacy feature is there. desktop + ipad.

interface Row {
  hash: string;
  scene?: string;
  overlay?: string;
  testId?: string;
  label?: string;
  heading?: string;
  url?: RegExp;
}

const ROWS: Row[] = [
  { hash: '#/', scene: 'title', testId: 'title-gate' },
  { hash: '#/?panel=tous', scene: 'title', overlay: 'overlay-heroes' },
  { hash: '#/profiles/new', scene: 'title', overlay: 'overlay-hero-new', label: 'Ton prénom' },
  { hash: '#/p/{id}/camp', scene: 'camp', testId: 'camp-parchemins' },
  { hash: '#/p/{id}/camp?panel=heros', scene: 'cabin', overlay: 'overlay-heros', testId: 'hero-switch', url: /\/cabane\?panel=heros$/ },
  { hash: '#/p/{id}/tente-parchemins', scene: 'library', testId: 'library-shelves' },
  { hash: '#/p/{id}/parchemins', scene: 'library', overlay: 'overlay-shelves', testId: 'text-card' },
  { hash: '#/p/{id}/texts/new', scene: 'library', overlay: 'overlay-desk', label: 'Titre' },
  { hash: '#/p/{id}/texts/scan', scene: 'library', overlay: 'overlay-lens', testId: 'btn-scan-read' },
  { hash: '#/p/{id}/alexandria', scene: 'library', overlay: 'overlay-portal', testId: 'work-card' },
  { hash: '#/p/{id}/alexandria/{work}', scene: 'library', overlay: 'overlay-portal-work', testId: 'btn-refresh-work' },
  { hash: '#/p/{id}/temple', scene: 'delphi', testId: 'delphi-pythia' },
  { hash: '#/p/{id}/delphes', scene: 'delphi', overlay: 'overlay-pythia', testId: 'oracle-reward' },
  { hash: '#/p/{id}/quetes', scene: 'delphi', overlay: 'overlay-tablets', testId: 'board-boss' },
  { hash: '#/p/{id}/tente-de-guerre', scene: 'war', testId: 'war-hydre' },
  { hash: '#/p/{id}/dossier', scene: 'war', overlay: 'overlay-dossier', testId: 'dossier-small-tricks' },
  { hash: '#/p/{id}/bestiaire', scene: 'war', overlay: 'overlay-codex', testId: 'bestiary-card-hydre' },
  { hash: '#/p/{id}/bestiaire/argus', scene: 'war', overlay: 'overlay-codex-page', heading: 'Le mythe' },
  { hash: '#/p/{id}/monstres/hydre', scene: 'war', overlay: 'overlay-portrait', testId: 'lieutenant-quest' },
  { hash: '#/p/{id}/dragon', scene: 'nest', testId: 'dragon-stage' },
  { hash: '#/p/{id}/dragon?panel=soin', scene: 'nest', overlay: 'overlay-care', testId: 'dragon-tint-bronze' },
  { hash: '#/p/{id}/cabane', scene: 'cabin', testId: 'cabin-trophies' },
  { hash: '#/p/{id}/cabane?panel=tresors', scene: 'cabin', overlay: 'overlay-trophies', testId: 'cabin-reward-egide' },
  { hash: '#/p/{id}/cabane?panel=heros', scene: 'cabin', overlay: 'overlay-heros', testId: 'hero-journal' },
  { hash: '#/p/{id}/stats', scene: 'cabin', overlay: 'overlay-journal', heading: 'Totaux' },
  { hash: '#/p/{id}/settings', scene: 'cabin', overlay: 'overlay-lyre', label: 'Ton niveau' },
  { hash: '#/p/{id}/eris', testId: 'topbar-camp' },
  { hash: '#/p/{id}/play/{text}', testId: 'pace-option-1' },
];

test('every route opens its place, its overlay and its legacy feature', async ({ page, request }, testInfo) => {
  test.setTimeout(240_000);
  const id = await createProfileApi(request, `Parite-${testInfo.project.name}-${Date.now() % 1e6}`);
  const work = ((await (await request.get('/api/alexandria/works')).json()) as { id: string }[])[0].id;
  const text = ((await (await request.get('/api/texts')).json()) as { id: number }[])[0].id;
  for (const row of ROWS) {
    const hash = row.hash.replace('{id}', String(id)).replace('{work}', work).replace('{text}', String(text));
    await page.goto(`/${hash}`);
    if (row.scene) {
      await expect(page.getByTestId(`scene-${row.scene}`), hash).toBeVisible();
      await waitForSceneSettled(page);
    }
    if (row.url) await expect(page, hash).toHaveURL(row.url);
    if (row.overlay) await expect(page.getByTestId(row.overlay), hash).toBeVisible();
    if (row.testId) await expect(page.getByTestId(row.testId).first(), hash).toBeVisible();
    if (row.label) await expect(page.getByLabel(row.label).first(), hash).toBeVisible();
    if (row.heading) await expect(page.getByRole('heading', { name: row.heading }).first(), hash).toBeVisible();
    expect(await redScan(page), hash).toEqual([]);
  }
});
```

- [ ] **Step 4: Verify**

Run: `scripts/npm.sh run test` and `scripts/npm.sh run check` — Expected: all pass, `0 errors and 0 warnings`.
Run: `scripts/playwright.sh scenes-parity` — Expected: 1 test × 2 projects passes (28 routes each).

- [ ] **Step 5: Commit**

```bash
git add web/src/screens/screens.test.ts web/e2e/scenes-parity.spec.ts web/src/App.svelte
git commit -m "UI3b: the legacy screens retire - top nav only on Play/Boss, profile gate on the night backdrop, parity sweep of every route

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/src/screens/screens.test.ts web/e2e/scenes-parity.spec.ts web/src/App.svelte
```

### Task 9: The complete UI3 review walk (iPad screenshots in `docs/reviews/ui3/`) and the full gate

**Files:**
- Modify: `web/e2e/playability-ui3.spec.ts`
- Create (generated): `docs/reviews/ui3/*.png` (every UI3a shot is regenerated too)

**Interfaces:**
- Consumes: UI3a Task 13 (`Walk`, `shot`, `noRed`, `skipGreeting`, `titleSection`, `librarySection`, `delphiSection`, `SECTIONS`, `DEBUG_SHOTS`), every place's test ids, `createProfileApi`, `makeResult`, `postSession`, `createText` (`web/e2e/helpers.ts`).
- Produces: the finished walk — sections `title`, `hub`, `library`, `delphi`, `war`, `nest`, `cabin`, `wide`; `?debug` shots of all seven scenes; `ipad-portrait-a01-rotate-screen.png`.

- [ ] **Step 1: Add the four UI3b sections and the two viewport shots**

In `web/e2e/playability-ui3.spec.ts` add `closeOverlay` (already imported), `createProfileApi`, `makeResult`, `postSession` to the import from `./helpers`, then add these functions above `SECTIONS`:

```ts
async function hubSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await shot(w, 'b01-hub-fresh');
  await noRed(w, 'hub');
  // Carry #16 / M9: the locked path to battle, explained by the dragon.
  await page.getByTestId('camp-boss').click();
  await expect(page.getByTestId('dialogue-text')).toContainText('Éris se cache encore');
  await shot(w, 'b02-hub-locked-battle-path');
  await skipGreeting(w);
  // A lived-in camp: two lieutenants foiled over three days, a quest on the board, a prophecy.
  const text = await createText(page.request, {
    title: `Veillée ${w.project}`,
    body: 'Les héros reviennent au camp. Ils racontent leurs voyages et les Muses les écoutent.',
    level: '10H',
  });
  for (const day of ['2026-08-03', '2026-08-04', '2026-08-05']) {
    for (const category of ['agreement:verb', 'homophone']) {
      await postSession(page.request, { profileId: w.profileId, textId: text.id, day, result: makeResult({ draft: 4, caught: 4, category }) });
    }
  }
  await page.request.post(`/api/profiles/${w.profileId}/quests`, { data: { target: 'chimere' } });
  await page.reload();
  await expectCamp(page);
  await skipGreeting(w);
  await shot(w, 'b03-hub-lived-in');
  await noRed(w, 'hub lived-in');
}

async function warSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await page.getByTestId('camp-dossier').click();
  await expectScene(page, 'war');
  await shot(w, 'b04-war-tent');
  await noRed(w, 'war tent');
  await page.getByTestId('war-hydre').click();
  await expect(page.getByTestId('overlay-portrait')).toBeVisible();
  await shot(w, 'b05-war-portrait-hydre');
  await closeOverlay(page);
  await page.getByTestId('war-dossier').click();
  await expect(page.getByTestId('overlay-dossier')).toBeVisible();
  await shot(w, 'b06-war-dossier', 1500);
  await noRed(w, 'dossier');
  await closeOverlay(page);
  await page.getByTestId('war-bestiary').click();
  await expect(page.getByTestId('overlay-codex')).toBeVisible();
  await shot(w, 'b07-war-codex');
  await page.getByTestId('bestiary-card-hydre').click();
  await expect(page.getByTestId('overlay-codex-page')).toBeVisible();
  await shot(w, 'b08-war-codex-page');
  await closeOverlay(page);
  await closeOverlay(page);
  // Carry #16 / M9 again: a lieutenant asleep at a 7H hero's level.
  const young = await createProfileApi(page.request, `${w.heroName}-7H`, '7H');
  await page.goto(`/#/p/${young}/tente-de-guerre`);
  await expectScene(page, 'war');
  await page.getByTestId('war-protee').click();
  await expect(page.getByTestId('dialogue-text')).toContainText('Protée dort encore');
  await shot(w, 'b09-war-sleeping-lieutenant');
}

async function nestSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await page.getByTestId('camp-dragon').click();
  await expectScene(page, 'nest');
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await shot(w, 'b10-nest-greeting');
  await skipGreeting(w);
  await shot(w, 'b11-nest');
  await noRed(w, 'nest');
  await page.getByTestId('nest-dragon').click();
  await expect(page.getByTestId('overlay-care')).toBeVisible();
  await shot(w, 'b12-nest-care');
  await closeOverlay(page);
}

async function cabinSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await page.getByTestId('camp-cabin').click();
  await expectScene(page, 'cabin');
  await shot(w, 'b13-cabin');
  await noRed(w, 'cabin');
  await page.getByTestId('cabin-trophies').click();
  await expect(page.getByTestId('overlay-trophies')).toBeVisible();
  await shot(w, 'b14-cabin-trophies', 1200);
  await closeOverlay(page);
  await page.getByTestId('cabin-journal').click();
  await expect(page.getByTestId('overlay-journal')).toBeVisible();
  await shot(w, 'b15-cabin-journal');
  await closeOverlay(page);
  await page.getByTestId('cabin-lyre').click();
  await expect(page.getByTestId('overlay-lyre')).toBeVisible();
  await shot(w, 'b16-cabin-lyre');
  await noRed(w, 'settings');
  await closeOverlay(page);
  // Carry #4: the HUD's hero chip opens the hero panel in the cabin, from any place.
  await page.goto(`/#/p/${w.profileId}/temple`);
  await expectScene(page, 'delphi');
  await skipGreeting(w);
  await page.getByTestId('hud-hero').click();
  await expect(page.getByTestId('overlay-heros')).toBeVisible();
  await shot(w, 'b17-cabin-hero-panel');
  await closeOverlay(page);
}

async function wideSection(w: Walk) {
  const { page } = w;
  for (const [size, name] of [
    [{ width: 1440, height: 900 }, 'b18-laptop-1440x900'],
    [{ width: 2560, height: 1080 }, 'b19-ultrawide-2560x1080'],
  ] as const) {
    await page.setViewportSize(size);
    await page.goto(`/#/p/${w.profileId}/camp`);
    await expectCamp(page);
    await skipGreeting(w);
    await shot(w, name);
  }
  await page.setViewportSize({ width: 1180, height: 820 });
}
```

and replace the `SECTIONS` and `DEBUG_SHOTS` constants by:

```ts
const SECTIONS: { name: string; run: (w: Walk) => Promise<void> }[] = [
  { name: 'title', run: titleSection },
  { name: 'hub', run: hubSection },
  { name: 'library', run: librarySection },
  { name: 'delphi', run: delphiSection },
  { name: 'war', run: warSection },
  { name: 'nest', run: nestSection },
  { name: 'cabin', run: cabinSection },
  { name: 'wide', run: wideSection },
];

const DEBUG_SHOTS: { hash: string; sceneId: string; name: string }[] = [
  { hash: '/', sceneId: 'title', name: 'd01-debug-title' },
  { hash: '/p/{id}/tente-parchemins', sceneId: 'library', name: 'd02-debug-library' },
  { hash: '/p/{id}/temple', sceneId: 'delphi', name: 'd03-debug-delphi' },
  { hash: '/p/{id}/camp', sceneId: 'camp', name: 'd04-debug-hub' },
  { hash: '/p/{id}/tente-de-guerre', sceneId: 'war', name: 'd05-debug-war-tent' },
  { hash: '/p/{id}/dragon', sceneId: 'nest', name: 'd06-debug-nest' },
  { hash: '/p/{id}/cabane', sceneId: 'cabin', name: 'd07-debug-cabin' },
];
```

Update the file's header comment: `UI3a: title, library tent, Delphi. UI3b: hub, war tent, nest, cabin, wide viewports.`

- [ ] **Step 2: Run the walk**

Run: `scripts/playwright.sh --config playwright.playability.config.ts playability-ui3`
Expected: 2 passed; `docs/reviews/ui3/` holds `ipad-landscape-a01…a16`, `b01…b19`, `d01…d07` and `ipad-portrait-a01-rotate-screen.png`; the console notes list no `RED at` line and a single request origin. Delete any stale PNG in `docs/reviews/ui3/` that the walk no longer writes.

- [ ] **Step 3: Look at every screenshot**

Open each PNG (the Read tool shows images) with the review's question in mind: "does anything still look like a school form?". Check that every `?debug` outline sits on its landmark (hub: nest, temple and stairs, striped tent, red tent, archway, cabin; war tent: six sheets, table, lectern; nest: straw bed; cabin: shelf, journal, lamp and lyre); that no plaque floats over sky or sea or overlaps another; that the weekly banner hangs in the sky; that the dragon sits in the painted nest; that the two locked places read as locked (lock icon, greyed glow) and their lines explain why. Fix what you find in the owning file (`*.shapes.ts` within ±2 %, CSS), rerun the walk, and list in your report what you checked and anything left for the Opus playability review.

- [ ] **Step 4: The full gate**

Run: `scripts/check.sh`
Expected: ends with `== ALL GREEN` — pytest; svelte-check `0 errors and 0 warnings`; vitest (incl. `noEmoji.test.ts`, `screens.test.ts`, scene budgets); docker build; Playwright `desktop` (every functional spec) and `ipad` (every `scenes-*` spec: title, camp, debug, library, delphi, war, nest, cabin, parity).

- [ ] **Step 5: Commit**

```bash
git add web/e2e/playability-ui3.spec.ts docs/reviews/ui3
git commit -m "UI3b: complete UI3 review walk - iPad screenshots of every place, overlay and locked place, ?debug shots of all seven scenes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- web/e2e/playability-ui3.spec.ts docs/reviews/ui3
```

---

## Self-review (UI3b)

- **Spec coverage.** §3 War tent (portraits → page, map table → Éris's file, codex → bestiary): Tasks 2–3. Dragon's nest (dragon at its stage, growth): Task 4. Cabin (trophy shelf, journal = stats, lamp & lyre = settings incl. the sound switch; sliders are UI5 per A17): Tasks 5–6. Hub (six places, weekly banner, dragon greets): Task 7. Feature parity: Parity map + `scenes-parity.spec.ts` (Task 8), and each legacy screen's content moved unchanged (A3). §2.3 routes: B1 adds one route, removes none; `camp?panel=heros` kept as a hand-over. §4 shapes by hand + `?debug`: every scene task (`validateScene`, `expectInSafeZone`, `labelOverlaps`, debug outline counts) and the walk's seven debug shots. §10: per-scene e2e on both projects, portrait rotate, no red, the walk's iPad screenshots, `scripts/check.sh`. Carry items: table at the top (hero panel #4 → Task 6; #12 → plaques of Tasks 2/4/5 and the cabin's own art; #16 → Tasks 2, 7, 9; #17 and rec. 1–8 → Tasks 7–8).
- **Placeholder scan.** Every step carries its code or its exact edit; the only discretionary numbers are hotspot shapes, bounded to ±2 % and checked by named tests and `?debug` shots.
- **Type consistency.** `PlaceId`/`PanelId` additions (Task 1) are exactly the values `WarTent`, `Nest`, `CabinRoom` switch on (`portrait`, `dossier`, `codex`, `page`, `soin`, `tresors`, `journal`, `lyre`, `heros`). `SceneId` `war`/`nest`/`cabin` match the scene ids and the `scene-*` test ids. `dragonSays`/`dragonSpeaker` (Task 1) are used with a `DragonOut` in Tasks 2, 4, 7. `nestDragonLayer`/`campDragonLayer` return `Omit<SceneLayerDef, 'id' | 'src' | 'alt'>` and are spread into a `SceneLayerDef`. `heroPanelHref` changes once (Task 6) and `PlaceScene`/`Camp` call it unchanged. `dragonCaption` and `treasureCaption` stay exported by `camp.ts` (Task 7) for `nest.ts` and `cabin.ts`.
