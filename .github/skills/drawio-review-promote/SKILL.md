---
name: drawio-review-promote
description: "Safely modify manually edited draw.io files. Use when preparing a review copy, checkpointing an original draw.io file, promoting reviewed changes back, or documenting a revert path for protected manual edits."
argument-hint: "Provide the manually edited draw.io path to prepare or promote"
---

# Draw.io review and promote

## When to use

- A manually edited draw.io file needs further changes.
- A protected draw.io file should not be edited in place first.
- The user wants a reversible manual draw.io workflow.

## Procedure

1. Treat the manually edited file as protected until promotion is approved.
2. Prepare a mirrored review copy with `python scripts/drawio_review_workflow.py prepare <source>`.
3. Make the first-pass edits only in the review copy under `diagrams/2.output/draw.io/review/`.
4. Compare the review copy against the protected original and confirm the intended changes.
5. Promote with `python scripts/drawio_review_workflow.py promote <source>` so the original is checkpointed under `diagrams/2.output/draw.io/checkpoints/` before replacement.
6. Record the revert path or checkpoint location if the user may need to roll back.

## Guardrails

- Do not edit the protected original first unless the user explicitly asks for in-place changes.
- Keep generator-owned metadata intact where possible.
- If a review copy drifts structurally, document the risk before promotion.