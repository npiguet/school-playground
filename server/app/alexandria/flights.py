"""Single-flight, bounded runner for Alexandria refreshes (UI3a fix round 5).

A refresh fetches a work and runs spaCy on up to MAX_CHUNKS passages: seconds of CPU per call. Run
as a plain sync endpoint, each press of « Recopier à nouveau » held one of the shared request
threadpool's threads for that whole time, and nothing merged presses on the same work: a couple of
dozen concurrent refreshes (several players, or e2e workers) took every thread, so unrelated
endpoints (creating a profile, listing works) timed out behind them.

`RefreshFlights.run(key, fn)`:
- single-flight per key: a refresh of a work already in flight does not start a second one; it
  waits for that one and returns its result (or raises its error);
- bounded: the blocking work runs on its own capacity limiter (`max_concurrent` threads, separate
  from the request threadpool's limiter), so refreshes of different works queue behind each other
  instead of crowding out the rest of the API;
- waiters hold no thread at all: they await an asyncio task on the event loop.
It must be used from the event loop (an `async def` endpoint); all bookkeeping runs on that one
loop, so it needs no lock.
"""
from __future__ import annotations

import asyncio
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
