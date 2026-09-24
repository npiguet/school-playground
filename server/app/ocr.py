"""Pillow preprocessing + Tesseract `fra` OCR for photographed printed handouts (spec §3.2, §5).

Pipeline: preprocess() normalises orientation/size/contrast, run_tesseract() extracts
per-word data, assemble() turns words into paragraphs (dehyphenated, page numbers
dropped) plus a list of low-confidence words, and clean_ocr_text() tidies punctuation
and quotes so the OCR output reads like normal French prose.
"""
from __future__ import annotations
import io
import re
import statistics
from dataclasses import dataclass
from typing import Callable

from PIL import Image, ImageOps
from pytesseract import Output
import pytesseract

MAX_SIDE = 2200
# Per-word Tesseract confidence under which a word is listed « À vérifier ». Calibrated on the
# fixtures (SP2 playability P1-8): a clean print scores 89–97 on every word, so the old 60 never
# fired; a phone-like photo of the same handout (handout-phone.jpg: downscaled, blurred, JPEG-
# compressed, slightly rotated) scores 0–56 on its misreads and 67–68 on the shaky accented
# words that are right — exactly the ones the child must compare with the paper.
LOW_CONF = 75
TESSERACT_CONFIG = "--psm 6"
# `--psm 6` ("assume a single uniform block of text") makes Tesseract report a printed
# handout's title and body as the same (block, par) - real handouts almost always set a title
# apart with visibly more vertical space than between two body lines, so relying on Tesseract's
# own grouping alone would glue the title onto the first sentence. A gap this many times the
# document's median line height is treated as a paragraph break within a (block, par) group too.
PARAGRAPH_GAP_FACTOR = 1.6

DIGIT_OR_PUNCT_LINE_RE = re.compile(r"^[\d\W]+$")
# A word of the assembled text, elisions and hyphens kept (« l'enfant », « porte-monnaie »).
WORD_RE = re.compile(r"[^\W\d_]+(?:['-][^\W\d_]+)*")
_EDGE_PUNCT_RE = re.compile(r"^[^\w]+|[^\w]+$")


@dataclass(frozen=True, slots=True)
class OcrWord:
    text: str
    conf: float
    block: int
    par: int
    line: int
    left: int
    top: int
    width: int
    height: int


def preprocess(data: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img)
    img = img.convert("L")
    scale = MAX_SIDE / max(img.size)
    new_size = (round(img.width * scale), round(img.height * scale))
    img = img.resize(new_size, Image.LANCZOS)
    img = ImageOps.autocontrast(img, cutoff=1)
    return img


def run_tesseract(img: Image.Image) -> list[OcrWord]:
    data = pytesseract.image_to_data(img, lang="fra", config=TESSERACT_CONFIG, output_type=Output.DICT)
    words: list[OcrWord] = []
    for i, text in enumerate(data["text"]):
        if not text.strip():
            continue
        conf = float(data["conf"][i])
        if conf == -1:
            continue
        words.append(OcrWord(
            text=text, conf=conf,
            block=data["block_num"][i], par=data["par_num"][i], line=data["line_num"][i],
            left=data["left"][i], top=data["top"][i], width=data["width"][i], height=data["height"][i]))
    return words


def _join_lines(lines: list[str]) -> str:
    result = ""
    for line in lines:
        if not result:
            result = line
        elif result.endswith("-") and line[:1].islower():
            result = result[:-1] + line
        else:
            result = result + " " + line
    return result


def _chip(text: str) -> str:
    """The word as the verify screen lists it: without the punctuation Tesseract glued to it
    (« forêt. » → « forêt »), so the chip matches a word of the textarea."""
    word = _EDGE_PUNCT_RE.sub("", text)
    return word if any(ch.isalpha() for ch in word) else ""


def unknown_words(text: str, is_known: Callable[[str], bool]) -> list[str]:
    """Words of the assembled text the lexicon does not know, in order, once each: a misread
    the OCR was confident about (« oissaux »), or a proper name — both worth a look at the paper.
    Hyphenated compounds are checked part by part (after dehyphenation, so a line-end split like
    « vil-lage » never shows up)."""
    out: list[str] = []
    for word in WORD_RE.findall(text):
        if word in out:
            continue
        if all(is_known(part) for part in word.split("-") if part):
            continue
        out.append(word)
    return out


def assemble(words: list[OcrWord], is_known: Callable[[str], bool] | None = None) -> tuple[str, list[str]]:
    paragraphs: dict[tuple[int, int], dict[int, list[OcrWord]]] = {}
    para_order: list[tuple[int, int]] = []
    for word in words:
        key = (word.block, word.par)
        if key not in paragraphs:
            paragraphs[key] = {}
            para_order.append(key)
        paragraphs[key].setdefault(word.line, []).append(word)

    heights = [word.height for word in words if word.height > 0]
    gap_threshold = statistics.median(heights) * PARAGRAPH_GAP_FACTOR if heights else 0

    paragraph_texts: list[str] = []
    for key in para_order:
        lines_by_num = paragraphs[key]
        groups: list[list[str]] = [[]]
        prev_bottom: int | None = None
        for line_num in sorted(lines_by_num):
            line_words = lines_by_num[line_num]
            line_text = " ".join(w.text for w in line_words)
            if DIGIT_OR_PUNCT_LINE_RE.match(line_text):
                continue
            line_top = min(w.top for w in line_words)
            line_bottom = max(w.top + w.height for w in line_words)
            if prev_bottom is not None and (line_top - prev_bottom) > gap_threshold:
                groups.append([])
            groups[-1].append(line_text)
            prev_bottom = line_bottom
        for lines in groups:
            if lines:
                paragraph_texts.append(_join_lines(lines))

    text = clean_ocr_text("\n\n".join(paragraph_texts))

    low_confidence: list[str] = []
    for word in words:
        chip = _chip(word.text) if 0 <= word.conf < LOW_CONF else ""
        if chip and chip not in low_confidence:
            low_confidence.append(chip)
    if is_known is not None:
        low_confidence += [w for w in unknown_words(text, is_known) if w not in low_confidence]

    return text, low_confidence


_QUOTE_SINGLE_RE = re.compile(r"[’‘ʼ]")
_QUOTE_DOUBLE_RE = re.compile(r"[“”„]")
_NBSP_RE = re.compile(r"[  ]")
_GUILLEMET_OPEN_RE = re.compile(r"«\s*")
_GUILLEMET_CLOSE_RE = re.compile(r"\s*»")
_SPACE_BEFORE_COMMA_DOT_RE = re.compile(r"\s+([,.])")
_SPACE_BEFORE_HI_PUNCT_RE = re.compile(r"(\w)\s*([;:!?])")
_MULTI_SPACE_RE = re.compile(r" {2,}")
_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")


def clean_ocr_text(text: str) -> str:
    text = _QUOTE_SINGLE_RE.sub("'", text)
    text = _QUOTE_DOUBLE_RE.sub('"', text)
    text = _NBSP_RE.sub(" ", text)
    text = _GUILLEMET_OPEN_RE.sub("« ", text)
    text = _GUILLEMET_CLOSE_RE.sub(" »", text)
    text = _SPACE_BEFORE_COMMA_DOT_RE.sub(r"\1", text)
    text = _SPACE_BEFORE_HI_PUNCT_RE.sub(r"\1 \2", text)  # exactly one space before ; : ! ? after a letter
    text = _MULTI_SPACE_RE.sub(" ", text)
    text = _MULTI_NEWLINE_RE.sub("\n\n", text)
    text = "\n".join(line.strip() for line in text.split("\n"))
    return text.strip()


def ocr_page(data: bytes, ocr=run_tesseract, is_known: Callable[[str], bool] | None = None) -> dict:
    img = preprocess(data)
    text, low_confidence = assemble(ocr(img), is_known)
    return {"text": text, "low_confidence": low_confidence, "width": img.width, "height": img.height}
