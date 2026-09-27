"""One worker thread makes the lines one at a time (spec 2026-09-27 §4.1): a line asked for now goes to
the front of the queue, and two requests for the same line share one job."""
from __future__ import annotations

import threading
from collections import deque
from concurrent.futures import Future
from dataclasses import dataclass, field
from typing import Callable

from app.cache import Cache


@dataclass(frozen=True)
class Line:
    text: str    # normalised and respelled
    speed: float


@dataclass(eq=False)
class _Job:
    key: str
    line: Line
    future: Future = field(default_factory=Future)


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

    def request(self, line: Line, urgent: bool) -> Future:
        k = self._key(line)
        data = self._cache.get(k)
        if data is not None:
            done: Future = Future()
            done.set_result(data)
            return done
        with self._cv:
            job = self._jobs.get(k)
            if job is None:
                job = _Job(k, line)
                self._jobs[k] = job
                if urgent:
                    self._queue.appendleft(job)
                else:
                    self._queue.append(job)
                self._cv.notify()
            elif urgent and job in self._queue:
                self._queue.remove(job)
                self._queue.appendleft(job)
            return job.future

    def pending(self) -> list[str]:
        with self._cv:
            return [j.line.text for j in self._queue]

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
                self._forget(job)
                job.future.set_exception(e)
            else:
                self._forget(job)
                job.future.set_result(data)

    def _forget(self, job: _Job) -> None:
        """The job leaves the table before its future settles (preflight ruling #4): a request that finds
        it gone reads the cache or starts a fresh job, never a finished future (or an old failure)."""
        with self._cv:
            self._jobs.pop(job.key, None)
