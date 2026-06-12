# Preview override flow (spec 006)

Short map for agents reviewing gap/spacing/persist work. Read this before tracing code.

## `gap_delta` end-to-end

```
Inspector "Gap bump" (editor.js setFrameProp)
  → overrides[cid].gap_delta  (session; null = clear sentinel)
  → layout-bridge applyOverridesToFrameTree  (runtime relayout)
  → save-client POST /api/overrides/{slug}
  → server.ts persistFrameDiagramOverridePayloadToYaml
  → frame-diagram.ts applyFrameOverride  (YAML write)
  → scripts/diagrams/frames/{slug}.yaml

Reload path:
  YAML → loadFrameYaml → layoutFrameTree (server)
  → serializeFrameDiagram → canonicalState.frameTree JSON
  → layout-bridge deserializeFrameWire (browser)
  → layoutFrameTree (client relayout)
  → buildComponentTree / updateComponentModelFromLayout
  → inspector reads ovr.gap_delta ?? node.data.gap_delta
```

## Key files (in order)

| Layer | File |
|-------|------|
| Allowlists (single source) | `packages/layout-engine/src/preview-shell/frame-override-manifest.ts` |
| Persist | `apps/preview/src/persistence/frame-diagram.ts` |
| Wire serialize/deserialize | `packages/layout-engine/src/frame-serialize.ts` |
| Client relayout | `scripts/preview/layout-bridge.js` |
| Inspector UI | `scripts/preview/editor.js` (`buildAutolayoutPanel`, `setFrameProp`) |
| Save POST | `scripts/preview/save-client.js` |
| Dense-stack promotion | `packages/layout-engine/src/layout.ts` (`promoteDenseLeafStackGaps`) |
| Component tree for inspector | `packages/layout-engine/src/component-tree.ts` |

## Naming at boundaries

- **YAML / overrides:** `gap_delta` (snake_case)
- **Frame model / wire JSON:** `gapDelta` (camelCase)

## Tests to run for gap_delta changes

```bash
npm --prefix apps/preview test
npm --prefix packages/layout-engine test -- gap-delta-wire-roundtrip frame-override-manifest component-tree
```

## Known limits

- **ELK diagrams:** local relayout skipped; `gap_delta` does not affect ELK child spacing.
- **Headed containers:** inspector gap hint uses body stack gap; parent `gap_delta` targets authored parent frame.
