# Agent Inbox

Machine-generated handoffs, long diagnostics, and cross-repo follow-up notes go here.

Do not use this file for user notes. User-authored async notes belong in `INBOX.md`.

The agent should triage anything durable from this file into `TODO.md`, `STATUS.md`, `HISTORY.md`, or `docs/specs.md`, then empty this file back to this header template.

---

## Bug: root direction vertical → horizontal should reset top-level sizing to hug

**Reported:** 2026-06-04 (`android-custom-to-cloud` editor pass)

**Symptom:** After switching the page (root) `direction` from `vertical` to `horizontal`, top-level section/column frames stay `sizing_h: fill` (or otherwise FILL on the old primary axis). They stretch to equal column width/height instead of hugging content.

**Expected:** On root direction change, **all direct children of `page`** should reset to **hug** on the layout primary axis (and cross-axis as appropriate), so authors re-opt into `fill` deliberately. Same behavior in preview inspector and in any YAML persistence of that edit.

**Reference diagram:** `android-custom-to-cloud` — four top-level sections (`custom_files`, `host_tools`, `anbox_cloud`, `virt_instance`).

**Where:** Preview editor direction handler (`scripts/preview/editor.js` or layout-bridge), optional mirror in `scripts/frame_yaml_persistence.py` when `direction` is saved on `page`.

---

## Process: agents must not replace frame YAML wholesale

**Context:** `android-custom-to-cloud` stakeholder edit (2026-06-04).

**What happened:** User tuned layout in the preview UI (`direction: vertical`, parent `gap: 0`, etc.). An agent rewrote `scripts/diagrams/frames/android-custom-to-cloud.yaml` from git/assumptions instead of the on-disk (or saved) file, dropping editor state and adding structure not in the source (e.g. `Consumes` / `Instance` panels).

**How save works:** Preview **Save** POSTs override deltas to `/api/overrides/<slug>`, which merges into YAML via `scripts/frame_yaml_persistence.py` (`persist_override_payload_to_yaml`). Only keys present in the override payload are written—not a full tree export. Unsaved inspector changes live only in the browser until Save.

**Agent rule:** Before editing a frame YAML, read the current file from disk. Apply minimal diffs for the requested fix. Do not revert user-saved `direction` / `gap` / `padding` unless asked. If the user may have unsaved UI edits, say so and ask them to Save first (or paste overrides).
