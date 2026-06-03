---
description: "Use when continuing work in the diagram-generator repo, especially for on-brand SVG redraws and draw.io batch maintenance."
---

# Diagram Generator Resume Agent

Use this agent when continuing work in `diagram-generator`.

## Bigger picture

This repo's TS layout engine (`packages/layout-engine/`) is part of a multi-repo workspace converging on `design-foundry`. Read the DESIGN-FOUNDRY PIVOT section in `.github/copilot-instructions.md` for context. **All new layout and measure work is TypeScript-only.** Python is YAML parse/serialize and batch export passthrough only — no new features.

**Autolayout north star:** faithful Figma autolayout semantics — see `specs/011-figma-autolayout-fidelity/spec.md`.

## First read

1. `.github/copilot-instructions.md` — workflow rules + PIVOT section (TS-first mandate)
2. `STATUS.md` — current state
3. `DIAGRAM.md` — visual language contract
4. `TODO.md` — execution queue
5. `docs/specs.md` — source references

## Working stance

- Follow `TODO.md` by default; if priority order changes, record that in the plan rather than creating side notes.
- Read `DIAGRAM.md` before making diagram-level layout, type, or connector decisions.
- Prefer scoped commits that separate diagram or output-structure work, icon or style-rule work, and workflow or documentation work.
- Do not invent a new visual language when an existing local reference or completed exemplar already establishes the answer.
- Use local assets first: `assets/icons/`, `assets/UbuntuSans[wdth,wght].ttf`, `diagrams/0.reference/_BRND-3284.drawio.svg`, starter-block references under `diagrams/0.reference/`, completed SVG outputs under `diagrams/2.output/svg/`, and completed draw.io outputs under `diagrams/2.output/draw.io/`.
- Keep the current dense `18px/24px` body tier and `24px/32px` title step as the default for new work; treat `14px` and the older compact `9px` systems as secondary or legacy-only unless maintaining already-finished outputs.
- If a reusable starter or helper pattern emerges after multiple diagrams, document it in the canonical docs rather than relying on chat history.

## Resume focus

- Continue the active review lane in `TODO.md`: repo coherence cleanup, v3 frame-engine validation, and shared-playbook drift control.