# Feature Specification: Diagram interchange (Mermaid & D2 import/export)

**Feature Branch**: `feat/028-diagram-interchange-mermaid-d2`

**Spec Package**: `028-diagram-interchange-mermaid-d2`

**Created**: 2026-06-06

**Status**: Draft

**Depends on**: spec **022** (diagram authoring AST — compile, validate, lower, **export** adapters landed in v1).

**Input**: Extend spec 022 export-only adapters into a documented **interchange layer**: stable export from `DiagramDocument`, lossy **import** from Mermaid flowchart and D2 subsets back into frame-tree YAML/AST, explicit fidelity matrix, and CLIs for round-trip workflows used by integrators and the `../d2/` proof-of-concept repo.

## Problem Statement

Spec 022 established frame YAML as the **only canonical** authoring format and added **one-way** exporters:

- `exportMermaid(ast)` — lossy; no arrow labels; subgraph-only containers
- `exportD2(ast)` — preserves nested blocks and arrow labels; still lossy on layout/icons/styling

There is **no import path** from Mermaid or D2 back into the AST, no documented round-trip expectations, and no unified interchange API. Integrators experimenting in D2 (see `../d2/juju-4-architecture.d2`) cannot merge structural edits back into frame YAML without manual rewrite.

Adversarial review of the D2 exporter ([`specs/022-diagram-authoring-ast/adversarial-review-d2-export.md`](../022-diagram-authoring-ast/adversarial-review-d2-export.md)) identified silent-loss gaps that interchange work should close.

## Mission

Provide a **bidirectional, explicitly lossy** interchange layer between:

| Format | Role |
|--------|------|
| Frame YAML / `DiagramDocument` | Canonical source of truth |
| Mermaid flowchart | Lightweight sharing, docs, GitHub rendering |
| D2 | Nested architecture diagrams, ELK/sketch layouts, Terrastruct tooling |

**Import never replaces YAML authority** — imported documents are validated, annotated with diagnostics, and may require human cleanup before merge.

## User Scenarios & Testing

### User Story 1 — Documented export surface (Priority: P1)

As an integrator, I want one documented export contract for Mermaid and D2 so I know which AST fields survive and which emit warnings.

**Independent test**: `contracts/interchange-fidelity.md` lists every `AuthorFrameNode` / `AuthorArrow` field with Export(Mermaid), Export(D2), Import(Mermaid), Import(D2) columns; unit tests assert warning codes for each lossy export field on the tiered-network fixture.

**Acceptance scenarios**

1. **Given** a compiled tiered-network AST, **When** exported to Mermaid and D2, **Then** warning codes match the fidelity matrix for icons, layout, anchors, and arrow metadata.
2. **Given** export CLIs, **When** run with `--strict`, **Then** export warnings fail the process (same as compile strict mode).

---

### User Story 2 — D2 import to AST (Priority: P1)

As an integrator, I want to parse a **supported D2 subset** into `DiagramDocument` so structural edits made in D2 can be merged back into frame YAML.

**Independent test**: Parse `../d2/juju-bootstrap-machines-process.d2` (exporter output) → AST → lower → `FrameDiagram` loads without errors; frame ids and arrow endpoints match modulo documented loss.

**Acceptance scenarios**

1. **Given** nested D2 blocks `{ ... }`, **When** imported, **Then** AST `root` tree mirrors nesting (synthetic `page` wrapper allowed).
2. **Given** D2 connections `a.b -> c.d: "label"`, **When** imported, **Then** AST `arrows` list contains matching `source`, `target`, and `label` lines.
3. **Given** unsupported D2 constructs (classes, styles, markdown blocks, sequences), **When** imported, **Then** `IMPORT_D2_UNSUPPORTED_*` warnings are emitted and ignored sections are listed in diagnostics.

---

### User Story 3 — Mermaid import to AST (Priority: P2)

As an integrator, I want to parse a **flowchart TB/LR subset** into `DiagramDocument` for simple diagrams shared in docs.

**Independent test**: Golden import of a minimal flowchart (tiered-network Mermaid export round-trip) recovers frame ids and edges; multiline `<br/>` labels become `label:` arrays.

**Acceptance scenarios**

1. **Given** `subgraph` blocks, **When** imported, **Then** container frames are created with `children`.
2. **Given** `node["label"]` syntax, **When** imported, **Then** leaf frames receive multiline labels.
3. **Given** anchor or styling syntax Mermaid allows but YAML does not, **When** imported, **Then** `IMPORT_MERMAID_UNSUPPORTED_*` warnings are recorded.

---

### User Story 4 — Round-trip CLI workflows (Priority: P2)

As a maintainer, I want CLIs to convert between formats with visible diagnostics.

**Independent test**:

```bash
# Export (exists — harden per matrix)
node packages/layout-engine/scripts/export-d2.mjs --slug tiered-network-architecture --out /tmp/t.d2
node packages/layout-engine/scripts/export-mermaid.mjs --slug tiered-network-architecture --out /tmp/t.mmd

# Import (new)
node packages/layout-engine/scripts/import-d2.mjs --in /tmp/t.d2 --out /tmp/frame.yaml
node packages/layout-engine/scripts/import-mermaid.mjs --in /tmp/t.mmd --out /tmp/frame.yaml
```

**Acceptance scenarios**

1. **Given** YAML → D2 → import-D2 → YAML, **When** compared, **Then** structural diff (ids, nesting, arrows) is empty and lossy fields are listed.
2. **Given** import output, **When** passed through `compileDiagramYaml`, **Then** no errors on strict corpus fixtures.

---

### User Story 5 — Export hardening from adversarial review (Priority: P2)

As a maintainer, I want D2/Mermaid exporters to fail loudly on invalid refs and warn on all ignored arrow/frame metadata.

**Independent test**: Unit tests for `D2_MISSING_FRAME_REF`, `D2_UNSUPPORTED_ARROW_STYLE`, shared layout-field warnings; optional `d2 compile` check when `D2_BIN` is set.

---

### User Story 6 — Optional preview / HTTP export (Priority: P3)

As a preview user, I want to download Mermaid/D2 for the loaded slug from the preview server (parity with SVG export discoverability).

**Independent test**: `GET /api/export/mermaid?slug=` and `GET /api/export/d2?slug=` return `text/plain` compiled from on-disk YAML (not live overrides unless explicitly specified).

## Functional Requirements

### FR-001 — Canonical authority

- Frame YAML (`engine: v3`, `root`, `arrows`) remains the **only** authoritative authoring format.
- Import produces YAML or `DiagramDocument` suitable for `compileDiagramYaml`; it does not bypass validation.

### FR-002 — Export (extend 022)

- `exportMermaid(ast)` and `exportD2(ast)` remain pure functions on `DiagramDocument`.
- All ignored frame/arrow fields MUST emit documented `*_UNSUPPORTED_*` warnings (no silent loss for fields listed in fidelity matrix).
- Invalid arrow endpoints MUST emit `D2_MISSING_FRAME_REF` / `MERMAID_MISSING_FRAME_REF`.

### FR-003 — D2 import subset

Minimum construct support for v1:

- Top-level and nested shape blocks: `id: { ... }`, `id: label`, `id: "multi\nline"`
- Connections: `src -> dst`, `src -> dst: label`
- Dot-path endpoints resolving to nested frames
- Optional `vars.d2-config.layout-engine` → `meta.layout_engine` hint on export only (import may ignore or round-trip as comment)

Out of scope for v1 import: `classes`, per-shape `style`, icons, SQL tables, sequences, markdown blocks.

### FR-004 — Mermaid import subset

Minimum construct support for v1:

- `flowchart TB|LR`
- Nodes: `id["label"]`, `id["a<br/>b"]`
- Subgraphs: `subgraph id` … `end`
- Edges: `a --> b`, `a -->|label| b` (label recovery best-effort)

Out of scope for v1: classDefs, style links, click callbacks, other diagram types.

### FR-005 — Interchange fidelity matrix

- Maintain normative matrix in `contracts/interchange-fidelity.md` (export + import columns).
- Tests reference matrix rows by field name.

### FR-006 — CLIs

| Script | Direction | Status |
|--------|-----------|--------|
| `export-mermaid.mjs` | YAML → `.mmd` | Exists (022) |
| `export-d2.mjs` | YAML → `.d2` | Exists (022) |
| `import-mermaid.mjs` | `.mmd` → YAML | New |
| `import-d2.mjs` | `.d2` → YAML | New |
| `interchange-roundtrip.mjs` | YAML → format → YAML + diff report | New (optional) |

All CLIs support `--strict`, `--out`, and stderr diagnostics consistent with compile CLIs.

## Non-Functional Requirements

- **NFR-001**: Import parsers live under `packages/layout-engine/src/diagram-author/import-*` mirroring export module layout.
- **NFR-002**: No new runtime dependency on D2/Mermaid binaries for **import** (pure TS parsing).
- **NFR-003**: Optional `D2_BIN` env for export golden compile checks in CI/dev only.
- **NFR-004**: Shared warning collector for layout fields used by both exporters.

## Non-Goals

- Mermaid or D2 as canonical authoring formats
- Full syntax coverage for either language
- Visual/on-brand styling parity in interchange formats (colors, icons, stroke tokens stay in TS SVG path)
- Automatic merge of imported D2 into live preview overrides without Save
- Replacing `../d2/` hand-crafted styled diagrams — those remain reference assets for styling experiments

## Success Criteria

1. Fidelity matrix published and referenced by tests.
2. D2 import recovers tiered-network and juju-bootstrap **structure** from exporter output.
3. Mermaid import recovers tiered-network **structure** from exporter output.
4. Adversarial review items D2-01, D2-03, D2-06 closed in code/docs.
5. `docs/specs.md` and `docs/diagram-authoring.md` describe interchange as spec 028 scope.

## Related artifacts

| Artifact | Path |
|----------|------|
| D2 export adversarial review | `specs/022-diagram-authoring-ast/adversarial-review-d2-export.md` |
| D2 PoC repo | `../d2/` (`juju-4-architecture.d2`, `juju-bootstrap-machines-process.d2`) |
| Authoring docs | `docs/diagram-authoring.md` |
