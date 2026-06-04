# Stakeholder guide — making a diagram (2026-06-04)

Use this page when you need an **on-brand architecture or workflow diagram** without reading the full engineering backlog.

## What works today

| Capability | Status |
|------------|--------|
| Author diagrams as **Frame YAML** | Ready — source of truth on disk |
| **Interactive preview** (edit, resize, save) | Ready — TypeScript layout + HarfBuzz text in the browser |
| **Export SVG** (batch / CI) | Ready — `export-frame-svg.mjs` (TS); icons embedded from `assets/icons/` |
| draw.io export | Separate scripts; not the primary path for new work |

**Engineering in progress (spec 012):** batch/preview SVG still differ slightly on **arrow heads, overlays, and some legacy primitives** until `svg-render.ts` reaches full parity with the interactive preview. For stakeholder demos, prefer the **preview server** or accept simple elbow arrows in batch SVG.

## Fastest path — new diagram

1. **Copy a nearby example** from `scripts/diagrams/frames/` (e.g. `test-vertical-stack.yaml` or `example-deployment-pipeline.yaml`).
2. Save as `scripts/diagrams/frames/<your-slug>.yaml` with `engine: v3` and a `root:` frame tree.
3. Start preview:

   ```bash
   python scripts/preview_server.py
   ```

   Open: `http://127.0.0.1:8100/view/v3:<your-slug>`

4. Edit in the UI (inspector, drag-resize, grid). **Save** writes back to the YAML file.
5. **Export SVG** (optional, for slides or Illustrator):

   ```bash
   npm --prefix packages/layout-engine run build
   node packages/layout-engine/scripts/export-frame-svg.mjs --slug <your-slug> --out ./tmp/<your-slug>.svg
   ```

## Design rules (summary)

Full contract: [`DIAGRAM.md`](../DIAGRAM.md). Short version:

- White / light grey fills; **one** black emphasis box per diagram if needed.
- **Orange** (`#E95420`) for arrows only — not box fills.
- Icons: pick from [`assets/icons/`](../assets/icons/) by filename (e.g. `Server.svg`).
- 8px grid, 24px gutters, default box width 192px unless HUG content dictates otherwise.

## Good demo diagrams

| Slug | Use when showing… |
|------|-------------------|
| `support-engineering-flow` | Nested panels, mixed sizing, primary product demo |
| `diagram-intake-workflow` | Workflow / process steps |
| `android-custom-to-cloud` | Three-tier hierarchy |
| `maas-machine-lifecycle` | Icons + multi-column layout |
| `test-vertical-stack` | Minimal “hello world” |

Index: `http://127.0.0.1:8100/` lists all frame YAML diagrams.

## Where engineering detail lives

| Audience | Document |
|----------|----------|
| PM / milestone tracking | Jira [DE-941](https://warthogs.atlassian.net/browse/DE-941), Coda (sibling `diagram-generator-planning` repo) |
| Current repo state | [`STATUS.md`](../STATUS.md) |
| Active tasks | [`TODO.md`](../TODO.md), `specs/012-ts-svg-renderer-retire-python/` |
| Visual language | [`DIAGRAM.md`](../DIAGRAM.md) |

## Architecture (one paragraph)

Diagrams are **YAML on disk**. The **TypeScript** layout engine (`packages/layout-engine/`) measures and places frames (Figma-like autolayout). The preview editor runs layout in the browser; the server serves YAML APIs and can emit SVG via Node. Python remains for **YAML save helpers** and legacy batch paths being retired under spec 012 — not for interactive editing.
