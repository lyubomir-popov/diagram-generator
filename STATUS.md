# Status

Minimal cold-start handover only.

## Current shape

- Product path: Node preview app + TypeScript layout engine.
- Source of truth: frame YAML in `scripts/diagrams/frames/`.
- Visual contract: [`DIAGRAM.md`](DIAGRAM.md).
- Operational map: [`docs/agent-index.md`](docs/agent-index.md).

## Rules that matter

- Do not add new Python product-path logic.
- Do not grow `scripts/preview/*.js` with new layout semantics; put them in `packages/layout-engine/`.
- Keep `DIAGRAM.md`, `README.md`, and this file short.

## Validation

```bash
npm --prefix packages/layout-engine test
npm --prefix apps/preview test
node scripts/check_no_new_python.mjs
```

Use targeted preview black-box tests only when touching preview routes or shell behavior.

## Active files to check first

- `packages/layout-engine/src/layout.ts`
- `packages/layout-engine/src/svg-render.ts`
- `packages/layout-engine/src/frame-classes.ts`
- `packages/layout-engine/src/tokens.ts`
- `apps/preview/src/server.ts`
- `scripts/preview/layout-bridge.js`
- `scripts/preview/editor.js`

## Work queue

- Check `TODO.md` for active implementation work.
- Check `INBOX.md` for user notes.
- Ignore old Python parity history unless you are deleting it.
