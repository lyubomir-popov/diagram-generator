# Spec 018 – PNG export

**Branch**: `feat/018-png-export`  
**Created**: 2026-06-04  
**Status**: Draft  
**Re-scoped**: 2026-06-07 for spec 038 alignment  
**Input**: Stakeholder need to drop diagrams into decks and docs without Illustrator; complement existing **Save SVG** and batch `export-frame-svg.mjs`.

## Problem

The repo can already produce **on-brand SVG** from frame YAML through the TypeScript engine, and authors can already **Save SVG** from the preview UI. There is still **no first-class PNG path** aligned with the TypeScript-only pivot:

- no one-click **Save PNG** in the preview shell
- no slug-based PNG batch export from YAML → TS SVG → PNG
- no clear Node-side raster pipeline that future sessions can follow without reaching for Python

Older notes referenced `scripts/export_png.py` and `preview_server.py` as the PNG path. That is now explicitly the wrong direction. Under spec 038, the front door becomes Node and PNG export must sit on top of the same TS authority path as SVG: **YAML → TS layout/render → SVG authority → raster adapter**.

Stakeholders still routinely need **PNG** for PowerPoint, Confluence, Jira, and comparison pages under `diagrams/3.compare/`.

## Goals

1. **Preview**: one-click **Save PNG** beside **Save SVG**, same slug-based filename convention (`<slug>-onbrand-v3@2x.png`).
2. **Batch**: export PNG for a slug or the v3 corpus from YAML → TS SVG → PNG without hand-copying paths.
3. **Fidelity**: PNG must match TS SVG output (fonts, icons, orange arrows) by rasterizing the same authoritative SVG bytes the Node preview app or batch exporter would emit, not a lossy DOM screenshot.
4. **Pivot alignment**: the spec must not reintroduce Python into the product path. PNG export is a **Node / TypeScript adapter**, not a special-case escape hatch.

## User scenarios

### US1 – Save PNG from preview (P1)

**Given** a loaded v3 diagram in the preview editor, **When** the author clicks **Save PNG**, **Then** the browser downloads a PNG raster of the current diagram at a documented scale (default **2×** for slide clarity).

**Given** unsaved inspector overrides, **When** Save PNG is used, **Then** either:

- the UI warns that PNG reflects the last saved YAML on disk, or
- the export endpoint accepts the same override payload as the live stage and emits PNG from the in-memory TS state.

The first version may ship with the saved-YAML warning if it avoids complexity; the second is a later refinement.

### US2 – Slug-based batch CLI (P1)

**Given** a frame slug `request-to-hardware-stack`, **When**:

```bash
node apps/preview/scripts/export-png.mjs --slug request-to-hardware-stack --scale 2
```

**Then** the tool runs the authoritative TS SVG export (or reuses an existing `*-onbrand-v3.svg`), rasterizes it, and writes:

`diagrams/2.output/v3/png/<slug>-onbrand-v3@2x.png`

### US3 – Corpus / CI batch (P2)

**Given** the v3 frame corpus under `scripts/diagrams/frames/`, **When** `export-png.mjs --all-v3` runs, **Then** every slug with a successful TS SVG export gets matching `@1x` / `@2x` PNGs under `diagrams/2.output/v3/png/`.

### US4 – HTTP download from the Node preview app (P2)

**Given** the Node preview app is running, **When** `GET /v3/png/<slug>-onbrand-v3.png?scale=2` is requested, **Then** the server returns `image/png` bytes (cacheable by slug + YAML mtime + scale) using the same authoritative TS SVG bytes as the batch path.

## Non-goals

- PDF export
- Transparent PNG background (default **white** `#fff`)
- Replacing comparison-page manually refined rasters in `diagrams/2.output/draw.io/manually-edited/raster/`
- PNG export for force-layout preview mode
- Embedded PNG inside SVG
- A separate canvas-rendered PNG pipeline
- Any Python wrapper, helper, or bridge for raster export

## Requirements

| ID | Requirement |
|----|-------------|
| FR-001 | PNG output MUST use TS-rendered SVG as the single visual source of truth. |
| FR-002 | PNG export MUST live on the Node / TypeScript product path and MUST NOT require a Python CLI or Python preview server. |
| FR-003 | Default scale factors: **1** and **2**; allow `--scale` comma list (1–4). |
| FR-004 | Filename pattern: `<slug>-onbrand-v3@{n}x.png` under `diagrams/2.output/v3/png/`. |
| FR-005 | Preview UI adds **Save PNG** next to **Save SVG**. |
| FR-006 | Raster failures MUST surface clearly (missing browser/runtime dependency, missing SVG authority bytes, timeout) — no silent empty files. |
| FR-007 | PNG export MUST respect `DIAGRAM.md` output constraints indirectly by rasterizing compliant TS SVG only. |
| FR-008 | The same route/CLI contract must work after spec 038 replaces the Python preview server with the Node preview app. |

## Technical direction

The PNG path is an **adapter** over the SVG authority path:

```text
frame YAML
  -> TS compile / layout / SVG export
  -> authoritative SVG bytes
  -> raster adapter
  -> PNG bytes / file
```

The raster adapter may use:

- Playwright / headless Chromium, or
- a Node-native SVG raster library such as `sharp` / `resvg-js`,

provided the resulting fidelity matches the authoritative TS SVG closely enough for stakeholder use. The spec does **not** require a browser if a Node-native rasterizer proves adequate.

## Success criteria

- Stakeholder guide lists **Export PNG** as Ready with Node-based commands.
- `request-to-hardware-stack` → `@2x.png` matches visual review of live preview at the same scale (±1px tolerance from rasterization).
- Node-side tests cover slug resolution, path conventions, and raster failure messaging.
- Preview **Save PNG** downloads a file without console errors when the Node preview app and raster dependency are available.
- The spec package contains no Python product-path instructions or references that would contradict spec 038.

## Dependencies

- Spec **012** TS SVG export (`export-frame-svg.mjs`, preview TS-only SVG)
- Spec **014** export hardening patterns for bounded/cached work
- Spec **038** Node preview front door and Python removal

## References

- `packages/layout-engine/scripts/export-frame-svg.mjs` — authoritative SVG export path
- `scripts/preview/editor.js` / successor preview shell save patterns
- `docs/stakeholder-guide.md` — update on completion
- `diagrams/0.reference/sample.png` — canonical raster reference for starter block
