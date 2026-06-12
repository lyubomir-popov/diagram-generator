---
name: diagram-language-sync
description: "Sync broader design-language specs into the diagram system. Use when importing typography, spacing, or grid rules from the upstream design language into tokens.ts, shared renderer constants, draw.io style sync, or layout helpers."
argument-hint: "Describe the upstream spec source and which token families are changing"
---

# Diagram language sync

## When to use

- The broader design language changed typography, spacing, or grid rules.
- Renderer constants need to absorb upstream design-system values.
- draw.io style defaults need to reflect new spacing or type decisions.

## Procedure

1. Read the upstream design-language source, then read `packages/layout-engine/src/tokens.ts`, `packages/layout-engine/src/frame-classes.ts`, `scripts/design_tokens.py`, and `scripts/drawio_style_sync.py`.
2. Update **code constants first** (`tokens.ts`, `frame-classes.ts`, Python parity if still required).
3. Update the **Runtime constants** table in `DIAGRAM.md` so prose stays aligned with code.
4. Rebuild outputs with the `diagram-build-validate` skill.
5. Audit changed diagrams specifically for text ascent, line spacing, box growth, connector spacing, and icon padding regressions.
6. Record any newly generalized mapping rules in `DIAGRAM.md`, `STATUS.md`, or `TODO.md` as appropriate.

## Guardrails

- Do not update `DIAGRAM.md` prose without updating `tokens.ts` / `frame-classes.ts` (or vice versa).
- Keep imported values explicit; avoid burying new design-language rules in chat-only rationale.
- Prefer one source-to-token mapping over per-diagram overrides.
- Unless the user explicitly asks for another tier, keep the repo aligned to the current diagram pilot: `18px` body text, `8px` baseline unit, `24px` line step, and `24px` structural gutters.
