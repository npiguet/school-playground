"""app.kokoro's splitter (Task 3 addendum #3): no model needed."""
from app.kokoro import MAX_PHONEMES, split_phonemes


def test_a_sequence_that_fits_is_one_piece():
    ps = "a" * MAX_PHONEMES
    assert split_phonemes(ps) == [ps]


def test_it_cuts_at_the_space_nearest_the_middle():
    assert split_phonemes("aaa bb cccc d", limit=8) == ["aaa bb", "cccc d"]


def test_it_prefers_a_pause_in_the_middle_half():
    # the plain space at 8 is the middle itself, the one after « , » is at 12, but a pause is better
    ps = "aaaa bbb cc, ddd"
    assert split_phonemes(ps, limit=12) == ["aaaa bbb cc,", "ddd"]


def test_a_pause_far_from_the_middle_is_not_worth_it():
    ps = "a, bbbbbbbbbb cccccccccc"      # the pause is at 2, outside the middle half
    assert split_phonemes(ps, limit=20) == ["a, bbbbbbbbbb", "cccccccccc"]


def test_every_piece_fits_and_nothing_is_dropped():
    ps = ", ".join(f"mo{i % 7}tˈɛ̃" for i in range(400))       # about 3 600 phonemes, commas only
    pieces = split_phonemes(ps)
    assert len(pieces) > 1 and all(0 < len(p) <= MAX_PHONEMES for p in pieces)
    assert " ".join(pieces) == ps


def test_a_sequence_without_a_space_is_cut_at_its_middle():
    assert split_phonemes("abcdefghij", limit=4) == ["ab", "cde", "fg", "hij"]
