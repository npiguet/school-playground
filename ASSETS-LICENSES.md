# Third-party assets and licences

Everything the game ships that was not made for it. The art is generated locally (see
`docs/art/style-guide.md`) and is not listed here. Audio credits (scenes UI spec §7) are added
in UI5.

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
