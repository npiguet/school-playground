from pathlib import Path
from app.alexandria.allowlist import load_allowlist
from app.alexandria.chunk import make_chunks, split_sentences
from app.alexandria.clean import Paragraph, clean_text, gutenberg_text_to_paragraphs, wikisource_html_to_paragraphs
from app.alexandria.fetch import FetchError, OfflineFetcher, page_slug
from app.alexandria.filters import chunk_verdict
from app.alexandria.score import level_for, score_for

FIX = Path(__file__).parent / "fixtures" / "alexandria"
CONTENT = Path(__file__).resolve().parents[2] / "content"
PROSE = ("Le vieux marin regardait la mer. Les vagues grises montaient lentement vers la plage, et les mouettes criaient au-dessus des rochers. "
         "Il pensait aux voyages anciens, aux tempêtes et aux ports lointains où les hommes chantaient le soir. ")


def test_allowlist_rejects_unknown_or_recent_deaths(tmp_path):
    (tmp_path / "alexandria").mkdir()
    (tmp_path / "alexandria" / "works.json").write_text('''{"version": 1, "works": [
      {"id": "ok", "title": "T", "author": "A", "author_death": 1900, "translator": "B", "translator_death": 1950, "source": "wikisource", "pages": ["P"], "level_hint": "8H", "note": ""},
      {"id": "recent", "title": "T", "author": "A", "author_death": 1900, "translator": "B", "translator_death": 1960, "source": "wikisource", "pages": ["P"], "level_hint": "8H", "note": ""},
      {"id": "unknown", "title": "T", "author": "A", "author_death": null, "translator": null, "translator_death": null, "source": "wikisource", "pages": ["P"], "level_hint": "8H", "note": ""}]}''', encoding="utf-8")
    assert [w.id for w in load_allowlist(tmp_path)] == ["ok"]


def test_shipped_allowlist_is_valid():
    works = load_allowlist(CONTENT)
    assert len(works) >= 12 and all(w.author_death < 1956 and (w.translator_death or 0) < 1956 for w in works)
    assert not any("bérard" in (w.translator or "").lower() for w in works)


def test_page_slug_and_offline_fetcher():
    assert page_slug("Vingt_mille_lieues_sous_les_mers/Partie_1/Chapitre_1") == "vingt-mille-lieues-sous-les-mers-partie-1-chapitre-1"
    assert page_slug("Contes_d’Andersen/La_Petite_Sirène") == "contes-d-andersen-la-petite-sirene"
    f = OfflineFetcher(FIX)
    assert "<p>" in f.wikisource_page("Vingt_mille_lieues_sous_les_mers/Partie_1/Chapitre_1")
    assert "START OF" in f.gutenberg_text(99999)
    try:
        f.wikisource_page("Nope")
        assert False
    except FetchError:
        pass


def test_wikisource_html_cleaning():
    html = ('<div class="mw-parser-output"><span class="pagenum">12</span><h2>Chapitre I</h2>'
            '<p>Les fées dansent<sup class="reference">[1]</sup> dans la clairière.<br/>Elles chantent.</p>'
            '<div class="poem"><p>Ô vagues,<br/>ô rochers !</p></div>'
            '<table><tr><td>ignored</td></tr></table><ol class="references"><li>note</li></ol>'
            '<p>Le vent   emporte «leurs» chansons — très-loin.</p></div>')
    paras = wikisource_html_to_paragraphs(html)
    assert [p.kind for p in paras] == ["prose", "verse", "prose"]
    assert paras[0].text == "Les fées dansent dans la clairière. Elles chantent."
    assert paras[2].text == "Le vent emporte « leurs » chansons — très loin."


def test_gutenberg_cleaning_and_verse():
    txt = (FIX / "gutenberg" / "pg99999.txt").read_text(encoding="utf-8")
    paras = gutenberg_text_to_paragraphs(txt)
    assert all("Project Gutenberg" not in p.text for p in paras)
    assert any(p.kind == "verse" for p in paras) and any(p.kind == "prose" for p in paras)


def test_clean_text_footnotes_and_quotes():
    assert clean_text("Il[2] dit (3) : « oui »… l’ami !") == "Il dit : « oui »… l'ami !"


def test_split_sentences_guards_abbreviations():
    s = split_sentences("M. Seguin n'avait jamais eu de bonheur avec ses chèvres. Il les perdait toutes ! « Où vont-elles ? » Il ne savait pas.")
    assert s == ["M. Seguin n'avait jamais eu de bonheur avec ses chèvres.", "Il les perdait toutes !", "« Où vont-elles ? »", "Il ne savait pas."]


def test_make_chunks_respects_bounds_and_sentence_boundaries():
    paras = [Paragraph(PROSE * 3, "prose"), Paragraph(PROSE * 2, "prose"), Paragraph("Fin.", "prose")]
    chunks = make_chunks(paras)
    assert chunks and all(80 <= c["word_count"] <= 200 for c in chunks)
    for c in chunks:
        assert c["body"][0].isupper() and c["body"].rstrip()[-1] in ".!?»"
    long_sentence = " ".join(["mot"] * 250) + "."
    assert make_chunks([Paragraph(long_sentence, "prose")]) == []


def test_chunk_verdicts(lexicon):
    ok = {"body": PROSE * 2, "word_count": 100, "sentences": split_sentences(PROSE * 2), "verse": False}
    assert chunk_verdict(ok, lexicon) is None
    assert chunk_verdict({**ok, "body": "En 1866, " + PROSE * 2}, lexicon) == "digits"
    assert chunk_verdict({**ok, "verse": True}, lexicon) == "verse"
    dialogue = "— Oui, dit-il. — Non, dit-elle. — Peut-être. " + PROSE
    assert chunk_verdict({**ok, "body": dialogue, "sentences": split_sentences(dialogue)}, lexicon) == "dialogue"
    old = PROSE + "Les hommes chantoient et les enfans jouoient sur la plage. "
    assert chunk_verdict({**ok, "body": old * 2}, lexicon) == "old_spelling"
    names = PROSE + "Achille, Hector, Priam, Hélène, Pâris, Ménélas, Agamemnon, Ulysse, Nestor, Ajax et Diomède parlaient. "
    assert chunk_verdict({**ok, "body": names}, lexicon) == "proper_nouns"
    gibberish = PROSE + "Le zorglub frimbait les cratouilles vlomes. "
    assert chunk_verdict({**ok, "body": gibberish}, lexicon) == "unknown_words"


def test_level_and_score():
    easy = {"agreement_density": 0.30, "avg_sentence_len": 9, "rare_ratio": 0.01, "chain_targets": 30}
    hard = {"agreement_density": 0.20, "avg_sentence_len": 30, "rare_ratio": 0.12, "chain_targets": 20}
    assert level_for(easy, "5H") == "5H" and level_for(easy, "8H") == "8H" and level_for(hard, "5H") == "11H"
    assert score_for(easy) == 30.0
