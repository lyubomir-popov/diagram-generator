# Diagram Generator

An LLM-based diagramming workflow that turns rough sketches and brand/layout rules into on-brand SVG and draw.io diagrams.

## Quick start: file convention

Agent instructions live under `.github`, not the repo root:

- **`.github/copilot-instructions.md`** — the single repo-wide instruction file
- **`.github/agents/agent.md`** — optional repo-specific resume prompt
- **`.github/skills/`** — optional on-demand workflow skills for repeatable procedures

Everything else lives at the repo root as operational workflow files:

```
README.md        — human-readable overview
DIAGRAM.md       — canonical diagram language spec
ROADMAP.md       — long-term direction
TODO.md          — active execution queue
INBOX.md         — async user notes (agent drains these)
AGENT-INBOX.md   — agent-only handoffs and diagnostics
STATUS.md        — cold-start orientation
HISTORY.md       — completed work archive
docs/specs.md    — source docs, reference assets, sibling repos
```

The rule: every important piece of project state lives in exactly one place.

## What this repo does

This repo rebuilds rough, hand-drawn, or inconsistent diagrams into a strict reusable design system with:

- editable SVG outputs
- editable draw.io XML outputs
- consistent typography, spacing, icon placement, and arrow geometry
- cold-start-safe workflow files so a new chat can continue without re-deriving the system

## Workflow

### Before generating any diagram

**Read the playbook first.** The diagram style rules are non-negotiable:

1. Read [`DIAGRAM.md`](DIAGRAM.md)
2. Review the invariants in [`.github/copilot-instructions.md`](.github/copilot-instructions.md) under "Non-negotiable diagram rules"

Key rules you must not violate:

- Colors: white, `#F3F3F3` grey, or one black emphasis box only — **no other fills**
- Orange `#E95420` is **reserved for arrows only** — never use it for boxes
- Icons come from [`assets/icons/`](assets/icons) only — do not invent or source new ones
- Text is always top-left aligned with `8px` insets

### After adding new diagrams

Update the comparison pages so reviewers can see before/after:

1. Add entries to the `PAIRS` list in [`scripts/build_compare_pages.py`](scripts/build_compare_pages.py)
2. Run `python scripts/build_compare_pages.py`
3. Verify the new HTML appears in [`diagrams/3.compare/html/`](diagrams/3.compare/html)

### Input/output structure

Input:

- rough sketches or screenshot references in [`diagrams/1.input/`](diagrams/1.input)
- brand and layout invariants documented in [`DIAGRAM.md`](DIAGRAM.md), [`STATUS.md`](STATUS.md), and [`docs/specs.md`](docs/specs.md)
- local icons from [`assets/icons/`](assets/icons)

Output:

- primary editable draw.io exports in [`diagrams/2.output/draw.io/`](diagrams/2.output/draw.io)
- sibling SVG outputs in [`diagrams/2.output/svg/`](diagrams/2.output/svg)

Build order:

- **Pipeline 1 (stable):** run [`build_outputs.py`](scripts/build_outputs.py) for the canonical batch build
- **Pipeline 2 (experimental):** run [`build_v2.py`](scripts/build_v2.py) for the declarative grid outputs
- Compare with [`_compare_3way.py`](scripts/_compare_3way.py) to validate v2 against v1 and input sketches

## Canonical references

- Starter block: [`sample.svg`](diagrams/0.reference/sample.svg)
- Larger visual preview: [`sample.png`](diagrams/0.reference/sample.png)
- Reusable SVG starter: [`onbrand-svg-starter.svg`](diagrams/0.reference/onbrand-svg-starter.svg)
- Canonical exemplar: [`memory-wall-onbrand.svg`](diagrams/2.output/svg/memory-wall-onbrand.svg)
- Canonical draw.io exporter: [`export_drawio_batch.py`](scripts/export_drawio_batch.py)
- Shared primitives module: [`diagram_shared.py`](scripts/diagram_shared.py)

## Current design system

The canonical diagram-language contract now lives in [`DIAGRAM.md`](DIAGRAM.md). It holds the current tokens, layout rules, output constraints, and redraw workflow in one place so `TODO.md` can stay focused on active work.

## Draw.io export rules

- Text-bearing boxes, panels, and notation widgets must export as native editable `mxCell` geometry
- Icons may use embedded `data:` image cells
- Truly special non-text shapes like the jagged memory wall may use image-backed cells when needed
- Direct connectors must use real `source` / `target` references plus explicit `entry` / `exit` anchors
- Exports should force light rendering with `adaptiveColors="none"` and explicit colors

## Workflow map

| File | Purpose |
|------|---------|
| `.github/copilot-instructions.md` | Agent rules, workflow conventions, diagram invariants |
| `.github/agents/agent.md` | Repo-specific resume-agent prompt |
| `.github/skills/` | Optional on-demand workflow skills |
| `README.md` | Human-readable overview and workflow reminder |
| `DIAGRAM.md` | Canonical diagram language spec |
| `ROADMAP.md` | Long-term direction and future stages |
| `TODO.md` | Active queue, principles, architecture notes |
| `INBOX.md` | Quick user notes to be triaged later |
| `AGENT-INBOX.md` | Machine-generated handoffs and diagnostics awaiting triage |
| `STATUS.md` | Cold-start orientation for the next session |
| `HISTORY.md` | Archive of completed work |
| `docs/specs.md` | Governing references, local assets, sibling repos |

`INBOX.md` and `AGENT-INBOX.md` have different jobs. User notes stay in `INBOX.md` so they remain easy to scan. Long agent-to-agent handoffs, cross-repo follow-ups, and automation diagnostics go in `AGENT-INBOX.md` instead.

## How to work in this repo

### If you are the user

1. Put interrupting ideas, reminders, and loose notes in `INBOX.md`.
2. Keep machine-generated handoff text out of `INBOX.md`; that belongs in `AGENT-INBOX.md`.
3. Use `TODO.md` for the next real work items only.
4. Use `ROADMAP.md` for longer-term direction, not the active queue.
5. Read `README.md`, `STATUS.md`, and `DIAGRAM.md` when returning after time away.

### If you are the agent

1. Start with `STATUS.md`.
2. Read `DIAGRAM.md` before changing diagram behavior.
3. Drain `INBOX.md` into `TODO.md` or `ROADMAP.md`.
4. Drain `AGENT-INBOX.md` into canonical files.
5. Read `TODO.md`.
6. Read `docs/specs.md` before changing spec-governed behavior.
7. Update `STATUS.md`, `TODO.md`, and `HISTORY.md` as work lands.

## LLM efficiency notes

These habits matter more than prompt cleverness when you are using a coding or diagramming LLM in this repo.

- Pick one model per task. Model switches often invalidate caches and force the tool to reprocess the same context.
- Keep permanent instructions short. Durable rules belong in `.github/copilot-instructions.md` and `DIAGRAM.md`; one-off task detail belongs in the active prompt, `TODO.md`, or `STATUS.md`.
- Keep project memory in the repo, not only in chat. `STATUS.md`, `TODO.md`, `HISTORY.md`, and `docs/specs.md` are the cheap recovery path for a fresh session.
- Prefer markdown, plain text, and direct asset paths over screenshots of text, dense tables, or loosely paraphrased descriptions.
- Search in smaller verified passes, then confirm against the governing reference asset or output file.
- Checkpoint and restart freely when context gets noisy instead of dragging a bloated conversation forward.

Educational notes:

- Good repo state beats long chat history. If a new session can recover by reading a few files, the workflow scales.
- Durable rules should stay stable. Temporary context should be disposable. Mixing them is a common source of token waste.
- Verification is part of efficient prompting. A fast wrong answer that is never checked is more expensive than a slower answer with a narrow validation step.

## Status

There are two diagram generation pipelines. Both coexist and write to separate output files.

### Pipeline 1: imperative (stable)

The proven, production-ready pipeline. Each diagram is an imperative Python function that places every box, arrow, icon, and label with explicit coordinates.

| | |
|---|---|
| **Builder** | `scripts/generate_remaining_diagrams.py` |
| **Entry point** | `python scripts/build_outputs.py` |
| **Outputs** | `*-onbrand.svg`, `*-onbrand.drawio` |
| **Maturity** | Stable. All 9 diagrams are content-complete against their input sketches. |

### Pipeline 2: declarative grid (experimental)

A newer declarative system where diagrams are defined as data (model → layout → SVG/draw.io). Uses a grid-based layout engine with auto-routing arrows.

| | |
|---|---|
| **Definitions** | `scripts/diagrams/*.py` (one file per diagram) |
| **Layout engine** | `scripts/diagram_layout.py` + `scripts/diagram_model.py` |
| **Entry point** | `python scripts/build_v2.py` |
| **Outputs** | `*-onbrand-v2.svg`, `*-onbrand-v2.drawio` |
| **Maturity** | Experimental. Several diagrams still have missing content, broken arrows, or layout issues vs their v1 equivalents. |

### 3-way visual comparison

Use `python scripts/_compare_3way.py` to generate Playwright screenshots comparing input sketch → v1 → v2 for each diagram. Output lands in `diagrams/3.compare/visual-diff/`. This is the primary tool for identifying v2 regressions.

### Which pipeline to use

- For production outputs, use Pipeline 1.
- For development of the declarative system, use Pipeline 2 and always validate against the v1 output and input sketch using the 3-way comparison tool.
- On a cold start, the agent should ask the user which pipeline to work on.
