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
    assert started.wait(5)
    assert w.pending() == ["B", "C"]
    release.set()
    assert [f.result(5) for f in futures] == [b"mp3:A", b"mp3:B", b"mp3:C"]
    assert made == ["A", "B", "C"]
    w.stop()


def test_a_line_asked_for_now_jumps_the_queue(tmp_path):
    make, started, release, made = blocking()
    w = worker(tmp_path, make)
    w.request(Line("A", 1.0), urgent=False)
    assert started.wait(5)
    w.request(Line("B", 1.0), urgent=False)
    w.request(Line("C", 1.0), urgent=False)
    d = w.request(Line("D", 1.0), urgent=True)
    assert w.pending() == ["D", "B", "C"]
    c = w.request(Line("C", 1.0), urgent=True)   # already queued: moves to the front
    assert w.pending() == ["C", "D", "B"]
    release.set()
    b = w.request(Line("B", 1.0), urgent=False)
    c.result(5), d.result(5), b.result(5)
    w.stop()
    assert made == ["A", "C", "D", "B"]


def test_two_requests_for_one_line_share_one_job(tmp_path):
    make, started, release, made = blocking()
    w = worker(tmp_path, make)
    a = w.request(Line("A", 1.0), urgent=False)
    assert started.wait(5)
    first = w.request(Line("B", 1.0), urgent=False)
    again = w.request(Line("B", 1.0), urgent=True)
    running = w.request(Line("A", 1.0), urgent=True)   # being made: the same job too
    assert again is first and running is a
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


class GatedCache(Cache):
    """A cache whose next missed `get` waits at a gate once `hold` is set: the window between a request's
    cache miss and its taking the worker's lock, held open on purpose."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.hold, self.missed, self.gate = False, threading.Event(), threading.Event()

    def get(self, key):
        data = super().get(key)
        if data is None and self.hold:
            self.hold = False
            self.missed.set()
            self.gate.wait(5)
        return data


def test_a_line_finished_while_asked_for_is_not_made_again(tmp_path):
    make, started, release, made = blocking()
    cache = GatedCache(tmp_path, 10_000_000)
    w = Worker(make, cache, key=lambda line: line.text)
    w.start()
    prepared = w.request(Line("A", 1.0), urgent=False)
    assert started.wait(5)
    cache.hold = True
    asked = []
    t = threading.Thread(target=lambda: asked.append(w.request(Line("A", 1.0), urgent=True)))
    t.start()
    assert cache.missed.wait(5)        # the request missed the cache, and has not taken the lock yet
    release.set()
    assert prepared.result(5) == b"mp3:A"   # the worker finished « A » and dropped its job meanwhile
    cache.gate.set()
    t.join(5)
    assert asked[0].result(5) == b"mp3:A"
    w.stop()
    assert made == ["A"]


def test_a_failed_line_is_never_handed_out_again(tmp_path):
    # Ruling #4: the job leaves the table before its future settles, so a request made the moment a line
    # fails (here from the failure's own callback, in the worker thread) starts a fresh job.
    release, calls, again = threading.Event(), [], []

    def make(line: Line) -> bytes:
        calls.append(line.text)
        if len(calls) == 1:
            release.wait(5)
            raise RuntimeError("tripped")
        return b"ok"

    asked = threading.Event()

    def ask_again(_):
        again.append(w.request(Line("A", 1.0), urgent=True))
        asked.set()

    w = worker(tmp_path, make)
    failed = w.request(Line("A", 1.0), urgent=True)
    failed.add_done_callback(ask_again)
    release.set()
    assert isinstance(failed.exception(5), RuntimeError)
    assert asked.wait(5)   # callbacks run just after the waiters wake: wait for this one
    assert again[0] is not failed
    assert again[0].result(5) == b"ok"
    w.stop()
    assert calls == ["A", "A"]


def test_a_waiter_cannot_cancel_or_break_the_shared_job(tmp_path):
    make, started, release, made = blocking()
    w = worker(tmp_path, make)
    w.request(Line("A", 1.0), urgent=False)
    assert started.wait(5)
    b = w.request(Line("B", 1.0), urgent=False)
    assert not b.cancel()                  # the job is shared: one waiter cannot cancel it for the others
    c = w.request(Line("C", 1.0), urgent=False)
    c.set_result(b"settled by a waiter")   # whatever a waiter does, the worker carries on
    release.set()
    assert b.result(5) == b"mp3:B"
    assert w.request(Line("D", 1.0), urgent=True).result(5) == b"mp3:D"
    assert w.alive()
    w.stop()
    assert made == ["A", "B", "C", "D"]
    assert not w.alive()


def test_preparing_lines_reads_no_file(tmp_path):
    make, started, release, made = blocking()
    cache = Cache(tmp_path, 10_000_000)
    reads = []
    cache.get = lambda key: reads.append(key)   # prepare() may only check that a line is there
    w = Worker(make, cache, key=lambda line: line.text)
    w.start()
    cache.put("A", b"mp3:A")
    w.prepare([Line("X", 1.0)])
    assert started.wait(5)                      # « X » is being made
    # « X » being made and « A » cached: nothing to do; « B » twice: once.
    w.prepare([Line("X", 1.0), Line("A", 1.0), Line("B", 1.0), Line("B", 1.0)])
    assert w.pending() == ["B"]
    assert reads == []
    release.set()
    w.stop()
    assert made[0] == "X" and "A" not in made


def test_a_line_that_fails_in_the_queue_is_logged(tmp_path, caplog):
    # A line /prepare queued has no waiter to report its failure: the worker logs it.
    def make(line: Line) -> bytes:
        raise RuntimeError("tripped")

    w = worker(tmp_path, make)
    f = w.request(Line("A", 1.0), urgent=False)
    assert isinstance(f.exception(5), RuntimeError)
    w.stop()
    assert any("could not say" in r.getMessage() and r.exc_info for r in caplog.records)


def test_a_new_prepare_drops_the_queued_lines_nobody_waits_for(tmp_path):
    # I2: one child plays at a time, so the latest dictation wins. A line asked for (/speak) and the line
    # being made stay; an abandoned dictation's lines no longer hold the one worker.
    make, started, release, made = blocking()
    w = worker(tmp_path, make)
    w.prepare([Line(t, 1.0) for t in "XABC"])
    assert started.wait(5)                                 # « X » is being made
    asked = w.request(Line("B", 1.0), urgent=True)         # the new dictation's first line, asked for now
    w.prepare([Line(t, 1.0) for t in "DXA"])               # « C » is dropped; « A » comes after « D »
    assert w.pending() == ["B", "D", "A"]
    release.set()
    assert asked.result(5) == b"mp3:B"
    assert w.request(Line("A", 1.0), urgent=False).result(5) == b"mp3:A"   # the last one, made
    w.stop()
    assert made == ["X", "B", "D", "A"]


def test_the_lines_queued_and_not_waited_on_are_one_prepare_at_most(tmp_path):
    # Final review M2: repeated /prepare calls cannot grow the queue (MAX_PREPARE_LINES bounds one call).
    make, started, release, made = blocking()
    w = worker(tmp_path, make)
    w.prepare([Line("X", 1.0)])
    assert started.wait(5)
    for n in range(5):
        w.prepare([Line(f"{n}-{i}", 1.0) for i in range(100)])
    assert w.pending() == [f"4-{i}" for i in range(100)]
    w.prepare([])
    assert w.pending() == []
    release.set()
    w.stop()


def test_a_line_asked_for_is_still_made_after_a_prepare_that_leaves_it_out(tmp_path):
    make, started, release, made = blocking()
    w = worker(tmp_path, make)
    w.prepare([Line("X", 1.0)])
    assert started.wait(5)
    waited = w.request(Line("A", 1.0), urgent=False)       # queued behind nothing, and waited on
    w.prepare([Line("B", 1.0)])
    assert w.pending() == ["A", "B"]
    release.set()
    assert waited.result(5) == b"mp3:A"
    w.stop()
