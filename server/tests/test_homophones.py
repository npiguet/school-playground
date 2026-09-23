from pathlib import Path
from app.nlp.homophones import load_homophones

CONTENT = Path(__file__).resolve().parents[2] / "content"


def test_loads_repo_table():
    h = load_homophones(CONTENT)
    assert h.set_of("à") == "a"
    assert h.set_of("A") == "a"
    assert h.set_of("c’est") == "ces"      # typographic apostrophe unified
    assert h.set_of("maison") is None
    assert "sont" in h.words("son")
    assert "étaient" in h.hint("son")


def test_words_are_unique_across_sets():
    h = load_homophones(CONTENT)
    seen = set()
    for s in h.sets:
        for w in s["words"]:
            assert w not in seen, w
            seen.add(w)
