import threading

from app.cache import Cache
from app.worker import Line, Worker


def blocking():
    """A `make` that holds its first line until released; every line after it goes straight through."""
    started, release, made = threading.Event(), threading.Event(), []

    def make(line: Line) -> bytes:
        made.append(line.text)
        started.set()
        release.wait(5)
        return b"mp3:" + line.text.encode()

    return make, started, release, made


def worker(tmp_path, make):
    w = Worker(make, Cache(tmp_path, 10_000_000), key=lambda line: f"{line.speed}|{line.text}")
    w.start()
    return w


def test_lines_are_made_one_at_a_time_in_order(tmp_path):
    make, started, release, made = blocking()
    w = worker(tmp_path, make)
    futures = [w.request(Line(t, 1.0), urgent=False) for t in "ABC"]
    started.wait(5)
    assert w.pending() == ["B", "C"]
    release.set()
    assert [f.result(5) for f in futures] == [b"mp3:A", b"mp3:B", b"mp3:C"]
    assert made == ["A", "B", "C"]
    w.stop()


def test_a_line_asked_for_now_jumps_the_queue(tmp_path):
    make, started, release, made = blocking()
    w = worker(tmp_path, make)
    w.request(Line("A", 1.0), urgent=False)
    started.wait(5)
    w.request(Line("B", 1.0), urgent=False)
    w.request(Line("C", 1.0), urgent=False)
    d = w.request(Line("D", 1.0), urgent=True)
    assert w.pending() == ["D", "B", "C"]
    c = w.request(Line("C", 1.0), urgent=True)   # already queued: moves to the front
    assert w.pending() == ["C", "D", "B"]
    release.set()
    c.result(5), d.result(5)
    w.stop()
    assert made[:3] == ["A", "C", "D"]


def test_two_requests_for_one_line_share_one_job(tmp_path):
    make, started, release, made = blocking()
    w = worker(tmp_path, make)
    w.request(Line("A", 1.0), urgent=False)
    started.wait(5)
    first = w.request(Line("B", 1.0), urgent=False)
    again = w.request(Line("B", 1.0), urgent=True)
    running = w.request(Line("A", 1.0), urgent=True)   # being made: the same job too
    assert again is first
    release.set()
    assert first.result(5) == b"mp3:B" and running.result(5) == b"mp3:A"
    w.stop()
    assert made == ["A", "B"]


def test_a_cached_line_needs_no_job(tmp_path):
    make, _, release, made = blocking()
    release.set()
    w = worker(tmp_path, make)
    assert w.request(Line("A", 1.0), urgent=True).result(5) == b"mp3:A"
    assert w.request(Line("A", 1.0), urgent=True).result(5) == b"mp3:A"
    assert made == ["A"]
    w.stop()


def test_a_failed_line_is_tried_again_when_asked_again(tmp_path):
    calls = []

    def make(line: Line) -> bytes:
        calls.append(line.text)
        if len(calls) == 1:
            raise RuntimeError("tripped")
        return b"ok"

    w = worker(tmp_path, make)
    failed = w.request(Line("A", 1.0), urgent=True)
    assert isinstance(failed.exception(5), RuntimeError)
    assert w.request(Line("A", 1.0), urgent=True).result(5) == b"ok"
    w.stop()
