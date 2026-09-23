"""Lazy, process-wide spaCy model loader."""
from functools import lru_cache
import spacy


@lru_cache(maxsize=2)
def get_nlp(model_name: str):
    return spacy.load(model_name, exclude=["ner"])
