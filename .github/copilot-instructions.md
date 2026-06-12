# Workspace Instructions

## TS-first

- Product path is Node + TypeScript.
- New layout, measure, render, save, and preview behavior belongs in `packages/layout-engine/` or `apps/preview/`.
- Do not add new Python product-path logic.

## Preview shell

`scripts/preview/*.js` is shell and glue, not engine authority.

- Allowed: DOM wiring, selection, inspector UX, save wiring, small shell fixes.
- Not allowed: new layout semantics, style resolution, renderer truth, duplicated engine logic.

If a change needs real diagram semantics, put it in TypeScript first.

## Frame YAML

- `scripts/diagrams/frames/*.yaml` is the authored source of truth.
- Read the current file from disk before editing it.
- Make minimal diffs. Do not reconstruct YAML from memory or old output.

## Cold-start path

Read these first:

1. `docs/agent-index.md`
2. `DIAGRAM.md`
3. Only the source files relevant to the task

Use `STATUS.md` for a short handover only. Do not trawl large history docs unless the task explicitly needs them.

## Validation

```bash
npm --prefix packages/layout-engine test
npm --prefix apps/preview test
node scripts/check_no_new_python.mjs
```

Use targeted preview tests when changing preview routes, shell behavior, or save flows.

## Doc policy

- Keep repo instructions short.
- Put durable behavior in code and a few small docs.
- Delete stale prose instead of preserving multiple conflicting explanations.
