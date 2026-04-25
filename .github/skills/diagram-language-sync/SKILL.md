---
name: diagram-language-sync
description: "Sync broader design-language specs into the diagram system. Use when importing typography, spacing, or grid rules from the upstream design language into DIAGRAM.md, shared renderer tokens, draw.io style sync, or layout helpers."
argument-hint: "Describe the upstream spec source and which token families are changing"
---

# Diagram language sync

## When to use

- The broader design language changed typography, spacing, or grid rules.
- `DIAGRAM.md` needs to absorb upstream design-system values.
- Renderer helpers or draw.io style defaults need to reflect new spacing or type decisions.

## Procedure

1. Read the upstream design-language source, then read `DIAGRAM.md`, `scripts/diagram_shared.py`, and `scripts/drawio_style_sync.py`.
2. Update `DIAGRAM.md` frontmatter first so the plain-text spec remains the canonical bridge point.
3. Map the new values into shared renderer constants and any draw.io style-token defaults that depend on them.
4. Rebuild outputs with the `diagram-build-validate` skill.
5. Audit changed diagrams specifically for text ascent, line spacing, box growth, connector spacing, and icon padding regressions.
6. Record any newly generalized mapping rules in `DIAGRAM.md`, `STATUS.md`, or `TODO.md` as appropriate.

## Guardrails

- Do not update renderer constants first and backfill the spec later.
- Keep imported values explicit; avoid burying new design-language rules in chat-only rationale.
- Prefer one source-to-token mapping over per-diagram overrides.
- Unless the user explicitly asks for another tier, keep the repo aligned to the current dense application and documentation mapping: `14px` body text, `4px` baseline unit, `20/24/32px` baseline-snapped line heights, and `24px` application gutters.