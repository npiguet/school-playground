import shutil
from pathlib import Path
import pytest
from app.ocr import LOW_CONF, OcrWord, assemble, clean_ocr_text, ocr_page, preprocess, unknown_words

FIX = Path(__file__).parent / "fixtures" / "scan"
HAS_TESSERACT = shutil.which("tesseract") is not None


def w(text, conf=95.0, block=1, par=1, line=1):
    return OcrWord(text, conf, block, par, line, 0, 0, 10, 10)


def test_preprocess_restores_orientation_and_resizes():
    img = preprocess((FIX / "handout-rotated.jpg").read_bytes())
    assert img.mode == "L" and img.width > img.height and max(img.size) == 2200


def test_assemble_joins_lines_dehyphenates_and_drops_page_numbers():
    words = [w("Les"), w("fées", conf=40), w("dansent"), w("jusqu'au"), w("vil-"),
             w("lage", line=2), w("endormi.", line=2),
             w("Ils", par=2), w("écoutent.", par=2),
             w("3", block=2, conf=90)]
    text, low = assemble(words)
    assert text == "Les fées dansent jusqu'au village endormi.\n\nIls écoutent."
    assert low == ["fées"]


# SP2 playability P1-8: « À vérifier » chips never appeared. A shaky accented word (Tesseract
# gives 60–75 on those in a phone photo), a confident misread the lexicon does not know, and the
# punctuation glued to a word all have to reach the chip list — once each, in reading order.
def test_low_confidence_lists_shaky_words_without_punctuation_and_unknown_words():
    words = [w("Les"), w("fées,", conf=68), w("dansent"), w("dans"), w("la"), w("forêt.", conf=32),
             w("Les", par=2), w("oissaux", conf=90, par=2), w("les", par=2), w("écoutent.", par=2),
             w("porte-monnaie", par=2), w("l'enfant", par=2), w("vil-", par=2), w("lage", par=2, line=2)]
    known = {"les", "fées", "dansent", "dans", "la", "forêt", "oiseaux", "écoutent", "porte", "monnaie", "enfant", "village", "et", "le", "du"}
    is_known = lambda word: word.lower().split("'")[-1] in known   # like Lexicon.is_known: elision-aware
    text, low = assemble(words, is_known=is_known)
    assert low == ["fées", "forêt", "oissaux"]
    assert unknown_words("Les oissaux, l'enfant et le porte-monnaie du vil-lage.", is_known) == ["oissaux", "vil-lage"]
    assert assemble(words)[1] == ["fées", "forêt"]          # no lexicon: confidence only
    assert 60 < LOW_CONF <= 80


def test_clean_ocr_text():
    assert clean_ocr_text("Les fées , dansent .\n\n\n\n«Oui»   , dit-il ; non !") == "Les fées, dansent.\n\n« Oui », dit-il ; non !"
    assert clean_ocr_text("l’enfant  ") == "l'enfant"


@pytest.mark.skipif(not HAS_TESSERACT, reason="tesseract binary not installed")
def test_real_tesseract_reads_the_fixture():
    page = ocr_page((FIX / "handout.png").read_bytes())
    assert "fées dansent dans la clairière" in page["text"]
    assert "village endormi" in page["text"]            # hyphenated line end merged
    assert "\n3" not in page["text"] and not page["text"].endswith("3")
    assert page["width"] == 2200


@pytest.mark.skipif(not HAS_TESSERACT, reason="tesseract binary not installed")
def test_rotated_photo_gives_the_same_words():
    page = ocr_page((FIX / "handout-rotated.jpg").read_bytes())
    assert "clairière" in page["text"] and "émerveillés" in page["text"]


# SP2 playability P1-8: handout-phone.jpg is the clean render downscaled, blurred, JPEG-compressed
# and slightly rotated, the way a phone photo of a photocopied handout comes in. The threshold is
# calibrated so that this photo yields chips (misreads and shaky accented words) while the clean
# fixtures yield none.
@pytest.mark.skipif(not HAS_TESSERACT, reason="tesseract binary not installed")
def test_phone_photo_flags_words_to_verify_and_clean_prints_do_not(lexicon):
    phone = ocr_page((FIX / "handout-phone.jpg").read_bytes(), is_known=lexicon.is_known)
    assert "fées dansent" in phone["text"]
    assert phone["low_confidence"], phone
    assert all(word == word.strip(".,;:!?«»\"'") for word in phone["low_confidence"])
    assert phone["low_confidence"] == list(dict.fromkeys(phone["low_confidence"]))
    for name in ("handout.png", "handout-rotated.jpg"):
        assert ocr_page((FIX / name).read_bytes(), is_known=lexicon.is_known)["low_confidence"] == []
