# Feature Specification: Force-layout restoration

**Feature Branch**: `feat/force-layout-restoration`

**Created**: 2026-06-05

**Status**: Complete

**Input**: Restore the broken force-layout demo lane using a TypeScript-first architecture, based on `docs/architecture/repo-health-audit-2026-06-05.md` and the archived force-lane behavior captured in `docs/archive/history-2026-05.md`.

## Problem Statement

The repo still ships the force-layout UI shell (`scripts/preview/force.js`, `scripts/preview/force-viewer.html`) and preview-server route surface, but the force backend and tracked example specs were deleted. The result is a dead demo lane: `/force` is unavailable, force examples do not appear reliably in served picker/index surfaces, and the existing shell cannot be exercised or validated.

The restoration must follow the repo's TS-first rule. Do not recreate `force_preview.py` or `force_layout.py`. The restored lane should use TypeScript for simulation and rendering ownership, restore the three tracked examples, and keep the BF-shell preview/editor behavior that previously worked.

Historical JSON recovered from git history may be used as migration input, but it is not the intended final authored source of truth. Before this spec is complete, the restored force examples must move to a YAML-authored canonical format. JSON is transport/export only and must not become a second authored authority beside the canonical YAML.

## User Scenarios & Testing

### User story 1 - Browse and open force examples again (Priority: P1)

As a reviewer, I need the three tracked force examples to appear again in preview navigation so the force lane is demoable and testable.

**Why this priority**: Without discoverable example data, the force lane is functionally absent.

**Independent Test**: Start the preview server, open `/`, confirm the force section appears, and open `/force/view/force-stakeholders`, `/force/view/force-juju-landing-pages`, and `/force/view/force-support-case-lifecycle` successfully.

**Acceptance Scenarios**:

1. **Given** a clean checkout with the restored force feature, **When** the preview server loads the root index and picker surfaces, **Then** the three tracked force examples appear alongside their existing reference images.
2. **Given** a force example slug, **When** `/force/view/<slug>` loads, **Then** the BF-shell page renders a live graph instead of an unavailable-backend message.

---

### User story 2 - Interact with the force graph in the browser (Priority: P1)

As a diagram editor user, I need drag, pin, tick controls, reset, and save to work again so force examples are editable rather than static screenshots.

**Why this priority**: The historical value of the force lane was interactive graph layout, not just static rendering.

**Independent Test**: In the browser, drag a node, verify it pins, step or play the simulation, save, reload, and confirm the manual state persists.

**Acceptance Scenarios**:

1. **Given** a force graph with unpinned nodes, **When** I drag a node and release it, **Then** its position updates immediately and remains pinned.
2. **Given** a manually adjusted graph, **When** I save and reload or reset the page, **Then** the saved pinned/style state persists and the graph reflows around that state.
3. **Given** a selected node, **When** I resize it via the existing shared handles, **Then** width and height snap to the 8px grid and respect the 48px minimum.

---

### User story 3 - Export and validate the restored lane (Priority: P2)

As a maintainer, I need JSON and SVG export plus a bounded validation story so the restored force lane is not a second-class surface.

**Why this priority**: The old force lane supported JSON and SVG export and was validated as a demo surface.

**Independent Test**: Export JSON and SVG for at least one restored force example and confirm the outputs are non-empty and reflect the current in-session pinned state.

**Acceptance Scenarios**:

1. **Given** a restored force example, **When** I export JSON, **Then** node positions, pins, links, and style state are preserved in the canonical force spec format.
2. **Given** the same graph, **When** I export SVG, **Then** the output is non-empty and reflects the live graph state rather than a stale reference snapshot.

## Edge Cases

- Force examples missing saved overrides should still open from canonical tracked source.
- Reference images remain available even if the force simulation data is incomplete or invalid.
- Node drag or resize should not push nodes outside the stage bounds.
- Simulation controls should not require a Python backend or a second authority for node state.
- Missing or malformed force spec fields should fail explicitly, not silently degrade to an empty graph.

## Requirements

### Functional Requirements

- **FR-001**: The force-layout lane MUST be restored without reintroducing Python solver or backend authority.
- **FR-002**: Three tracked force examples MUST exist again in a YAML-authored canonical source format and be discoverable from preview navigation.
- **FR-003**: The browser force surface MUST support drag-to-pin, simulation tick/play controls, reset, save, and shared resize handles.
- **FR-004**: Save and reload MUST preserve pinned/manual state in the canonical authored force source format, with JSON limited to transport or export when needed.
- **FR-005**: JSON and SVG export MUST work for restored force examples.
- **FR-006**: Preview-server force routes MUST either call TS-backed logic or be reduced to thin wrappers around TS-owned state.

### Non-Functional Requirements

- **NFR-001**: No new Python layout or simulation engine may be introduced for force restoration.
- **NFR-002**: Force restoration should reuse shared BF-shell/editor primitives where they already exist (`editor-base.js`, shared handles, shared shell controls).
- **NFR-003**: Restored examples must remain bounded and demo-friendly; do not add open-ended force corpus growth in this slice.

## Success Criteria

- **SC-001**: `/force/view/force-stakeholders`, `/force/view/force-juju-landing-pages`, and `/force/view/force-support-case-lifecycle` all load successfully in the preview shell.
- **SC-002**: Browser interaction proves drag-to-pin, save/reset persistence, and resize behavior on at least one restored example.
- **SC-003**: JSON and SVG export succeed for at least one restored example.
- **SC-004**: The restored lane is explicitly TS-owned in code and docs, with no new Python force backend introduced.

## Out of Scope

- Replacing the existing force UI shell with a new product surface.
- Generic graph-authoring features beyond restoring the previous demo behavior.
- PNG export for force mode (tracked separately under spec 018 if needed later).

## Dependencies

- `docs/architecture/repo-health-audit-2026-06-05.md`
- `docs/archive/history-2026-05.md`
- `scripts/preview/force.js`
- `scripts/preview/force-viewer.html`
- `diagrams/1.input/force/IMG_3229.jpg`
- `diagrams/1.input/force/IMG_3231.jpg`
- `diagrams/1.input/force/IMG_3232.jpg`