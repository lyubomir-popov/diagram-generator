# Tasks: Preview engine drift closeout

## Phase 1 - Engine surface alignment

- [x] T001 Define the single authoritative supported-engine surface
- [x] T002 Either host `elk-force` cleanly or remove/fail-fast its premature acceptance path
- [x] T003 Remove forbidden `localStorage` writes from the live preview path

## Phase 2 - Force save contract convergence

- [x] T010 Return canonical persisted state from the force save endpoint
- [x] T011 Rehydrate force preview from canonical save payloads instead of local-only authority
- [x] T012 Add focused force save/reload regressions without widening scope into a controller rewrite

## Phase 3 - Compatibility groundwork and closeout

- [x] T020 Add typed compatibility metadata/hooks to the preview-engine model
- [x] T021 Add hostability/compatibility validation around manifest and runtime routing
- [x] T022 Update repo tracking docs after focused validation is green
