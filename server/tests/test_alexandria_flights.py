"""Fix round 5: Alexandria refreshes are single-flight per work and bounded, so presses of
« Recopier à nouveau » can neither redo the same work in parallel nor starve the rest of the API."""
import asyncio
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from app.alexandria.allowlist import load_allowlist
from app.alexandria.flights import RefreshFlights
from app.main import create_app


def test_concurrent_runs_of_one_key_share_a_single_run():
    calls = []

    def fn():
        calls.append(1)
        return {"n": len(calls)}

    async def main():
        flights = RefreshFlights()
        # gather starts the six callers in order before the leader's thread can even be scheduled,
        # so all six attach to the same flight.
        return await asyncio.gather(*(flights.run("verne", fn) for _ in range(6))), flights

    results, flights = asyncio.run(main())
    assert len(calls) == 1
    assert all(r is results[0] for r in results)
    assert flights.waiters("verne") == 0


def test_a_finished_flight_is_not_cached_the_next_run_refreshes_again():
    calls = []

    def fn():
        calls.append(1)
        return len(calls)

    async def main():
        flights = RefreshFlights()
        return await flights.run("verne", fn), await flights.run("verne", fn)

    assert asyncio.run(main()) == (1, 2)


def test_an_error_reaches_every_waiter_and_clears_the_flight():
    def boom():
        raise RuntimeError("scribes en grève")

    async def main():
        flights = RefreshFlights()
        outcomes = await asyncio.gather(*(flights.run("verne", boom) for _ in range(3)), return_exceptions=True)
        again = await flights.run("verne", lambda: "ok")
        return outcomes, again

    outcomes, again = asyncio.run(main())
    assert [str(o) for o in outcomes] == ["scribes en grève"] * 3
    assert again == "ok"


def test_runs_of_different_keys_are_bounded():
    lock = threading.Lock()
    state = {"now": 0, "max": 0}

    def fn():
        with lock:
            state["now"] += 1
            state["max"] = max(state["max"], state["now"])
        time.sleep(0.05)  # long enough for an unbounded runner to overlap the others
        with lock:
            state["now"] -= 1

    async def main():
        flights = RefreshFlights(max_concurrent=2)
        await asyncio.gather(*(flights.run(f"work-{i}", fn) for i in range(6)))

    asyncio.run(main())
    assert state["max"] == 2


def test_a_cancelled_waiter_does_not_cancel_the_shared_run():
    release = threading.Event()

    def fn():
        release.wait(10)
        return "done"

    async def main():
        flights = RefreshFlights()
        quitter = asyncio.create_task(flights.run("verne", fn))
        stayer = asyncio.create_task(flights.run("verne", fn))
        await asyncio.sleep(0)
        quitter.cancel()
        await asyncio.gather(quitter, return_exceptions=True)
        release.set()
        return await stayer

    assert asyncio.run(main()) == "done"


class _GatedFetcher:
    """Offline-fixture stand-in whose first page fetch blocks until the test opens the gate."""

    def __init__(self):
        self.gate = threading.Event()
        self.calls = 0

    def wikisource_page(self, title):
        self.calls += 1
        self.gate.wait(30)
        prose = ("Le vieux marin regardait la mer. Les vagues grises montaient lentement vers la plage, "
                 "et les mouettes criaient au-dessus des rochers. ") * 12
        return f'<div class="mw-parser-output"><p>{prose}</p></div>'

    def gutenberg_text(self, ebook_id):
        raise AssertionError("not used")


def _wait_until(predicate, timeout=20.0):
    deadline = time.monotonic() + timeout
    while not predicate():
        if time.monotonic() > deadline:
            raise AssertionError("condition not reached in time")
        time.sleep(0.01)


def test_many_refresh_presses_run_once_and_do_not_starve_other_endpoints(settings):
    presses = 60
    # More presses than the request threadpool has threads (40): as a sync endpoint every press
    # held a thread for the whole refresh, so the works listing below queued behind them.
    fetcher = _GatedFetcher()
    with TestClient(create_app(settings)) as client:
        client.app.state.fetcher = fetcher
        client.app.state.annotator = lambda body: {"version": 3, "tokens": [], "chains": [], "sentences": []}
        flights = client.app.state.alexandria_refreshes
        work = next(w for w in load_allowlist(settings.content_dir) if w.source == "wikisource")
        work_id = work.id
        with ThreadPoolExecutor(max_workers=presses) as pool:
            futures = [pool.submit(client.post, f"/api/alexandria/works/{work_id}/refresh") for _ in range(presses)]
            try:
                _wait_until(lambda: flights.waiters(work_id) == presses)
                started = time.monotonic()
                assert client.get("/api/alexandria/works").status_code == 200
                assert client.post("/api/profiles", json={"name": "Pendant", "avatar": "chouette", "level": "9H"}).status_code == 201
                assert time.monotonic() - started < 5
            finally:
                fetcher.gate.set()
            responses = [f.result(30) for f in futures]
        assert all(r.status_code == 200 for r in responses)
        assert len({r.text for r in responses}) == 1
        assert fetcher.calls == len(work.pages)  # every page fetched once: a single refresh ran
