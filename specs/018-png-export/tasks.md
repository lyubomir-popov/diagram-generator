# Tasks – Spec 018 PNG export

## Phase 1 – Batch / CLI on the Node path

- [ ] T010 Add a Node PNG export entrypoint (`apps/preview/scripts/export-png.mjs` or equivalent)
- [ ] T011 Add shared Node raster helpers: `resolveV3SvgPath(slug)`, `ensureTsSvgForSlug(slug)`, `rasterizeSvgToPng(svgBytes, scale)`
- [ ] T012 Wire `--slug`, `--refresh-svg`, `--all-v3`, and default dirs `diagrams/2.output/v3/{svg,png}`
- [ ] T013 Add Node-side tests for path/slug resolution and actionable failure messages
- [ ] T014 Smoke: `node apps/preview/scripts/export-png.mjs --slug request-to-hardware-stack --scale 2` produces non-empty PNG

## Phase 2 – Preview UI on the Node preview app

- [ ] T020 Add `GET /v3/png/<slug>-onbrand-v3.png` (or `/api/png/<slug>`) on the Node preview app with `scale` query param
- [ ] T021 Reuse authoritative TS SVG bytes before rasterize; add bounded PNG job queue / cache
- [ ] T022 Add **Save PNG** button to the preview shell beside **Save SVG**
- [ ] T023 Implement `saveCurrentPng()` in the browser shell (download from Node endpoint; clear errors if raster dependency missing)
- [ ] T024 If overrides are dirty and not saved: show confirm/banner that PNG uses saved YAML, unless override-aware export already exists

## Phase 3 – Docs & registration

- [ ] T030 Update `docs/stakeholder-guide.md` with Node-based PNG commands
- [ ] T031 Update `docs/specs.md`
- [ ] T032 Update `STATUS.md` / `TODO.md` when feature ships
- [ ] T033 Adversarial review: font/icon parity, scale 1 vs 2 file size, fallback/error policy

## Verification checklist

- [ ] PNG white background, no accidental transparency
- [ ] Orange arrows and embedded icons visible in raster output
- [ ] Filename matches `<slug>-onbrand-v3@2x.png`
- [ ] Works on Windows paths and WSL
- [ ] Server/CLI returns actionable errors when the raster dependency is unavailable
- [ ] No Python product-path command, route, or helper is introduced by this spec
