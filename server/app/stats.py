"""Per-profile statistics derived from submitted session results (spec §3.5 mots-pièges)."""
from __future__ import annotations
import sqlite3
from app.textutil import words, WORD_RE

DEFAULT_ARGUS = ["verbes", "groupes_nominaux", "homophones", "mots_pieges"]
PASS_BUCKETS = {
    "verbes": {"agreement:verb", "agreement:participle"},
    "groupes_nominaux": {"agreement:number", "agreement:gender", "agreement:other"},
    "homophones": {"homophone"},
    "mots_pieges": {"lexical", "accent"},
}
TRAP_CATEGORIES = {"lexical", "accent"}
NON_TRAP_SUBS = {"missing", "extra"}


def stat_key(error: dict) -> str:
    if error.get("category") == "agreement":
        return f"agreement:{error.get('sub') or 'other'}"
    return error["category"]


def argus_order(category_rows: list[dict]) -> list[str]:
    totals = {k: {"draft": 0, "missed": 0} for k in DEFAULT_ARGUS}
    for r in category_rows:
        for bucket, keys in PASS_BUCKETS.items():
            if r["category"] in keys:
                totals[bucket]["draft"] += r["errors_in_draft"]
                totals[bucket]["missed"] += r["missed"]

    def ratio(b):
        t = totals[b]
        return t["missed"] / t["draft"] if t["draft"] >= 5 else -1.0

    return sorted(DEFAULT_ARGUS, key=lambda b: -ratio(b))


def apply_session_to_stats(conn: sqlite3.Connection, profile_id: int, result: dict, day: str, now: str) -> None:
    for key, c in result.get("byCategory", {}).items():
        vals = (c.get("opportunities", 0), c.get("draft", 0), c.get("caught", 0), c.get("missed", 0), c.get("introduced", 0))
        conn.execute("""INSERT INTO profile_stat(profile_id, category, occurrences, errors_in_draft, caught, missed, introduced, updated_at)
                        VALUES (?,?,?,?,?,?,?,?)
                        ON CONFLICT(profile_id, category) DO UPDATE SET
                          occurrences = occurrences + excluded.occurrences,
                          errors_in_draft = errors_in_draft + excluded.errors_in_draft,
                          caught = caught + excluded.caught, missed = missed + excluded.missed,
                          introduced = introduced + excluded.introduced,
                          updated_at = excluded.updated_at""", (profile_id, key, *vals, now))
        conn.execute("""INSERT INTO profile_stat_day(profile_id, day, category, occurrences, errors_in_draft, caught, missed, introduced)
                        VALUES (?,?,?,?,?,?,?,?)
                        ON CONFLICT(profile_id, day, category) DO UPDATE SET
                          occurrences = occurrences + excluded.occurrences,
                          errors_in_draft = errors_in_draft + excluded.errors_in_draft,
                          caught = caught + excluded.caught, missed = missed + excluded.missed,
                          introduced = introduced + excluded.introduced""",
                     (profile_id, day, key, *vals))


def update_trap_words(conn: sqlite3.Connection, profile_id: int, result: dict, reference_body: str, now: str,
                      record_misses: bool = True) -> None:
    """Leitner boxes of the profile's mots-pièges. A dictation's draft errors are the child's own
    mistakes: each one enters (or resets) a trap word. In the Grimoire corrompu (`record_misses=False`)
    the draft errors are Éris's plants, so no word is added or reset — a planted word she left wrong
    (a final error) merely misses its promotion, and one she caught or spelt right moves up a box."""
    errors = result.get("finalErrors", []) + (result.get("draftErrors", []) if record_misses else [])
    missed_words = {e["expected"].lower() for e in errors
                    if e.get("category") in TRAP_CATEGORIES and e.get("sub") not in NON_TRAP_SUBS
                    and e.get("expected") and WORD_RE.fullmatch(e["expected"])}
    if record_misses:
        for w in missed_words:
            conn.execute("""INSERT INTO trap_word(profile_id, word, box, last_seen, misses) VALUES (?,?,1,?,1)
                            ON CONFLICT(profile_id, word) DO UPDATE SET misses = misses + 1, box = 1, last_seen = excluded.last_seen""",
                         (profile_id, w, now))
    present = set(words(reference_body)) - missed_words
    for r in conn.execute("SELECT word, box FROM trap_word WHERE profile_id = ?", (profile_id,)).fetchall():
        if r["word"] in present:
            conn.execute("UPDATE trap_word SET box = ?, last_seen = ? WHERE profile_id = ? AND word = ?",
                         (min(5, r["box"] + 1), now, profile_id, r["word"]))
