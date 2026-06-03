# Adversarial review prompt (copy-paste for GPT / Composer)

Use this after a coding session on `diagram-generator`. Replace placeholders if the branch moved.

---

## Prompt (copy everything below this line)

You are doing an **adversarial code review** of the `diagram-generator` repo. Be skeptical: assume something is broken until you verify otherwise. Do **not** rubber-stamp.

### Context

- **North star:** TypeScript-only for layout/measure (`packages/layout-engine/`). Frame **YAML** is the only authored source of truth. JSON from `/api/frame-tree` is a **derived wire DTO**, not authority.
- **Preview:** `scripts/preview_server.py` + `layout-bridge.js` (HarfBuzz). TS pools: `preview_ts_export.py` (SVG), `preview_ts_layout.py` (frame-tree/grid/tree). Python `layout_v3` / `diagram_render_svg` remain **SVG fallback only** until spec 012.
- **Recent specs on branch `feat/005-autolayout-hardening`:**
  - 011 — 66ch HUG, `text-layout.ts`, TS export
  - 013 — TS preview API (frame-tree/grid/tree); Python layout off preview paths
  - 014 — TS SVG export pool (cache, semaphore, coalescing)
  - 015 — port kill opt-in; force-mode diagram nav
  - 016 — `DG_FRAMES_DIR` in Node CLIs; layout pool coalescing; force picker dedup
  - 017 — frame delete (`removed_ids`, Delete/Backspace, tree context menu)
- **Branch:** `feat/005-autolayout-hardening` — commits: `31bce6e..505fd98` (or `main..HEAD`)

### Your tasks

1. **Git / branch hygiene**
   - Branch name vs scope (005 + 011–017)? Commits atomic? Bisectable?
   - Untracked junk (`image-*.png`, `.specify/`) vs intentional WIP?
   - Should this split into multiple PRs (e.g. 011+014+015 vs 013+016 vs 017)?

2. **Preview server stability** (P1)
   - `preview_ts_export.py` / `preview_ts_layout.py`: cache, semaphore, coalescing, `TimeoutExpired`, `RLock` deadlocks?
   - `DG_FRAMES_DIR` honored by all Node entrypoints (`_dist-import.mjs`)?
   - Port: `DG_PREVIEW_KILL_PORT` still killing healthy servers?
   - Watcher / `_rebuild` silent failures?

3. **TS layout correctness** (P1)
   - `max_width_chars: 66`, opt-out `0`, `applyTextLayoutDefaults`
   - Heading synthesis vs Python `frame_loader.py`
   - Parity fixtures vs `parity-fixture-builder.ts`

4. **Preview client** (P1)
   - Frame delete: undo restores frame tree (`f` in editor state)? `removed_ids` YAML roundtrip?
   - `bindInteraction()` called after delete — duplicate listeners?
   - Force mode diagram picker (single handler in `editor-base.js`)?
   - Grid mode blank stage if bridge fails?

5. **Architecture drift**
   - New Python layout/measure logic (forbidden)?
   - Dual YAML parsers drift?
   - Two SVG render paths (TS `svg-render.ts` vs Python `diagram_render_svg.py`)?

6. **Tests** — run and report pass/fail:
   ```bash
   cd packages/layout-engine && npm test
   cd scripts && python -m pytest test_preview_ts_export.py test_preview_ts_layout.py test_preview_frames_dir.py test_preview_ts_api.py test_frame_yaml_persistence.py -q
   cd scripts && python -m pytest test_preview_support_engineering_flow.py -q -k "roundtrip or per_side_padding or save"
   ```

### Output format

| Severity | Area | Finding | Evidence (file:line or command) | Recommended fix |
|----------|------|---------|----------------------------------|-----------------|
| P0/P1/P2/P3 | … | … | … | … |

Then:

- **Top 3 risks** before merge
- **Open questions** for the author
- **What you verified** (commands + pass/fail)

Prefer minimal TS-first fixes. No large rewrites unless P0/P1.

---

## Optional one-liner

> Adversarial review `diagram-generator` `feat/005-autolayout-hardening` (`31bce6e..505fd98`): TS preview API, DG_FRAMES_DIR, frame delete, pools, 66ch layout, branch hygiene. P0/P1 table + top 3 risks. Run pytest bundle above.
