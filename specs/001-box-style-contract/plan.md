# Implementation Plan: Box style contract – two-tier model

**Branch**: `feat/001-box-style-contract` | **Date**: 2026-05-28 | **Spec**: [spec.md](spec.md)

## Summary

Formalise the two-tier box visual model (outlined leaf / grey container) by consolidating style resolution into a single path in `frame_loader.py`, removing duplicate styling decisions from the renderer, and ensuring all four allowed box styles map correctly from Frame properties to SVG output.

## Technical Context

**Language/Version**: Python 3.11

**Primary Dependencies**: None beyond stdlib + existing engine modules

**Testing**: pytest (`test_frame_loader.py`, `test_layout_v3.py`, `test_parity.py`)

**Target Platform**: SVG output + HTML preview server

**Constraints**: All 20+ existing diagrams must render without regression. request-to-hardware-stack is the visual reference.

## Constitution Check

| Article | Status | Notes |
|---------|--------|-------|
| I. Anti-patch protocol | ✅ Pass | This is a contract change, properly classified |
| II. Layer ownership | ✅ Pass | Style resolution moves entirely into frame_loader.py (the owning layer for defaults) |
| III. DIAGRAM.md is the visual contract | ✅ Pass | Implementation aligns with the four allowed box styles already defined in DIAGRAM.md |
| IV. Test before ship | ✅ Planned | Full diagram render regression test after each change |
| V. Sensible defaults | ✅ Core goal | This feature exists to make defaults correct |

## Project Structure

### Documentation (this feature)

```text
specs/001-box-style-contract/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Executable task list
```

### Source Code (affected files)

```text
scripts/
├── frame_loader.py      # Style resolution consolidation (PRIMARY)
├── frame_model.py       # Frame dataclass – may need resolved_fill/resolved_border fields
├── layout_v3.py         # _render_frame() – remove style decisions, read resolved fields
├── diagram_shared.py    # Tokens (INSET, colours) – verify, no changes expected
├── test_frame_loader.py # New tests for style resolution
└── test_layout_v3.py    # New tests for rendering correct styles
```

## Architecture

### Current state (problems)

1. **Style resolution is split across two layers.** `frame_loader.py` sets some defaults (leaf→SOLID border, container→NONE border). But `_render_frame()` in `layout_v3.py` re-derives fill colours at render time based on `is_container`, `border`, and `fill` – duplicating and sometimes contradicting the loader's intent.

2. **Grey fill is inconsistent.** Some containers get grey from the renderer's `is_container + border==NONE → GREY` logic. But containers with explicit `border: solid` (like headed panels in request-to-hardware-stack) don't trigger this path, so their fill depends on what the YAML author wrote. Leaf boxes inside grey containers sometimes have `fill: grey` manually to look right – a style leak that violates the semantic YAML principle.

3. **Heading text position is not enforced.** The heading is synthesised as a `__heading` child frame, but its text position depends on the child's layout – which can end up centred or offset depending on alignment defaults.

4. **The `+1px` padding hack.** Borderless frames (annotations, containers) add 1px to padding_left, padding_top, and padding_right to compensate for the missing stroke width. This is fragile, makes padding non-uniform, and breaks when boxes change style dynamically.

5. **Double padding.** Panel children sit at `panel_padding + child_padding` from the panel edge. When both use INSET (8px), the visual distance from panel edge to child text is 16px+, which looks like double spacing compared to a standalone box.

### Target state

1. **Single style resolver in frame_loader.py.** After loading, every Frame has fully resolved fill, border, stroke colour, and text-weight fields computed from its level (either depth-derived or explicit `level:` override). The renderer reads these directly – zero style logic in `_render_frame()`. The `+1px` padding compensation is deleted; every box has a 1px stroke, making padding uniform.

2. **Four styles map to clear conditions – universal 1px stroke rule:**

Every visible box has a 1px stroke. The stroke colour matches the fill for boxes that shouldn't show a border, or is `transparent` for annotations. This eliminates the `+1px` padding compensation hack entirely – padding is uniform across all box types.

| Style | Condition | Fill | Stroke colour | Text weight |
|-------|-----------|------|---------------|-------------|
| Outlined box | Level 1 (default for depth 2+), no variant | transparent | `#000000` | 400 (regular) |
| Grey box | Level 2 (default for depth 1), or explicit `level: 2` | `#F3F3F3` | `#F3F3F3` | 700 for heading, 400 for label |
| Annotation | `variant: annotation` | transparent | `transparent` | 400 |
| Highlight | Any frame with `variant: highlight` | `#000000` | `#000000` | preserved, text forced white |

Note: `border: dotted` (renamed from legacy `dashed`) is reserved for panels acting as network boundaries and future zone overlays. It is not one of the four primary box styles – it is a border mode applied to a panel.

Separators and all box types share the same outer footprint because every rect includes the 1px stroke geometry.

3. **Heading is always top-left.** The `__heading` synthetic child uses top-left alignment, padding from INSET token.

### Complexity Tracking

No constitution violations. This is a straightforward consolidation of existing scattered logic into one path.

## Key Validation Scenarios

1. **Minimal container + leaf YAML** – no explicit styling → correct defaults
2. **request-to-hardware-stack** – visual parity with current output (the reference)
3. **lt-diagram-generator** – highlight variant still works
4. **support-engineering-flow** – cards with text hierarchy render correctly
5. **android-security-comparison** – text is top-left, not centred
6. **Full regression** – all diagrams in `scripts/diagrams/frames/` render without error
