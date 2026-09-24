"""Pillow preprocessing + Tesseract `fra` OCR for photographed printed handouts (spec §3.2, §5).

Pipeline: preprocess() normalises orientation/size/contrast, run_tesseract() extracts
per-word data, assemble() turns words into paragraphs (dehyphenated, page numbers
dropped) plus a list of low-confidence words, and clean_ocr_text() tidies punctuation
and quotes so the OCR output reads like normal French prose.
"""
from __future__ import annotations
import io
import re
from dataclasses import dataclass

from PIL import Image, ImageOps
from pytesseract import Output
import pytesseract

MAX_SIDE = 2200
LOW_CONF = 60
TESSERACT_CONFIG = "--psm 6"

DIGIT_OR_PUNCT_LINE_RE = re.compile(r"^[\d\W]+$")


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


def assemble(words: list[OcrWord]) -> tuple[str, list[str]]:
    paragraphs: dict[tuple[int, int], dict[int, list[OcrWord]]] = {}
    para_order: list[tuple[int, int]] = []
    for word in words:
        key = (word.block, word.par)
        if key not in paragraphs:
            paragraphs[key] = {}
            para_order.append(key)
        paragraphs[key].setdefault(word.line, []).append(word)

    paragraph_texts: list[str] = []
    for key in para_order:
        lines_by_num = paragraphs[key]
        lines: list[str] = []
        for line_num in sorted(lines_by_num):
            line_text = " ".join(w.text for w in lines_by_num[line_num])
            if DIGIT_OR_PUNCT_LINE_RE.match(line_text):
                continue
            lines.append(line_text)
        if lines:
            paragraph_texts.append(_join_lines(lines))

    text = clean_ocr_text("\n\n".join(paragraph_texts))

    low_confidence: list[str] = []
    seen: set[str] = set()
    for word in words:
        if 0 <= word.conf < LOW_CONF and any(ch.isalpha() for ch in word.text) and word.text not in seen:
            seen.add(word.text)
            low_confidence.append(word.text)

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


def ocr_page(data: bytes, ocr=run_tesseract) -> dict:
    img = preprocess(data)
    text, low_confidence = assemble(ocr(img))
    return {"text": text, "low_confidence": low_confidence, "width": img.width, "height": img.height}
