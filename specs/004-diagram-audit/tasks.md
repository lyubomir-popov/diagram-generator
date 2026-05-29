# Tasks: Diagram audit – fix all existing YAMLs

**Input**: Design documents from `/specs/004-diagram-audit/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Organization**: Tasks are grouped by batch (matching plan.md) to keep diffs reviewable and regressions isolatable. This is configuration-only work – no engine code changes.

## Format: `[ID] [P?] [Batch] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Batch]**: Which batch this task belongs to (B1, B2, B3, B4)
- All edits target `scripts/diagrams/frames/`

## Override Removal Rules (Reference)

**Remove if:**
- `border: none` on root/wrapper node (L0 default)
- `border: solid` on L2 panel (heading + leaf children only – engine default)
- `border: none` on interior layout wrappers (effectively L0)
- `fill: grey` / `fill: "#F3F3F3"` on L2 panels (engine default)
- `fill: transparent` on L0/L1 nodes (engine default)

**Keep if:**
- `variant: highlight` or `variant: annotation` (intentional semantic overrides)
- Any override producing a different effect from the engine default for that level
- Explicit `border: solid` on a node that wouldn't otherwise get it from the engine

---

## Phase 1: Setup

**Purpose**: Verify baseline before any edits

- [x] T001 Activate Python venv and confirm preview server is running at localhost:8100
- [x] T002 Run baseline test suite: `python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q` – confirm all 235 tests pass
- [x] T003 Verify feat/001-box-style-contract and feat/002-heading-body-layout are merged into current branch

**Checkpoint**: Baseline confirmed – batch processing can begin

---

## Phase 2: Batch 1 – Light cleanup (3 files) 🎯 MVP

**Goal**: Remove root `border: none` from 3 simple files. Quick wins to validate the workflow.

**Independent Test**: All 235 tests pass + 3 diagrams render identically in browser.

### User Story 1 – Remove redundant explicit styling (P1)

- [x] T004 [P] [B1] Remove root `border: none` from scripts/diagrams/frames/complex-routing-usecase.yaml
- [x] T005 [P] [B1] Remove root `border: none` from scripts/diagrams/frames/complex-testcase.yaml
- [x] T006 [P] [B1] Remove root `border: none` from scripts/diagrams/frames/simple-testcase.yaml

### Batch 1 Verification

- [x] T007 [B1] Run test suite: `python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q` – all 235 tests must pass
- [x] T008 [B1] Browser-verify complex-routing-usecase at http://127.0.0.1:8100/view/v3:complex-routing-usecase
- [x] T009 [P] [B1] Browser-verify complex-testcase at http://127.0.0.1:8100/view/v3:complex-testcase
- [x] T010 [P] [B1] Browser-verify simple-testcase at http://127.0.0.1:8100/view/v3:simple-testcase
- [x] T011 [B1] Commit batch 1: `git commit -m "yaml: batch 1 – remove redundant root border from light files"`

**Checkpoint**: Batch 1 complete – already clean, no changes needed

---

## Phase 3: Batch 2 – Medium cleanup (7 files)

**Goal**: Remove root border + interior redundant overrides from 7 medium-complexity files.

**Independent Test**: All 235 tests pass + 7 diagrams render identically in browser.

### User Story 1 – Remove redundant explicit styling (P1)

- [x] T012 [P] [B2] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/android-container-vs-vm.yaml
- [x] T013 [P] [B2] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/android-custom-to-cloud.yaml
- [x] T014 [P] [B2] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/example-deployment-pipeline.yaml
- [x] T015 [P] [B2] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/example-platform-architecture.yaml
- [x] T016 [P] [B2] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/example-stacked-blocks.yaml
- [x] T017 [P] [B2] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/maas-vendor-support.yaml

### User Story 2 – Fix incorrect tier assignments (P1)

- [x] T018 [B2] Audit and fix tier assignments in scripts/diagrams/frames/support-engineering-flow.yaml – verified correct, no changes needed

### Batch 2 Verification

- [x] T019 [B2] Run test suite: `python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q` – all 235 tests must pass
- [x] T020 [P] [B2] Browser-verify android-container-vs-vm at http://127.0.0.1:8100/view/v3:android-container-vs-vm
- [x] T021 [P] [B2] Browser-verify android-custom-to-cloud at http://127.0.0.1:8100/view/v3:android-custom-to-cloud
- [x] T022 [P] [B2] Browser-verify example-deployment-pipeline at http://127.0.0.1:8100/view/v3:example-deployment-pipeline
- [x] T023 [P] [B2] Browser-verify example-platform-architecture at http://127.0.0.1:8100/view/v3:example-platform-architecture
- [x] T024 [P] [B2] Browser-verify example-stacked-blocks at http://127.0.0.1:8100/view/v3:example-stacked-blocks
- [x] T025 [P] [B2] Browser-verify maas-vendor-support at http://127.0.0.1:8100/view/v3:maas-vendor-support
- [x] T026 [P] [B2] Browser-verify support-engineering-flow at http://127.0.0.1:8100/view/v3:support-engineering-flow
- [x] T027 [B2] Commit batch 2: `git commit -m "yaml: batch 2 – remove redundant overrides from medium files"`

**Checkpoint**: Batch 2 complete – 10/24 files cleaned

---

## Phase 4: Batch 3 – Heavy cleanup, group A (7 files)

**Goal**: Remove many redundant border/fill overrides from 7 complex files.

**Independent Test**: All 235 tests pass + 7 diagrams render identically in browser.

### User Story 1 – Remove redundant explicit styling (P1)

- [x] T028 [P] [B3] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/android-graphics-stack.yaml
- [x] T029 [P] [B3] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/aws-hld.yaml
- [x] T030 [P] [B3] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/diagram-intake-workflow.yaml
- [x] T031 [P] [B3] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/diagram-language-workflow.yaml
- [x] T032 [P] [B3] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/gpu-waiting-scheduler.yaml
- [x] T033 [P] [B3] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/lightning-talk-engine.yaml

### User Story 2 – Fix incorrect tier assignments (P1)

- [x] T034 [B3] Audit and fix tier assignments in scripts/diagrams/frames/android-security-comparison.yaml – verified correct, no changes needed

### Batch 3 Verification

- [x] T035 [B3] Run test suite: `python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q` – all 235 tests must pass
- [x] T036 [P] [B3] Browser-verify android-graphics-stack at http://127.0.0.1:8100/view/v3:android-graphics-stack
- [x] T037 [P] [B3] Browser-verify android-security-comparison at http://127.0.0.1:8100/view/v3:android-security-comparison
- [x] T038 [P] [B3] Browser-verify aws-hld at http://127.0.0.1:8100/view/v3:aws-hld
- [x] T039 [P] [B3] Browser-verify diagram-intake-workflow at http://127.0.0.1:8100/view/v3:diagram-intake-workflow
- [x] T040 [P] [B3] Browser-verify diagram-language-workflow at http://127.0.0.1:8100/view/v3:diagram-language-workflow
- [x] T041 [P] [B3] Browser-verify gpu-waiting-scheduler at http://127.0.0.1:8100/view/v3:gpu-waiting-scheduler
- [x] T042 [P] [B3] Browser-verify lightning-talk-engine at http://127.0.0.1:8100/view/v3:lightning-talk-engine
- [x] T043 [B3] Commit batch 3: automated cleanup committed as part of combined batch 3+4

**Checkpoint**: Batch 3 complete – 17/24 files cleaned

---

## Phase 5: Batch 4 – Heavy cleanup, group B (7 files)

**Goal**: Remove many redundant border/fill overrides from the final 7 complex files.

**Independent Test**: All 235 tests pass + 7 diagrams render identically in browser.

### User Story 1 – Remove redundant explicit styling (P1)

- [x] T044 [P] [B4] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/lt-a4-generator.yaml
- [x] T045 [P] [B4] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/lt-summit-identity.yaml
- [x] T046 [P] [B4] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/maas-architecture.yaml
- [x] T047 [P] [B4] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/maas-machine-lifecycle.yaml
- [x] T048 [P] [B4] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/request-to-hardware-stack.yaml (20+ `border: none` instances)
- [x] T049 [P] [B4] Remove redundant `border:` and `fill:` overrides from scripts/diagrams/frames/rise-of-inference-economy.yaml

### User Story 1 + 2 – Special case

- [x] T050 [B4] Audit scripts/diagrams/frames/lt-diagram-generator.yaml – engine handles missing L2 border correctly, confirmed no action needed

### User Story 3 – Consistent text hierarchy in cards (P2)

- [x] T051 [B4] Search all 24 YAMLs for mixed-weight labels and verify they use `{text: ..., weight: "700"}` format for bold title lines – all consistent
- [x] T052 [B4] Fix any inconsistent bold-title label formats found in T051 – none found

### Batch 4 Verification

- [x] T053 [B4] Run test suite: `python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q` – all 235 tests must pass
- [x] T054 [P] [B4] Browser-verify lt-a4-generator at http://127.0.0.1:8100/view/v3:lt-a4-generator
- [x] T055 [P] [B4] Browser-verify lt-diagram-generator at http://127.0.0.1:8100/view/v3:lt-diagram-generator
- [x] T056 [P] [B4] Browser-verify lt-summit-identity at http://127.0.0.1:8100/view/v3:lt-summit-identity
- [x] T057 [P] [B4] Browser-verify maas-architecture at http://127.0.0.1:8100/view/v3:maas-architecture
- [x] T058 [P] [B4] Browser-verify maas-machine-lifecycle at http://127.0.0.1:8100/view/v3:maas-machine-lifecycle
- [x] T059 [P] [B4] Browser-verify request-to-hardware-stack at http://127.0.0.1:8100/view/v3:request-to-hardware-stack
- [x] T060 [P] [B4] Browser-verify rise-of-inference-economy at http://127.0.0.1:8100/view/v3:rise-of-inference-economy
- [x] T061 [B4] Commit batch 4: automated cleanup committed as part of combined batch 3+4

**Checkpoint**: Batch 4 complete – all 24 files cleaned

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all diagrams and cleanup

- [x] T062 Run full test suite one final time: `python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q` – all 235 tests pass
- [x] T063 Browse all 24 diagrams in preview server for final visual regression check
- [x] T064 Flag orphaned memory-wall.json as a separate cleanup concern in TODO.md
- [x] T065 Run quickstart.md validation – confirmed all steps in specs/004-diagram-audit/quickstart.md are accurate post-audit

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies – start immediately
- **Batch 1 (Phase 2)**: Depends on Setup – validates the workflow
- **Batch 2 (Phase 3)**: Depends on Batch 1 verification passing
- **Batch 3 (Phase 4)**: Depends on Batch 2 verification passing
- **Batch 4 (Phase 5)**: Depends on Batch 3 verification passing
- **Polish (Phase 6)**: Depends on all batches complete

### Within Each Batch

1. All YAML edit tasks marked [P] can run in parallel (different files, no dependencies)
2. Test suite run (T007/T019/T035/T053) must wait for all edits in that batch
3. Browser verification tasks marked [P] can run in parallel after tests pass
4. Commit must be last in each batch

### Parallel Opportunities

- Within any batch, all file-edit tasks ([P]) can run simultaneously
- Within any batch, all browser-verify tasks ([P]) can run simultaneously after tests pass
- Batches themselves are sequential (each depends on prior batch passing verification)

---

## Parallel Example: Batch 2

```bash
# Launch all YAML edits in parallel:
Task T012: android-container-vs-vm.yaml
Task T013: android-custom-to-cloud.yaml
Task T014: example-deployment-pipeline.yaml
Task T015: example-platform-architecture.yaml
Task T016: example-stacked-blocks.yaml
Task T017: maas-vendor-support.yaml
Task T018: support-engineering-flow.yaml

# After all edits complete, run tests:
Task T019: python -m pytest ... -q

# After tests pass, browser-verify in parallel:
Task T020–T026: all 7 diagrams verified simultaneously

# After verification, commit:
Task T027: git commit
```

---

## Implementation Strategy

### MVP First (Batch 1 Only)

1. Complete Phase 1: Setup – verify baseline
2. Complete Phase 2: Batch 1 – 3 light files
3. **STOP and VALIDATE**: All tests pass + visual identity confirmed
4. This proves the workflow works before tackling harder files

### Incremental Delivery

1. Batch 1 (3 files) → validate → commit (MVP)
2. Batch 2 (7 files) → validate → commit (10/24 done)
3. Batch 3 (7 files) → validate → commit (17/24 done)
4. Batch 4 (7 files) → validate → commit (24/24 done)
5. Polish → final verification → done

Each batch is independently committable and revertable. If a batch breaks something, revert just that batch.

---

## Notes

- [P] tasks = different files, no dependencies between them
- [B1]–[B4] = batch number for traceability
- No engine code changes – YAML configuration only
- Visual output must be identical before/after for every modified file
- `variant:` declarations are always intentional – never remove them
- request-to-hardware-stack.yaml has the most overrides (20+) – budget extra time
- lt-diagram-generator.yaml may need no changes – engine handles missing L2 border correctly
