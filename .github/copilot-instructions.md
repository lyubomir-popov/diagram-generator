# Workspace Instructions

Primary repo instructions live in [`AGENTS.md`](../AGENTS.md).

Use `AGENTS.md` as the single authority for:

- TS-first and Python-retirement rules
- shell and environment guidance, including Windows / WSL advice
- cold-start read order and **handover** (do not maintain parallel state in `STATUS.md`)
- validation commands
- repo search hygiene and commit discipline
- **spec-kit on demand** — do not load speckit agents/prompts unless the user explicitly asks for spec work

Do not duplicate repo-specific workflow rules here. Update `AGENTS.md` instead.

<!-- SPECKIT START -->
Load `.github/agents/speckit.*`, `.github/prompts/speckit.*`, and `specs/*/plan.md` **only** when the user explicitly requests spec-kit work.
For normal bugfixes: read `docs/agent-index.md` + `AGENTS.md` + task-scoped source files.
Spec index: `docs/specs.md` — open one package at a time.
<!-- SPECKIT END -->
