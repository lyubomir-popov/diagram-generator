# Feature Specification: Diagram authoring AST, concise YAML, and export adapters

**Feature Branch**: `feat/022-diagram-authoring-ast`

**Spec Package**: `022-diagram-authoring-ast`

**Created**: 2026-06-05

**Status**: In progress

**Input**: Improve the frame YAML authoring format (concise edges, node/group grammar, defaults/templates) while preserving it as canonical source of truth; compile to a strict internal AST; render via existing TS engine; add Mermaid/D2 as export adapters only.

## Mission

Refactor diagram authoring into a **parser → normalizer → validator → AST → renderer/exporters** pipeline. Mermaid and D2 are **export targets**, never canonical syntax.

```
author-friendly YAML
  → parse + normalize legacy variants
  → expand defaults/templates
  → validate references
  → strict DiagramDocument AST
  → lower → FrameDiagram (existing layout runtime)
  → custom SVG renderer (existing)
  → optional Mermaid exporter (new)
  → optional D2 exporter (new)
```

**Non-goals for this spec**

- Replacing YAML with Mermaid or D2 as source of truth
- Rewriting the preview shell (`scripts/preview/*.js`) — see Preview shell policy in `.github/copilot-instructions.md`
- Big-bang migration of all corpus diagrams in one PR
- Changing `docs/diagram-schema.json` ontology schema (separate legacy/agent schema; document relationship only)

## Operating contract for implementers

1. **TypeScript owns the compiler** — new code lands in `packages/layout-engine/` first.
2. **Exporters consume AST only** — never parse raw YAML.
3. **Renderer stays on FrameDiagram** — AST lowers to existing `Frame` / `FrameDiagram`; do not fork layout/measure in exporters.
4. **Backward compatibility** — legacy `arrows` + `root:` YAML continues to load; emit deprecation warnings, normalize to AST.
5. **Small, tested increments** — no parallel architecture beside the paths named in `plan.md`.
6. **Do not block on Python parity** — `frame_loader.py` may lag; TS compiler is authoritative.
7. Another agent may be active in the repo — touch only files listed in `tasks.md` for each task.

## User scenarios and testing

### User Story 1 — Concise edge authoring (Priority: P1)

As a diagram author, I want to write `public_repo -> global_server` instead of verbose `source`/`target` objects so edge lists stay readable.

**Independent test**: Parse mixed shorthand + object edges; normalized AST contains structured `Edge` records with `source`, `target`, `kind: directed`.

**Acceptance scenarios**

1. **Given** `edges: [public_repo -> global_server]`, **When** compiled, **Then** AST has one edge `{ source: public_repo, target: global_server, kind: directed }`.
2. **Given** invalid shorthand `public_repo ->`, **When** compiled, **Then** a clear parse error names the line and expected `source -> target` form.
3. **Given** legacy `arrows:` with object form, **When** compiled, **Then** same AST as equivalent `edges:` and a deprecation warning is recorded.

---

### User Story 2 — Node vs group grammar (Priority: P1)

As a diagram author, I want `node:` and `group:` entries so connectable leaves are distinct from layout containers.

**Independent test**: Parse layout tree with nested groups and nodes; AST has separate `nodes` and `groups` indexes plus `layoutTree`; edges resolve only to node ids.

**Acceptance scenarios**

1. **Given** a `group: tier2_row` with child nodes, **When** compiled, **Then** group exists in `groups`, children are nodes or nested groups, layout tree preserves nesting.
2. **Given** an edge targeting a group id, **When** compiled, **Then** validation fails unless the group is explicitly marked connectable (future field; default: not connectable).
3. **Given** duplicate ids across a node and group, **When** compiled, **Then** validation fails with a collision error.

---

### User Story 3 — Defaults and `use` templates (Priority: P1)

As a diagram author, I want reusable `defaults` and `use: template` on nodes so repeated icon/label patterns are not copy-pasted.

**Independent test**: Template expansion merges defaults; node-level overrides win.

**Acceptance scenarios**

1. **Given** `defaults.client.label: Client` and `node: client_l1 use: client`, **When** compiled, **Then** node `client_l1` has label `Client`.
2. **Given** the same with `label: Special client` on the node, **When** compiled, **Then** label is `Special client`.
3. **Given** `use: missing_template`, **When** compiled, **Then** validation fails with unknown template error.

---

### User Story 4 — Validation and warnings (Priority: P2)

As a maintainer, I want strict validation errors and non-fatal warnings so broken diagrams fail early with actionable messages.

**Independent test**: Fixture suite covers errors and warnings listed in `data-model.md`.

**Acceptance scenarios**

1. **Given** edge source id that does not exist, **When** compiled, **Then** error cites source id and edge index.
2. **Given** unused default template, **When** compiled, **Then** warning lists unused template keys.
3. **Given** duplicate edges, **When** compiled, **Then** warning (not error unless configured strict).

---

### User Story 5 — Mermaid export adapter (Priority: P2)

As an integrator, I want Mermaid flowchart output from the normalized AST for docs and tooling, accepting that layout hints may be lossy.

**Independent test**: Golden tests: AST → Mermaid string; no YAML parsing in exporter.

**Acceptance scenarios**

1. **Given** multi-line labels `["Tier 1", "Global server"]`, **When** exported, **Then** Mermaid node uses `<br/>` line breaks.
2. **Given** nested groups, **When** exported, **Then** `subgraph` blocks with `direction LR`/`TB` where feasible.
3. **Given** icons, padding, fill sizing, **When** exported, **Then** warnings note unsupported hints.

---

### User Story 6 — D2 export adapter (Priority: P3)

As an integrator, I want D2 output for nested container diagrams where Mermaid is too lossy.

**Independent test**: AST → D2 string golden test on tiered-network-shaped fixture.

**Acceptance scenarios**

1. **Given** nested groups, **When** exported, **Then** D2 containers mirror group hierarchy.
2. **Given** icon metadata on nodes, **When** exported, **Then** icon included where D2 supports it; warning otherwise.

---

### User Story 7 — Documentation and migration (Priority: P2)

As a cold-start agent, I need schema docs, migration notes, and export limitation tables.

**Independent test**: `quickstart.md` examples parse and match documented AST shape.

**Acceptance scenarios**

1. **Given** old `arrows` + `root:` document, **When** migration utility or compat path runs, **Then** produces new-style YAML or loads equivalently with warnings documented.

## Functional requirements

### FR-001 — Edge rename and syntax

- Authoring key **`edges`** replaces **`arrows`** (legacy alias with deprecation warning).
- Shorthand: `source -> target` (whitespace around `->` tolerated; ids must match `[A-Za-z_][A-Za-z0-9_]*` or existing id rules).
- Object form retained: `source`, `target`, optional `label`, `style`, `id`, `waypoints`, etc.
- Normalized AST edge: `{ source, target, kind: "directed", ...optional }`.

### FR-002 — Layout grammar

- Top-level **`layout`** (new) or legacy **`root`** (compat) — both normalize to `layoutTree`.
- Children entries are discriminated:
  - `node: <id>` — connectable visible node
  - `group: <id>` — layout container
- Layout hints on groups/nodes: `direction`, `padding`, `align`, `sizing_w`, `sizing_h`, `level`, `gap`, `heading`, `icon`, `variant`, etc. (map to existing Frame fields on lower).

### FR-003 — Defaults / templates

- `defaults:` map of template name → partial node properties.
- `use: <template>` on node entries; expansion before validation.
- Override precedence: node properties > template > implicit defaults.

### FR-004 — Internal AST

See `data-model.md`. Minimum separation: `nodes`, `groups`, `edges`, `layoutTree`, `defaults`, `metadata`.

### FR-005 — Validation (errors)

- Unique node ids; unique group ids; no id collision across nodes and groups.
- Every edge `source`/`target` resolves to a **node** id (not group, unless `connectable: true` on group — optional v1 field).
- Every `use` references existing default.
- Labels: string or string array (normalize to line list).
- Groups must have `children` unless `allow_empty: true`.
- Layout children must be valid `node` or `group` entries.
- Invalid edge shorthand → parse error with line context.

### FR-006 — Warnings (non-fatal)

- Unused defaults; orphan nodes (no incident edge); empty groups; duplicate edges; Mermaid/D2 unsupported property lists per node/group.

### FR-007 — Pipeline

Implement as explicit stages (no string replacement migration):

1. `parseYamlDocument(raw)`
2. `normalizeLegacySchema(doc)` — `arrows`→`edges`, `root`→`layout`
3. `expandDefaults(doc)`
4. `buildIndexes(doc)` — nodes, groups
5. `validate(doc, indexes)` — errors + warnings
6. `buildDiagramAst(...)` — strict AST
7. `lowerToFrameDiagram(ast)` — existing runtime
8. `exportMermaid(ast)` / `exportD2(ast)` — adapters only

### FR-008 — Backward compatibility

- Legacy YAML with `arrows` and `root.children[].id` continues to load.
- Deprecation warnings logged (compiler `warnings[]`); optional `--strict` fails on deprecated keys.
- Optional CLI `migrate-diagram-yaml.mjs` rewrites to new schema (does not run automatically).

### FR-009 — Tests

Cover all cases listed in user requirements §9 (concise/object/mixed edges, templates, validation errors, layout tree, exporters).

### FR-010 — Documentation

Update or add under this spec package and canonical docs when implementing (see tasks): authoring schema, edge syntax, node vs group, defaults, validation, Mermaid/D2 limitations, migration from `arrows`.

## Edge cases

- Empty `edges: []` — valid.
- Self-loop `a -> a` — warning or error (decide in implementation; default: allow with warning).
- Edge shorthand with extra `:` confusion vs YAML mapping — parser must not treat `->` lines as mappings.
- Legacy flat `children[].id` without `node:`/`group:` — normalizer infers: leaf with label/icon → node; container with children → group.
- `engine: v3` retained; compiler version field `schema: author-v1` optional on new documents.

## Success criteria

- **SC-001**: New authoring YAML for `tiered-network-architecture` is ≤40% fewer lines than legacy equivalent without losing layout intent.
- **SC-002**: 100% of kept corpus loads through compat path with zero behavior change in SVG golden tests (post-lower).
- **SC-003**: All validation error fixtures produce stable error codes/messages.
- **SC-004**: Mermaid exporter produces parseable flowchart for tiered-network AST fixture.
- **SC-005**: No exporter reads raw YAML.

## References

- Current loader: `packages/layout-engine/src/frame-yaml-loader.ts`, `scripts/frame_loader.py`
- Runtime model: `packages/layout-engine/src/frame-model.ts` (`Frame`, `FrameDiagram`, `Arrow`)
- Example corpus: `scripts/diagrams/frames/tiered-network-architecture.yaml`
- Separate ontology schema: `docs/diagram-schema.json` (not replaced by this spec)
