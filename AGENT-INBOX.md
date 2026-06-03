# Agent Inbox

Machine-generated handoffs, long diagnostics, and cross-repo follow-up notes go here.

Do not use this file for user notes. User-authored async notes belong in `INBOX.md`.

The agent should triage anything durable from this file into `TODO.md`, `STATUS.md`, `HISTORY.md`, or `docs/specs.md`, then empty this file back to this header template.

---

## Branch hygiene (manual)

Adversarial review noted `feat/005-autolayout-hardening` spans many specs and may need PR split / branch rename. Not automated here.

---

## Adversarial review — remaining

| Severity | Area | Finding | Status |
|----------|------|---------|--------|
| P3 | Git | Stray untracked `image-*.png`, `.specify/`; branch name vs scope | Manual |

Resolved (2026-06-03):

- Spec 017 — `bindInteraction` idempotent; Playwright delete tests
- TS preview hot-reload — `WATCH_PATHS` + `_recreate_ts_preview_pools()` on `_rebuild()`
