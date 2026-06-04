# Diagram Generator

A constrained interactive diagram editor that turns rough sketches and brand/layout rules into on-brand SVG and draw.io diagrams.

**Need a diagram for a stakeholder review?** Start with [`docs/stakeholder-guide.md`](docs/stakeholder-guide.md) and [`STATUS.md`](STATUS.md) (updated 2026-06-04).

## Bigger picture

This repo is part of a multi-repo workspace converging on `design-foundry` — a Houdini-in-spirit kernel for procedural graphic design. The TS autolayout engine in `packages/layout-engine/` is the single autolayout codebase in the workspace and will eventually port into design-foundry as `@design-foundry/operator-autolayout`. See `../design-foundry/PIVOT.md` for the full cross-repo plan.

**TypeScript is the implementation language.** Layout, measure, and SVG export run in `packages/layout-engine/`. Python is narrowing to YAML save helpers and legacy batch renderers (spec 012 retires `diagram_render_svg.py`).

## Start Here

The repo uses a single render engine: **v3 autolayout** – a Figma-like nested frame engine with per-axis sizing, 9-point alignment, and native Frame YAML definitions.

Fastest way to see the project working:

```bash
python scripts/preview_server.py
# open http://127.0.0.1:8100/view/v3:support-engineering-flow
```

### Cold-start path for layout work

If you are changing the autolayout engine, read these in order before editing code:

1. [`DIAGRAM.md`](DIAGRAM.md) – the canonical diagram-language contract (tokens, rules, output constraints).
2. [`TODO.md`](TODO.md) – the active execution queue with milestone status and open work.
3. [`STATUS.md`](STATUS.md) – cold-start orientation, architecture, key files.
4. [`.github/copilot-instructions.md`](.github/copilot-instructions.md) – workflow discipline and anti-patch protocol.

Key files: `packages/layout-engine/src/layout.ts` (measure→place), `packages/layout-engine/src/svg-render.ts` + `export-frame-svg.mjs` (batch SVG), `scripts/preview/layout-bridge.js` (interactive relayout), `scripts/preview_server.py` (preview + TS SVG pool), `scripts/diagrams/frames/*.yaml` (authored diagrams). See `docs/stakeholder-guide.md` for the edit→preview→export loop.

### Recommended exemplar path

Start the preview server and open:

1. `http://127.0.0.1:8100/view/v3:support-engineering-flow` – the primary demo with nested autolayout
2. `http://127.0.0.1:8100/view/v3:android-custom-to-cloud` – three-tier hierarchy (section/panel/leaf)
3. `http://127.0.0.1:8100/view/v3:android-container-vs-vm` – container/VM comparison with vertical nesting

### Agent prompt: demo the project

Paste this into an agent on a fresh clone:

```text
Open this repo and demo the current v3 workflow end-to-end.

1. Work from the repo root.
2. The only live render surface is v3 autolayout with Frame YAML in `scripts/diagrams/frames/`.
3. Start the interactive preview server:
    - python scripts/preview_server.py
4. Open these demo surfaces (prefer VS Code webview or Simple Browser; otherwise default browser):
    - http://127.0.0.1:8100/view/v3:support-engineering-flow
    - http://127.0.0.1:8100/view/v3:android-custom-to-cloud
    - http://127.0.0.1:8100/view/v3:android-container-vs-vm
5. Tell me when the interactive preview is visible.
```

Detailed single-surface prompts are in the interactive demo section below.

## Quick start for new users

### UI development rule

All editor and preview UI must use [Baseline Foundry](../baseline-foundry/) components and styles. Do not create local CSS styles unless Baseline Foundry lacks the needed primitive. The agent should familiarise itself with the BF component library before building new UI.

```bash
git clone <repo-url> && cd diagram-generator
python -m venv .venv
.venv/Scripts/activate  # Windows
# source .venv/bin/activate  # macOS/Linux

python scripts/preview_server.py
# open http://127.0.0.1:8100/view/v3:support-engineering-flow
```

### Creating your own diagram

**Native Frame YAML (preferred):** Drop a `.yaml` file in `scripts/diagrams/frames/` and it is auto-discovered by the preview server. No registration needed.

```yaml
engine: v3
title: My diagram
arrows:
  - source: step1.bottom
    target: step2.top
root:
  id: page
  direction: vertical
  padding: 24
  border: none
  children:
    - id: step1
      label: [First step]
      icon: Document.svg
    - id: step2
      label: [Second step]
      icon: Package.svg
```

Start the preview server with `python scripts/preview_server.py` and open `http://127.0.0.1:8100/view/v3:my-diagram`. See `scripts/diagrams/frames/test-vertical-stack.yaml` for a minimal working example and `scripts/diagrams/frames/support-engineering-flow.yaml` for a fuller authored surface.

### Example diagrams (tracked)

Tracked examples ship with the repo for reference:

| Example | What it demonstrates |
|---------|---------------------|
| [`test-vertical-stack.yaml`](scripts/diagrams/frames/test-vertical-stack.yaml) | Minimal working v3 frame definition |
| [`example-deployment-pipeline.yaml`](scripts/diagrams/frames/example-deployment-pipeline.yaml) | Simple vertical flow with arrows |
| [`example-platform-architecture.yaml`](scripts/diagrams/frames/example-platform-architecture.yaml) | Nested panels and multi-column layout |
| [`example-stacked-blocks.yaml`](scripts/diagrams/frames/example-stacked-blocks.yaml) | Fill distribution and stacked-layout behaviour |
| [`complex-testcase.yaml`](scripts/diagrams/frames/complex-testcase.yaml) | Structured testcase with overlays |
| [`support-engineering-flow.yaml`](scripts/diagrams/frames/support-engineering-flow.yaml) | Primary end-to-end demo surface |

### Interactive autolayout demo

The interactive autolayout demo is the hot-reload preview server. It is the live editor surface for local relayout, spacing controls, align/distribute actions, and save-back into Frame YAML.

The preview server serves the repo-owned vendored BF `os` tier stylesheet and Ubuntu Sans snapshot under `assets/baseline-foundry/`, so fresh clones get the same preview shell without depending on a sibling checkout at runtime. Refresh that vendored snapshot with `python scripts/sync_baseline_foundry_assets.py` when you want to roll a newer Foundry release into this repo from a sibling checkout.

```bash
python scripts/preview_server.py
```

Then open one of these URLs in your browser:

- `http://127.0.0.1:8100/` for the diagram index
- `http://127.0.0.1:8100/view/v3:support-engineering-flow` for the primary nested-frame demo
- `http://127.0.0.1:8100/view/v3:diagram-intake-workflow` for the workflow explainer
- `http://127.0.0.1:8100/view/v3:request-to-hardware-stack` for a dense vertical-stack example

Suggested demo flow:

1. Start `python scripts/preview_server.py`
2. Open `http://127.0.0.1:8100/view/v3:support-engineering-flow`
3. Resize a parent panel or change gutter controls to watch autolayout recompute child placement
4. Multi-select a few boxes to try distribute/align actions in the inspector
5. For layout work, take a Playwright screenshot and check panel widths, gutter equality, wrapper styling, arrow routing, and label placement before considering the result valid

Features: component tree sidebar, click-to-select inspector, drag-and-resize with 8px snap, parent/child autolayout relayout, grid overlay controls, undo/redo, and save-back to YAML. Saved edits are drafting aids; the authored source of truth remains the frame YAML.

#### Agent prompt: open the interactive autolayout demo

Paste this into an agent if you want it to launch the live demo end-to-end instead of just describing the steps:

```text
Open this repo and launch the interactive autolayout demo for `diagram-intake-workflow`.

Work from the repo root. Do not stop at instructions; actually run the setup and open the demo.

1. Start the preview server in an integrated terminal with:
    python scripts/preview_server.py
2. Keep that terminal running.
3. Prefer opening the demo in a VS Code webview or Simple Browser if your environment supports it. Otherwise open it in the default browser at:
    http://127.0.0.1:8100/view/v3:diagram-intake-workflow
4. If you need a Windows command to open the browser yourself, use:
    Start-Process "http://127.0.0.1:8100/view/v3:diagram-intake-workflow"
5. Wait until the page is visibly loaded, then tell me the interactive demo is ready.
6. If the first attempt fails because the port is busy or the server needs a restart, recover and retry rather than stopping early.
```

### Available icons

~150 SVG icons from the Canonical/Ubuntu icon set are available in [`assets/icons/`](assets/icons). Use the filename (for example `"Server.svg"`) in a frame's `icon` field.

### Design rules at a glance

- **Fills**: white (default), `#F3F3F3` grey (accent), black (one emphasis box max)
- **Orange** `#E95420`: arrows and arrowheads only – never boxes
- **Icons**: from `assets/icons/` only – omit rather than invent
- **Text**: top-left aligned, 8px inset, 18px/24px body
- **Grid**: 8px baseline, 24px gutters, 192px default box width

Full spec: [`DIAGRAM.md`](DIAGRAM.md)

## Quick start: file convention

Agent instructions live under `.github`, not the repo root:

- **`.github/copilot-instructions.md`** – the single repo-wide instruction file
- **`.github/agents/agent.md`** – optional repo-specific resume prompt
- **`.github/skills/`** – optional on-demand workflow skills for repeatable procedures

Everything else lives at the repo root as operational workflow files:

```
README.md        – human-readable overview
DIAGRAM.md       – canonical diagram language spec
TODO.md          – active execution queue
INBOX.md         – async user notes (agent drains these)
AGENT-INBOX.md   – agent-only handoffs and diagnostics
STATUS.md        – cold-start orientation
HISTORY.md       – completed work archive
docs/specs.md    – source docs, reference assets, sibling repos
```

The rule: every important piece of project state lives in exactly one place.

## What this repo does

This repo rebuilds rough, hand-drawn, or inconsistent diagrams into a strict reusable design system with:

- native Frame YAML authored state in `scripts/diagrams/frames/`
- TypeScript local relayout via `packages/layout-engine/`
- editable SVG outputs
- editable draw.io XML outputs
- consistent typography, spacing, icon placement, and arrow geometry
- cold-start-safe workflow files so a new chat can continue without re-deriving the system

## Workflow

### Before generating any diagram

**Read the playbook first.** The diagram style rules are non-negotiable:

1. Read [`DIAGRAM.md`](DIAGRAM.md)
2. Review the anti-patch protocol in [`.github/copilot-instructions.md`](.github/copilot-instructions.md)

Key rules you must not violate:

- Colors: white, `#F3F3F3` grey, or one black emphasis box only – **no other fills**
- Orange `#E95420` is **reserved for arrows only** – never use it for boxes
- Icons come from [`assets/icons/`](assets/icons) only – do not invent or source new ones
- Text is always top-left aligned with `8px` insets

### After adding new diagrams

Validate the live v3 surface:

1. Add a new `.yaml` file under [`scripts/diagrams/frames/`](scripts/diagrams/frames/)
2. Start `python scripts/preview_server.py`
3. Open `http://127.0.0.1:8100/view/v3:<slug>` and browser-check the result
4. If you changed layout or render behaviour, run `python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q`

### Input/output structure

**Note:** This repo keeps the input, output, reference, and working draw.io lanes in git so the workflow stays reproducible. Only generic local development artifacts such as `__pycache__/`, `*.pyc`, workspace files, and `_tail.txt` stay ignored.

Input:

- rough sketches or screenshot references in [`diagrams/1.input/`](diagrams/1.input)
- authored Frame YAML in [`scripts/diagrams/frames/`](scripts/diagrams/frames/)
- brand and layout invariants documented in [`DIAGRAM.md`](DIAGRAM.md), [`STATUS.md`](STATUS.md), and [`docs/specs.md`](docs/specs.md)
- local icons from [`assets/icons/`](assets/icons)

Output:

- primary editable draw.io exports in [`diagrams/2.output/draw.io/`](diagrams/2.output/draw.io)
- sibling SVG outputs in [`diagrams/2.output/svg/`](diagrams/2.output/svg)

## Canonical references

- Starter block: [`sample.svg`](diagrams/0.reference/sample.svg)
- Larger visual preview: [`sample.png`](diagrams/0.reference/sample.png)
- Reusable SVG starter: [`onbrand-svg-starter.svg`](diagrams/0.reference/onbrand-svg-starter.svg)
- Frame-class contract: [`docs/frame-classes.md`](docs/frame-classes.md)
- Primary live demo surface: [`support-engineering-flow.yaml`](scripts/diagrams/frames/support-engineering-flow.yaml)
- Minimal v3 starter example: [`test-vertical-stack.yaml`](scripts/diagrams/frames/test-vertical-stack.yaml)
- Shared primitives module: [`diagram_shared.py`](scripts/diagram_shared.py)

## Draw.io export rules

- Text-bearing boxes, panels, and notation widgets must export as native editable `mxCell` geometry
- Icons may use embedded `data:` image cells
- Truly special non-text shapes may use image-backed cells when needed
- Direct connectors must use real `source` / `target` references plus explicit `entry` / `exit` anchors
- Exports should force light rendering with `adaptiveColors="none"` and explicit colors

## Token-driven draw.io style sync

`scripts/drawio_style_sync.py` now understands named canonical presets derived from the shared renderer tokens, so you can target generator-tagged cells by token and reapply the current draw.io defaults without hand-writing raw `KEY=VALUE` lists.

Useful commands:

```bash
python scripts/drawio_style_sync.py --list-presets
python scripts/drawio_style_sync.py --token label-box --preset label-box
python scripts/drawio_style_sync.py diagrams/2.output/draw.io/request-to-hardware-stack-onbrand.drawio --token edge-orange --preset edge-orange --write
```

Combine `--token`, `--role`, `--preset`, `--set`, and `--unset` as needed. Presets give you the canonical baseline; explicit `--set` or `--unset` flags can still override individual draw.io fields for one-off migrations.

The protected manual-edit lane is infrastructure-ready, but not always populated. `scripts/drawio_review_workflow.py` can create `diagrams/2.output/draw.io/manually-edited/`, `review/`, and `checkpoints/` on demand; in a fresh tree those directories may be absent until someone actually prepares or promotes a review copy.

## Workflow map

| File | Purpose |
|------|---------|
| `.github/copilot-instructions.md` | Agent rules, workflow conventions, diagram invariants |
| `.github/agents/agent.md` | Repo-specific resume-agent prompt |
| `.github/skills/` | Optional on-demand workflow skills |
| `README.md` | Human-readable overview and workflow reminder |
| `DIAGRAM.md` | Canonical diagram language spec |
| `TODO.md` | Active execution queue |
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
4. Read `README.md`, `STATUS.md`, and `DIAGRAM.md` when returning after time away.

### If you are the agent

1. Start with `STATUS.md`.
2. Read `DIAGRAM.md` before changing diagram behavior.
3. Drain `INBOX.md` into `TODO.md`.
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
