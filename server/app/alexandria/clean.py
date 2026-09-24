"""Turn raw Wikisource HTML or Gutenberg plain text into clean prose/verse paragraphs."""
from __future__ import annotations

import re
from dataclasses import dataclass
from html.parser import HTMLParser

SKIP_TAGS = {"table", "style", "script", "sup", "h1", "h2", "h3", "h4", "nav", "ol"}
SKIP_CLASSES = {
    "reference", "references", "ws-noexport", "mw-editsection", "pagenum", "ws-summary",
    "ws-header", "ws-footer", "noprint", "mw-references-wrap", "toc",
}


@dataclass
class Paragraph:
    text: str
    kind: str  # 'prose' | 'verse'


def clean_text(text: str) -> str:
    s = text
    s = re.sub(r"[’‘ʼ]", "'", s)
    s = re.sub(r"[“”]", '"', s)
    s = re.sub(r"[\xa0  ]", " ", s)
    s = re.sub(r"\[\d+\]", "", s)
    s = re.sub(r"\(\d+\)", "", s)
    s = re.sub(r"«\s*", "« ", s)
    s = re.sub(r"\s*»", " »", s)
    s = s.replace("très-", "très ")
    s = s.replace("–", "—")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _classes_of(attrs: list[tuple[str, str | None]]) -> set[str]:
    for name, value in attrs:
        if name == "class" and value:
            return set(value.split())
    return set()


class _ParagraphCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.paragraphs: list[Paragraph] = []
        self._skip_stack: list[bool] = []
        self._poem_stack: list[bool] = []
        self._p_depth = 0
        self._buf: list[str] = []
        self._para_is_verse = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        classes = _classes_of(attrs)
        parent_skip = self._skip_stack[-1] if self._skip_stack else False
        skip_now = parent_skip or tag in SKIP_TAGS or bool(classes & SKIP_CLASSES)
        self._skip_stack.append(skip_now)
        parent_poem = self._poem_stack[-1] if self._poem_stack else False
        self._poem_stack.append(parent_poem or (tag == "div" and "poem" in classes))
        if tag == "p" and not skip_now:
            self._p_depth += 1
            if self._p_depth == 1:
                self._buf = []
                self._para_is_verse = self._poem_stack[-1]
        elif tag == "br" and self._p_depth > 0 and not skip_now:
            self._buf.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if self._skip_stack:
            self._skip_stack.pop()
        if self._poem_stack:
            self._poem_stack.pop()
        if tag == "p" and self._p_depth > 0:
            self._p_depth -= 1
            if self._p_depth == 0:
                text = clean_text("".join(self._buf))
                if text:
                    self.paragraphs.append(Paragraph(text, "verse" if self._para_is_verse else "prose"))

    def handle_data(self, data: str) -> None:
        if self._p_depth > 0 and not (self._skip_stack and self._skip_stack[-1]):
            self._buf.append(data)


def wikisource_html_to_paragraphs(html: str) -> list[Paragraph]:
    collector = _ParagraphCollector()
    collector.feed(html)
    collector.close()
    return collector.paragraphs


def gutenberg_text_to_paragraphs(txt: str) -> list[Paragraph]:
    lines = txt.splitlines()
    start = next((i for i, l in enumerate(lines) if "*** START OF" in l), None)
    end = next((i for i, l in enumerate(lines) if "*** END OF" in l), None)
    if start is None or end is None or end <= start:
        return []
    body_lines = lines[start + 1:end]
    text = "\n".join(body_lines)
    blocks = [b.strip("\n") for b in re.split(r"\n[ \t]*\n", text)]
    paragraphs: list[Paragraph] = []
    for block in blocks:
        block_lines = [l.strip() for l in block.splitlines() if l.strip()]
        if not block_lines:
            continue
        is_verse = (len(block_lines) >= 4
                    and all(len(l) < 50 for l in block_lines)
                    and all(l[0].isupper() for l in block_lines))
        if is_verse:
            joined = "\n".join(block_lines)
        else:
            joined = " ".join(block_lines)
        cleaned = clean_text(joined)
        if cleaned:
            paragraphs.append(Paragraph(cleaned, "verse" if is_verse else "prose"))
    return paragraphs
