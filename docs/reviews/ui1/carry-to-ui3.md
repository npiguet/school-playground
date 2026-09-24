# UI1 review findings carried to UI3

These are the UI1 review findings (from `playability.md` and the final code review) that belong to
later milestones. The UI3 plan must pick up each one. Everything else was fixed in the UI1 fix wave
(see `.superpowers/sdd/2026-09-24-ui1-foundation-camp-hub/fix-wave-report.md`).

- **Playability #4 (second half): move the hero panel into the cabin scene.** Spec §3 puts settings
  (lamp and lyre), the journal (stats) and the trophy shelf in the Cabin scene, which UI3 builds. UI1
  restyled the panel as three bronze medallions. Keep it as a shortcut from the HUD.
- **Playability #12 (second half): make each destination's title echo its hub label.** Examples:
  « La tente des parchemins » vs « Les Parchemins », « La tente de guerre » vs « Le dossier d'Éris ».
  Also, the Cabin banner shows the camp fire, not a cabin. Those titles and banners belong to the
  legacy screens that UI3/UI4 replace with Library, Delphi, War-tent and Cabin scenes. Renaming them
  now would churn dozens of e2e selectors on screens about to be deleted. UI1 did add the fade
  through night on every hub exit and « ← Retour au camp » in the legacy nav.
- **Playability #13 (scroll title): rename the « Ce qui arrive à l'école » oracle scroll.** The title
  comes from server content (`server/app/world/oracle.py`), and the scenes spec keeps the server
  unchanged. The Delphi scene (UI3) should label it client-side, e.g. « Ce que prépare ta classe ».
  UI1 already fixed the contrast of the reward line and the Oracle screen's « dictée … jour(s) »
  wording.
- **Playability #17: labels float over the sky and sea.** This comes from the placeholder
  `camp.webp`, whose buildings don't match the places. With the real `hub_camp.webp`, anchor each
  label to its landmark with a short leader line or pin, and re-map the places to the landmarks in
  `docs/art/scenes.md`.
- **Playability #16 / final review M9 (locked-place step): add a walk and e2e step for a locked
  place.** No camp place has a locked state in UI1. All places are always open, and the battle path
  is hidden rather than locked until Éris can be fought. The walk and e2e can't reach
  `Hotspot`'s locked branch until a scene defines a locked place. Add the step together with the
  first locked hotspot, e.g. the Alexandria portal in the Library scene.
- **Playability recommendations for UI3 (real hub art), 1–9:**
  - Re-map places to `hub_camp.webp`'s landmarks.
  - Drop the bestiary and quest-board hotspots, and move their badges onto the war tent and Delphi
    plaques (six places, not eight).
  - Clip the edge landmarks and keep the label clamp.
  - Put the weekly banner in the open sky (x 40–65, y 8–18).
  - Show captions only for the 2–3 places with news.
  - Give exactly one "next step" glow.
  - Seat the dragon cut-out in the painted nest (≈ 17, 50) and use the same crop for its portrait.
  - Replace the hub exits with scene transitions and retire the old top nav.
  - Preload Library and Delphi from the hub.

  All of these depend on the UI3 art and scenes.
