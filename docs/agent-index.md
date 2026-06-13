# Agent index

Read this before broad repo searches.

## What matters

- Product path: TypeScript
- Source of truth: frame YAML in `scripts/diagrams/frames/`
- Preview front door: `apps/preview/`
- Layout/render authority: `packages/layout-engine/`
- Workflow authority: [`AGENTS.md`](../AGENTS.md) (includes handover — do not read `STATUS.md`)

## First files

1. [`AGENTS.md`](../AGENTS.md)
2. [`DIAGRAM.md`](../DIAGRAM.md)
3. `packages/layout-engine/src/tokens.ts`
4. `packages/layout-engine/src/frame-classes.ts`
5. `packages/layout-engine/src/layout.ts`
6. `apps/preview/src/server.ts`

## Trap files (never read whole file)

| File | ~Lines | Instead |
|------|-------:|---------|
| `scripts/preview/editor.js` | 6,000 | `rg` symbol, then `Read` with offset/limit |
| `scripts/preview/layout-bridge.js` | 1,900 | same |
| `scripts/preview/force.js` | 1,450 | same |
| `packages/layout-engine/dist/layout-engine.iife.js` | 3.5 MB | edit `packages/layout-engine/src/`; run `build:browser` |
| `diagrams/**` | binaries | ignored by `.cursorignore`; not product code |
| `specs/**` (bulk) | 8k+ | open **one** `specs/<id>-<slug>/` when doing spec work |

Thin shell modules (safe to read whole): `editor-state.js`, `editor-base.js`, `save-client.js`, `undo-manager.js`, `elk-controller.js`.

## Tier-2 flow maps

| Topic | Map |
|-------|-----|
| Preview override persist / `gap_delta` | [`specs/006-arrow-routing-redesign/preview-override-flow.md`](../specs/006-arrow-routing-redesign/preview-override-flow.md) |
| Shell decomposition boundaries | [`specs/026-preview-shell-decomposition-ts-migration/boundaries.md`](../specs/026-preview-shell-decomposition-ts-migration/boundaries.md) |
| Agent token / workspace slimming | [`specs/040-agent-token-slimming/spec.md`](../specs/040-agent-token-slimming/spec.md) |

Add a new row when you land a cross-layer map (UI → server → engine → disk). Keep maps ≤60 lines.

## Main paths

| Path | Role |
|------|------|
| `packages/layout-engine/src/` | TS engine and browser bundle source |
| `packages/layout-engine/tests/` | Vitest coverage |
| `apps/preview/src/` | Node preview app |
| `scripts/preview/` | Browser shell |
| `scripts/diagrams/frames/` | Authored diagrams |

## Runtime flow

```text
frame YAML
  -> loadFrameYaml
  -> layoutFrameTree
  -> renderFrameDiagramToSvg
  -> preview app
  -> browser shell
```

## Commands

```bash
npm --prefix packages/layout-engine test
npm --prefix apps/preview test
npm run preview
node scripts/check_no_new_python.mjs
```

## Search hygiene

- Prefer narrow `rg` scoped to one directory.
- Read one targeted file after search hits.
- Avoid repo-wide sweeps unless the task is genuinely cross-cutting.
- Do not load `.github/agents/speckit.*` unless the user asked for spec-kit work.
