# Implementation Plan: Agent token slimming

**Branch**: `040-agent-token-slimming` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)

## Summary

Land ignore files, fix the two-folder workspace file, consolidate handover into `AGENTS.md`, enrich `docs/agent-index.md`, stop auto-loading speckit plans in copilot instructions, and broadcast rules to all agent entry points. Planning repo gets parallel `.cursorignore` / `.cursorindexingignore` for corpus assets.

## Technical Context

**Languages**: Markdown, JSON (workspace file)

**Primary files**:

- `.cursorignore`, `.cursorindexingignore`
- `diagram-generator.code-workspace`
- `AGENTS.md`, `STATUS.md` (stub), `docs/agent-index.md`
- `.github/copilot-instructions.md`, `.github/agents/agent.md`
- `AGENT-INBOX.md`, `INBOX.md`
- `README.md`, `docs/specs.md`
- `../diagram-generator-planning/.cursorignore` (sibling repo)

**Testing**: Manual — verify workspace roots, spot-check that ignored paths are excluded from `@codebase` search, confirm agent entry docs read order.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Minimal diff | PASS | Docs + ignore files only |
| No duplicate authority | PASS | Retires `STATUS.md` parallel track |
| AGENTS.md as workflow source | PASS | Explicit goal |

## Phase 0 — Tooling (done in initial PR)

- [x] Add `.cursorignore` and `.cursorindexingignore`
- [x] Trim `diagram-generator.code-workspace` to two folders
- [x] Add spec package `specs/040-agent-token-slimming/`

## Phase 1 — Doc authority

- [x] Merge `STATUS.md` handover into `AGENTS.md#handover`
- [x] Stub `STATUS.md` → pointer only
- [x] Expand `docs/agent-index.md` (trap files + tier-2 table)
- [x] Update `README.md`, `docs/specs.md`, `.github/*` entry agents
- [x] Remove speckit plan auto-injection from `copilot-instructions.md`

## Phase 2 — Cross-agent broadcast

- [x] Populate `AGENT-INBOX.md` with rules for Codex, Copilot, Cursor, Claude, Windsurf, etc.
- [ ] Drain `AGENT-INBOX.md` after triage (agent session end)
- [ ] Add ignore files to `diagram-generator-planning`

## Phase 3 — Ongoing (not blocking close)

- Continue `editor.js` / `layout-bridge.js` TS extraction (spec 026)
- Add tier-2 maps when touching new cross-layer paths
- Stash cosmetic frame YAML before agent reviews

## STATUS.md vs AGENTS.md — decision

**Drop `STATUS.md` as a handover surface.** Keep a one-line stub so old links do not 404. Agents update `AGENTS.md` Handover section when session state changes (active branch, in-flight spec, trap-file areas touched). `TODO.md` remains the execution queue; `INBOX.md` remains the user async channel.

## Workspace roots — why old repos still appeared

Cursor injects **currently open workspace roots** into each chat's `user_info`, not the last saved file on disk alone. If a chat started while 11 roots were open, that snapshot persists for the thread. The on-disk `diagram-generator.code-workspace` previously still listed **five** folders (`design.md`, `canonical-spacing-spec`, `design-foundry`, etc.) — now trimmed to two. **Reopen** the workspace file (or File → Close Folder on strays) so new chats see only two roots.
