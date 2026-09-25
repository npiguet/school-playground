"""FastAPI dependency wiring for the NLP annotator (lazy-loaded, cached on app.state)."""
from __future__ import annotations
import threading
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


# Several Alexandria refreshes (one flight per work) and text saves can reach a cold app at once:
# without the lock each of them loaded its own spaCy model (final review M15).
_annotator_lock = threading.Lock()


def get_annotator(request: Request) -> Callable[[str], dict]:
    state = request.app.state
    annotator = getattr(state, "annotator", None)
    if annotator is None:
        with _annotator_lock:
            annotator = getattr(state, "annotator", None)
            if annotator is None:
                annotator = make_annotator(state.settings)
                state.annotator = annotator
    return annotator
