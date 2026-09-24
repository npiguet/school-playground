# La Discorde — Scenes UI redesign (design spec)

Date: 2026-09-24. Branch: `scenes` (from `grimoire`). Parent spec: `2026-09-23-la-discorde-design.md`.
Approved by the user in conversation; the user waived the written-spec review.

## 1. Goal

Today the game reads as "a school application trying to be a little fun": screens are stacks of
cards, buttons and form elements. Target: **a full-screen mobile game with learning elements**.
Menus become painted **scenes with clickable locations** (gacha-hub style) so the player is inside
the world, not in front of forms.

- Primary target: **iPad in landscape**, installed on the home screen (standalone). Secondary:
  laptop browser. Portrait shows a "tourne ton iPad" screen.
- **Mechanics, pedagogy, API, server: unchanged.** The dictation runner, grading, Argus, Fil,
  corrupt engine, XP, mastery, quests, bosses, dragon rules all stay as they are. This is a
  presentation rewrite of `web/src/screens` + `web/src/components` plus new art, audio and dialogue.
- Ethical guardrails from the parent spec still hold (nothing lost, no streaks, no FOMO, no
  shaming). Éris's taunts target the camp's heroes in-fiction, never the player's ability.

## 2. Decisions

1. **Approach A**: keep Svelte 5 + TS + Vite. Scenes are layered DOM (full-bleed WebP background,
   positioned cut-out layers, hotspot buttons) + CSS/Svelte transitions + **GSAP** for cinematic
   moments + a small **canvas FX layer** for particles. **Howler.js** for audio. No WebGL engine.
   New npm deps allowed: `gsap`, `howler` (+ types). Any other dep needs a ledger ruling.
2. **Hub + district scenes**, max two levels deep; secondary content opens as **overlays**
   (in-world objects sliding over the dimmed scene), never as a new form page.
3. **Routing unchanged**: the in-house hash router and all current route names/paths stay; every
   scene and overlay has a route, so Back, reload and deep links keep working. New routes may be
   added (e.g. a title scene) but none removed without a ruling.
4. **Form elements stay real HTML** (inputs, textareas, selects) for iPad keyboard, selection,
   autocorrect-off and accessibility, restyled as semi-transparent parchment / bronze / marble.
   Prefer transparency wherever legibility allows.
5. **Dragon companion is the narrator** in a portrait + dialogue box; the Pythia (Delphi), Athena's
   owl (Library) and Éris (battle) speak in their places. Dialogue is **never spoken by TTS**: the
   voice is reserved for dictation.
6. **Audio: music + SFX + voice channels**, each with an independent volume slider and mute.
7. **Fonts** (self-hosted woff2, OFL, latin + latin-ext subsets, no runtime Google Fonts):
   **Cinzel** (place names, hotspot labels, titles; caps only, never running text),
   **Alegreya** (dialogue, narration, quests, bestiary, UI body), **Literata** (the dictation and
   proofreading text — legibility first, large size, clear é/è/ê, i/l/1, ç).
8. Models for subagents: **no Fable** (user quota). Opus for plans, art direction and reviews;
   Sonnet for most implementation; Haiku for mechanical edits.

## 3. Screen map

| Current screens | New presentation |
|---|---|
| ProfilePicker, ProfileCreate | **Title scene**: camp gates at dusk, Éris's shadow in the sky; heroes are painted shields on the gate; "Entrer" tap (unlocks audio); new hero = short naming ritual overlay |
| Camp | **Hub scene**: hotspots Dragon's nest, Oracle's path (Delphi), Library tent, War tent, Cabin, Path to battle; weekly goal as a banner; dragon greets |
| Library, TextCreate, ScanText, Alexandria, AlexandriaWork | **Library scene**: shelves = her texts (scroll overlay), scribe's desk = write/paste a text, bronze lens = scan, portal = Alexandria (Gutenberg) |
| Oracle, QuestBoard | **Delphi scene**: Pythia on her tripod (focus choice), votive-tablet wall (quests) |
| Dossier, Bestiaire, BestiaireEntry, Lieutenant | **War tent scene**: map table (Éris's file), lieutenants' portraits pinned to the canvas (tap → page), bestiary codex on a lectern |
| DragonScreen | **Dragon's nest scene**: dragon at its stage, growth |
| Cabin, Stats, Settings | **Cabin scene**: trophy shelf (rewards/perks), journal (stats), lamp & lyre (settings incl. audio sliders) |
| Play, Boss | **Battle stage** (section 5) |
| Results | **Victory overlay**: chest/laurel animation, XP rising, dragon reacts, explanations via dialogue + "Revoir" scroll |

Any existing functionality on a screen must remain reachable in its new home (feature parity is a
review gate). PIN gate, onboarding, break nudge, progression reveal, level/pace select keep their
logic and get restyled or re-staged.

## 4. Scene engine

- **Stage**: art is 16:9, rendered `object-fit: cover` full-bleed. All interactive elements live in
  a centred **4:3 safe zone** (landscape iPad crops the sides of 16:9). Laptop shows the full 16:9.
  Portrait (`orientation: portrait` and aspect < 1) → rotate screen. Standalone PWA with
  `apple-mobile-web-app-status-bar-style: black-translucent`; respect safe-area insets.
- **Scene data** (`web/src/lib/world/scenes/*.ts`), typed: background, layers (image, x/y/scale in
  art %, depth for parallax, idle animation preset), hotspots (id, shape as polygon/ellipse in art %,
  label, target route, state: locked | new | badge count, visibility predicate from camp state),
  ambience (particle preset, music track), narrator event keys.
- **Components** (`web/src/components/scene/`): `SceneStage`, `SceneLayer`, `Hotspot` (real
  `<button>`, glow + bob idle, flash on tap, visible label, focusable, test ids), `Overlay`
  (variants: scroll, codex, table), `DialogueBox` (portrait, typewriter, tap to advance/skip),
  `Hud` (slim: hero, XP laurel, dragon mini-portrait, audio quick toggles), `FxCanvas`,
  `SceneTransition`, `RotateScreen`.
- **Parallax**: gentle, on pointer drag / device tilt where permitted; ≤ 3 depth layers.
- **Hotspot debug overlay**: dev aid behind `?debug` — a read-only outline of every visible hotspot
  shape over the scene. Not shipped visibly to players (hidden unless the query flag is present).
  (User decision, 2026-09-24: the interactive `?edit` hotspot editor was dropped; shapes are
  authored by hand as data in `<scene>.shapes.ts` and checked with this overlay.)
- **Motion**: honour `prefers-reduced-motion` (no parallax, no bob, fades only).
- **Performance**: ≤ 600 KB WebP per scene background; preload likely next scenes; scene visible
  < 1 s on LAN. A test/script fails if a scene background exceeds the budget.

## 5. Battle stage (Play, Boss, Grimoire)

Full-screen battle backdrop; opponent (lieutenant / monster / Éris cut-out) on one side reacting
(hit, taunt, defeat), HP bar that drops as errors are caught; dragon on the other side. The
dictation / proofreading text sits on a **semi-transparent parchment** in Literata. When the iPad
keyboard opens (`visualViewport` resize), the layout switches to a compact mode: the scene shrinks
to a band above the parchment and stays visible. All current play mechanics (pace, pause, replay,
help stages, Argus passes, Bouclier, Chouette, Fil, word editor) keep working with restyled
controls. Proofreading of long texts must stay comfortable: legibility beats décor.

## 6. Look and feel

- Palette from `docs/art/style-guide.md` (marble white, terracotta, olive, Aegean blue, burnished
  gold) + an Éris palette (bronze, poison purple, green) for her lair and battles.
- UI kit: parchment panels (torn/rolled edges, semi-transparent), bronze embossed buttons, marble
  plaques for scene names, laurel XP bar, gold coins/emblem badges. CSS first; Krea textures where
  CSS can't do it.
- **Art to generate** (Krea 2 Turbo, painterly house style, **native 2048×1152** (Krea prefers
  2–2.5 MP); upscale only if needed): scenes — title (camp gates at dusk), camp hub (recomposed
  with distinct readable locations), dragon's nest, Delphi, library tent, war tent, cabin, Éris's
  lair, 3 battle backdrops (river, rocky coast, ruined temple). Cut-outs (inked clean style, C2_am4
  cutout): Pythia, Athena's owl, props (votive tablets, codex on lectern, trophy shelf). Reuse
  existing cut-outs; dragon dialogue portraits are crops of the stage cut-outs. Generation only
  when Forge is idle (the GPU is shared with the user).

## 7. Audio

- Howler.js; channels **music**, **sfx**, **voice** (TTS). Independent volume + mute each, in the
  Cabin (lamp & lyre) and as quick toggles in the HUD; stored **per profile** (server settings).
  Voice volume where the browser honours it (iPad may only honour mute).
- Music: quiet ambient loop per scene (camp fire, temple, sea wind, Éris's lair) + a battle loop;
  **ducked** while TTS speaks and during proofreading. SFX short, never overlapping the voice.
- Audio unlocks on the title scene's "Entrer" tap (iOS rule).
- Sources **CC0 only** (Kenney, OpenGameArt CC0, etc.), AAC/m4a for iPad; ~8 MB music total;
  every file credited in `ASSETS-LICENSES.md`. The existing `juice/sfx.ts` / `soundStore` are
  replaced or extended, not duplicated.

## 8. Dialogue

- Lines in `content/dialogue/*.json` (French), keyed by event: scene enter, first visit, quest
  ready, weekly goal reached, battle start, error caught, error missed, victory, retry, etc.
  Several variants per event, no immediate repeat. Speakers: dragon (stage-aware portrait), Pythia,
  owl, Éris.
- **First-visit guided tours** replace instruction paragraphs; skippable; seen-flags per profile.
- After a battle the dragon delivers the existing explanation text; "Revoir" opens the full review
  scroll. Dialogue is not TTS'd.

## 9. Milestones

1. **UI1 Foundation + Camp hub**: fonts, UI kit, scene components, stage/safe-zone, rotate screen,
   hotspot debug overlay (was: hotspot editor, see §4), HUD, dialogue box (static lines ok), Camp as hub scene on placeholder or existing
   art. Other screens untouched but reachable.
2. **UI2 Art** (parallel with UI1, art files only): all scenes and cut-outs of §6, hotspot-friendly
   compositions, style-guide update.
3. **UI3 Places**: Title, Library, Delphi, War tent, Dragon's nest, Cabin scenes + overlays with
   full feature parity.
4. **UI4 Battle stage**: Play/Boss/Grimoire staging, keyboard compact mode, victory overlay.
5. **UI5 Audio + dialogue**: audio sourcing and channels, dialogue content, guided first visits,
   Éris taunts.

## 10. Quality gates

- `scripts/check.sh` ALL GREEN after every milestone (pytest, svelte-check, vitest, docker build,
  Playwright). Logic tests unchanged unless a ruling says otherwise.
- E2E in **WebKit at iPad landscape 1180×820** (plus the existing desktop project): every hotspot
  and overlay reachable, Back works, battle compact layout with a simulated keyboard (reduced
  viewport height), portrait rotate screen, reduced motion.
- Scene weight budget check.
- After each milestone: **Opus code review** and **Opus playability/immersion review** from iPad-size
  screenshots with the question "does anything still look like a school form?"; findings fixed
  before the next milestone.
