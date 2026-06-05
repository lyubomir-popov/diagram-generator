# Stakeholder guide — making a diagram (2026-06-04, spec 012 complete)

Use this page when you need an **on-brand architecture or workflow diagram** without reading the full engineering backlog.

## What works today

| Capability | Status |
|------------|--------|
| Author diagrams as **Frame YAML** | Ready — source of truth on disk |
| **Interactive preview** (edit, resize, save) | Ready — TypeScript layout + HarfBuzz text in the browser |
| **Export SVG** (batch / CI) | Ready — `export-frame-svg.mjs` (TS); icons, arrow heads, overlays; golden-regression locked for a small canonical corpus |
| draw.io export | Separate scripts; not the primary path for new work |

## Fastest path — new diagram

1. **Copy a nearby example** from `scripts/diagrams/frames/` (e.g. `example-deployment-pipeline.yaml` or `support-engineering-flow.yaml`).
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
| `example-deployment-pipeline` | Workflow / process steps |
| `example-platform-architecture` | Nested panels and multi-column layout |
| `request-to-hardware-stack` | Headed panels + arrow chain |
| `test-box-styles` | Compact “hello world” for style variants |

Index: `http://127.0.0.1:8100/` lists all frame YAML diagrams.

## Where engineering detail lives

| Audience | Document |
|----------|----------|
| PM / milestone tracking | Jira [DE-941](https://warthogs.atlassian.net/browse/DE-941), Coda (sibling `diagram-generator-planning` repo) |
| Current repo state | [`STATUS.md`](../STATUS.md) |
| Active tasks | [`TODO.md`](../TODO.md) — spec 005 autolayout hardening, spec 018 PNG export |
| Visual language | [`DIAGRAM.md`](../DIAGRAM.md) |

## Architecture (one paragraph)

Diagrams are **YAML on disk**. The **TypeScript** layout engine (`packages/layout-engine/`) measures and places frames (Figma-like autolayout). The preview editor runs layout in the browser; the server serves YAML APIs and emits SVG via Node (no Python SVG renderer). Python remains for **YAML save helpers** and layout parity tests — not for interactive editing or SVG export.
