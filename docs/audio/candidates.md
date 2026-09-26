# UI5 Task 3a — audio candidates

CC0 only (Ruling E17). Every entry below was opened on its source page and its licence quoted from
that page at the date given; freesound entries link the public HQ preview file (`-hq.mp3`), never a
logged-in original (Ruling E17's default). Durations are the source's own duration (as measured by
its page, or by `tools/audio/run_docker.sh measure` on the downloaded file — noted per row). All
dates read: 2026-09-26.

This is the **Task 3a checkpoint**: candidates only, nothing built. The controller/user pick one
candidate per slot (or ask for something else); Task 3b then writes `tools/audio/sources.json` for
the picks, trims/crossfades/normalises them, and builds the fourteen `.m4a` files.

Kenney's own `License.txt` (quoted once here, identical in every Kenney zip used below) reads:

> License: (Creative Commons Zero, CC0)
> http://creativecommons.org/publicdomain/zero/1.0/
> This content is free to use in personal, educational and commercial projects.

Freesound's CC0 badge links the same deed and every page quoted below shows:

> You can copy, modify, distribute and perform the sound, even for commercial purposes, all without
> the need of asking permission to the author.
> http://creativecommons.org/publicdomain/zero/1.0/

Kenney's pack pages describe the pack, not each individual file inside it; where a Kenney file is
listed below, its "sounds like" line is built from the file's own name (the only per-file label
Kenney gives it) and the pack's tags, not from a page's prose the way a freesound/OpenGameArt entry
has one.

## Music (five loops, target 45–90 s once trimmed, ≤ 2 MiB each, ≤ 8 MiB total, −18 LUFS, stereo)

### music/sea — "sea wind at dusk by the gates: soft surf far below, wind, no gulls crying, no voice"

| # | Title | Author | Source | Licence quote (page, read 2026-09-26) | Duration | Format | Excerpt | Fits because |
|---|---|---|---|---|---|---|---|---|
| 1 | Ambience Sea and Waves .wav | Fester993 | [freesound.org/.../564437](https://freesound.org/people/Fester993/sounds/564437/) → [HQ preview](https://cdn.freesound.org/previews/564/564437_5456250-hq.mp3) | "You can copy, modify, distribute and perform the sound... without the need of asking permission" (CC0 deed linked) | 202.42 s (page) | WAV 48 kHz/24-bit stereo (hq preview: mp3) | start 30 s, dur 60 s | Page: "A Simple sea Ambience, with waves gently crashing on the sand, recorded in Ostia (Italy) during nightime." No gulls, no voice mentioned; night matches "dusk". |
| 2 | CFX-20130331-UK-DorsetSeaCliff07.wav | Carlvus | [freesound.org/.../182608](https://freesound.org/people/Carlvus/sounds/182608/) → [HQ preview](https://cdn.freesound.org/previews/182/182608_3244946-hq.mp3) | Same CC0 deed quote, confirmed on page | 152.09 s (page, "2:32.087") | WAV 96 kHz/24-bit stereo | start 20 s, dur 60 s | Titled "Sea Cliff Ambience"; a commenter notes it "have some wind noise". No gulls or voice on the page or in comments. |

Loops: neither is authored as a seamless loop; both get the pipeline's tail→head crossfade (Task 3b).

### music/camp — "a camp fire at night: gentle crackle, crickets, maybe a faint plucked string far away"

| # | Title | Author | Source | Licence quote | Duration | Format | Excerpt | Fits because |
|---|---|---|---|---|---|---|---|---|
| 1 | Fireplace Sound Loop (`fire.wav`) | PagDev | [opengameart.org/content/fireplace-sound-loop](https://opengameart.org/content/fireplace-sound-loop) → [fire.wav](https://opengameart.org/sites/default/files/fire.wav) | "CC0" (page badge, links the CC0 deed) | **29.26 s, −40.6 LUFS, −14.9 dBTP (measured)** | WAV | whole file (too short to trim further) | Page: "Wood-burning fireplace sound effect loop with crackling and popping sounds, suitable for games featuring fire, campfires, or stoves." Authored as a loop already, but shorter than the catalogue's own 30 s floor (`LOOP_MIN_S`) once measured — **does not meet the slot's length on its own**; would need repeating twice before the pipeline's crossfade (a small `process.py` change) or dropping in favour of candidate 2 or 3. Also very quiet (needs a large gain) and has no crickets/strings. |
| 2 | Sounds of the forest night.mp3 | Kingcornz | [freesound.org/.../342369](https://freesound.org/people/Kingcornz/sounds/342369/) → [HQ preview](https://cdn.freesound.org/previews/342/342369_4804147-hq.mp3) | CC0 deed quote confirmed on page | 60.57 s (page) | mp3 (source), hq preview mp3 | start 0, dur 60 s (whole clip) | Page: "Sounds of the night, campfire & crickets ambience" — crackle **and** crickets together, exactly the brief. |
| 3 | campfire in a forest at night.wav | Duophonic | [freesound.org/.../248303](https://freesound.org/people/Duophonic/sounds/248303/) → [HQ preview](https://cdn.freesound.org/previews/248/248303_1001802-hq.mp3) | CC0 deed quote confirmed on page | 141.33 s (page, "2:21.326") | WAV | start 10 s, dur 60 s | Page: "A recording of a small campfire in the forest at night... You can hear wind..." Field recording, no crickets mentioned but wind qualifies as ambience. |

### music/temple — "temple air: wind through columns, a low warm drone or faint chimes, calm"

| # | Title | Author | Source | Licence quote | Duration | Format | Excerpt | Fits because |
|---|---|---|---|---|---|---|---|---|
| 1 | MUSCChim_Atonal Crystal Chime Texture 1_EM | newlocknew | [freesound.org/.../772279](https://freesound.org/people/newlocknew/sounds/772279/) → [HQ preview](https://cdn.freesound.org/previews/772/772279_5828667-hq.mp3) | CC0 deed quote confirmed on page | 71.36 s (page) — already inside the 45–90 s target, no trim needed | wav (source) | start 0, dur 71 s (whole clip) | Page: "Atonal, crystal glass texture, reminiscent of gentle wind chimes." Matches "faint chimes, calm" precisely. |
| 2 | Orbital Temple Sacred Drone by Mantice | bassimat | [freesound.org/.../854867](https://freesound.org/people/bassimat/sounds/854867/) → [HQ preview](https://cdn.freesound.org/previews/854/854867_15636277-hq.mp3) | CC0 deed quote confirmed on page | 300.02 s, −17.9 LUFS, −1.3 dBTP (measured) | WAV | start 60 s, dur 70 s | Page: "A sacred/meditative ambient drone... layers incorporate harmonic overtones, filtered noise... optional granular processing using samples like singing bowls and gongs." "Temple" is in its own title; matches "low warm drone, calm". Already almost exactly at the −18 LUFS music target. |

### music/lair — "Éris's lair: low ominous drone, slow bubbling, faint wind; unsettling, never scary"

| # | Title | Author | Source | Licence quote | Duration | Format | Excerpt | Fits because |
|---|---|---|---|---|---|---|---|---|
| 1 | Textured Low Drone - Loop | kkenny101 | [freesound.org/.../871189](https://freesound.org/people/kkenny101/sounds/871189/) → [HQ preview](https://cdn.freesound.org/previews/871/871189_17997500-hq.mp3) | CC0 deed quote confirmed on page | 46.72 s (page) — already inside 45–90 s, almost no trim | wav (source) | start 0, dur 46 s (whole clip) | Page: "A deep, textured low-frequency drone created from the original source", authored as a loop. Low and unsettling without being a jump-scare drone. |
| 2 | Dark Atmospheric Drone (Time-Stretched, Seamless Loop) | kkenny101 | [freesound.org/.../865550](https://freesound.org/people/kkenny101/sounds/865550/) → [HQ preview](https://cdn.freesound.org/previews/865/865550_17997500-hq.mp3) | CC0 deed quote confirmed on page | 158.36 s (page) | wav (source) | start 30 s, dur 70 s | Page: "A subtle, dark atmospheric drone created from a lightly processed audio source", explicitly a seamless loop. |
| 3 | When the Shadows Gather | Tsorthan Grove | [opengameart.org/content/when-the-shadows-gather](https://opengameart.org/content/when-the-shadows-gather) → [ogg](https://opengameart.org/sites/default/files/when_the_shadows_gather_0.ogg) | "CC0 / Public Domain. No Rights Reserved. Free to use however you like with no attribution required." | 153.60 s, −13.8 LUFS, −0.3 dBTP (measured) | ogg/flac | start 0, dur 70 s | Page: "dark, atmospheric quality with pulsing drone elements creating an unsettling mood... integrates seamlessly into longer scenes as a looping piece." Matches "unsettling, never scary" (no horror stingers described). Hot source (−13.8 LUFS); normalisation will pull it down ~4 dB. |

**Open item for the controller:** none of the three drones above include bubbling. Two short CC0
bubbling textures were found that could be layered underneath in Task 3b — **Bubbling** (mattfinarelli,
[freesound.org/.../533147](https://freesound.org/people/mattfinarelli/sounds/533147/), CC0, 3.25 s,
page: "excellent loop for background effects... like a wizard's cauldron bubbling away") and
**Witches Brew.wav** (opticaillusions, [freesound.org/.../614866](https://freesound.org/people/opticaillusions/sounds/614866/),
CC0, 34.07 s, page: "Bubbling boiling witches brew") — but `tools/audio/process.py` as specified in
the brief takes exactly one source per slot; mixing a drone with a bubbling layer would need a small
addition to `sources.json`/`process.py` in 3b (e.g. a second `layer` field) or the two tracks
pre-mixed by hand before being treated as the slot's one source. Flagging rather than deciding this
for the controller.

### music/battle — "a light rhythmic loop (hand drums, plucked strings), energetic but not aggressive"

| # | Title | Author | Source | Licence quote | Duration | Format | Excerpt | Fits because |
|---|---|---|---|---|---|---|---|---|
| 1 | Krakatoa | Kistol | [opengameart.org/content/krakatoa](https://opengameart.org/content/krakatoa) → [Krakatoa_0.ogg](https://opengameart.org/sites/default/files/Krakatoa_0.ogg) | "Music by Kistol, but credit is not required." (page's CC0 line) | 72.00 s, −15.9 LUFS, −1.3 dBTP (measured) — lands right inside the 45–90 s target, whole file usable | ogg | start 0, dur 72 s (whole clip) | Page: "A seamless looping track featuring tribal percussion with distinct melodic qualities... marimba and percussive elements arranged in a tribal style." Percussive + melodic, explicitly a seamless loop, not aggressive. Already close to the −18 LUFS target. |
| 2 | Jungle Simple Style 1 | Tozan | [opengameart.org/content/jungle-simple-style-1](https://opengameart.org/content/jungle-simple-style-1) → [junglesimplesyle1.ogg](https://opengameart.org/sites/default/files/junglesimplesyle1_0.ogg) | "(CC0) Attribution Optional" | 162.85 s, −34.3 LUFS, −19.4 dBTP (measured) | ogg | start 20 s, dur 70 s | Page: "Two Melodies Vibraphone and Marimba and Strings Ess[e]mble Bassline" — mallet percussion + strings, no voice, calmer than a "boss battle" track. Quiet source, needs a large normalisation gain. |

**Rejected:** *Tribal* (Of Far Different Nature, [opengameart.org/content/tribal](https://opengameart.org/content/tribal),
CC0) — a "chilled tribal track" on bongos, but its tags list voice samples and "hoo" vocal elements;
excluded per the no-voice rule. Also rejected: every OGA "Boss Battle" track found under this search —
all metal/rock, too aggressive for "she writes under it, ducked".

## Sound effects (nine, short, mono, −16 LUFS)

Kenney candidates below were downloaded as the pack zip and measured directly with
`tools/audio/run_docker.sh measure` (no login or extra fetch needed — CC0 confirmed by each pack's
own `License.txt`, quoted at the top of this document).

### sfx/tap (≤ 0.15 s) — "a soft wooden or paper click"

| # | File | Pack | Licence | Measured (this run) | Sounds like (per its name/pack) |
|---|---|---|---|---|---|
| 1 | `click_003.ogg` | Kenney [Interface Sounds](https://kenney.nl/assets/interface-sounds) | CC0 (pack `License.txt`) | 0.01 s, −16.3 LUFS, −1.4 dBTP | One of 100 generic UI "click" sounds in the pack; short and dry. |
| 2 | `click_005.ogg` | Kenney Interface Sounds | CC0 | 0.01 s, −16.4 LUFS, −0.4 dBTP | Same family, alternate take. |
| 3 | `click2.ogg` | Kenney [UI Audio](https://kenney.nl/assets/ui-audio) | CC0 (pack `License.txt`) | 0.06 s, −14.5 LUFS, −1.1 dBTP | UI SFX Set's "click" family; slightly longer/softer than Interface Sounds' clicks. |

### sfx/seal (≤ 0.5 s) — "a wax seal cracking"

| # | Title/File | Source | Licence | Duration | Excerpt | Fits because |
|---|---|---|---|---|---|---|
| 1 | Wax seal | [freesound.org/.../759526](https://freesound.org/people/Cerise_Virtuelle/sounds/759526/) → [HQ preview](https://cdn.freesound.org/previews/759/759526_16331384-hq.mp3), CC0 deed quote confirmed | 1.34 s, −32.5 LUFS, −10.0 dBTP (measured on the hq preview) | start 0, dur 0.45 s | Page, verbatim: "the sound of someone sealing an envelope with a wax seal stamp, created by pressing a metal punch into a blob of Blu Tack on some paper." Exact match to the brief. Quiet source; will need a healthy gain in normalisation. |
| 2 | `impactWood_light_002.ogg` | Kenney [Impact Sounds](https://kenney.nl/assets/impact-sounds), CC0 | 0.27 s, −19.8 LUFS, −1.1 dBTP (measured) | start 0, dur 0.27 s | Fallback only: a crisp light wood impact, not literally a wax seal, but a similarly short, dry crack if candidate 1's character doesn't sit well in the mix. |
| 3 | `impactGlass_light_001.ogg` | Kenney Impact Sounds, CC0 | 0.21 s, −16.9 LUFS, −0.9 dBTP (measured) | start 0, dur 0.21 s | Fallback only: a bright, very short snap. |

### sfx/unroll (≤ 0.8 s) — "parchment unrolling"

| # | Title | Source | Licence | Duration | Excerpt | Fits because |
|---|---|---|---|---|---|---|
| 1 | Parchment - Unroll | [freesound.org/.../753282](https://freesound.org/people/Vrymaa/sounds/753282/) → [HQ preview](https://cdn.freesound.org/previews/753/753282_13973196-hq.mp3), CC0 deed quote confirmed | 23.14 s, −28.8 LUFS, −0.9 dBTP (measured) | start ≈ 2 s, dur 0.7 s (pick the single crispest unroll motion — needs a listening pass to place exactly) | Page, verbatim: "Unrolling an old stiff parchment. This sound is part of a collection that illustrates the careful restoration work carried out in museums when working with ancient objects." Exact match. |
| 2 | Unrolling Scroll.wav | [freesound.org/.../202107](https://freesound.org/people/spookymodem/sounds/202107/) → [HQ preview](https://cdn.freesound.org/previews/202/202107_3756348-hq.mp3), CC0 deed quote confirmed | 3.58 s, −40.3 LUFS, −24.6 dBTP (measured) | start 0, dur 0.8 s | Page: "Unrolling a scroll or spell." Quiet source, needs a healthy gain. |
| 3 | Unrolling parchment paper in a garage | [freesound.org/.../503663](https://freesound.org/people/RavenWolfProds/sounds/503663/) → [HQ preview](https://cdn.freesound.org/previews/503/503663_9619518-hq.mp3), CC0 deed quote confirmed | 16.25 s, −32.5 LUFS, −4.3 dBTP (measured) | start ≈ 3 s, dur 0.8 s | Page: field recording, "Unrolling a roll of parchment paper in a suburban garage." Weaker pick: garage room tone is audible per its own description. |

### sfx/chime (≤ 1.2 s) — "a small bright bell or chime"

| # | Title | Source | Licence | Duration | Excerpt | Fits because |
|---|---|---|---|---|---|---|
| 1 | Little bell | [freesound.org/.../846674](https://freesound.org/people/NikoletB/sounds/846674/) → [HQ preview](https://cdn.freesound.org/previews/846/846674_1856262-hq.mp3), CC0 deed quote confirmed | 6.36 s, −46.1 LUFS, −29.9 dBTP (measured) | start 0, dur 1.2 s | Page: "Small bell with a clear, bright tone and gentle resonance." Very quiet source (a lot of headroom below the true-peak ceiling) — will need a large normalisation gain; worth a listening check for hiss before picking it. |
| 2 | BELLHand_Ringing Small Hand Bell_HvD_OwSFX | [freesound.org/.../767307](https://freesound.org/people/Hano_van_Dalen/sounds/767307/) → [HQ preview](https://cdn.freesound.org/previews/767/767307_15758192-hq.mp3), CC0 deed quote confirmed | 11.36 s, −39.3 LUFS, −16.8 dBTP (measured) | start 0, dur 1.2 s | Page: "Clear, resonant chime of an antique hand bell, short, crisp rings with a warm tone." Also quiet; less extreme than candidate 1. |
| 3 | MAGShim_Sparkling Twinkle Bleep 1_EM | [freesound.org/.../825544](https://freesound.org/people/newlocknew/sounds/825544/) → [HQ preview](https://cdn.freesound.org/previews/825/825544_5828667-hq.mp3), CC0 deed quote confirmed | 30.05 s, −27.3 LUFS, −6.0 dBTP (measured) | start 0, dur 1.0 s | Page: "Sparkling bright ding sound." Brighter/more synthetic alternative, hottest of the three sources; also a `sfx/growth` candidate (a different excerpt window from the same source). |

### sfx/growth (≤ 1.5 s) — "a rising shimmer (the dragon grows)"

| # | Title | Source | Licence | Duration | Excerpt | Fits because |
|---|---|---|---|---|---|---|
| 1 | a cute little sparkly synth rise | [freesound.org/.../678380](https://freesound.org/people/msx2plus/sounds/678380/) → [HQ preview](https://cdn.freesound.org/previews/678/678380_14784311-hq.mp3), CC0 deed quote confirmed | 8.66 s, −11.0 LUFS, −0.3 dBTP (measured) | start 0, dur 1.5 s | Tags: cheery, magic, rise, sparkle, synth. A literal rising shimmer — the best match in either search engine. Hot source (little normalisation gain needed). |
| 2 | MAGShim_Sparkling Twinkle Bleep 1_EM | [freesound.org/.../825544](https://freesound.org/people/newlocknew/sounds/825544/) (see `sfx/chime` above), CC0 | 30.05 s, −27.3 LUFS, −6.0 dBTP (measured) | start 3 s, dur 1.5 s | Same source as `sfx/chime` candidate 3; a later, longer excerpt could read as a rising shimmer rather than a single ding. |

Only two strong candidates found for this slot; freesound's CC0 filter returns very little for
"rising magic shimmer" phrasing. Flagging as thinner coverage rather than padding with a weak third.

### sfx/hmpf (≤ 0.8 s) — "Éris displeased: a muted low comic horn or bassoon 'womp' (no voice)"

| # | Title | Source | Licence | Duration | Excerpt | Fits because |
|---|---|---|---|---|---|---|
| 1 | horn_fail_wahwah_1.wav | [freesound.org/.../362206](https://freesound.org/people/TaranP/sounds/362206/) → [HQ preview](https://cdn.freesound.org/previews/362/362206_6629901-hq.mp3), CC0 deed quote confirmed | 4.32 s, −22.6 LUFS, −8.7 dBTP (measured) | start 0, dur 0.8 s | Title implies a descending comic horn "wah-wah"/womp; no voice, no description text beyond the title on the page. |
| 2 | Fail Jingle (layer 1) | [freesound.org/.../181354](https://freesound.org/people/unfa/sounds/181354/) → [HQ preview](https://cdn.freesound.org/previews/181/181354_1038806-hq.mp3), CC0 deed quote confirmed | 6.60 s, −16.0 LUFS, −5.9 dBTP (measured) | start 0, dur 0.8 s | Title-only page; a "fail" stinger layer, comic register, no voice. |
| 3 | Fail Jingle Party Horn | [freesound.org/.../825292](https://freesound.org/people/qubodup/sounds/825292/) → [HQ preview](https://cdn.freesound.org/previews/825/825292_71257-hq.mp3), CC0 deed quote confirmed | 3.00 s, −15.0 LUFS, −0.1 dBTP (measured) | start 0, dur 0.8 s | Page: "Paper party horn fail honk sound jingle... pitch shifted 2nd by -1 and 3rd by -2" — a descending honk. Weaker pick: a party horn's timbre is brighter/thinner than a bassoon; no voice regardless. |

**Rejected:** *the death of the Kazoo* (msLineOn, [freesound.org/.../754933](https://freesound.org/people/msLineOn/sounds/754933/),
CC0) — page: "A deep, sad kazoo sound fading into silence, creating a sense of finality and closure." Too
slow and mournful for a quick displeased "womp"; not chosen as a candidate.

### sfx/laurel (≤ 1 s) — "leaves rustling with a tiny chime"

| # | Title | Source | Licence | Duration | Excerpt | Fits because |
|---|---|---|---|---|---|---|
| 1 | Wind_Chimes1.wav | [freesound.org/.../471074](https://freesound.org/people/Islabonita/sounds/471074/) → [HQ preview](https://cdn.freesound.org/previews/471/471074_2200015-hq.mp3), CC0 deed quote confirmed | 88.42 s, −44.5 LUFS, −27.5 dBTP (measured) | start ≈ 12 s, dur 1.0 s (needs a listening pass to land on an audible chime tinkle) | Page, verbatim: "Leaves on a tree hissing in strong wind, windchimes." The only candidate found with both elements the brief asks for, together. Very quiet source; will need a large normalisation gain. |
| 2 | LeavesRustlingFast07 | [freesound.org/.../489941](https://freesound.org/people/falcospizaetus/sounds/489941/) → [HQ preview](https://cdn.freesound.org/previews/489/489941_10570192-hq.mp3), CC0 deed quote confirmed | 0.50 s, −42.4 LUFS, −29.6 dBTP (measured) — fits whole, no trim | start 0, dur 0.45 s | Title-only page; a fast leaf rustle. No chime in this recording — would need one layered in (same limitation as `music/lair`'s bubbling, see above) if chosen. Also very quiet. |
| 3 | Leaves Rustling | [freesound.org/.../765965](https://freesound.org/people/SoundDesigner0101/sounds/765965/) → [HQ preview](https://cdn.freesound.org/previews/765/765965_15695818-hq.mp3), CC0 deed quote confirmed | 30.98 s, −39.7 LUFS, −7.2 dBTP (measured) | start 0, dur 1.0 s | Title-only page; leaves only, same limitation as candidate 2. |

### sfx/strike (≤ 0.5 s) — "a soft blow on a bronze shield"

| # | File | Pack | Licence | Measured (this run) | Sounds like (per its name/pack) |
|---|---|---|---|---|---|
| 1 | `impactPlate_medium_000.ogg` | Kenney [Impact Sounds](https://kenney.nl/assets/impact-sounds), CC0 | 0.61 s, −21.7 LUFS, −1.4 dBTP (trim to ≤ 0.5 s in 3b) | "impactPlate" family (a struck metal plate) — the closest Kenney category to a shield blow. |
| 2 | `impactMetal_light_002.ogg` | Kenney Impact Sounds, CC0 | 0.24 s, −15.4 LUFS, −1.3 dBTP | A light metal impact, brighter/thinner than a plate hit. |
| 3 | `impactPlate_light_001.ogg` | Kenney Impact Sounds, CC0 | 0.65 s, −22.2 LUFS, −1.3 dBTP (trim to ≤ 0.5 s in 3b) | Same "impactPlate" family, lighter velocity. |

### sfx/fanfare (≤ 2.5 s) — "a short victory jingle"

| # | Title | Source | Licence | Duration | Excerpt | Fits because |
|---|---|---|---|---|---|---|
| 1 | Fanfare - Rpg | [freesound.org/.../566203](https://freesound.org/people/colorsCrimsonTears/sounds/566203/) → [HQ preview](https://cdn.freesound.org/previews/566/566203_11785387-hq.mp3), CC0 deed quote confirmed | 1.22 s, −18.0 LUFS, −4.0 dBTP (measured) — fits whole, no trim | start 0, dur 1.18 s | Page: "Congratulatory fanfare in an rpg" style — exactly the brief, and already under budget. |
| 2 | fanfare.mp3 | [freesound.org/.../242207](https://freesound.org/people/Wagna/sounds/242207/) → [HQ preview](https://cdn.freesound.org/previews/242/242207_3271346-hq.mp3), CC0 deed quote confirmed | 8.18 s, −13.2 LUFS, −1.3 dBTP (measured) | start 0, dur 2.5 s | Page: "Success-fanfare" — the author's own tag says it was made for a game win. |

**Rejected:** Kenney [Music Jingles](https://kenney.nl/assets/music-jingles) "Hit jingles"/"Steel
jingles" (CC0, pack `License.txt`) — measured: `jingles_HIT00.ogg` 0.28 s / −13.2 LUFS / −4.0 dBTP,
`jingles_STEEL00.ogg` 0.93 s / −15.1 LUFS / −2.6 dBTP. Both are single stings, not a short melodic
fanfare phrase; not chosen as candidates.

## Coverage summary

14/14 slots have at least two candidates; 9/14 have three (`music/camp`, `music/lair`, `sfx/tap`,
`sfx/seal`, `sfx/unroll`, `sfx/chime`, `sfx/hmpf`, `sfx/laurel`, `sfx/strike`). Five have two
(`music/sea`, `music/temple`, `music/battle`, `sfx/growth`, `sfx/fanfare`) — noted inline above in
each case; the searches turned up little else that both fit the brief and wasn't rejected outright.

## Open items for the controller

1. **`music/lair`'s bubbling** and **`sfx/laurel`'s chime** (candidates 2–3): the strongest single-file
   matches for the drone/rustle don't include the second texture the brief asks for (bubbling, tiny
   chime); the best "both at once" matches are `music/lair` candidate 1 (drone only) and `sfx/laurel`
   candidate 1 (has both). If the controller prefers combining two separate CC0 sources instead,
   `tools/audio/process.py` needs a small extension in 3b (it currently takes one `file` per slot).
2. `music/camp` candidate 1 (PagDev's Fireplace Sound Loop) measured at **29.26 s**, under the
   catalogue's own 30 s floor (`LOOP_MIN_S`, `catalog.ts`) and well under the slot's 45–90 s target,
   even though its own page calls it a loop. It cannot supply a 45–90 s excerpt by itself; using it
   would mean repeating it (e.g. twice, then crossfading) before `process.py`'s current one-shot
   trim-and-crossfade step, a small pipeline change, or picking candidate 2 or 3 instead (both are
   already long enough as-is).
3. `sfx/tap` and `sfx/strike`'s Kenney files, being pack-level CC0 (not individually described), are
   matched by category/filename rather than a per-file "sounds like" quote — flagged in case the
   controller wants a stricter per-file source for those two slots.
