import pytest

from app.cache import cache_key
from app.text import MAX_CHARS, Respeller, normalise, segments


def test_the_voice_hears_plain_single_spaces():
    assert normalise("Bonjour ! Je lirai tes  dictées.\n") == "Bonjour ! Je lirai tes dictées."


def test_respells_whole_words_only():
    r = Respeller({"Seguin": "Segin", "ail": "aille"})
    assert r("Monsieur Seguin cueille de l'ail.") == "Monsieur Segin cueille de l'aille."
    assert r("Le travail et les ailes, l'ail-des-ours.") == "Le travail et les ailes, l'ail-des-ours."


def test_respelling_is_case_sensitive():
    assert Respeller({"Seguin": "Segin"})("seguin") == "seguin"


def test_the_longest_entry_wins():
    r = Respeller({"Saint": "Sin", "Saint-Exupéry": "Sainte-Xupéri"})
    assert r("Saint-Exupéry et Saint Louis") == "Sainte-Xupéri et Sin Louis"


def test_an_empty_table_changes_nothing(tmp_path):
    (tmp_path / "r.json").write_text("{}", encoding="utf-8")
    assert Respeller.load(tmp_path / "r.json")("Un matin. Point.") == "Un matin. Point."
    assert Respeller.load(tmp_path / "missing.json")("x") == "x"


def test_a_malformed_table_is_refused(tmp_path):
    (tmp_path / "r.json").write_text('{"a": 1}', encoding="utf-8")
    with pytest.raises(ValueError):
        Respeller.load(tmp_path / "r.json")


def test_a_short_line_is_one_segment():
    assert segments("Un matin, virgule, l'œuf se fendit. Point.") == ["Un matin, virgule, l'œuf se fendit. Point."]


def test_a_long_line_is_cut_after_a_named_full_stop_only():
    sentence = "Le loup, virgule, arriva près de la bergerie. Point."
    text = " ".join([sentence] * 12)
    parts = segments(text, limit=120)
    assert " ".join(parts) == text
    assert all(len(p) <= 120 for p in parts)
    assert all(p.endswith("Point.") for p in parts)


def test_a_mark_and_its_name_are_never_apart():
    a, b = "A" * 50 + ". Point.", "B" * 50 + " ? Point d'interrogation."
    assert segments(f"{a} {b}", limit=60) == [a, b]
    ellipsis = "C" * 50 + "… Points de suspension."
    assert segments(f"{ellipsis} {a}", limit=60) == [ellipsis, a]


def test_an_overlong_sentence_stays_whole():
    text = "mot " * 100 + "fin. Point."
    assert segments(text, limit=50) == [text]


def test_the_limit_is_ten_thousand_characters():
    # Kokoro plan Ruling K1, now a guard: the game says a sentence at a time (web MAX_LINE_CHARS).
    assert MAX_CHARS == 10_000


def test_the_game_s_french_spacing_becomes_plain_spaces():
    assert normalise("Bonjour\u202f! «\u00a0Point\u00a0»") == "Bonjour ! « Point »"


def test_a_breath_group_that_goes_on_keeps_its_ending():
    # Pace-bug report 2026-09-27, open item 2: a group cut on a word ends with a bare comma, not a full
    # stop. The voice takes it as it is: one segment, its comma kept, so its cache key is its own.
    line = "Quand les marins d'Ulysse débarquèrent sur l'île boisée,"
    assert normalise(line) == line
    assert segments(normalise(line)) == [line]
    assert cache_key("m", "v", 0.9, line) != cache_key("m", "v", 0.9, line[:-1] + ".")
    assert normalise("les invita dans son palais") == "les invita dans son palais"
