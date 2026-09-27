"""UI5 Ruling E15, final review I5: the server's strings that the client shows (409 details, the
world's techniques and rewards, the Alexandria notes and fetch errors) follow the same French
typography as web/src (web/src/frenchSpacing.test.ts): a narrow no-break space (U+202F) before
« : ; ! ? » and inside « guillemets », never a plain or a no-break (U+00A0) one, and never none.

Every string constant of server/app is scanned (docstrings aside). A string counts as French prose
when it has a French accented letter, guillemets or a common French word (FRENCH); the English
diagnostics, SQL (« = ? ») and log lines never do. Modules of regular expressions over French text
are listed in CODE.
"""
import ast
import re
from pathlib import Path

APP = Path(__file__).resolve().parent.parent / "app"

BAD_SPACE = re.compile(r"[  ][:;!?»]|«[  ]")
# A missing space: a letter, digit or « ) » right against « ; ! ? » », « right against a word, or
# a word right against « : » then a space (« Wikisource: … »). `?.`, `??`, a URL's `?page=` are code.
NO_SPACE = [re.compile(r"(?:[^\W_]|\))[;!?»](?![.?=\w])"), re.compile(r"«[^\W_]"), re.compile(r"[^\W_]:\s")]
FRENCH = re.compile(r"[àâçéèêëîïôûùüÿœæÀÂÇÉÈÊËÎÏÔÛÙÜŒÆ«»]|\b(?:le|la|les|de|des|du|un|une|et|est|pas|tu|ton|ta|tes|pour|sur|dans|fichier|page)\b", re.I)

# Files whose French strings are not copy but code over French text (regexes that strip or match
# the scanned dictation's own spacing, word lists): {path relative to app: why}.
CODE = {
    "ocr.py": "normalises the scanned text's spacing (regexes)",
    "alexandria/clean.py": "normalises a Wikisource page's spacing (regexes)",
    "alexandria/chunk.py": "splits a text at its sentences (regexes over French punctuation)",
    "corrupt.py": "Éris's misspellings (regexes over French word endings)",
}


def _docstrings(tree: ast.AST) -> set[int]:
    ids = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            body = getattr(node, "body", [])
            if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
                ids.add(id(body[0].value))
    return ids


def strings_of(source: str) -> list[str]:
    """The string constants of a module (an f-string's literal parts joined, each hole a word)."""
    tree = ast.parse(source)
    skip = _docstrings(tree)
    out: list[str] = []
    in_fstrings: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.JoinedStr):
            parts = []
            for v in node.values:
                in_fstrings.add(id(v))
                parts.append(v.value if isinstance(v, ast.Constant) and isinstance(v.value, str) else "x")
            out.append("".join(parts))
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Constant)
            and isinstance(node.value, str)
            and id(node) not in skip
            and id(node) not in in_fstrings
        ):
            out.append(node.value)
    return out


def faults(text: str) -> list[str]:
    if not FRENCH.search(text):
        return []
    return [text[max(0, m.start() - 20) : m.end() + 3] for rx in (BAD_SPACE, *NO_SPACE) for m in rx.finditer(text)]


def test_every_french_string_of_the_server_is_spaced():
    report = []
    files = sorted(APP.rglob("*.py"))
    assert len(files) > 30
    for f in files:
        rel = f.relative_to(APP).as_posix()
        if rel in CODE:
            continue
        for s in strings_of(f.read_text(encoding="utf-8")):
            report += [f"{rel}: «{at}»" for at in faults(s)]
    assert report == [], "\n".join(report)


def test_no_stale_exclusion():
    for rel in CODE:
        assert (APP / rel).is_file(), rel


def test_the_scanner_catches_a_plain_or_a_missing_space_and_ignores_code():
    src = (
        '"""Docstring : ignorée."""\n'
        'A = "Les murs sont pleins : range."\n'
        'B = "Tu gagnes!"\n'
        'C = f"page «{t}» introuvable"\n'
        'D = f"réponse invalide de Wikisource: {e}"\n'
        'E = "Les murs sont pleins\\u202f: range. «\\u202fmot\\u202f» Bravo\\u202f!"\n'
        'F = "SELECT * FROM t WHERE id = ?"\n'
        'G = f"page «\\u202f{t}\\u202f» introuvable"\n'
    )
    found = [at for s in strings_of(src) for at in faults(s)]
    assert len(found) == 5, found
