# Implementation Plan: Diagram audit – fix all existing YAMLs

**Branch**: `feat/004-diagram-audit` | **Date**: 2026-05-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-diagram-audit/spec.md`

## Summary

Systematically audit all 24 non-test frame YAMLs in `scripts/diagrams/frames/` and remove redundant styling overrides that are now handled by the engine's level system (spec 001) and heading-as-child layout (spec 002). This is configuration-only work – no engine code changes. Every YAML must render identically after cleanup.

## Technical Context

**Language/Version**: Python 3.11+ (engine), YAML (frame files being edited)

**Primary Dependencies**: frame_loader.py (resolve_styles), layout_v3.py, diagram_render_svg.py

**Storage**: N/A – YAML files in `scripts/diagrams/frames/`

**Testing**: `python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q` (235 tests)

**Target Platform**: SVG output, HTML preview at localhost:8100

**Project Type**: Configuration audit (no source code changes)

**Performance Goals**: N/A

**Constraints**: Visual output must be pixel-identical before/after for every modified YAML

**Scale/Scope**: 24 non-test YAML files, grouped into 3 effort tiers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Anti-patch protocol | **PASS** | Classification: "Configuration" – removing redundant YAML overrides, no engine changes |
| II. Layer ownership | **PASS** | All changes in Frame YAML, the owning layer for structure |
| III. DIAGRAM.md visual contract | **PASS** | Cleanup aligns YAMLs with engine defaults that implement DIAGRAM.md |
| IV. Test before ship | **PASS** | Full test suite + browser verification after every batch |
| V. Sensible defaults | **PASS** | This is the entire point – remove overrides that duplicate engine defaults |
| VI. Stable interfaces | **N/A** | No code changes |
| VII. No format lock-in | **N/A** | No new format identifiers |
| VIII. Semantic YAML | **PASS** | Removing visual `fill:`/`border:` overrides moves toward semantic purity |

No violations. No complexity tracking needed.

## Engine Defaults Reference

From `resolve_styles()` in `frame_loader.py`:

| Level | Fill | Stroke | When |
|-------|------|--------|------|
| L0 (root/wrapper) | transparent | none | Always |
| L1 (leaf) | transparent | #000000 | No children |
| L2 (panel + heading, no panel descendants) | #F3F3F3 | #F3F3F3 | Has heading, leaf descendants only |
| L3 (panel parent + heading + panel descendants) | transparent | #000000 | Has heading + nested panels |

| Variant | Fill | Stroke |
|---------|------|--------|
| highlight | black | black |
| annotation | transparent | none |

## Audit Findings

### Redundancy categories

| Finding | Count | Action |
|---------|-------|--------|
| Root `border: none` | 16/24 | Remove – L0 default is "none" |
| Explicit `border: solid` on L2 panels | 12/24 | Remove – engine assigns solid at L2 |
| Excessive `border: none` on layout wrappers | 8/24 | Remove – L0 default handles this |
| `variant: highlight` usage | 7/24 | Keep – correct intentional use |
| `variant: annotation` usage | 1/24 | Keep – correct intentional use |
| lt-diagram-generator.yaml missing L2 border | 1/24 | Leave – engine handles it; adding explicit border would contradict cleanup direction |
| Orphaned memory-wall.json | 1 | Flag only – no matching YAML, separate concern |

### Files by cleanup effort

**Light (root border: none only – 3 files):**
- complex-routing-usecase
- complex-testcase
- simple-testcase

**Medium (root border + a few redundant overrides – 7 files):**
- android-container-vs-vm
- android-custom-to-cloud
- example-deployment-pipeline
- example-platform-architecture
- example-stacked-blocks
- maas-vendor-support
- support-engineering-flow

**Heavy (many redundant border/fill overrides – 14 files):**
- android-graphics-stack
- android-security-comparison
- aws-hld
- diagram-intake-workflow
- diagram-language-workflow
- gpu-waiting-scheduler
- lightning-talk-engine
- lt-a4-generator
- lt-diagram-generator
- lt-summit-identity
- maas-architecture
- maas-machine-lifecycle
- request-to-hardware-stack
- rise-of-inference-economy

## Execution Strategy

### Batch processing order

Work in 4 batches to keep diffs reviewable and regressions isolatable:

1. **Batch 1 – Light cleanup** (3 files): Root `border: none` removal only. Quick wins to validate the workflow.
2. **Batch 2 – Medium cleanup** (7 files): Root border + a few interior overrides.
3. **Batch 3 – Heavy cleanup, group A** (7 files): android-*, aws-hld, diagram-intake-workflow, diagram-language-workflow, gpu-waiting-scheduler, lightning-talk-engine.
4. **Batch 4 – Heavy cleanup, group B** (7 files): lt-*, maas-*, request-to-hardware-stack, rise-of-inference-economy.

### Per-batch workflow

For each batch:

1. **Snapshot**: Note current test count and state.
2. **Edit**: Remove redundant overrides per the rules below.
3. **Test**: `python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q` – all 235 tests must pass.
4. **Render**: Run all modified diagrams through `layout_frame_diagram()` and confirm no errors.
5. **Browser-verify**: Check representative diagrams at `http://127.0.0.1:8100/view/v3:<slug>` for visual identity.
6. **Commit**: One commit per batch with prefix `yaml:`.

### Override removal rules

**Remove if:**
- `border: none` on a root/wrapper node (L0 default)
- `border: solid` on a panel with heading and no panel descendants (L2 default)
- `border: none` on internal layout wrappers that are effectively L0
- `fill: grey` / `fill: "#F3F3F3"` on L2 panels (engine default)
- `fill: transparent` on L0/L1 nodes (engine default)

**Keep if:**
- `variant: highlight` or `variant: annotation` (intentional semantic overrides)
- Any override that produces a visual effect different from the engine default for that level
- Explicit `border: solid` on a node that would not otherwise get it from the engine

### Verification command

```bash
python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q
```

## Project Structure

### Documentation (this feature)

```text
specs/004-diagram-audit/
├── plan.md              # This file
├── research.md          # Engine defaults analysis and audit findings
├── data-model.md        # YAML cleanup rules and file inventory
└── quickstart.md        # Step-by-step execution guide
```

### Source (files being modified)

```text
scripts/diagrams/frames/
├── android-container-vs-vm.yaml
├── android-custom-to-cloud.yaml
├── android-graphics-stack.yaml
├── android-security-comparison.yaml
├── aws-hld.yaml
├── complex-routing-usecase.yaml
├── complex-testcase.yaml
├── diagram-intake-workflow.yaml
├── diagram-language-workflow.yaml
├── example-deployment-pipeline.yaml
├── example-platform-architecture.yaml
├── example-stacked-blocks.yaml
├── gpu-waiting-scheduler.yaml
├── lightning-talk-engine.yaml
├── lt-a4-generator.yaml
├── lt-diagram-generator.yaml
├── lt-summit-identity.yaml
├── maas-architecture.yaml
├── maas-machine-lifecycle.yaml
├── maas-vendor-support.yaml
├── request-to-hardware-stack.yaml
├── rise-of-inference-economy.yaml
├── simple-testcase.yaml
└── support-engineering-flow.yaml
```

**Structure Decision**: No new files or directories. This feature modifies existing YAML configuration files only.
