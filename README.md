# Diagram Generator

Frame YAML in `scripts/diagrams/frames/` → TypeScript layout/render in `packages/layout-engine/` → editable SVG in preview and batch export.

This repo is TS-first. Python is retirement debt for draw.io and a few black-box test harnesses only. Do not add new Python product-path behavior.

## Start

```bash
npm install
npm run preview
```

Open `http://127.0.0.1:8100/view/v3:support-engineering-flow`.

## Cold Start

Read these in order:

1. [`docs/agent-index.md`](docs/agent-index.md)
2. [`DIAGRAM.md`](DIAGRAM.md)
3. Targeted source files for the area you are changing

Use [`STATUS.md`](STATUS.md) only for a short handover snapshot. Use [`docs/specs.md`](docs/specs.md) only when you need governing references.

## Key Paths

| Path | Role |
|------|------|
| `packages/layout-engine/` | TS layout, measure, render, authoring, browser bundle |
| `apps/preview/` | Node preview app |
| `scripts/preview/` | Browser shell and glue |
| `scripts/diagrams/frames/` | Authored frame YAML |
| `DIAGRAM.md` | Minimal visual contract |

## Core Commands

```bash
npm --prefix packages/layout-engine test
npm --prefix apps/preview test
npm run preview
node scripts/check_no_new_python.mjs
```

If you change layout-engine browser exports used by preview shell code:

```bash
npm --prefix packages/layout-engine run build:browser
```

## Notes

- Product path is Node + TypeScript.
- Existing preview tests under `scripts/test_preview_*.py` still cover the TS preview app; they are black-box tests, not Python rendering authority.
- Keep repo docs short. Durable behavior belongs in code and a few small docs, not large prose specs.
