---
description: "Use when continuing work in the diagram-generator repo, especially for on-brand SVG redraws and draw.io batch maintenance."
---

# Diagram Generator Resume Agent

Use this agent when continuing work in `diagram-generator`.

## What belongs here

- A short repo-specific resume prompt for future agents.
- The first files to read in this repo.
- Brief continuation hints about the most important work surfaces.
- Narrow repo-specific guidance that would be awkward to place in the generic workflow rules.

Keep this file short enough that reading it at session start is cheap.

## What does not belong here

- Stable workflow rules that apply repo-wide. Those belong in `.github/copilot-instructions.md`.
- Current state, progress notes, or cold-start facts. Those belong in `STATUS.md`.
- Active tasks, decision notes, or architecture notes. Those belong in `TODO.md`.
- Long-term direction. That belongs in `ROADMAP.md`.
- Source-of-truth references. Those belong in `docs/specs.md`.
- User-facing overview text. That belongs in `README.md`.
- Long agent handoffs or diagnostics. Those belong in `AGENT-INBOX.md`.

If this file starts accumulating extra detail, move that detail to the canonical workflow file instead of growing this prompt into a second status document.

## First read

1. `.github/copilot-instructions.md`
2. `STATUS.md`
3. `DIAGRAM.md`
4. `TODO.md`
5. `ROADMAP.md`
6. `docs/specs.md`
7. `README.md`

## Cold-start question

Before starting diagram work, ask the user:

> Which pipeline should we work on this session?
>
> 1. **Pipeline 1 (stable)** – imperative builders in `generate_remaining_diagrams.py`, builds via `build_outputs.py`, outputs `*-onbrand.svg/drawio`
> 2. **Pipeline 2 (declarative grid)** – declarative grid definitions in `scripts/diagrams/*.py`, builds via `build_v2.py`, outputs `*-onbrand-v2.svg/drawio`
> 3. **Pipeline 3 (v3 frame engine)** – declarative YAML frames in `scripts/diagrams/frames/*.yaml`, Figma-like autolayout engine ported to TypeScript (`packages/layout-engine/`), runs client-side via `layout-bridge.js`, preview at `http://127.0.0.1:8100/view/v3:<slug>`. Python `layout_v3.py` stays for batch builds.

This determines which files to edit, which build/test commands to run, and which validation mode matters. Do not assume one or the other.

## Canonical discipline

- Read and follow the **anti-patch protocol** in `.github/copilot-instructions.md` before coding anything. Classify every request first.
- Treat `DIAGRAM.md` as the source of truth for visual rules — colors, typography, layout, components, arrows.
- Treat `.github/copilot-instructions.md` as the source of truth for workflow discipline and the anti-patch protocol.
- Never duplicate visual rules from `DIAGRAM.md` into other files.
- Keep status in the canonical workflow files: `STATUS.md`, `TODO.md`, `ROADMAP.md`, `HISTORY.md`, `INBOX.md`, `AGENT-INBOX.md`, and `docs/specs.md`.
- Drain `INBOX.md` and `AGENT-INBOX.md` at session start.
- Update `STATUS.md` when the current state changes.
- Update `TODO.md` when active work or architecture notes change.
- Move completed items to `HISTORY.md`.
- Update `ROADMAP.md` only when long-term direction changes.
- Put long machine-generated notes in `AGENT-INBOX.md`, not in this file.

## Working stance

- Follow `TODO.md` by default; if priority order changes, record that in the plan rather than creating side notes.
- Read `DIAGRAM.md` before making diagram-level layout, type, or connector decisions.
- Prefer scoped commits that separate diagram or output-structure work, icon or style-rule work, and workflow or documentation work.
- Do not invent a new visual language when an existing local reference or completed exemplar already establishes the answer.
- Use local assets first: `assets/icons/`, `assets/UbuntuSans[wdth,wght].ttf`, `diagrams/0.reference/_BRND-3284.drawio.svg`, starter-block references under `diagrams/0.reference/`, completed SVG outputs under `diagrams/2.output/svg/`, and completed draw.io outputs under `diagrams/2.output/draw.io/`.
- Keep the current dense `18px/24px` body tier and `24px/32px` title step as the default for new work; treat `14px` and the older compact `9px` systems as secondary or legacy-only unless maintaining already-finished outputs.
- If a reusable starter or helper pattern emerges after multiple diagrams, document it in the canonical docs rather than relying on chat history.

## Resume focus

- Continue the active review lane in `TODO.md`: Illustrator re-audit, draw.io import validation, and shared-playbook drift control.