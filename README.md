# Diagram Generator

An LLM-based diagramming workflow that turns rough sketches and brand/layout rules into on-brand SVG and draw.io diagrams.

## Start Here

If you are new to the repo and using an agent, make the pipeline choice explicit before doing anything else:

- **Pipeline 2**: declarative + autolayout. This is the cutting-edge path for new work and the interactive editor, but it is still slightly unstable.
- **Pipeline 1**: imperative stable implementation. This is the safer path when you want the established canonical batch.

Fastest way to see the project working:

- Interactive polish pass: run `python scripts/preview_server.py --slug diagram-intake-workflow --grid`, then open `http://127.0.0.1:8100/view/diagram-intake-workflow`
- Static comparison with inputs: open [`diagrams/3.compare/html/diagram-intake-workflow.html`](diagrams/3.compare/html/diagram-intake-workflow.html)

### Agent prompt: demo the project

Paste this into an agent on a fresh clone:

```text
Open this repo and demo the current workflow end-to-end.

1. Work from the repo root.
2. Explain the pipeline choice briefly, then proceed with Pipeline 2 unless I explicitly ask for Pipeline 1:
    - Pipeline 2 = declarative + autolayout, cutting edge, slightly unstable.
    - Pipeline 1 = stable initial implementation.
3. Refresh the live demo assets if needed:
    - python scripts/build_v2.py
    - python scripts/build_compare_pages.py
4. Start the interactive preview server for `diagram-intake-workflow` with the grid overlay:
    - python scripts/preview_server.py --slug diagram-intake-workflow --grid
5. Open both demo surfaces, preferring a VS Code webview or Simple Browser if your environment supports it; otherwise open them in the default browser:
    - http://127.0.0.1:8100/view/diagram-intake-workflow
    - diagrams/3.compare/html/diagram-intake-workflow.html
6. Tell me when both the interactive preview and the static compare page are visible.
```

Detailed single-surface prompts are in the interactive demo section below.

## Quick start for new users

```bash
# 1. Clone and set up
git clone <repo-url> && cd diagram-generator
python -m venv .venv
.venv/Scripts/activate  # Windows
# source .venv/bin/activate  # macOS/Linux

# 2. Build the stable shareable batch (SVG + draw.io)
python scripts/build_outputs.py --no-visual

# 3. Build the declarative v2 batch
python scripts/build_v2.py

# 4. View outputs
# SVGs land in diagrams/2.output/svg/
# draw.io files land in diagrams/2.output/draw.io/
```

If you only want the currently active declarative pipeline, you can skip the stable build and run `python scripts/build_v2.py` from the repo root.

### Creating your own diagram

Create a new file in `scripts/diagrams/`, for example `scripts/diagrams/my_diagram.py`:

```python
from diagram_model import Arrow, Box, Diagram, Fill, Line

my_diagram = Diagram(
    title="My diagram",
    arrangement=Diagram.Arrangement.GRID,
    cols=1, col_width=192, row_height=64,
    col_gap=24, row_gap=24, outer_margin=24,
    components=[
        Box(id="step1", label=[Line("First step")],
            icon="Document.svg", col=0, row=0),
        Box(id="step2", label=[Line("Second step")],
            fill=Fill.GREY, icon="Package.svg", col=0, row=1),
        Arrow(source="step1.bottom", target="step2.top"),
    ],
)
```

Then register it in `scripts/build_v2.py` by adding a tuple to `_REGISTRY` and rebuild. See [`scripts/diagrams/example_deployment_pipeline.py`](scripts/diagrams/example_deployment_pipeline.py) for a complete starter example.

### Example diagrams (tracked)

Three generic examples ship with the repo for reference:

| Example | What it demonstrates |
|---------|---------------------|
| [`example_deployment_pipeline.py`](scripts/diagrams/example_deployment_pipeline.py) | Simple vertical flow: boxes + arrows |
| [`example_platform_architecture.py`](scripts/diagrams/example_platform_architecture.py) | Grid with nested panels, multi-column span |
| [`example_data_processing.py`](scripts/diagrams/example_data_processing.py) | Panels with allocation bars, separators, annotations |

### Interactive autolayout demo

The interactive autolayout demo is the hot-reload preview server. It is still an active editor surface rather than a polished end-user app, but it is the current way to exercise live relayout, gutter controls, distribute/align, and override persistence.

```bash
python scripts/preview_server.py              # all diagrams, port 8100
python scripts/preview_server.py --slug memory-wall --grid  # single diagram with grid overlay
```

Then open one of these URLs in your browser:

- `http://127.0.0.1:8100/` for the diagram index
- `http://127.0.0.1:8100/view/memory-wall` for a direct single-diagram demo

Suggested demo flow:

1. Start `python scripts/preview_server.py --slug memory-wall --grid`
2. Open `http://127.0.0.1:8100/view/memory-wall`
3. Resize a parent panel or change gutter controls to watch autolayout recompute child placement
4. Multi-select a few boxes to try distribute/align actions in the inspector

Features: component tree sidebar, click-to-select inspector, drag-and-resize with 8px snap, parent/child autolayout relayout, waypoint editing, grid overlay controls, undo/redo snapshots, and override persistence to JSON. Overrides are a drafting aid – the agent reads them and applies fixes to the Python definition.

#### Agent prompt: open the interactive autolayout demo

Paste this into an agent if you want it to launch the live demo end-to-end instead of just describing the steps:

```text
Open this repo and launch the interactive autolayout demo for `diagram-intake-workflow`.

Work from the repo root. Do not stop at instructions; actually run the setup and open the demo.

1. Start the preview server in an integrated terminal with:
    python scripts/preview_server.py --slug diagram-intake-workflow --grid
2. Keep that terminal running.
3. Prefer opening the demo in a VS Code webview or Simple Browser if your environment supports it. Otherwise open it in the default browser at:
    http://127.0.0.1:8100/view/diagram-intake-workflow
4. If you need a Windows command to open the browser yourself, use:
    Start-Process "http://127.0.0.1:8100/view/diagram-intake-workflow"
5. Wait until the page is visibly loaded, then tell me the interactive demo is ready.
6. If the first attempt fails because the port is busy or the server needs a restart, recover and retry rather than stopping early.
```

#### Agent prompt: open the static compare demo

This is the fastest static review surface: the compare HTML shows the input, the agent-generated output, and the manual-refinement slot side by side.

```text
Open this repo and launch the static compare demo for `diagram-intake-workflow`.

Work from the repo root. Do not stop at instructions; actually refresh the compare page and open it.

1. Refresh the compare pages with:
    python scripts/build_compare_pages.py
2. Prefer opening the compare page in a VS Code webview or Simple Browser if your environment supports it. Otherwise open this file in the default browser:
    diagrams/3.compare/html/diagram-intake-workflow.html
3. On Windows, if you need an explicit open command, use:
    Start-Process (Resolve-Path "diagrams/3.compare/html/diagram-intake-workflow.html")
4. Tell me when the static compare page is visible.
5. If the compare page looks stale, rebuild the declarative outputs first with `python scripts/build_v2.py`, then rerun `python scripts/build_compare_pages.py`.
```

### Available icons

~150 SVG icons from the Canonical/Ubuntu icon set are available in [`assets/icons/`](assets/icons). Use the filename (e.g. `"Server.svg"`) in the `icon` field of any `Box` or `Panel`.

### Design rules at a glance

- **Fills**: white (default), `#F3F3F3` grey (accent), black (one emphasis box max)
- **Orange** `#E95420`: arrows and arrowheads only – never boxes
- **Icons**: from `assets/icons/` only – omit rather than invent
- **Text**: top-left aligned, 8px inset, 18px/24px body
- **Grid**: 8px baseline, 24px gutters, 192px default box width

Full spec: [`DIAGRAM.md`](DIAGRAM.md)

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

**Note:** This repo is currently set up for private internal sharing, so the input, output, compare, reference, and working draw.io diagram lanes are included in git. Only generic local development artifacts such as `__pycache__/`, `*.pyc`, workspace files, and `_tail.txt` stay ignored.

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
- Canonical exemplar: [`memory-wall-onbrand.svg`](diagrams/2.output/svg/memory-wall-onbrand.svg) (generated locally)
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
| **Maturity** | Experimental but much closer to parity. All 9 diagrams are converted, and the currently audited batch is green; the open work is PM-shareable authoring, command-pattern undo, and further workflow hardening rather than basic rendering gaps. |

### 3-way visual comparison

Use `python scripts/_compare_3way.py` to generate Playwright screenshots comparing input sketch → v1 → v2 for each diagram. Output lands in `diagrams/3.compare/visual-diff/`. This is the primary tool for identifying v2 regressions.

### Which pipeline to use

- For production outputs, use Pipeline 1.
- For development of the declarative system, use Pipeline 2 and always validate against the v1 output and input sketch using the 3-way comparison tool.
- On a cold start, the agent should ask the user which pipeline to work on.
