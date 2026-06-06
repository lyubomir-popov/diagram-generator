# Agent Inbox

Machine-generated handoffs, long diagnostics, and cross-repo follow-up notes go here.

Do not use this file for user notes. User-authored async notes belong in `INBOX.md`.

The agent should triage anything durable from this file into `TODO.md`, `STATUS.md`, `HISTORY.md`, or `docs/specs.md`, then empty this file back to this header template.

---

## Force unpin fixes — completion report (2026-06-06)

**Executor:** composer (auto tier)

### Files changed

- `scripts/preview/force.js` — multi-select Pin all / Unpin all; shared `applyPinToNodes()`; Save always posts `exportForceSnapshot` JSON (removed `{}` save path)
- `packages/layout-engine/src/force-runtime.ts` — clear `nodeSpec.fx`/`fy` on unpin; sync authored x/y on patch
- `packages/layout-engine/tests/force-runtime.test.ts` — unpin + export + reload regression
- `scripts/test_preview_force_api.py` — save without `fx`/`fy` after unpinned snapshot
- `TODO.md` — marked both force unpin items complete

### Commands run

```bash
npm --prefix packages/layout-engine run build
npm --prefix packages/layout-engine test -- tests/force-runtime.test.ts
python -m pytest scripts/test_preview_force_api.py -q
```

### Pass/fail

- force-runtime vitest: **7/7 pass**
- test_preview_force_api.py: **2/2 pass**

### Residual risks

- Bulk pin/unpin pushes one undo entry per node (not a single compound undo)
- Save requires `LayoutEngine.exportForceSnapshot` in browser (already required for local force runtime)

---

## Adversarial review request — force unpin fixes

Review the just-landed force-preview fixes for:

- multi-select unpin applying to every selected node
- unpinned state persisting across Save/Reload

Check the changed files, run the focused validation commands listed above, and look for save-path drift or selection-state edge cases. Findings first, ordered by severity.
