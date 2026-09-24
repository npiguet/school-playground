# Directives for agents working on this repository

These apply to every agent: the main session and every subagent (implementers, reviewers, fixers).

## No "pre-existing" problems

This codebase was written entirely by agents. A problem you find that predates your change was
caused by an agent (another subagent, or an earlier session), so it is ours to fix.

- Never dismiss a failure, warning, flaky test, lint/type-check warning, bug or inconsistency as
  "pre-existing", "unrelated" or "not introduced by this change".
- When you find one, fix it: in your current change if it is small and in reach, otherwise report it
  explicitly as an open item so it gets fixed next (never as an excuse to move on).
- Reviewers: a pre-existing problem you notice is a finding like any other, with a severity.
- Test output and `svelte-check` must be clean: zero errors **and zero warnings**.

## No emoji

Emoji don't fit the game's painted Greek-myth look. Never use emoji anywhere the player can see them:
not as icons, badges, buttons or markers, and not inside French text either. Use the painted icons in
`web/public/art/` (cut-outs, emblems, `icons/`), an inline SVG, or plain words instead.
