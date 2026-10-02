#!/usr/bin/env bash
# The scripts' run guards (scripts/lib.sh), checked without docker: claim_stack_run's one run per
# STACK (refused with exit 3 while a live run holds it, taken over from a dead one, released at
# exit), its release surviving with_playwright_lock and ensure_volumes' `npm ci` (docker stubbed:
# an install that succeeds, fails, or is killed), and the caller's traps handed back afterwards.
# Every lock lives in a fresh temp dir, so the machine's real locks are never touched.
# Run from anywhere: `scripts/test_run_guard.sh` (exit 0 when every check passes).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
T="$(mktemp -d)"
export TMPDIR="$T"
LIVE=""
trap '[ -z "$LIVE" ] || kill "$LIVE" 2>/dev/null; rm -rf "$T"' EXIT

STACK_LOCK="$T/discorde-run-discorde-guardtest.lock"
E2E_LOCK="$T/discorde-e2e.lock"
INSTALL_LOCK="$T/discorde-install-discorde-guardtest.lock"
fails=0
pass() { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
expect_eq() { if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (got '$2', want '$3')"; fi; }
expect_has() { case "$2" in *"$3"*) pass "$1" ;; *) fail "$1 (no '$3' in: $2)" ;; esac; }
expect_gone() { if [ -e "$2" ]; then fail "$1 ($2 still there)"; else pass "$1"; fi; }

# docker, stubbed for ensure_volumes: volumes are files in $T, `npm ci` does what NPM_STUB says
# (ok, fail, or term: the shell is killed mid-install), and the readiness probe succeeds once an
# install went through.
cat >"$T/stub.sh" <<'STUB'
docker() {
  case "$1 $2" in
    "volume inspect") [ -e "$TMPDIR/vol-$3" ] ;;
    "volume create") touch "$TMPDIR/vol-$3" ;;
    "volume rm") rm -f "$TMPDIR/vol-$4" ;;
    run\ *)
      local n=$# last="${!#}" before
      before="${@:n-1:1}"
      if [ "$before $last" = "npm ci" ]; then
        case "${NPM_STUB:-ok}" in
          ok) touch "$TMPDIR/ready" ;;
          fail) return 1 ;;
          term) kill -TERM $$; sleep 1 ;;
        esac
      else
        [ -e "$TMPDIR/ready" ]
      fi ;;
    *) echo "unexpected docker $*" >&2; return 99 ;;
  esac
}
STUB
# A real docker must never be reached: case 1 refuses before any docker step.
mkdir -p "$T/bin"
printf '#!/bin/sh\necho "docker reached: $*" >&2\nexit 99\n' >"$T/bin/docker"
chmod +x "$T/bin/docker"

# Runs a snippet with lib.sh (and the docker stub) sourced on STACK=guardtest; prints its output,
# then its exit status on the last line.
lib() {
  local out status
  out="$(STACK="${STACK_ID:-guardtest}" bash -c "source '$HERE/lib.sh'; source '$T/stub.sh'; $1" 2>&1)"
  status=$?
  printf '%s\n%s' "$out" "$status"
}
status_of() { printf '%s' "${1##*$'\n'}"; }
reset_install() { rm -rf "$T"/vol-* "$T/ready" "$INSTALL_LOCK"; }

# 1. A live run holds the stack: playwright.sh refuses with exit 3, before any docker step.
sleep 60 &
LIVE=$!
mkdir "$STACK_LOCK"
printf '%s\n%s\n' "$LIVE" "2026-10-02 10:00:00" >"$STACK_LOCK/owner"
out="$(PATH="$T/bin:$PATH" STACK=guardtest "$HERE/playwright.sh" --list 2>&1)"
expect_eq "1 live holder: exit 3" "$?" 3
expect_has "1 live holder: says why" "$out" "another run of stack discorde-guardtest is in progress (PID $LIVE"
expect_eq "1 live holder: its lock is untouched" "$(sed -n 1p "$STACK_LOCK/owner")" "$LIVE"

# 2. Another stack is not blocked, and releases its own lock at exit.
r="$(STACK_ID=guardother lib 'claim_stack_run; echo claimed')"
expect_eq "2 other stack: exit 0" "$(status_of "$r")" 0
expect_gone "2 other stack: released at exit" "$T/discorde-run-discorde-guardother.lock"

# 3. The holder is gone: its lock is taken over, then released at exit.
kill "$LIVE"
wait "$LIVE" 2>/dev/null
r="$(lib 'claim_stack_run; echo claimed')"
expect_eq "3 dead holder: exit 0" "$(status_of "$r")" 0
expect_has "3 dead holder: taken over" "$r" "taking over the run lock of stack discorde-guardtest from PID $LIVE"
expect_gone "3 dead holder: released at exit" "$STACK_LOCK"
LIVE=""

# 4. Both locks are held during with_playwright_lock's command; the stack's release is handed back.
r="$(lib 'claim_stack_run; with_playwright_lock ls -d "$PLAYWRIGHT_LOCK" "$STACK_RUN_LOCK" >/dev/null && echo both-held
  echo "after: $(trap -p EXIT)"; [ -d "$STACK_RUN_LOCK" ] && echo stack-still-held')"
expect_eq "4 machine lock: exit 0" "$(status_of "$r")" 0
expect_has "4 machine lock: both held during" "$r" both-held
expect_has "4 machine lock: EXIT trap handed back" "$r" "after: trap -- 'release_stack_run' EXIT"
expect_has "4 machine lock: stack lock kept after" "$r" stack-still-held
expect_gone "4 machine lock: stack lock released at exit" "$STACK_LOCK"
expect_gone "4 machine lock: machine lock released at exit" "$E2E_LOCK"

# 5. Killed inside the machine lock: exit 130, both locks released.
r="$(lib 'claim_stack_run; with_playwright_lock bash -c "kill -TERM \$PPID; sleep 3"')"
expect_eq "5 killed in the machine lock: exit 130" "$(status_of "$r")" 130
expect_gone "5 killed in the machine lock: stack lock released" "$STACK_LOCK"
expect_gone "5 killed in the machine lock: machine lock released" "$E2E_LOCK"

# 6. A lock just taken, its owner file not written yet: refused.
mkdir "$STACK_LOCK"
r="$(lib 'claim_stack_run; echo claimed')"
expect_eq "6 lock without owner yet: exit 3" "$(status_of "$r")" 3
rm -rf "$STACK_LOCK"

# 7. ensure_volumes runs npm ci: the stack's release and the caller's INT/TERM traps survive it.
reset_install
r="$(lib 'claim_stack_run; trap "echo int" INT; trap "echo term" TERM; ensure_volumes
  echo "exit: $(trap -p EXIT)"; echo "int: $(trap -p INT)"; echo "term: $(trap -p TERM)"
  [ -d "$STACK_RUN_LOCK" ] && echo stack-still-held')"
expect_eq "7 npm ci: exit 0" "$(status_of "$r")" 0
expect_has "7 npm ci: it ran" "$r" "npm ci"
expect_has "7 npm ci: EXIT trap handed back" "$r" "exit: trap -- 'release_stack_run' EXIT"
expect_has "7 npm ci: INT trap handed back" "$r" "int: trap -- 'echo int' SIGINT"
expect_has "7 npm ci: TERM trap handed back" "$r" "term: trap -- 'echo term' SIGTERM"
expect_has "7 npm ci: stack lock kept after" "$r" stack-still-held
expect_gone "7 npm ci: stack lock released at exit" "$STACK_LOCK"
expect_gone "7 npm ci: install lock released" "$INSTALL_LOCK"

# 8. npm ci fails: exit 1, the partial volume, the install lock and the stack lock all go.
reset_install
r="$(NPM_STUB=fail lib 'claim_stack_run; ensure_volumes; echo not-reached')"
expect_eq "8 npm ci fails: exit 1" "$(status_of "$r")" 1
expect_has "8 npm ci fails: says so" "$r" "npm ci failed for discorde-guardtest-web-node_modules"
expect_gone "8 npm ci fails: partial volume removed" "$T/vol-discorde-guardtest-web-node_modules"
expect_gone "8 npm ci fails: install lock released" "$INSTALL_LOCK"
expect_gone "8 npm ci fails: stack lock released" "$STACK_LOCK"

# 9. Killed during npm ci: exit 130, the same three go.
reset_install
r="$(NPM_STUB=term lib 'claim_stack_run; ensure_volumes; echo not-reached')"
expect_eq "9 killed during npm ci: exit 130" "$(status_of "$r")" 130
expect_gone "9 killed during npm ci: partial volume removed" "$T/vol-discorde-guardtest-web-node_modules"
expect_gone "9 killed during npm ci: install lock released" "$INSTALL_LOCK"
expect_gone "9 killed during npm ci: stack lock released" "$STACK_LOCK"

# 10. A complete install: no npm ci, the traps are untouched.
reset_install
touch "$T/vol-discorde-guardtest-web-node_modules" "$T/ready"
r="$(lib 'claim_stack_run; ensure_volumes; echo "exit: $(trap -p EXIT)"')"
expect_eq "10 ready install: exit 0" "$(status_of "$r")" 0
expect_has "10 ready install: EXIT trap kept" "$r" "exit: trap -- 'release_stack_run' EXIT"
expect_gone "10 ready install: stack lock released at exit" "$STACK_LOCK"

echo
if [ "$fails" -eq 0 ]; then echo "run guard: all checks passed"; else echo "run guard: $fails check(s) failed"; fi
[ "$fails" -eq 0 ]
