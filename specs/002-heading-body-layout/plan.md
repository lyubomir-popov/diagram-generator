# Implementation plan: heading + body layout region

**Branch**: `feat/002-heading-body-layout` | **Date**: 2026-05-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-heading-body-layout/spec.md`

## Summary

Fix the synthetic `__heading` / `__body` child system so that containers with `heading:` produce a reliable two-zone layout: a heading zone (text top-left, icon top-right) and a body zone (children below, consistent gap/padding). The `__body` frame must copy all layout-affecting fields from the parent so layout behaviour is preserved through the synthesis.

## Technical context

**Language/Version**: Python 3.11+

**Primary dependencies**: uharfbuzz (text measurement), PyYAML (frame parsing), lxml (SVG)

**Storage**: N/A – all state is in-memory frame trees loaded from YAML

**Testing**: pytest (`test_frame_loader.py`, `test_layout_v3.py`, `test_parity.py`, `test_autolayout.py`)

**Target platform**: SVG output, HTML preview server at localhost:8100

**Project type**: Layout engine / diagram generator

**Performance goals**: N/A – layout is single-pass, sub-second for all current diagrams

**Constraints**: Must not regress any of the 31 existing frame YAML diagrams

**Scale/Scope**: ~5 files touched, ~100 lines net change

## Constitution check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Anti-patch protocol | **PASS** | This is a **contract change** – fixing the `__body` synthesis contract in `frame_loader.py`. Not a one-off fix for a single diagram. |
| II. Layer ownership | **PASS** | All changes land in the owning layers: `frame_loader.py` (parsing/defaults), `layout_v3.py` (measure/place). Renderer is untouched. |
| III. DIAGRAM.md is the visual contract | **PASS** | No visual token changes. Heading position (top-left text, top-right icon) is structural, not a new visual rule. |
| IV. Test before ship | **PASS** | Plan includes running all 31 diagrams + targeted new tests. |
| V. Sensible defaults | **PASS** | `__body` inherits parent defaults automatically – no new manual overrides. |
| VI. Stable public interfaces | **PASS** | No public API signature changes in `packages/layout-engine/`. |
| VII. No format lock-in | **PASS** | No new persisted format identifiers. |
| VIII. Semantic YAML | **PASS** | No new visual properties in YAML. `heading:` remains semantic. |

**Gate result**: All clear – proceed to Phase 0.

## Project structure

### Documentation (this feature)

```text
specs/002-heading-body-layout/
├── plan.md              # This file
├── research.md          # Phase 0: code analysis findings
├── data-model.md        # Phase 1: Frame/FrameBox field contracts
├── quickstart.md        # Phase 1: verification steps
├── contracts/           # Phase 1: __heading/__body synthesis contract
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source code (repository root)

```text
scripts/
├── frame_loader.py      # MODIFY: fix __body field copying in _parse_frame()
├── frame_model.py       # READ ONLY: Frame dataclass reference
├── layout_v3.py         # MODIFY: heading zone height calc in measure/place
├── diagram_render_svg.py # READ ONLY: verify renderer handles zones correctly
├── diagram_shared.py    # READ ONLY: ICON_SIZE, INSET constants
├── test_frame_loader.py # MODIFY: add __body field inheritance tests
├── test_layout_v3.py    # MODIFY: add heading zone placement tests
└── diagrams/frames/     # READ ONLY: existing YAML diagrams for regression
```

**Structure decision**: This is a contained change within the existing `scripts/` directory. No new files or directories needed beyond test additions and spec artefacts.
