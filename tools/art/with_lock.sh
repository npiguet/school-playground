#!/usr/bin/env bash
# Run one art command (a Forge batch, a segmentation run) while holding the machine-wide lock that
# e2e/Playwright runs and the audio tools also take (scripts/lib.sh with_playwright_lock), so the
# local GPU/CPU-heavy art work never overlaps a browser test run. Keep each locked batch short
# (a few images, a few minutes) so waiting e2e runs are not starved.
#   tools/art/with_lock.sh python .claude/skills/krea2/generate.py --prompt-file p.txt ...
. "$(dirname "${BASH_SOURCE[0]}")/../../scripts/lib.sh"
with_playwright_lock "$@"
