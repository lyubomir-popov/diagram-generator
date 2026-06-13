# Feature Specification: Agent token slimming

**Feature Branch**: `040-agent-token-slimming`

**Created**: 2026-06-13

**Status**: Draft

**Input**: Reduce AI agent token burn when working in `diagram-generator` (and the paired `diagram-generator-planning` workspace) without losing fix quality.

## Problem Statement

Agent sessions waste tokens on environment noise, duplicate cold-start docs, trap-file full reads, spec-kit surfaces loaded by default, and multi-root workspaces that inject unrelated `AGENTS.md` / rules every turn. The repo already documents many mitigations in `AGENTS.md`, but several are not enforced by tooling (ignore files, workspace file, agent entry points).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lean workspace context (Priority: P1)

A developer opens Cursor with only `diagram-generator` and `diagram-generator-planning`. No other sibling repos inject rules. `.cursorignore` and `.cursorindexingignore` prevent indexing of `diagrams/`, `node_modules/`, `dist/`, binaries, and spec-kit command files unless explicitly opened.

**Why this priority**: Workspace and index noise is billed on every turn before any tool call.

**Independent Test**: Open the two-folder workspace; confirm `user_info` / workspace roots list only those two paths. Confirm `diagrams/` and `packages/layout-engine/dist/layout-engine.iife.js` are not in codebase search index.

**Acceptance Scenarios**:

1. **Given** the saved workspace file, **When** opened in Cursor, **Then** only `diagram-generator` and `diagram-generator-planning` are roots.
2. **Given** `.cursorignore` at repo root, **When** an agent searches for a string in `diagrams/`, **Then** hits are not returned from ignored paths by default.
3. **Given** spec-kit files under `.github/agents/speckit.*`, **When** the user does not ask for spec work, **Then** agent entry docs direct agents not to load them.

---

### User Story 2 - Single cold-start authority (Priority: P1)

A developer or agent orients from `AGENTS.md` + `docs/agent-index.md` only. `STATUS.md` is retired as a parallel handover doc; agents update a short **Handover** section in `AGENTS.md` at session end when state changed.

**Why this priority**: `STATUS.md` duplicates `AGENTS.md`, `README.md`, and `agent-index.md` (~40 lines of repeated validation paths and trap files).

**Independent Test**: `STATUS.md` is a ≤5-line pointer to `AGENTS.md#handover`. Cold-start docs do not tell agents to read `STATUS.md` first.

**Acceptance Scenarios**:

1. **Given** a completed agent session that changed active work, **When** the agent updates handover state, **Then** it edits `AGENTS.md` Handover section only.
2. **Given** a new agent cold start, **When** following `AGENTS.md`, **Then** read order is `docs/agent-index.md` → `DIAGRAM.md` → task files (no `STATUS.md`).

---

### User Story 3 - Trap-file discipline (Priority: P1)

Preview work uses `rg` + partial reads on `scripts/preview/editor.js` (~6k lines) and `layout-bridge.js` (~2k lines). `docs/agent-index.md` lists trap files, line counts, and tier-2 flow maps so agents do not explore cross-layer paths from scratch.

**Why this priority**: One full `editor.js` read can exceed an entire task budget.

**Independent Test**: `docs/agent-index.md` contains a trap-file table and at least one tier-2 flow map link.

**Acceptance Scenarios**:

1. **Given** a preview persist bug, **When** an agent reads `docs/agent-index.md`, **Then** it finds the `gap_delta` / override flow map without repo-wide search.
2. **Given** a shell change, **When** an agent needs `editor.js`, **Then** entry docs say to search then read a line range, never the whole file.

---

### User Story 4 - Spec-kit on demand only (Priority: P2)

Speckit agents, prompts, and skills load only when the user explicitly asks to create or execute a spec (`/speckit`, "write a spec", "run spec-kit", etc.). Normal bugfixes do not load `.github/agents/speckit.*` or bulk `specs/**`.

**Why this priority**: Speckit agent markdown files are 170–286 lines each; auto-injection via `copilot-instructions.md` SPECKIT blocks adds dead weight.

**Independent Test**: `.github/copilot-instructions.md` SPECKIT block does not embed a current `plan.md` path. `AGENTS.md` states the on-demand rule.

**Acceptance Scenarios**:

1. **Given** a layout bugfix task, **When** the agent starts, **Then** it does not read `speckit.implement.agent.md`.
2. **Given** the user says "draft spec 041 for …", **When** the agent starts spec work, **Then** it may load the relevant `specs/<id>/` package and speckit surfaces.

---

### User Story 5 - Cross-agent inbox broadcast (Priority: P2)

Codex, Copilot, Cursor, Claude, and other agents see the same token rules via `AGENT-INBOX.md`, `AGENTS.md`, and `.github/copilot-instructions.md`.

**Independent Test**: `AGENT-INBOX.md` contains workspace, ignore-file, speckit-on-demand, and STATUS retirement instructions awaiting drain into canonical docs (this spec implements the drain).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Repo MUST ship `.cursorignore` and `.cursorindexingignore` covering dependencies, `dist/`, `diagrams/`, binaries, accidental `src/**/*.js` emit, and spec-kit command files.
- **FR-002**: `diagram-generator.code-workspace` MUST list only `diagram-generator` and `diagram-generator-planning`.
- **FR-003**: `AGENTS.md` MUST own cold-start, token budget, handover, and spec-kit-on-demand rules.
- **FR-004**: `STATUS.md` MUST be reduced to a pointer stub or removed with references updated.
- **FR-005**: `docs/agent-index.md` MUST include trap-file table and tier-2 flow map links.
- **FR-006**: `.github/copilot-instructions.md` and `.github/agents/agent.md` MUST NOT direct agents to read `STATUS.md` or auto-load speckit plans.
- **FR-007**: `docs/specs.md` MUST list spec 040.
- **FR-008**: `diagram-generator-planning` SHOULD add matching ignore files for `rtd_images/`, `tmp/`, and large scrape outputs (cross-repo workspace parity).

### Non-Goals

- Splitting `editor.js` (continues under spec 026 trajectory; out of scope except documenting trap-file reads).
- Deleting completed spec packages under `specs/`.
- Changing `diagram-generator-planning` STATUS/TODO workflow (that repo keeps its own doc model).

## Success Metrics

- Cold-start doc surface ≤ `AGENTS.md` + `agent-index.md` + `DIAGRAM.md` for product work.
- No auto-injected speckit `plan.md` in copilot instructions.
- Workspace file matches two-folder intent.
