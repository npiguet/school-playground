"""get_annotator's lazy load is shared: concurrent first callers load the NLP stack once (final
review M15: several Alexandria refresh flights can reach a cold app at the same time)."""
import threading
import time
from types import SimpleNamespace

import app.deps as deps


def test_concurrent_first_calls_load_the_annotator_once(monkeypatch):
    loads = []

    def slow_make(settings):
        loads.append(settings)
        time.sleep(0.2)  # a spaCy load takes seconds: every racing caller arrives meanwhile
        return lambda text: {"text": text}

    monkeypatch.setattr(deps, "make_annotator", slow_make)
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(settings="S")))
    start = threading.Barrier(8)
    got = []

    def call():
        start.wait()
        got.append(deps.get_annotator(request))

    threads = [threading.Thread(target=call) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert loads == ["S"]
    assert len(got) == 8 and all(a is got[0] for a in got)


def test_a_loaded_annotator_is_reused(monkeypatch):
    monkeypatch.setattr(deps, "make_annotator", lambda settings: (_ for _ in ()).throw(AssertionError("reloaded")))
    ready = lambda text: {}
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(settings="S", annotator=ready)))
    assert deps.get_annotator(request) is ready
