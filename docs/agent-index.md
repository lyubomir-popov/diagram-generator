# Agent index

Read this before broad repo searches.

## What matters

- Product path: TypeScript
- Source of truth: frame YAML in `scripts/diagrams/frames/`
- Preview front door: `apps/preview/`
- Layout/render authority: `packages/layout-engine/`

## First files

1. [`DIAGRAM.md`](../DIAGRAM.md)
2. `packages/layout-engine/src/tokens.ts`
3. `packages/layout-engine/src/frame-classes.ts`
4. `packages/layout-engine/src/layout.ts`
5. `apps/preview/src/server.ts`

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

- Prefer narrow `rg` searches.
- Read one targeted file after search hits.
- Avoid repo-wide sweeps unless the task is genuinely cross-cutting.
