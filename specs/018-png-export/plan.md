# Plan – Spec 018 PNG export

## Approach

Rasterize **TS-generated SVG**, not the browser DOM. Pipeline:

```
frame YAML  →  export-frame-svg.mjs  →  temp or cached *.svg
                                         ↓
                              export_png.py (Playwright)
                                         ↓
                         diagrams/2.output/v3/png/*.png
```

### Phase 1 – Align batch rasterizer (P1)

1. **Extend `scripts/export_png.py`**
   - Add `--slug <name>`: resolve `scripts/diagrams/frames/<slug>.yaml`, invoke Node `export-frame-svg.mjs --slug <slug> --out <tmpdir>/…svg` if SVG missing or `--refresh-svg`.
   - Default SVG search paths: `diagrams/2.output/v3/svg/*-onbrand-v3.svg`, then legacy `diagrams/2.output/svg/`.
   - Default output: `diagrams/2.output/v3/png/`.
   - Add `--all-v3`: glob v3 SVGs or all frame slugs and export each.

2. **Extract shared helper** `scripts/png_export.py` (optional thin module)
   - `resolve_v3_svg_path(slug) -> Path`
   - `rasterize_svg_to_png(svg_path, out_path, scale) -> None` (Playwright logic moved from CLI main)

3. **Tests** `scripts/test_export_png.py`
   - Path/slug resolution without Playwright.
   - Optional integration test gated on `PLAYWRIGHT_PNG=1`.

### Phase 2 – Preview Save PNG (P1)

**Option A (recommended):** Server endpoint + download

- `preview_server.py`: `GET /api/png/<slug>` or `/v3/png/<filename>.png`
  - Ensure TS SVG bytes (reuse `TsSvgExportPool` / cache from spec 014).
  - Write temp SVG → call `rasterize_svg_to_png` → return bytes.
  - Query param `scale` (default 2).
- `editor.js`: `saveCurrentPng()` fetches endpoint and triggers download (same UX as `saveCurrentSvg`).
- Bounded concurrency: share export pool or dedicated small PNG pool (max 1 Playwright browser per server instance).

**Option B (fallback):** Client-only canvas export

- Only if server Playwright is unavailable; document lower fidelity. Not sufficient for FR-001 alone.

Implement **Option A**; keep Option B out of scope unless serverless preview is required.

### Phase 3 – Docs & DX (P2)

- Update `docs/stakeholder-guide.md` with PNG commands.
- Update `docs/specs.md` index.
- Optional `package.json` / README script: `npm run export:png -- --slug foo`.

## Quickstart (after implementation)

```bash
# One-time
pip install playwright
playwright install chromium
npm --prefix packages/layout-engine run build

# Single diagram
python scripts/export_png.py --slug android-custom-to-cloud --scale 2

# Preview server + browser
python scripts/preview_server.py
# Open /view/v3:android-custom-to-cloud → Save PNG
```

## Risks

| Risk | Mitigation |
|------|------------|
| Playwright heavy in CI | Gate integration tests; document optional dep |
| Double subprocess (Node + Chromium) per PNG | Cache SVG; cache PNG by mtime+scale |
| Unsaved overrides not in PNG | Warn in UI v1; v2 pass override JSON to export endpoint |
| Threaded server + Playwright | Serialize PNG jobs (queue size 1–2) |

## File touch list

| File | Change |
|------|--------|
| `scripts/export_png.py` | `--slug`, v3 paths, TS SVG prelude |
| `scripts/png_export.py` | New shared rasterize helpers (optional) |
| `scripts/preview_server.py` | PNG route + cache |
| `scripts/preview/editor.js` | `saveCurrentPng`, button handler |
| `scripts/preview/viewer-unified.html` | **Save PNG** button |
| `scripts/preview/viewer.html` | Same button |
| `scripts/test_export_png.py` | New tests |
| `docs/stakeholder-guide.md` | PNG section |
| `docs/specs.md` | Register spec 018 |
