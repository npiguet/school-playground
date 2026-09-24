"""FastAPI dependency wiring for the NLP annotator (lazy-loaded, cached on app.state)."""
from __future__ import annotations
from typing import Callable
from fastapi import Request
from app.lexicon import load_lexicon
from app.nlp.annotate import annotate
from app.nlp.homophones import load_homophones
from app.nlp.model import get_nlp


def make_annotator(settings) -> Callable[[str], dict]:
    nlp = get_nlp(settings.spacy_model)
    homophones = load_homophones(settings.content_dir)
    lexicon = load_lexicon(settings.content_dir)
    return lambda text: annotate(text, nlp, homophones, lexicon)


def get_annotator(request: Request) -> Callable[[str], dict]:
    if not hasattr(request.app.state, "annotator"):
        request.app.state.annotator = make_annotator(request.app.state.settings)
    return request.app.state.annotator
