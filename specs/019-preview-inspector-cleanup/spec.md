# Spec 019 – Preview inspector UI cleanup

**Created**: 2026-06-04  
**Status**: Complete  
**Input**: Preview sidebar **Selection** panel duplicates fields already shown in Auto-layout / sizing controls below.

## Problem

The inspector’s top **Selection** block repeats information that appears again in the detailed controls:

| Redundant block | Duplicated by |
|-----------------|---------------|
| Component id | Tree selection highlight; Auto-layout section context |
| Computed position | Not needed for authoring; layout is driven by YAML + autolayout |
| Size (W×H) | Width/Height fields in Auto-layout sizing (Hug/Fill/Fixed + numeric) |
| Layout (direction + gap) | Direction and Gap in Auto-layout |

This adds noise and pushes actionable controls (alignment, autolayout, style) below the fold.

Headed containers intentionally expose one gap per container. The header/body split is internal layout structure: children live in the body group, and that single container gap controls spacing between those child nodes. Through nesting, each container contributes one gap value.

## Goals

1. **Remove** the four redundant read-only fields from the primary inspector path (`updateInspector`).
2. **Keep** alignment widget, Auto-layout panel, style picker, override deltas, violations, and multi-select summary.
3. **Optional** compact selection label (e.g. id only in the Auto-layout section heading) — not a separate field group.

## Non-goals

- Changing component tree or stage interaction.
- Removing override / violation / style UI.

## Acceptance

- Selecting `page` or any frame shows **no** duplicate Component / Computed position / Size / Layout summary rows.
- Auto-layout and sizing controls remain the single place to read and edit layout semantics.
- Headed containers keep a single `Gap` control; the inspector does not introduce separate Title gap / Stack gap labels.
- No regression in `renderSelectionInspector` / multi-select paths.

## Related

- Frame borders: 1px via `spacing.frame-stroke-width` in `docs/frame-classes.md`.
- `DIAGRAM.md` headed-panel rule: one gap per container, with body children grouped under that container.
