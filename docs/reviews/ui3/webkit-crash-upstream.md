# Draft upstream report: WPEWebProcess crashes (SIGSEGV) about once in 1 300 Playwright tests

Status: **draft, not filed** (Ruling F3c). Where it would go: https://bugs.webkit.org, product WebKit,
component WPE WebKit (the bundle's README says so), with a link from a Playwright issue
(microsoft/playwright), since the build is Playwright's own WebKit bundle. Before filing, attach a
symbolised backtrace (see "What is missing" at the end).

## Summary

Running a Playwright suite against WPE WebKit (Playwright's `webkit` browser on Linux), the
`WPEWebProcess` of a page dies about once in 1 300 test executions. Playwright sees a page `crash`
event, and the test fails on whatever it was doing at the time. No frame of the backtrace is in the
page's own code: the faults are in libWPEWebKit, on WebKit worker threads.

## Versions and environment

| | |
|---|---|
| Playwright | `@playwright/test` 1.63.0, image `mcr.microsoft.com/playwright:v1.63.0-noble` |
| WebKit bundle | `webkit-2359`, `minibrowser-wpe` (Release, built 2026-09-01 on Ubuntu 24.04.4), `libWPEWebKit-2.0.so.1.12.0` |
| Also seen on | Playwright 1.55.0, `webkit-2203` (a higher rate, below) |
| OS in the container | Ubuntu 24.04.4 LTS |
| Kernel | 6.6.87.2-microsoft-standard-WSL2 (Docker Desktop 29.4.1 on Windows 11, WSL 2 VM with 32 vCPUs and 15.5 GB) |
| GPU | none: Mesa llvmpipe (`libgl1-mesa-dri` 25.2.8-0ubuntu0.24.04.2) |
| Rendering settings | `LP_NUM_THREADS=2`, `WEBKIT_SKIA_ENABLE_CPU_RENDERING=1` (with Skia's GPU path through llvmpipe instead, see the rates below) |
| Headless | yes, Playwright's default for `webkit` |
| Load | 4 or 8 Playwright workers, each with its own browser; devices "Desktop Safari" (1280x720) and "iPad Pro 11 landscape" (1180x820, touch) |

The page is a Svelte 5 single-page app: full-screen painted scenes (large WebP images, CSS
transforms and transitions, a canvas particle layer driven by `requestAnimationFrame`), and
hash-based routing with frequent `history.back()` / `location.replace()`.

## Rate

Counted from Playwright's output (the page `crash` event, turned into a named test error by a
fixture), with core dumps off unless noted.

| Playwright / WebKit | rendering | test executions | crashes | rate |
|---|---|---|---|---|
| 1.55.0 / webkit-2203 | CPU Skia, 2 llvmpipe threads | 1 524 | 3 (cores) | 1 / 508 |
| 1.63.0 / webkit-2359 | CPU Skia, 2 llvmpipe threads | 6 513 | 5 (cores) | 1 / 1 303 |
| 1.63.0 / webkit-2359 | CPU Skia, 2 llvmpipe threads | 3 260 | 1 (crash event) | 1 / 3 260 |
| 1.63.0 / webkit-2359 | GPU Skia (llvmpipe), 2 llvmpipe threads | 3 260 | 0 (crash event) | < 1 / 3 260 |
| 1.55.0 / webkit-2203 | GPU Skia, default llvmpipe threads | ~1 150 | 7 segfaults in the kernel log (`SkiaGPUWorker` ×4, `ThreadedCompositor`, an invalid opcode, `WatchDogQueue` int3), all at teardown | ~1 / 160 |

Pooled over 1.63.0, that is 6 crashes in 13 033 executions, about **1 in 2 200**. The two 1.63
rendering settings (1 crash against 0, in 3 260 executions each) cannot be told apart with so few
events.

## Repro

No minimal repro: it takes a long suite. The crash lands in a different test each time (seen at
2.1 s, 2.7 s and 5.4 s into a test, and mid-navigation between two scenes), which points at
background work rather than a given page state. Steps that reproduce the rate:

1. Run a suite of ~160 WebKit tests like the one above with `--repeat-each=2` and 4 workers, ten times.
2. Count the page `crash` events (`page.on('crash')`).

A test that kills the `WPEWebProcess` on purpose shows the same Playwright symptoms (the page
`crash` event, then the test's next locator call fails or reads an empty page), which is how the
fixture was checked.

## Backtraces from the analysed cores

The cores were written with `ulimit -c unlimited` in the container and read with `gdb`. The
binaries are stripped, so only libraries and a few exported symbols show.

- **1.63.0, SIGSEGV, a WebKit worker thread**: 11 frames, a callback dispatched by
  `g_main_context_dispatch` on the thread's own GLib main loop, faulting inside libWPEWebKit. It
  looks like a use-after-free: a source still attached to the loop after its owner was destroyed.
- **1.63.0, SIGSEGV, deep recursion**: a long recursive walk, entirely inside libWPEWebKit.
- **1.55.0, SIGABRT**: `std::terminate` <- `__cxa_pure_virtual` in libWPEWebKit, on a worker
  thread's GLib main loop: a pure virtual call on an object that was half destroyed. Same family
  as the first 1.63 trace. The 6.4 GB core was
  `/ms-playwright/webkit-2203/minibrowser-wpe/bin/WPEWebProcess`.
- **1.55.0, kernel log**: `ThreadedCompositor` segfaults in libWPEWebKit and in libLLVM (llvmpipe),
  `SkiaGPUWorker` segfaults, one invalid opcode in `WPEWebProcess`, and an int3 in
  `WatchDogQueue` (WebKit's shutdown watchdog).

Three more 1.63 cores were counted before backtraces were kept.

## Expected

The web process does not crash.

## What is missing before filing

- A symbolised backtrace: a WPE build with debug symbols (or `debuginfod` for the bundle), and a
  run with `ulimit -c unlimited` and a cwd outside the bind mount, since each core is several GB.
- The thread name of each 1.63 crash, from the kernel log (`dmesg`, which needs a privileged
  container on Docker Desktop).
- Whether it also happens with a real GPU, or with the GTK port (`minibrowser-gtk`).

## Open item: the UI5 crashes (watch for a trend)

Not closed: per the repository's rule, a crash that keeps coming back stays an open item until its
cause is known. UI5 (audio and dialogue, 2026-09-27) saw these, each retried once by the rule below
and green on its retry:

| When | Spec and test | Project | Seen | Runs |
|---|---|---|---|---|
| Lane A, fix round 1 | `scenes-audio.spec.ts`, the lyre test, « page crashed at …/cabane » while closing the deep-linked lyre | ipad | 3 | 6 (two `--repeat-each=3` runs under heavy host load); then 0 in 250 runs of the spec |
| Task 9 | `scenes-battle-play.spec.ts:720`, the page crashed while the body ran | desktop | 1 | one `--repeat-each=3` run; 0 in the two gates |
| UI5 fix wave A | see `.superpowers/sdd/2026-09-27-ui5-audio-dialogue/fix-wave-a-report.md` (M13) | | | |
| UI5 fix wave B | `scenes-battle-play.spec.ts:571` (the Argus and the four tools), the page crashed while the body ran, right after the tap on the Bouclier (`?help=1`) | ipad | 1 | one `--repeat-each=3` run of the spec (120 of its tests); green on its retry. A second battle-play crash in two UI5 waves: this spec is now the one to watch |

What to watch: a cluster on one spec (the lyre's range input, focused and driven by keys, then
removed by the overlay's close on WPE, is the first thing to bisect), or on pages that play audio.
The e2e pages never load Howler or build an AudioContext (Ruling E10), so a trend tied to audio would
point at the page's own code, not WebKit's media stack. Add each new crash to this table.

## On our side

The suite marks such a test « browser crashed (upstream WebKit) » and runs it once more; no other
failure is retried (`web/e2e/crashGuard.ts`, `web/scripts/playwright-crash-retry.mjs`). The
measurements come from the project's working notes (`.superpowers/sdd/`, Task S of the immersion
wave and the UI3a fix wave A and e2e stability reports), which are not in the repository.
