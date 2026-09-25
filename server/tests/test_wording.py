"""No guilt wording in any string the server can hand to the player (plan Global Constraints, Ethics:
« manqué », « raté », « perdu » are never on screen). The e2e red/wording scans only see the offline
fixtures, which never reach the rarer server messages (a refresh stopped by its time budget slipped
through that way), so every string literal of the server code is checked here."""
import ast
import re
from pathlib import Path

GUILT = re.compile(r"\b(manquée?s?|ratée?s?|perdue?s?)\b", re.IGNORECASE)
APP = Path(__file__).resolve().parents[1] / "app"


def _strings(tree: ast.AST):
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            yield node.lineno, node.value


def _offenders(root: Path) -> list[str]:
    found = []
    for path in sorted(root.rglob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for lineno, text in _strings(tree):
            if GUILT.search(text):
                found.append(f"{path.relative_to(root)}:{lineno}: {text!r}")
    return found


def test_no_guilt_wording_in_server_strings():
    assert _offenders(APP) == []


def test_the_scan_catches_a_planted_guilt_string(tmp_path):
    (tmp_path / "planted.py").write_text(
        'NOTE = "Les scribes ont manqué de temps."\n'
        'def f(n):\n    return f"{n} passages perdus"\n'
        'OK = "Il manque un mot."\n',
        encoding="utf-8",
    )
    found = _offenders(tmp_path)
    assert len(found) == 2 and "manqué" in found[0] and "perdus" in found[1]
