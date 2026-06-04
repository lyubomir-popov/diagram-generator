# Spec 018 – PNG export

**Branch**: `feat/018-png-export`  
**Created**: 2026-06-04  
**Status**: Draft  
**Input**: Stakeholder need to drop diagrams into decks and docs without Illustrator; complement existing **Save SVG** and batch `export-frame-svg.mjs`.

## Problem

The repo can produce **on-brand SVG** from v3 frame YAML (TS layout + HarfBuzz + `svg-render.ts`), and authors can **Save SVG** from the preview UI. There is **no first-class PNG path** aligned with v3 naming, preview workflow, or corpus batch jobs.

A legacy script `scripts/export_png.py` rasterizes SVG via **Playwright (Chromium)** but:

- Defaults to `diagrams/2.output/svg/` (v2-era paths), not `diagrams/2.output/v3/svg/`
- Is not wired to preview **Save PNG**, slug-based batch, or `export-frame-svg.mjs`
- Requires a separate manual step after SVG export

Stakeholders routinely need **PNG** (PowerPoint, Confluence, Jira, comparison pages under `diagrams/3.compare/`).

## Goals

1. **Preview**: one-click **Save PNG** beside **Save SVG**, same slug-based filename convention (`<slug>-onbrand-v3.png`).
2. **Batch**: export PNG for a slug or the v3 corpus from YAML → TS SVG → PNG without hand-copying paths.
3. **Fidelity**: PNG must match TS SVG output (fonts, icons, orange arrows) — rasterize the same SVG the server would serve at `/v3/svg/<slug>-onbrand-v3.svg`, not a lossy client-side canvas grab of the live DOM.

## User scenarios

### US1 – Save PNG from preview (P1)

**Given** a loaded v3 diagram in the preview editor, **When** the author clicks **Save PNG**, **Then** the browser downloads a PNG raster of the current diagram at a documented scale (default **2×** for slide clarity).

**Given** unsaved inspector overrides, **When** Save PNG is used, **Then** either (a) the UI warns that PNG reflects **saved YAML on disk** until Save is clicked, or (b) PNG is generated from the same TS relayout payload as the live stage (preferred if feasible without new subprocess storms).

### US2 – Slug-based batch CLI (P1)

**Given** a frame slug `android-custom-to-cloud`, **When**:

```bash
python scripts/export_png.py --slug android-custom-to-cloud --scale 2
```

**Then** the tool runs TS SVG export (or reuses an existing `*-onbrand-v3.svg`), rasterizes via Playwright, and writes:

`diagrams/2.output/v3/png/<slug>-onbrand-v3@2x.png`

### US3 – Corpus / CI batch (P2)

**Given** the v3 frame corpus under `scripts/diagrams/frames/`, **When** `export_png.py --all-v3` (or documented Makefile target) runs, **Then** every slug with a successful TS SVG export gets matching `@1x` / `@2x` PNGs under `diagrams/2.output/v3/png/`.

### US4 – Optional HTTP download (P3)

**Given** preview server running, **When** `GET /v3/png/<slug>-onbrand-v3.png?scale=2` is requested, **Then** the server returns `image/png` bytes (cached by slug + YAML mtime + scale, same spirit as spec 014 SVG pool).

## Non-goals

- PDF export
- Transparent PNG background (default **white** `#fff`, matching `export_png.py` today)
- Replacing comparison-page manually refined rasters in `diagrams/2.output/draw.io/manually-edited/raster/`
- PNG export for force-layout preview mode
- Embedded PNG inside SVG

## Requirements

| ID | Requirement |
|----|-------------|
| FR-001 | PNG output MUST use TS-rendered SVG as the single visual source of truth. |
| FR-002 | Default scale factors: **1** and **2**; allow `--scale` comma list (1–4), matching existing `export_png.py`. |
| FR-003 | Filename pattern: `<slug>-onbrand-v3@{n}x.png` under `diagrams/2.output/v3/png/`. |
| FR-004 | Preview UI adds **Save PNG** control next to **Save SVG** in `viewer-unified.html` / `viewer.html`. |
| FR-005 | Playwright is an optional dev/CI dependency; document install (`playwright install chromium`) in plan quickstart. |
| FR-006 | Failures MUST surface clearly (missing Playwright, TS export 404, timeout) — no silent empty files. |
| FR-007 | PNG export MUST respect `DIAGRAM.md` output constraints indirectly by rasterizing compliant SVG only. |

## Success criteria

- Stakeholder guide lists **Export PNG** as Ready with copy-paste commands.
- `android-custom-to-cloud` → `@2x.png` matches visual review of live preview at same scale (±1px tolerance from rasterization).
- `python -m pytest scripts/test_export_png.py -q` (new) covers slug resolution and path conventions; Playwright tests marked optional/skipped in CI without browser.
- Preview Save PNG downloads a file without console errors when Playwright + TS export are available.

## Dependencies

- Spec **012** TS SVG export (`export-frame-svg.mjs`, preview TS-only SVG).
- Spec **014** patterns for bounded/cached subprocess export (reuse or share pool for PNG path).
- Existing `scripts/export_png.py` Playwright HTML wrapper.

## References

- `scripts/export_png.py` — current rasterizer
- `scripts/preview/editor.js` — `saveCurrentSvg()` pattern
- `docs/stakeholder-guide.md` — update on completion
- `diagrams/0.reference/sample.png` — canonical raster reference for starter block
