# Tasks: Diagram authoring AST (spec 022)

**Prerequisites**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md)

**Engine rule**: TypeScript owns compiler, validation, lowering, exporters. Python changes are optional passthrough only.

**Coordination**: Do not edit files outside the task you are executing if another agent is active. Prefer one phase per PR.

---

## Phase 1: Compiler scaffolding

- [x] T001 Create `packages/layout-engine/src/diagram-author/types.ts` — `DiagramDocument`, `Edge`, `CompileResult`, diagnostics
- [x] T002 Create `packages/layout-engine/src/diagram-author/compile.ts` — staged pipeline orchestrator
- [x] T003 [P] Create `packages/layout-engine/src/diagram-author/parse-yaml.ts` — parse string to untyped document
- [x] T004 Export `compileDiagramYaml` from `packages/layout-engine/src/index.ts` (or `browser-entry.ts` if preview-only)

## Phase 2: Edges (US1)

- [ ] T010 Create `edge-shorthand.ts` — parse `source -> target`; clear errors on malformed shorthand
- [ ] T011 Create edge normalizer — shorthand strings and object forms → `Edge[]`
- [ ] T012 Legacy compat — accept top-level `arrows`, normalize to edges, emit `LEGACY_KEY_DEPRECATED`
- [ ] T013 Tests: concise edges, object edges, mixed edges, invalid shorthand, legacy `arrows` deprecation

## Phase 3: Layout grammar (US2)

- [ ] T020 Parse `layout:` tree with `node:` / `group:` children
- [ ] T021 Legacy normalizer — `root:` + `children[].id` → infer node vs group; map to `layout`
- [ ] T022 Build `nodes`, `groups`, `layoutTree` indexes in `build-ast.ts`
- [ ] T023 Tests: nested groups, layout tree preservation, duplicate node/group/collision, invalid layout child, edge to group

## Phase 4: Defaults / templates (US3)

- [ ] T030 Create `expand-defaults.ts` — merge `defaults` + `use:`; node overrides win
- [ ] T031 Normalize labels — string and array → `LabelSpec`
- [ ] T032 Tests: template expansion, override, missing template, string label, array label

## Phase 5: Validation and warnings (US4)

- [ ] T040 Create `validate.ts` — all error codes in data-model.md
- [ ] T041 Warning pass — unused defaults, orphan nodes, empty groups, duplicate edges
- [ ] T042 Tests: invalid edge endpoints, unknown source/target, strict vs warn modes

## Phase 6: Lowering to runtime (US1–3 integration)

- [ ] T050 Create `lower-to-frame.ts` — `DiagramDocument` → `FrameDiagram` (edges → `arrows`)
- [ ] T051 Wire `frame-yaml-loader.ts` through `compileDiagramYaml` + lower (API unchanged)
- [ ] T052 Regression: existing corpus YAML loads; SVG golden unchanged for legacy files

## Phase 7: Mermaid exporter (US5)

- [ ] T060 Create `export-mermaid.ts` — AST in, Mermaid flowchart string out
- [ ] T061 Subgraph + direction LR/TB; array labels → `<br/>`
- [ ] T062 Mermaid unsupported-property warnings
- [ ] T063 Tests: tiered-network AST golden Mermaid string
- [ ] T064 [P] CLI `packages/layout-engine/scripts/export-mermaid.mjs`

## Phase 8: D2 exporter (US6)

- [ ] T070 Create `export-d2.ts` — containers, nodes, edges, icons where supported
- [ ] T071 D2 unsupported-property warnings
- [ ] T072 Tests: tiered-network AST golden D2 string
- [ ] T073 [P] CLI `packages/layout-engine/scripts/export-d2.mjs`

## Phase 9: Documentation and migration (US7)

- [ ] T080 Add `docs/diagram-authoring.md` — schema, validation, export limitations
- [ ] T081 Add `migrate-diagram-yaml.mjs` — rewrite `arrows`→`edges`, `root`→`layout` (optional utility)
- [ ] T082 Add reference fixture `tiered-network-architecture.author-v1.yaml`
- [ ] T083 Cross-link from `README.md` or `docs/stakeholder-guide.md` (one paragraph)
- [x] T084 Register spec in `docs/specs.md` when implementation starts

## Phase 10: Close-out

- [ ] T090 Adversarial review per `specs/ADVERSARIAL_REVIEW_PROMPT.md`
- [ ] T091 Update `STATUS.md` / `HISTORY.md` with compiler + exporter delivery notes

---

## Test matrix (must pass before Complete)

| Case | Task |
|------|------|
| Concise edge syntax | T013 |
| Object-form edge | T013 |
| Mixed edge syntax | T013 |
| Template expansion | T032 |
| Node override of template | T032 |
| Invalid edge endpoint | T042 |
| Edge pointing to group | T023 |
| Duplicate node id | T023 |
| Duplicate group id | T023 |
| Node/group id collision | T023 |
| Missing template | T032 |
| String label | T032 |
| Array label | T032 |
| Layout tree preservation | T023 |
| Mermaid export from AST | T063 |
| D2 export from AST | T072 |
