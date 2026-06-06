# Plan: Diagram interchange (Mermaid & D2)

**Spec**: 028-diagram-interchange-mermaid-d2  
**Status**: Draft

## Architecture

```
Frame YAML
    │ compileDiagramYaml
    ▼
DiagramDocument (AST) ─────────────────────────────┐
    │                                              │
    ├── exportMermaid ──► .mmd                     │
    ├── exportD2 ───────► .d2                      │
    │                                              │
    ├── importMermaid ◄── .mmd (new)               │
    └── importD2 ◄────── .d2 (new)                 │
            │                                      │
            ▼                                      │
    DiagramDocument' ──► serializeFrameYaml (new)  │
            │                                      │
            └──────── lower ──► FrameDiagram ◄─────┘
```

Import and export are **symmetric adapters** around the same AST type introduced in spec 022. Serialization to YAML is a separate concern from parsing external syntax.

## Phases

| Phase | Deliverable | Depends on |
|-------|-------------|------------|
| 0 | Fidelity matrix + export hardening (022 follow-up) | 022 complete |
| 1 | `import-d2.ts` + tests + `import-d2.mjs` | Phase 0 |
| 2 | `import-mermaid.ts` + tests + `import-mermaid.mjs` | Phase 0 |
| 3 | `serialize-diagram-yaml.ts` (AST → canonical YAML) | Phase 1–2 |
| 4 | Round-trip harness + optional `D2_BIN` compile check | Phase 1 |
| 5 | Docs + preview HTTP export (optional P3) | Phase 1–3 |

## Module layout

```
packages/layout-engine/src/diagram-author/
  export-mermaid.ts      # exists
  export-d2.ts           # exists
  export-shared.ts       # new: layout warning fields, label escaping helpers
  import-d2.ts           # new
  import-mermaid.ts      # new
  serialize-yaml.ts      # new (or extend migrate utility)
```

## Test strategy

- **Golden strings**: export (existing) + import parse trees
- **Round-trip structural equality**: ids, parent links, arrow endpoints on tiered-network + juju-bootstrap
- **Warning coverage**: one test per fidelity-matrix row marked “warn on export”
- **Optional integration**: `D2_BIN=d2 vitest import-d2-compile.test.ts`

## Risks

| Risk | Mitigation |
|------|------------|
| D2 grammar complexity | Strict subset parser; reject with diagnostics rather than partial silent parse |
| Mermaid dialect drift | Pin to flowchart subset used by our exporter; test round-trip from our export only initially |
| Duplicate layout warning lists | `export-shared.ts` in phase 0 |
