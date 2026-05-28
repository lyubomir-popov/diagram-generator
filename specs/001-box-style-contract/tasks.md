# Tasks: Box style contract – two-tier model

**Branch**: `feat/001-box-style-contract` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

## Phase 1: Test infrastructure (blocking prerequisite)

- [ ] T001 Create a minimal test YAML (`test-box-styles.yaml`) with one container (heading + icon + 2 leaf children) and one standalone leaf. No explicit fill/border/weight.
- [ ] T002 Write pytest tests in `test_frame_loader.py` that assert the expected resolved styles after loading: container→grey fill, no border; leaf→transparent fill, solid border; heading→weight 700; label→weight 400.
- [ ] T003 Write a pytest test that loads `test-box-styles.yaml`, runs layout + render, and asserts the FrameBox primitives have the correct fill/stroke values.

**Checkpoint**: Tests exist and fail (red) because the current loader doesn't resolve styles into a single path.

## Phase 2: Consolidate style resolution into frame_loader.py

- [ ] T004 Add a `resolve_styles()` post-processing pass in `frame_loader.py` that runs after `_apply_frame()`. This pass walks the Frame tree and sets `fill`, `border`, stroke colour, and text weight to their correct resolved values based on the two-tier rules + variant overlays. Every box gets a 1px stroke; the stroke colour matches the fill for invisible borders (`#F3F3F3` for grey, `transparent` for annotations, `#000000` for highlight and outlined).
- [ ] T005 Ensure `resolve_styles()` handles: (a) leaf defaults, (b) container defaults, (c) explicit YAML overrides preserved, (d) variant overlays applied last.
- [ ] T005b Delete the `+1px` padding compensation hack from `_render_frame()` in `layout_v3.py`. With universal 1px strokes, padding is uniform and the hack is no longer needed.
- [ ] T006 [P] Ensure heading lines synthesised for containers always get `weight: 700` and are positioned top-left.

**Checkpoint**: T002 tests pass (green). The loader now produces fully resolved styles.

## Phase 3: Simplify renderer to read resolved styles

- [ ] T007 Refactor `_render_frame()` in `layout_v3.py` to remove the style-derivation block (lines ~1140–1165). Replace with direct reads from `frame.fill.value` and `frame.border` – no more `is_container` checks or fill coercion at render time.
- [ ] T008 Verify T003 rendering tests pass.
- [ ] T009 Run full regression: `python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q` – all must pass.

**Checkpoint**: Renderer is a thin reader of resolved Frame properties. All tests green.

## Phase 4: Visual regression

- [ ] T010 Render all diagrams (`glob diagrams/frames/*.yaml`) and confirm no errors.
- [ ] T011 Browser-verify request-to-hardware-stack at `http://127.0.0.1:8100/view/v3:request-to-hardware-stack` – must match reference screenshot.
- [ ] T012 Browser-verify lt-diagram-generator – highlight variant still produces black boxes with white text.
- [ ] T013 Browser-verify android-security-comparison – heading text must be top-left, not centred.
- [ ] T014 Browser-verify support-engineering-flow – cards with bold title + regular body text render correctly.

**Checkpoint**: All visual checks pass. Feature complete.

## Phase 5: Documentation

- [ ] T015 Update DIAGRAM.md if any wording needs to change to match the resolved implementation (likely minimal – the four styles table is already correct).
- [ ] T016 Commit with message `engine: consolidate box style resolution into two-tier contract`.

## Notes

- Tasks marked `[P]` can be parallelised with adjacent tasks.
- T004–T006 are the core implementation. Everything else is test infrastructure or verification.
- If any existing YAML breaks because it relied on the renderer's ad-hoc style coercion, fix the YAML (configuration change), not the engine.
