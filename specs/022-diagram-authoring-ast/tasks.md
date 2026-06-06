# Tasks: Diagram authoring AST (spec 022)

**Prerequisites**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md)

**Engine rule**: TypeScript owns compiler, validation, lowering, exporters. Python changes are optional passthrough only.

**Coordination**: Do not edit files outside the task you are executing if another agent is active. Prefer one phase per PR.

---

## Phase 1: Compiler scaffolding

- [x] T001 Create `packages/layout-engine/src/diagram-author/types.ts` — `DiagramDocument`, arrow/frame AST, `CompileResult`, diagnostics
- [x] T002 Create `packages/layout-engine/src/diagram-author/compile.ts` — staged pipeline orchestrator
- [x] T003 [P] Create `packages/layout-engine/src/diagram-author/parse-yaml.ts` — parse string to untyped document
- [x] T004 Export `compileDiagramYaml` from `packages/layout-engine/src/index.ts` (or `browser-entry.ts` if preview-only)

## Phase 2: Arrows (US1)

- [x] T010 Create `arrow-shorthand.ts` — parse `source -> target`; clear errors on malformed shorthand
- [x] T011 Create arrow normalizer — shorthand strings and object forms → `AuthorArrow[]`
- [x] T012 Preserve existing arrow ref grammar — validate base ids while allowing container endpoints and side-qualified refs
- [x] T013 Tests: concise arrows, object arrows, mixed arrows, invalid shorthand, container endpoints, side-qualified refs

## Phase 3: Frame-tree AST (US2)

- [x] T020 Parse canonical `root:` tree into frame-node AST
- [x] T021 Build frame index / parentage map in `build-ast.ts`
- [x] T022 Normalize line content and current frame fields needed for lowering/export
- [x] T023 Tests: nested containers, tree preservation, duplicate ids, invalid child entry, arrow to container

## Phase 4: Defaults / templates (US3)

- [x] T030 Create `expand-defaults.ts` — merge `defaults` + `use:` on frame entries; local overrides win
- [x] T031 Normalize labels / headings — string, array, line-object → `LineSpec`
- [x] T032 Tests: template expansion, override, missing template, string label, array label, line-object preservation

## Phase 5: Validation and warnings (US4)

- [x] T040 Create `validate.ts` — all error codes in `data-model.md`
- [x] T041 Warning pass — unused defaults, orphan leaves, duplicate arrows, self-loops
- [x] T042 Tests: invalid arrow endpoints, unknown source/target, strict vs warn modes

## Phase 6: Lowering to runtime (US1–3 integration)

- [x] T050 Create `lower-to-frame.ts` — `DiagramDocument` → `FrameDiagram`
- [x] T051 Wire `frame-yaml-loader.ts` through `compileDiagramYaml` + lower (API unchanged)
- [x] T052 Regression: existing corpus YAML loads; SVG golden unchanged through compiler path

## Phase 7: Mermaid exporter (US5)

- [x] T060 Create `export-mermaid.ts` — AST in, Mermaid flowchart string out
- [x] T061 Subgraph mapping for containers; array labels → `<br/>`
- [x] T062 Mermaid unsupported-property warnings, including anchor-qualified ref degradation
- [x] T063 Tests: tiered-network AST golden Mermaid string
- [x] T064 [P] CLI `packages/layout-engine/scripts/export-mermaid.mjs`

## Phase 8: D2 exporter (US6) // defer for now

- [ ] T070 Create `export-d2.ts` — containers, leaves, arrows, icons where supported
- [ ] T071 D2 unsupported-property warnings
- [ ] T072 Tests: tiered-network AST golden D2 string
- [ ] T073 [P] CLI `packages/layout-engine/scripts/export-d2.mjs`

## Phase 9: Documentation and migration (US7)

- [ ] T080 Add `docs/diagram-authoring.md` — schema, validation, export limitations
- [ ] T081 Add `migrate-diagram-yaml.mjs` — optional shorthand-arrow / defaults extraction utility that preserves canonical `root` + `arrows`
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
| Concise arrow syntax | T013 |
| Object-form arrow | T013 |
| Mixed arrow syntax | T013 |
| Container arrow endpoint | T013 / T023 |
| Side-qualified arrow ref | T013 |
| Template expansion | T032 |
| Frame override of template | T032 |
| Invalid arrow endpoint | T042 |
| Duplicate frame id | T023 |
| Missing template | T032 |
| String label | T032 |
| Array label | T032 |
| Line-object label preservation | T032 |
| Frame tree preservation | T023 |
| Mermaid export from AST | T063 |
| D2 export from AST | T072 |
