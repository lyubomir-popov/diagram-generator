# Plan: Compatible engine switcher

## Phase 1 - Compatibility contract

- [x] define a typed engine-compatibility surface in the preview-engine registry
  - Extended `PreviewEngineCompatibility` with `description`
  - Added `CompatibilityResult` type
  - Added `evaluatePreviewEngineCompatibility()` with detailed reasons
  - Added `listPreviewEnginesWithCompatibility()` for switcher UI
- [x] decide whether compatibility keys evaluate against raw YAML metadata, compiled AST shape, or both
  - Decision: evaluate against `PreviewDocumentKind` (from YAML metadata) + `shellMode`
  - `requiredLayoutEngineKey` enforces engine-specific document requirements as an
    *offer* filter (see `evaluatePreviewEngineCompatibility` comment for offer-vs-resolve)
  - AST-shape predicates were prototyped then removed (YAGNI): no registered engine
    consumes them and nothing populates an AST-shape context. Reintroduce only when a
    real engine needs structural gating beyond document kind.

- [x] define how canonical engine choice persists without shadow state
  - Engine choice persists as `meta.layout_engine` in frame YAML
  - Added `layout_engine` field to `PersistOverridePayload`
  - Supports set, update, and clear (null) operations

## Compatibility matrix (current engines)

| Engine | Document Kinds | Required Layout Engine | Shell Mode | Description |
|--------|---------------|----------------------|------------|-------------|
| `v3` | `frame-diagram` | (none) | `grid` | Canonical native v3 autolayout for authored frame diagrams; default when `meta.layout_engine` is absent |
| `elk-layered` | `frame-diagram` | `elk-layered` | `grid` | Hierarchical layered layout for directed graphs and flowcharts |
| `force` | `force-spec` | (none) | `force` | Physics-based force-directed layout for organic graph structures |
| `sequence` | `sequence` | `sequence` | `grid` | Timeline-based layout for sequence diagrams and message flows |

## Compatibility matrix (near-term engines — NOT yet representable)

> These rows are aspirational and **cannot be declared today**. `PreviewDocumentKind`
> is currently `'frame-diagram' | 'sequence' | 'force-spec'`, so document kinds like
> `state-diagram`, `tree-diagram`, `swimlane-diagram`, `er-diagram`, and `class-diagram`
> would not typecheck. Before any of these lanes can register a compatibility entry,
> `PreviewDocumentKind` (in `packages/layout-engine/src/preview-engine/types.ts`) must be
> widened to admit the new kind. The table below records intended shape only.

| Engine | Document Kinds (future) | Required Layout Engine | Shell Mode | Description |
|--------|---------------|----------------------|------------|-------------|
| `state-machine` | `state-diagram` | `state-machine` | `grid` | State/lifecycle layout with compound states |
| `tree-mindmap` | `tree-diagram` | (none) | `grid` | Tidy tree and mindmap layout |
| `swimlane` | `swimlane-diagram` | (none) | `grid` | Lane-based workflow layout |
| `er-class` | `er-diagram`, `class-diagram` | (none) | `grid` | ER/class relationship layout with orthogonal connectors |


## Phase 2 - Preview switcher

- [x] add a manifest-driven engine switcher UI that reads compatible engines for the current document
- [x] rerender through existing preview-engine routing rather than bespoke shell paths
- [x] show disabled or hidden engines consistently with an explainable reason
- [x] register native v3 as the second grid-mode `frame-diagram` engine so the switcher is visible on authored frame diagrams

## Phase 3 - Validation and persistence

- [x] confirm engine changes round-trip through canonical persisted state
- [x] add focused preview tests for compatible filtering and rerender behavior
- [x] document how future engine lanes participate in compatibility declarations
