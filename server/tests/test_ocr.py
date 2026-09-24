import shutil
from pathlib import Path
import pytest
from app.ocr import OcrWord, assemble, clean_ocr_text, ocr_page, preprocess

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
