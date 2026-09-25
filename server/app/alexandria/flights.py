"""Single-flight, bounded runner for Alexandria refreshes (UI3a fix round 5, revised fix round 6).

A refresh fetches a work (up to 45 Wikisource pages, one by one, 20 s timeout each) then runs spaCy
on the accepted passages: seconds of CPU per call. Run as a plain sync endpoint, each press of
« Demander une nouvelle copie » held one of the shared request threadpool's threads for that whole time, and
nothing merged presses on the same work: a couple of dozen concurrent refreshes (several players, or
e2e workers) took every thread, so unrelated endpoints (creating a profile, listing works) timed out
behind them.

`RefreshFlights.run(key, fn)`:
- single-flight per key: a refresh of a work already in flight does not start a second one; it
  waits for that one and returns its result (or raises its error);
- loosely bounded, at the whole-`fn` (fetch + orchestration) level: `fn` runs on its own capacity
  limiter (`max_concurrent` threads, separate from the request threadpool's limiter), sized
  generously so one work's fetch never queues behind another's. Round 5 set this to 1, which was too
  tight: a real fetch (up to 45 pages at 20 s each) then spaCy could make a *second* work's refresh
  exceed the client's 120 s timeout just by waiting behind the first. Single-flight already caps how
  many distinct flights can ever be alive at once, to the fixed allowlist's works;
- waiters hold no thread at all: they await an asyncio task on the event loop.
It must be used from the event loop (an `async def` endpoint); all bookkeeping runs on that one loop,
so it needs no lock.

`AnnotationLimiter` bounds the step that actually is CPU-bound instead (spaCy's shared nlp object
must stay safe under concurrent use): wrap `annotate_fn` with it before passing it into
`refresh_work`, so at most `max_concurrent` annotation calls run at once however many works are
fetching concurrently. It is a plain `threading.Semaphore`, not an `anyio.CapacityLimiter`: `fn` (and
the annotate_fn call inside it) runs synchronously in a worker thread, off the event loop, where
anyio's async-only acquire could not be awaited.
"""
from __future__ import annotations

import asyncio
import threading
from typing import Any, Callable

import anyio


class RefreshFlights:
    def __init__(self, max_concurrent: int = 1) -> None:
        self._max_concurrent = max_concurrent
        self._limiter: anyio.CapacityLimiter | None = None  # created lazily, on the loop
        self._flights: dict[str, asyncio.Task] = {}
        self._waiters: dict[str, int] = {}

    def waiters(self, key: str) -> int:
        """How many callers are currently waiting on `key`'s flight (the leader included)."""
        return self._waiters.get(key, 0)

    async def run(self, key: str, fn: Callable[[], Any]) -> Any:
        task = self._flights.get(key)
        if task is None:
            task = asyncio.get_running_loop().create_task(self._lead(key, fn))
            # Nobody may be left awaiting it (every caller cancelled, e.g. clients gone): still
            # retrieve its outcome so an error is not reported as "never retrieved".
            task.add_done_callback(lambda t: t.cancelled() or t.exception())
            self._flights[key] = task
        self._waiters[key] = self._waiters.get(key, 0) + 1
        try:
            # shield: a caller that goes away (client disconnect) must not cancel the refresh the
            # other callers are waiting on.
            return await asyncio.shield(task)
        finally:
            self._waiters[key] -= 1
            if not self._waiters[key]:
                del self._waiters[key]

    async def _lead(self, key: str, fn: Callable[[], Any]) -> Any:
        try:
            if self._limiter is None:
                self._limiter = anyio.CapacityLimiter(self._max_concurrent)
            return await anyio.to_thread.run_sync(fn, limiter=self._limiter)
        finally:
            # Once finished, the next refresh of this work really refreshes again.
            del self._flights[key]


class AnnotationLimiter:
    """Bounds how many `annotate_fn` (spaCy) calls run at once, across every refresh currently
    fetching — see the module docstring for why this is a plain `threading.Semaphore` rather than
    an `anyio.CapacityLimiter`."""

    def __init__(self, max_concurrent: int) -> None:
        self._semaphore = threading.Semaphore(max_concurrent)

    def wrap(self, fn: Callable[..., Any]) -> Callable[..., Any]:
        def bounded(*args: Any, **kwargs: Any) -> Any:
            with self._semaphore:
                return fn(*args, **kwargs)
        return bounded
