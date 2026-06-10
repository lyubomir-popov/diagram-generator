# Tasks: Compatible engine switcher

## Phase 1 - Compatibility contract

- [x] T001 Define the typed compatibility contract each preview engine must expose
  - Extended `PreviewEngineCompatibility` with `description`
  - Added `CompatibilityResult` type
  - Added `evaluatePreviewEngineCompatibility()` with detailed reasons
  - Added `listPreviewEnginesWithCompatibility()` for switcher UI
  - All engines now have human-readable descriptions
  - Added the first real structural gate: `elk-layered` is only compatible with
    `frame-diagram` docs that actually author at least one arrow
  - Tests: 14/14 pass in `preview-engine-registry.test.ts`
- [x] T002 Decide the canonical persistence path for the selected engine
  - Engine choice persists as `meta.layout_engine` in frame YAML
  - Added `layout_engine` field to `PersistOverridePayload`
  - Added `applyLayoutEngineChoice()` helper in persistence layer
  - Supports set, update, and clear (null) operations
  - Server `/api/overrides/{slug}` rejects a persisted `layout_engine` that is not a
    hostable grid engine (compatibility gate at the write boundary)
  - Live preview-app coverage now proves the HTTP reject path for arrowless frame diagrams
  - Tests: 13/13 pass in `frame-diagram.test.ts` (spec 035 cases included)
- [x] T003 Record example compatibility matrices for current and near-term engines
  - Current-engine matrix recorded in `plan.md`
  - Near-term matrix recorded as aspirational only: those document kinds are NOT yet
    representable until `PreviewDocumentKind` is widened (documented in `plan.md`)


## Phase 2 - Preview switcher

- [x] T010 Add a manifest-driven engine switcher UI for compatible engines only
- [x] T011 Rerender the current document through the selected engine without duplicating authored state
- [x] T012 Add focused tests for hidden/disabled incompatible engines

## Phase 3 - Closeout

- [x] T020 Document the contract for future engine lanes
- [x] T021 Update repo tracking docs after implementation lands
- [x] T022 Mark the spec complete only after compatibility filtering and persistence are validated
