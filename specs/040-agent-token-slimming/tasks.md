---
description: "Task list for agent token slimming"
---

# Tasks: Agent token slimming

**Input**: `specs/040-agent-token-slimming/spec.md`, `plan.md`

## Phase 1: Tooling and workspace

- [x] T001 Add `.cursorignore` at repo root
- [x] T002 [P] Add `.cursorindexingignore` at repo root
- [x] T003 Trim `diagram-generator.code-workspace` to `diagram-generator` + `diagram-generator-planning` only

## Phase 2: Doc authority

- [x] T004 Merge handover content into `AGENTS.md#handover`; add spec-kit-on-demand and workspace rules
- [x] T005 Replace `STATUS.md` with ≤5-line pointer to `AGENTS.md#handover`
- [x] T006 Expand `docs/agent-index.md` with trap-file table and tier-2 flow map links
- [x] T007 Update `README.md` cold-start to drop `STATUS.md`
- [x] T008 Update `docs/specs.md` — add spec 040 row; fix STATUS role text
- [x] T009 Update `.github/copilot-instructions.md` — remove auto plan injection; speckit on demand
- [x] T010 Update `.github/agents/agent.md` — align read order with `AGENTS.md`

## Phase 3: Agent broadcast

- [x] T011 Write cross-agent rules to `AGENT-INBOX.md` (Codex, Copilot, Cursor, all agents)
- [x] T012 Add user note to `INBOX.md` pointing at spec 040
- [x] T013 [P] Add `.cursorignore` + `.cursorindexingignore` to `diagram-generator-planning` (sibling repo)
- [x] T014 [P] Update `diagram-generator-planning/.github/copilot-instructions.md` speckit block to on-demand only
- [ ] T015 Drain `AGENT-INBOX.md` after triage into canonical docs

## Phase 4: Verification

- [ ] T016 Reopen two-folder workspace; start new chat; confirm only two roots in workspace metadata
- [ ] T017 Confirm `@codebase` search does not surface `diagrams/` PNG paths by default
- [ ] T018 Spot-check agent cold start reads only `agent-index.md` + `AGENTS.md` + task files
