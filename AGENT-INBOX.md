# Agent Inbox

Machine-generated handoffs, long diagnostics, and cross-repo follow-up notes go here.

Do not use this file for user notes. User-authored async notes belong in `INBOX.md`.

The agent should triage anything durable from this file into `TODO.md`, `ROADMAP.md`, `STATUS.md`, `HISTORY.md`, or `docs/specs.md`, then empty this file back to this header template.

---

## BF main cleanup follow-up

This repo is not a simple revert case.

- Relevant commits:
	- `679599b` — substantive vendored-BF fallback, preview-shell refactor, and inspector restore
	- `cc5b539` — docs-only portability handoff note
- Classification: mixed BF portability work plus real preview/editor fixes.
- Do not do a blanket revert of `679599b`.
	- That commit contains real behavior the repo still needs.
- Preserve these outcomes when fixing the BF integration:
	- public clones still work without access to private `baseline-foundry`
	- sibling-preferred plus vendored fallback asset model remains in place
	- preview shell remains usable with left nav, main stage, and right aside
	- inspector remains present and working
	- preview/editor state remains compatible with the Python 3.9 environment
- Rework on top of current behavior rather than reverting:
	- update the vendored BF fallback assets to match corrected BF `main`
	- replace any old `panel`-shaped dependency with the proper `os`/`app` contract while preserving the old validated density and shell feel
	- keep the portability path intact for users who do not have the private BF repo
- Sanity checks after the resync:
	- preview still launches without sibling BF present
	- dropdown, inspector, shell resize, and scrolling still work
	- search/input/action padding matches the BF split-token contract
	- gold authoring accents still match the old validated chrome