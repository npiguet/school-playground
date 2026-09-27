"""One worker thread makes the lines one at a time (spec 2026-09-27 §4.1): a line asked for now goes to
the front of the queue, and two requests for the same line share one job. A new /prepare replaces the
lines still queued that nobody waits on (one child plays at a time: the latest dictation wins)."""
from __future__ import annotations

import logging
import threading
from collections import deque
from concurrent.futures import Future, InvalidStateError
from dataclasses import dataclass, field
from typing import Callable

from app.cache import Cache

log = logging.getLogger("uvicorn.error")


@dataclass(frozen=True)
class Line:
    text: str    # normalised and respelled
    speed: float


@dataclass(eq=False)
class _Job:
    key: str
    line: Line
    # Someone holds its future (a request: /speak): a new /prepare never drops it.
    waited: bool = False
    future: Future = field(default_factory=Future)


def _settled(data: bytes) -> Future:
    done: Future = Future()
    done.set_result(data)
    return done


class Worker:
    def __init__(self, make: Callable[[Line], bytes], cache: Cache, key: Callable[[Line], str]):
        self._make, self._cache, self._key = make, cache, key
        self._queue: deque[_Job] = deque()
        self._jobs: dict[str, _Job] = {}
        self._cv = threading.Condition()
        self._stopping = False
        self._thread = threading.Thread(target=self._run, name="tts-worker", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        with self._cv:
            self._stopping = True
            self._cv.notify_all()
        self._thread.join(timeout=5)

    def alive(self) -> bool:
        return self._thread.is_alive()

    def request(self, line: Line, urgent: bool) -> Future:
        """The line's MP3: at once if cached, else from its job (queued now, or the one already there)."""
        k = self._key(line)
        while True:
            data = self._cache.get(k)
            if data is not None:
                return _settled(data)
            job = self._enqueue(k, line, urgent)
            if job is not None:
                return job.future
            # Made between the miss above and the lock: read it now (or, evicted since, ask again).

    def prepare(self, lines: list[Line]) -> None:
        """/prepare: these lines, in order, replace every queued job nobody waits on. A job a request asked
        for, and the one being made, stay; a line cached or already waited on is not queued again. So the
        jobs queued and not waited on are at most one /prepare's lines (the queue's bound). Reads no file."""
        with self._cv:
            kept = deque(j for j in self._queue if j.waited)
            dropped = {j.key: j for j in self._queue if not j.waited}
            for k in dropped:
                del self._jobs[k]
            for line in lines:
                k = self._key(line)
                if k in self._jobs:          # waited on, being made, or already in this list
                    continue
                job = dropped.pop(k, None)   # still wanted: the same job, at its new place
                if job is None:
                    if self._cache.has(k):
                        continue
                    job = self._new_job(k, line)
                self._jobs[k] = job
                kept.append(job)
            self._queue = kept
            self._cv.notify()

    def pending(self) -> list[str]:
        with self._cv:
            return [j.line.text for j in self._queue]

    def _new_job(self, k: str, line: Line) -> _Job:
        job = _Job(k, line)
        # Running from the start: shared by every waiter, so none of them can cancel it.
        job.future.set_running_or_notify_cancel()
        return job

    def _enqueue(self, k: str, line: Line, urgent: bool) -> _Job | None:
        """The line's job, new or existing, now waited on; None if the line got cached since the caller's
        miss (`put` comes before `_settle`, so no job under the lock means the file is there, or the line
        failed)."""
        with self._cv:
            job = self._jobs.get(k)
            if job is None:
                if self._cache.has(k):
                    return None
                job = self._new_job(k, line)
                self._jobs[k] = job
                if urgent:
                    self._queue.appendleft(job)
                else:
                    self._queue.append(job)
                self._cv.notify()
            elif urgent and job in self._queue:
                self._queue.remove(job)
                self._queue.appendleft(job)
            job.waited = True
            return job

    def _run(self) -> None:
        while True:
            with self._cv:
                while not self._queue and not self._stopping:
                    self._cv.wait()
                if self._stopping:
                    return
                job = self._queue.popleft()
            try:
                data = self._make(job.line)
                self._cache.put(job.key, data)
            except BaseException as e:  # the request that waits on it answers 500; the next one tries again
                log.exception("tts: the voice could not say a line (%d characters at %.2f)",
                              len(job.line.text), job.line.speed)
                self._settle(job, lambda: job.future.set_exception(e))
            else:
                self._settle(job, lambda: job.future.set_result(data))

    def _settle(self, job: _Job, settle: Callable[[], None]) -> None:
        # The job leaves the table before its future settles (preflight ruling #4): a request that finds
        # it gone reads the cache or starts a fresh job, never a finished future (or an old failure).
        with self._cv:
            if self._jobs.get(job.key) is job:
                del self._jobs[job.key]
        if job.future.done():   # a waiter settled it itself: the worker carries on regardless
            return
        try:
            settle()
        except InvalidStateError:
            pass
