# content/lexique

Vendored, trimmed derivation of Lexique 3.83 used by `server/app/lexicon.py` for inflected
forms and sound-alikes. See `LICENSE.md` for attribution and licence.

- **Source:** downloaded directly from the official host, http://www.lexique.org/databases/Lexique383/Lexique383.zip
- **Build command:** `scripts/py.sh python -m app.tools.build_lexicon --out /work/content/lexique/lexique383-trimmed.tsv.gz`
- **Row count:** 142,373 rows kept of 142,694 in the source (rows with a space in `ortho` or an
  empty `cgram` were dropped).

If the official host is unreachable, download the zip once from the OpenLexicon mirror
(`https://github.com/chrplr/openlexicon/raw/master/datasets-info/Lexique383/Lexique383.zip`)
into `tmp/` (git-ignored) and pass `--zip /work/tmp/Lexique383.zip` to the build command.
