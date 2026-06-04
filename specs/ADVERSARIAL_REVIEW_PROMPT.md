# Adversarial review prompt (copy-paste for GPT / Composer)

Use this after a coding session on `diagram-generator`. Replace placeholders if the branch moved.

---

## Prompt (copy everything below this line)

You are doing an **adversarial code review** of the `diagram-generator` repo. Be skeptical: assume something is broken until you verify otherwise. Do **not** rubber-stamp.

### Context

- **North star:** TypeScript-only for layout/measure/SVG export (`packages/layout-engine/`). Frame **YAML** is the only authored source of truth. JSON from `/api/frame-tree` is a **derived wire DTO**, not authority.
- **Preview:** `scripts/preview_server.py` + `layout-bridge.js` (HarfBuzz). TS pools: `preview_ts_export.py` (SVG), `preview_ts_layout.py` (frame-tree/grid/tree). **Live v3 SVG is TS-only** (spec 012 T060a); failure → 404 + log. **No Python SVG renderer** — `diagram_render_svg.py` deleted (T060b).
- **Batch SVG:** `node packages/layout-engine/scripts/export-frame-svg.mjs --slug <name>` → `svg-render.ts`. Golden regression: `packages/layout-engine/tests/svg-golden.test.ts` (6 slugs).
- **Recent session work (verify on `main` or current branch):**
  - Spec **012** T050 — golden SVG harness + fixtures
  - Spec **012** T060b — deleted `diagram_render_svg.py`
  - Spec **019** — inspector cleanup (no duplicate Selection summary; `Auto-layout · {cid}`)
   - Prior: T030/T040 arrows+overlays, single-gap headed-container semantics, inspector cleanup
- **Branch:** `main` (or `git log -5 --oneline` for exact HEAD)

### Your tasks

1. **Git / branch hygiene**
   - Uncommitted vs intentional? `.env.local` must not be committed.
   - Commits atomic and bisectable?
   - Should golden SVG fixtures be split from inspector/editor changes?

2. **TS SVG renderer (P1)** — spec 012
   - `grep -r diagram_render_svg` — must be zero in `scripts/` and runtime paths (docs/history OK).
   - Golden tests: run `cd packages/layout-engine && npm test -- svg-golden` — all pass?
   - Arrow routing: waypoints preserved? Orange `#E95420` heads? Labels + `label_gap` from YAML?
   - Icons embedded (no placeholder rects when asset exists)?
   - DIAGRAM.md constraints: no `<use>`, external `<image href>`, marker refs?

3. **Preview inspector (P1)** — spec 019
   - Single-select: no Component / Computed position / Size / Layout duplicate rows?
   - Auto-layout panel still has Direction, Gap, and Width/Height sizing without reintroducing duplicate layout summary rows?
   - Multi-select path (`renderMultiSelectionInspector`) unchanged?
   - Arrow selection: waypoints + clear override still work without layout bounds check?

4. **TS layout correctness (P1)**
   - Headed-container spacing: save YAML → reload → inspector still presents one `Gap` control per container, with body children grouped under that container.
   - `test-deep-nesting` parity: 12 known TS failures (536 vs 552 width) — regressions or still pre-existing?
   - `max_width_chars: 66` HUG wrap unchanged?

5. **Preview server stability (P2)**
   - `preview_ts_export.py`: cache, semaphore, coalescing, timeout handling?
   - `DG_FRAMES_DIR` honored by Node CLIs (`_dist-import.mjs`)?

6. **Architecture drift**
   - New Python layout/measure logic (forbidden)?
   - Dual YAML parsers drift (`frame_loader.py` vs `frame-yaml-loader.ts`)?
   - Any revived Python SVG fallback path?

7. **Tests** — run and report pass/fail:
   ```bash
   cd packages/layout-engine && npm test
   cd scripts && python -m pytest test_preview_ts_export.py test_preview_ts_layout.py test_preview_frames_dir.py test_preview_ts_api.py test_preview_server_reload.py test_frame_yaml_persistence.py -q
   cd scripts && python -m pytest test_preview_support_engineering_flow.py -q -k "roundtrip or per_side_padding or save or stack_gap"
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

> Adversarial review `diagram-generator` `main`: spec 012 T050 golden SVG + T060b delete Python renderer + spec 019 inspector cleanup. Verify no `diagram_render_svg` refs, golden tests pass, inspector no duplicate fields, stack_gap roundtrip. P0/P1 table + top 3 risks. Run pytest/vitest bundle above.
