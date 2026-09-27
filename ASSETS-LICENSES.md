# Third-party assets and licences

Everything the game ships that was not made for it. The art is generated locally (see
`docs/art/style-guide.md`) and is not listed here.

## Fonts (scenes UI spec §2.7)

Self-hosted woff2 files under `web/public/fonts/`, latin + latin-ext subsets only, copied from
the `@fontsource/*` 5.3.0 packages (unmodified Google Fonts builds) by
`web/scripts/vendor-fonts.mjs`. All three families are under the SIL Open Font License 1.1; the
full licence text ships next to the files as `OFL.txt`.

| Family | Faces | Copyright | Licence |
|---|---|---|---|
| Cinzel | 600, 700 | Copyright 2020 The Cinzel Project Authors (https://github.com/NDISCOVER/Cinzel) | OFL-1.1, `web/public/fonts/cinzel/OFL.txt` |
| Alegreya | 400, 400 italic, 700 | Copyright 2011 The Alegreya Project Authors (https://github.com/huertatipografica/Alegreya) | OFL-1.1, `web/public/fonts/alegreya/OFL.txt` |
| Literata | 400, 600 | Copyright 2017 The Literata Project Authors (https://github.com/googlefonts/literata) | OFL-1.1, `web/public/fonts/literata/OFL.txt` |

## Texts from the Bibliothèque d'Alexandrie

The works offered behind the library tent's portal (the allowlist `content/alexandria/works.json`,
read by `server/app/alexandria/allowlist.py`) are in the public domain: their authors and
translators died more than seventy years ago. Each work and each adopted text keeps its author and
translator on screen (for example « Lewis Carroll, trad. Henri Bué »). The original texts come
from Wikisource and Project Gutenberg (each work's `source` field in the allowlist says which).

## The dictation voice (spec 2026-09-27)

The `tts` image bakes in Kokoro-82M and its French voice; they are downloaded at build time
(`tts/Dockerfile`, each file checked against the sha256 in `tools/tts/parity.json`), not shipped in
this repository. The lyre's credits name them to the players. The build runs ONNX Runtime directly
on the ONNX export (`tools/tts/parity.json` verdict `onnx-direct`): the kokoro-onnx and kokoro
Python packages and PyTorch are not in the image.

| Component | Source | Author | Licence |
|---|---|---|---|
| Kokoro-82M v1.0 (model weights, `config.json`) | [hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) | hexgrad | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) |
| Voice `ff_siwis` | trained on the [SIWIS French Speech Synthesis Database](https://datashare.ed.ac.uk/handle/10283/2353) | Junichi Yamagishi, Pierre-Edouard Honnet, Philip N. Garner, Alexandros Lazaridis (University of Edinburgh, Idiap Research Institute) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| ONNX export of Kokoro-82M and its voices (`kokoro-v1.0.onnx`, `voices-v1.0.bin`, release model-files-v1.0) | [thewh1teagle/kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) | thewh1teagle | the weights' [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) (the repository's code is [MIT](https://opensource.org/licenses/MIT)) |
| ONNX Runtime | [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) | Microsoft | [MIT](https://opensource.org/licenses/MIT) |
| misaki (French G2P, its espeak backend) | [hexgrad/misaki](https://github.com/hexgrad/misaki) | hexgrad | [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) |
| phonemizer-fork | [bootphon/phonemizer](https://github.com/bootphon/phonemizer) (fork published by thewh1teagle) | Hadrien Titeux and the phonemizer contributors | [GPL-3.0-or-later](https://www.gnu.org/licenses/gpl-3.0.html) |
| espeakng-loader (bundles espeak-ng 1.52.0) | [thewh1teagle/espeakng-loader](https://github.com/thewh1teagle/espeakng-loader) | thewh1teagle | [MIT](https://opensource.org/licenses/MIT) |
| soundfile 0.14.0 (the MP3 encoding, `tts/app/audio.py`) | [bastibe/python-soundfile](https://github.com/bastibe/python-soundfile) | Bastian Bechtold | [BSD-3-Clause](https://opensource.org/licenses/BSD-3-Clause) |
| libsndfile 1.2.2, with LAME 3.100 (the MP3 encoder) and mpg123 1.32.3 built in, bundled in soundfile's wheel ([libsndfile-binaries](https://github.com/bastibe/libsndfile-binaries)) | [libsndfile](https://github.com/libsndfile/libsndfile), [LAME](https://lame.sourceforge.io/), [mpg123](https://www.mpg123.de/) | Erik de Castro Lopo and the libsndfile contributors; the LAME developers; the mpg123 developers | libsndfile and mpg123 [LGPL-2.1-or-later](https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html), LAME [LGPL-2.0-or-later](https://www.gnu.org/licenses/old-licenses/lgpl-2.0.html) |
| espeak-ng (French phonemes) | [espeak-ng](https://github.com/espeak-ng/espeak-ng) | the eSpeak NG contributors | [GPL-3.0-or-later](https://www.gnu.org/licenses/gpl-3.0.html) |

<!-- audio:start -->
## Sounds (scenes UI spec §7)

Every sound is CC0 (public domain dedication); credited here anyway, with where it came from.

| File | Source | Author | Licence | Changes |
|---|---|---|---|---|
| `web/public/audio/music/battle.m4a` | [Krakatoa](https://opengameart.org/content/krakatoa) | Kistol | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | trimmed, loop seam crossfaded, loudness normalised, AAC 96 kbps |
| `web/public/audio/music/camp.m4a` | [Sounds of the forest night.mp3](https://freesound.org/people/Kingcornz/sounds/342369/) | Kingcornz | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | trimmed, loop seam crossfaded, loudness normalised, AAC 96 kbps |
| `web/public/audio/music/lair.m4a` | [Dark Atmospheric Drone (Time-Stretched, Seamless Loop)](https://freesound.org/people/kkenny101/sounds/865550/) | kkenny101 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | trimmed, loop seam crossfaded, loudness normalised, AAC 96 kbps |
| `web/public/audio/music/lair.m4a` (layer) | [Witches Brew.wav](https://freesound.org/people/opticaillusions/sounds/614866/) | opticaillusions | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | looped continuously, mixed in at -13 dB |
| `web/public/audio/music/sea.m4a` | [Ambience Sea and Waves .wav](https://freesound.org/people/Fester993/sounds/564437/) | Fester993 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | trimmed, loop seam crossfaded, loudness normalised, AAC 96 kbps |
| `web/public/audio/music/temple.m4a` | [Orbital Temple Sacred Drone by Mantice](https://freesound.org/people/bassimat/sounds/854867/) | bassimat | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | trimmed, loop seam crossfaded, loudness normalised, AAC 96 kbps |
| `web/public/audio/sfx/chime.m4a` | [BELLHand_Ringing Small Hand Bell_HvD_OwSFX](https://freesound.org/people/Hano_van_Dalen/sounds/767307/) | Hano_van_Dalen | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | trimmed, loudness normalised, AAC 96 kbps |
| `web/public/audio/sfx/fanfare.m4a` | [Fanfare - Rpg](https://freesound.org/people/colorsCrimsonTears/sounds/566203/) | colorsCrimsonTears | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | trimmed, loudness normalised, AAC 96 kbps |
| `web/public/audio/sfx/growth.m4a` | [a cute little sparkly synth rise](https://freesound.org/people/msx2plus/sounds/678380/) | msx2plus | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | trimmed, loudness normalised, AAC 96 kbps |
| `web/public/audio/sfx/hmpf.m4a` | [horn_fail_wahwah_1.wav](https://freesound.org/people/TaranP/sounds/362206/) | TaranP | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | trimmed, loudness normalised, AAC 96 kbps |
| `web/public/audio/sfx/laurel.m4a` | [LeavesRustlingFast07](https://freesound.org/people/falcospizaetus/sounds/489941/) | falcospizaetus | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | trimmed, loudness normalised, AAC 96 kbps |
| `web/public/audio/sfx/laurel.m4a` (layer) | [Wind_Chimes1.wav (chime excerpt only)](https://freesound.org/people/Islabonita/sounds/471074/) | Islabonita | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | a short excerpt, mixed in at +6 dB |
| `web/public/audio/sfx/seal.m4a` | [Wax seal](https://freesound.org/people/Cerise_Virtuelle/sounds/759526/) | Cerise_Virtuelle | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | trimmed, loudness normalised, AAC 96 kbps |
| `web/public/audio/sfx/strike.m4a` | [Impact Sounds - impactPlate_medium_000.ogg](https://kenney.nl/assets/impact-sounds) | Kenney (kenney.nl) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | trimmed, loudness normalised, AAC 96 kbps |
| `web/public/audio/sfx/tap.m4a` | [UI Audio - click2.ogg](https://kenney.nl/assets/ui-audio) | Kenney (kenney.nl) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | trimmed, loudness normalised, AAC 96 kbps |
| `web/public/audio/sfx/unroll.m4a` | [Parchment - Unroll](https://freesound.org/people/Vrymaa/sounds/753282/) | Vrymaa | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | trimmed, loudness normalised, AAC 96 kbps |
<!-- audio:end -->
