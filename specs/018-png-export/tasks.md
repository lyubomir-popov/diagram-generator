# Tasks – Spec 018 PNG export

## Phase 1 – Batch / CLI

- [ ] T010 Add `scripts/png_export.py` with `resolve_v3_svg_path(slug)`, `ensure_ts_svg_for_slug(slug)`, `rasterize_svg_to_png(svg, out, scale)`
- [ ] T011 Extend `scripts/export_png.py`: `--slug`, `--refresh-svg`, `--all-v3`, default dirs `diagrams/2.output/v3/{svg,png}`
- [ ] T012 Wire `--slug` to `node packages/layout-engine/scripts/export-frame-svg.mjs --slug <slug>` (respect `DG_FRAMES_DIR`)
- [ ] T013 Add `scripts/test_export_png.py` (path/slug unit tests; optional Playwright integration behind env flag)
- [ ] T014 Smoke: `python scripts/export_png.py --slug android-custom-to-cloud --scale 2` produces non-empty PNG

## Phase 2 – Preview UI

- [ ] T020 Add `GET /v3/png/<slug>-onbrand-v3.png` (or `/api/png/<slug>`) on `preview_server.py` with `scale` query param
- [ ] T021 Reuse TS SVG cache/pool before rasterize; bounded PNG job queue (avoid Playwright stampede)
- [ ] T022 Add **Save PNG** button to `viewer-unified.html` and `viewer.html` (Overrides section, beside Save SVG)
- [ ] T023 Implement `saveCurrentPng()` in `editor.js` (download from server endpoint; clear errors if Playwright missing)
- [ ] T024 If overrides dirty and not saved: show confirm or banner that PNG uses saved YAML (or implement override-aware export — stretch)

## Phase 3 – Docs & registration

- [ ] T030 Update `docs/stakeholder-guide.md` — Export PNG row + commands
- [ ] T031 Update `docs/specs.md` active specs table
- [ ] T032 Update `STATUS.md` / `TODO.md` when feature ships
- [ ] T033 Adversarial review: font/icon parity vs preview, scale 1 vs 2 file size, CI skip policy

## Verification checklist

- [ ] PNG white background, no accidental transparency
- [ ] Orange arrows and embedded icons visible in raster output
- [ ] Filename matches `<slug>-onbrand-v3@2x.png`
- [ ] Works on Windows (paths with spaces in repo) and WSL
- [ ] Server returns 503/404 with actionable message when Playwright not installed
