# Quickstart: Diagram audit

**Feature**: 004-diagram-audit | **Date**: 2026-05-29

## Prerequisites

- Features 001 (box-style-contract) and 002 (heading-body-layout) are merged
- Python venv activated: `.venv\Scripts\Activate.ps1`
- Preview server running: `python scripts/preview_server.py` at localhost:8100

## Step-by-step execution

### 1. Verify baseline

```bash
python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q
```

All 235 tests must pass before starting.

### 2. Process each batch

For each batch (1–4), repeat this cycle:

#### a. Edit YAMLs

Open each YAML in the batch and remove redundant overrides:

- Delete `border: none` from root/wrapper nodes
- Delete `border: solid` from L2 panels (heading + leaf children only)
- Delete `border: none` from interior layout wrappers
- Delete `fill: grey` / `fill: "#F3F3F3"` from L2 panels
- Delete `fill: transparent` from L0/L1 nodes
- **Keep** all `variant:` declarations
- **Keep** any override that produces a different effect from the engine default

#### b. Run tests

```bash
python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q
```

All 235 tests must pass.

#### c. Browser-verify

Open representative diagrams at `http://127.0.0.1:8100/view/v3:<slug>` and confirm visual identity.

#### d. Commit

```bash
git add scripts/diagrams/frames/
git commit -m "yaml: batch N – remove redundant overrides from <file-list>"
```

### 3. Batch assignments

| Batch | Files | Effort |
|-------|-------|--------|
| 1 | complex-routing-usecase, complex-testcase, simple-testcase | Light |
| 2 | android-container-vs-vm, android-custom-to-cloud, example-deployment-pipeline, example-platform-architecture, example-stacked-blocks, maas-vendor-support, support-engineering-flow | Medium |
| 3 | android-graphics-stack, android-security-comparison, aws-hld, diagram-intake-workflow, diagram-language-workflow, gpu-waiting-scheduler, lightning-talk-engine | Heavy A |
| 4 | lt-a4-generator, lt-diagram-generator, lt-summit-identity, maas-architecture, maas-machine-lifecycle, request-to-hardware-stack, rise-of-inference-economy | Heavy B |

### 4. Final verification

After all 4 batches:

```bash
python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q
```

Browse all 24 diagrams in the preview server to confirm nothing regressed.

## Key reference

- Engine defaults: `resolve_styles()` in `scripts/frame_loader.py`
- Plan: `specs/004-diagram-audit/plan.md`
- Spec: `specs/004-diagram-audit/spec.md`
