# Research: Diagram audit

**Feature**: 004-diagram-audit | **Date**: 2026-05-29

## Research questions

### Q1: What are the engine's default styles per level?

**Decision**: Use the level system from `resolve_styles()` in `frame_loader.py` as the reference.

**Rationale**: The level system was formalized in spec 001 (box-style-contract). It assigns visual properties based on structural role, making explicit overrides unnecessary when the intent matches the default.

**Findings**:

| Level | Condition | Fill | Stroke |
|-------|-----------|------|--------|
| L0 | Root or wrapper (no heading, not leaf) | transparent | none |
| L1 | Leaf (no children) | transparent | #000000 (solid) |
| L2 | Panel with heading, leaf descendants only | #F3F3F3 | #F3F3F3 |
| L3 | Panel with heading + panel descendants | transparent | #000000 (solid) |

Variants override these defaults:
- `highlight` → black fill + black stroke
- `annotation` → transparent fill + none stroke

### Q2: Which overrides are truly redundant?

**Decision**: An override is redundant if removing it produces the same resolved style from the engine.

**Rationale**: The engine's `resolve_styles()` computes the correct visual treatment from level + variant. Any explicit `fill:` or `border:` that matches what the engine would assign is noise.

**Redundancy rules**:
- `border: none` on root/wrapper → redundant (L0 default is "none")
- `border: solid` on L2 panel (has heading, no panel children) → redundant (engine assigns solid border at L2)
- `border: none` on internal layout wrapper → redundant (L0 default)
- `fill: grey` / `fill: "#F3F3F3"` on L2 panels → redundant (engine default)
- `fill: transparent` on L0/L1 → redundant (engine default)

### Q3: Are there any overrides that look redundant but aren't?

**Decision**: Preserve overrides where the node's structural role doesn't match the visual intent.

**Findings**:
- `variant: highlight` (7 files) – intentional semantic override, keep
- `variant: annotation` (1 file) – intentional semantic override, keep
- Any `border: solid` on a node that the engine would classify as L0 (wrapper) but the author wants rendered as a visible container – these need case-by-case review
- `lt-diagram-generator.yaml` missing `border: solid` on L2 panels – engine handles this correctly via level system, no action needed

### Q4: What about the orphaned memory-wall.json?

**Decision**: Flag as a separate concern, do not address in this audit.

**Rationale**: memory-wall.json has no matching YAML file. It may be a legacy artifact or from a different pipeline. Cleaning it up is outside the scope of a YAML configuration audit.

### Q5: How should batching work to minimize regression risk?

**Decision**: 4 batches ordered by complexity (light → heavy), with full test suite + browser verification between each.

**Rationale**: Smaller batches are easier to review and revert. Light files first validates the workflow before tackling complex files with many overrides.

**Alternatives considered**:
- Single batch (all 24 files at once) – rejected: too risky, hard to isolate regressions
- One file at a time – rejected: too slow for 24 files, the overrides follow predictable patterns
- By diagram family (android-*, lt-*, maas-*) – considered but the effort-based grouping is more useful for risk management

## Unresolved items

None. All questions resolved from existing engine source and audit data.
