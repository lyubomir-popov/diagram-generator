# Tasks: TypeScript authority and Python removal (design-foundry port prep)

**Input**: Design documents from `/specs/038-ts-authority-python-removal/`

**Prerequisites**: spec.md, plan.md

**Depends on**: specs 012, 013, 022, 025, 026, 027 complete

**Parallel marker**: `[P]` = no file or ordering dependency on the task immediately before it.

## Phase 0 - Architectural ratchet

- [x] T001 Establish `specs/038-ts-authority-python-removal/` as the single migration home and repoint the SpecKit context block in `.github/copilot-instructions.md` (the `<!-- SPECKIT START -->` block) at `specs/038-ts-authority-python-removal/plan.md`
- [x] T002 In `.github/copilot-instructions.md`, replace the "Python's role (narrowing)" four-role enumeration with one hard rule: no Python in the diagram product path; allowed Python is only the dated parity oracle, draw.io batch tooling, and `design_tokens.py` until `tokens.ts` is sole source
- [x] T003 In `.github/copilot-instructions.md`, correct the stale "Do NOT migrate code to design-foundry yet. The target kernel operator interface is not ready" guidance to state the design-foundry kernel contracts (operator-kernel K4, render-ir K1, text-shape K3) are ready and the blocker is this repo's Python preview front door, resolved by spec 038
- [x] T004 Add `scripts/check_no_new_python.mjs`: an allowlist of all current `.py` files under `scripts/`; exit non-zero when a new non-test, diagram-logic `.py` appears, with a message pointing at spec 038
- [x] T005 Wire `node scripts/check_no_new_python.mjs` into the documented validation commands (note in `plan.md` validation and any validation prompt/skill that lists checks)
- [x] T006 [P] Mirror the one hard rule at the top of `README.md`
- [x] T007 [P] Mirror the one hard rule at the top of `STATUS.md`

## Phase 1 - Node preview app (keystone)

- [x] T010 Create `apps/preview/` Node project with a `package.json` depending on `@diagram-generator/layout-engine`; add a root-level `npm run preview` entry point
- [x] T011 Implement the TypeScript HTTP server replicating the GET route surface: `/`, `/api/runtime-identity`, `/api/preview-engines`, `/preview/*` (incl. `/preview/bf-fonts/*`), `/svg/*`, `/view/*`, `/force/view/*`, `/v3/view/*`, `/v3/svg/*`, `/api/tree/*`, `/api/preview-document/*`, `/api/frame-tree/*`, `/api/grid/*`, `/api/force-spec/*`, `/api/icon/*`, `/reference/*` — importing `LayoutEngine`, `frame-serialize`, `grid-info`, `component-tree`, and `svg-render` directly (no subprocess pools)
- [x] T012 Implement file watch + SSE live reload to replace the Python watcher
- [x] T013 Port YAML save into TypeScript to replace `frame_yaml_persistence.py`, preserving the canonical `root` + `arrows` format; implement the POST routes `/api/overrides/*` and `/api/force-save/*`
- [x] T014 Port the diagram nav/picker HTML; verify the sidenav auto-populates from `scripts/diagrams/frames/`
- [x] T015 Re-express `test_frame_yaml_persistence.py` cases as TypeScript parity tests and assert byte-identical on-disk YAML versus the retired Python merge for the covered cases
- [x] T016 Flip the documented front door from `python scripts/preview_server.py` to `npm run preview` in `README.md`, `STATUS.md`, and `docs/stakeholder-guide.md`
- [x] T017 Browser-verify autolayout v3, force, and sequence lanes against the Node server at geometry parity with the retired Python server
- [x] T018 Run the spec 027 preview browser test API against the Node server and confirm green
- [x] T019 Delete `scripts/preview_server.py`, `scripts/preview_ts_layout.py`, `scripts/preview_ts_export.py`; port or retire `test_preview_server_reload.py`, `test_preview_ts_layout.py`, `test_preview_ts_export.py`, `test_preview_ts_api.py`

## Phase 2 - Delete residual product-path Python

- [x] T020 Demote `scripts/layout_v3.py` and `scripts/frame_loader.py` to a dated parity oracle: add a header noting the removal date and parity-only purpose; remove any non-test import
- [x] T021 Confirm `scripts/frame_yaml_persistence.py` is deleted (replaced in T013) and no module imports it
- [x] T022 Reduce the `check_no_new_python.mjs` allowlist to the dated oracle, draw.io tooling, `design_tokens.py`, and `test_*.py`
- [x] T023 Verify `rg -l "import (layout_v3|frame_loader|frame_yaml_persistence)" scripts` returns only parity-oracle and test files

## Phase 3 - Reshape layout-engine along design-foundry seams

- [x] T030 Carve internal seams inside `packages/layout-engine/src/` matching design-foundry (document-model/schema, operator-autolayout, render adapter, text adapter) without changing public exported signatures
- [x] T031 Add an operator-kernel-shaped facade: typed inputs (frame document + parameters) → sync `evaluate()` → output; document it as the de-facto port interface for `@design-foundry/operator-autolayout`
- [x] T032 Add a render-ir emit path (`LayoutOutput` → `DisplayListItem[]`) alongside the existing `svg-render.ts` SVG-string path; keep `svg-render.ts` as the diagram-generator-local string renderer
- [x] T033 Route text measurement through a text-shape-compatible adapter (HarfBuzz already in deps)
- [x] T034 Add geometry-parity fixtures proving the render-ir path and the SVG-string path produce equivalent geometry
- [x] T035 Assert public exported signatures are unchanged (empty `git diff` on exported types) so the de-facto port interface is preserved

## Phase 4 - Relocation handoff (out of scope here)

- [x] T040 Write an `AGENT-INBOX.md` note in `../design-foundry/` describing the reshaped seams, the operator-kernel-shaped facade, and the render-ir emit path, so a design-foundry session can relocate the package as `@design-foundry/operator-autolayout`, extend `document-schema` with the autolayout frame primitive, and run a parity test against the in-place engine

## Closeout

- [x] T050 Update `TODO.md`, `STATUS.md`, and `docs/specs.md` for the spec 038 lane and move completed items to `HISTORY.md`
- [x] T051 Mark this spec Complete only after the front door is Node, the four product-path Python files are deleted, the guard passes on the migrated tree, and the engine exposes the operator-kernel-shaped facade plus render-ir emit path at geometry parity

## Validation

```bash
npm --prefix packages/layout-engine test
python -m pytest scripts -q
node scripts/check_no_new_python.mjs
```

After Phase 1, browser-verify each engine lane against the Node server and run the spec 027 preview browser test API against it.
