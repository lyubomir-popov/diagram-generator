# Architecture Status (reference)

This file contains detailed architecture history moved from STATUS.md to save tokens on cold-start reads. Only consult this when working on editor architecture, frontend modules, or the force/grid editor systems.

## Frame classes

Four visual treatments (section, panel, leaf, annotation) plus two specials (highlight, separator). See [`frame-classes.md`](frame-classes.md) for the full spec.

- **Content-width alignment:** Two-pass VERTICAL layout separates content width from outer width. Panels with borders wrap content with INSET padding; standalone boxes align to the panel's inner content corridor.
- **col_span/row_span:** Boxes inside panels can span multiple grid columns without explicit width overrides.
- **BOX_MIN_HEIGHT enforcement:** Single-line boxes without icons are clamped to 64px minimum.
- **BASELINE_UNIT = 8px**, **GRID_GUTTER = 24px**, **OUTER_MARGIN = 24px**, **BODY_SIZE = 18px**.

## 4-phase architectural refactor (complete)

- **Phase A:** `BoxStyle` enum, YAML/JSON diagram loader, JSON schema.
- **Phase B:** Viewer JS/CSS/HTML extracted into `scripts/preview/`. Static files served at `/preview/*`.
- **Phase C:** `ComponentModel` class with indexed tree, parent/child navigation, override management. `InteractionManager` state machine.
- **Phase D:** Constraint enforcement system with 6 built-in brand constraints.

## Current frontend architecture

- `scripts/preview/editor-base.js` – shared shell infrastructure
- `scripts/preview/viewer-unified.html` – unified HTML template (grid + force modes)
- `scripts/preview/component-model.js` – `ComponentModel` + `ComponentNode` tree
- `scripts/preview/constraints.js` – `ConstraintRegistry` with pluggable constraints
- `scripts/preview/editor.js` – grid-mode interaction handlers, DOM sync, sidebar UI
- `scripts/preview/force.js` – force-mode interaction handlers, simulation controls
- `scripts/preview/editor.css` – editor styling, mode visibility rules
- `scripts/preview_server.py` – pure API server, watches for hot-reload

## Cold-start / portability

The preview ships a vendored BF `os` tier stylesheet and Ubuntu Sans snapshot under `assets/baseline-foundry/`, so fresh clones do not depend on a sibling checkout. The editor shell uses the BF `navigation + main + aside` contract with local resize bindings. The desktop shell is pinned locally to a single-row grid.

## Snap and guide system

Both editors share snap primitives via `editor-base.js`: `snapRectToTargets`, `collectPeerSnapTargets`, `collectGridSnapTargets`, `renderGuideLines`. Grid editor snaps to column/row edges; force editor snaps to peer node edges. Shared `UndoRedoManager` in `undo-manager.js`. Abstract `EngineAdapter` in `engine-interface.js`.

## v3 frame layout engine

Figma-like nested frame system with direction, gap, padding, per-axis sizing (HUG/FILL/FIXED), and 9-point alignment. Two-pass engine: measure (bottom-up) → place (top-down). **224** vitest tests in `packages/layout-engine/`; Python tests cover YAML and legacy parity. **32** v3 Frame YAML definitions in `scripts/diagrams/frames/`. Interactive layout is TS-only; preview live SVG is TS export only (spec 012 T060a).

Engine features: per-axis sizing, parent coercion model, coercion visibility, InDesign/Figma-style layout grid, drag-to-reorder, multi-select bulk editing, col_span/row_span, domain-specific undo/redo, deferred text composition, bidirectional text reflow, fonttools metrics, min/max constraints, per-side padding, heading height consistency. TypeScript port complete.
