# Plan – Spec 018 PNG export

## Approach

Rasterize **authoritative TS-generated SVG**, not the browser DOM and not a Python-side intermediate. The PNG path must plug into the same Node / TS authority path that spec 038 establishes:

```text
frame YAML
  -> compileDiagramYaml / loadFrameYaml
  -> TS layout + svg-render
  -> SVG bytes
  -> Node raster adapter
  -> diagrams/2.output/v3/png/*.png
```

The spec is intentionally downstream of spec 038. It should either:

- land after the Node preview app exists, or
- be implemented directly in the same Node app / package structure introduced by spec 038.

## Phase 1 – Batch rasterizer on the Node path (P1)

1. **Create a Node PNG export CLI**
   - Add a Node entrypoint such as `apps/preview/scripts/export-png.mjs` or a package-local CLI.
   - Support `--slug`, `--all-v3`, `--scale`, and `--refresh-svg`.
   - Resolve `scripts/diagrams/frames/<slug>.yaml`.
   - Generate or reuse authoritative `diagrams/2.output/v3/svg/<slug>-onbrand-v3.svg`.
   - Write PNG output to `diagrams/2.output/v3/png/`.

2. **Add a shared raster module**
   - `resolveV3SvgPath(slug)`
   - `ensureTsSvgForSlug(slug)`
   - `rasterizeSvgToPng(svgBytes, scale)`
   - Hide the chosen raster backend behind this module so the CLI and preview app share one implementation.

3. **Tests**
   - Path and slug resolution without a raster backend.
   - Optional raster integration tests gated behind an env flag if the dependency is heavyweight.

## Phase 2 – Preview Save PNG on the Node preview app (P1)

1. Add a Node preview route such as:
   - `GET /v3/png/<slug>-onbrand-v3.png?scale=2`
   - or `GET /api/png/<slug>?scale=2`
2. Reuse the same TS SVG authority bytes as the batch CLI before rasterizing.
3. Add a bounded raster queue / cache to avoid stampede under repeated requests.
4. Add `Save PNG` to the preview shell beside `Save SVG`.
5. Implement `saveCurrentPng()` in the browser shell to fetch the endpoint and download the result.
6. For v1, if overrides are dirty and not saved, warn that PNG reflects saved YAML unless override-aware export is already available.

## Phase 3 – Docs & DX (P2)

- Update `docs/stakeholder-guide.md` with Node-based PNG commands.
- Update `docs/specs.md`.
- Add a top-level script alias if helpful, for example `npm run export:png -- --slug foo`.

## Quickstart (after implementation)

```bash
# Build the TS engine
npm --prefix packages/layout-engine run build

# Single diagram
node apps/preview/scripts/export-png.mjs --slug request-to-hardware-stack --scale 2

# Preview app
npm run preview
# Open /view/v3:request-to-hardware-stack -> Save PNG
```

## Risks

| Risk | Mitigation |
|------|------------|
| Raster backend adds complexity | Keep it as a thin adapter over SVG bytes, not a second render pipeline |
| Double work before spec 038 lands | Sequence this spec after the Node front door; do not add new Python glue |
| Unsaved overrides not reflected | Ship a clear warning in v1; override-aware export is a follow-up |
| Browser-backed raster dependency is heavy | Keep raster behind a shared adapter; swap to a Node-native backend if fidelity is acceptable |

## File touch list

| File | Change |
|------|--------|
| `apps/preview/scripts/export-png.mjs` or equivalent | New Node CLI |
| `apps/preview/src/png-export/*` or equivalent | Shared raster helpers |
| Node preview app routes | PNG endpoint + cache/queue |
| Preview shell JS/HTML | `Save PNG` button + download handler |
| Node-side tests | New PNG export tests |
| `docs/stakeholder-guide.md` | PNG section |
| `docs/specs.md` | Register spec 018 closeout |
