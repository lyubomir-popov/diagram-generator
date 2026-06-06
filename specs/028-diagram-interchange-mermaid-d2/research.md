# Research: Diagram interchange (Mermaid & D2)

## Current state (post spec 022 phase 8)

| Capability | Mermaid | D2 |
|------------|---------|-----|
| Export from AST | `export-mermaid.ts` | `export-d2.ts` |
| Import to AST | None | None |
| CLI export | `export-mermaid.mjs` | `export-d2.mjs` |
| CLI import | None | None |
| Preview HTTP | None | None |
| Compile verify | None | Manual via `../d2/bin` or WSL d2 0.7.1 |

## Reference assets

| Asset | Location | Notes |
|-------|----------|-------|
| Hand-crafted Juju 4.0 D2 | `../d2/juju-4-architecture.d2` | Classes, colors, sketch — **styling target**, not structural import v1 |
| Vision YAML for above | `../d2/juju-4-architecture.yaml` | Different schema (`entities`/`groups`); not frame YAML |
| Exporter PoC | `../d2/juju-bootstrap-machines-process.d2` | From `juju-bootstrap-machines-process.yaml` via `export-d2.mjs` |
| D2 CLI bundle | `../d2/bin/d2-v0.7.1/` | Install script only; binary not vendored in repo |

## Parser approach options

| Option | Pros | Cons |
|--------|------|------|
| **A. Custom recursive-descent subset parser** | No deps; matches export output exactly | Must maintain grammar |
| **B. Official D2/Mermaid parser libs** | Completeness | Heavy deps; full grammar ≠ our AST |
| **C. Regex on exporter goldens only** | Fast to ship | Fragile for hand-edited files |

**Recommendation**: Option **A** for v1 — parse the subset our exporters emit plus minimal hand-edit tolerance (quoted labels, nested blocks, dot paths).

## D2 import grammar (v1 sketch)

```
document   ::= (vars_block)? shape_stmt* connection_stmt*
shape_stmt ::= ID ":" (label | block)
block      ::= "{" shape_stmt* "}"
connection ::= path "->" path (":" label)?
path       ::= ID ("." ID)*
label      ::= quoted | unquoted
```

Reject: `classes`, `style:`, markdown fences, imports.

## Mermaid import grammar (v1 sketch)

```
flowchart  ::= "flowchart" (TB|LR) stmt*
stmt       ::= subgraph | node | edge
subgraph   ::= "subgraph" ID block "end"
node       ::= ID "[\"" label "\"]"
edge       ::= ID "-->" ID
```

## Round-trip fidelity expectations

See `contracts/interchange-fidelity.md`. Structural fields (ids, nesting, arrows, text labels) should round-trip; layout, icons, colors, anchors, waypoints will not.

## Adversarial review input

Spec 028 phase 0 explicitly closes findings from `specs/022-diagram-authoring-ast/adversarial-review-d2-export.md` items D2-01, D2-03, D2-06, D2-08.
