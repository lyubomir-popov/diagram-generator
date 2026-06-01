# Workspace Instructions

## DESIGN-FOUNDRY PIVOT — read this first

The workspace is mid-pivot (2026-05-23). A peer repo at `../design-foundry/` (formerly `brand-layout-ops`) is being built as the Houdini-in-spirit kernel monorepo for procedural graphic design. One decision affects this repo permanently:

- **The TypeScript autolayout in `packages/layout-engine/`** (HUG/FILL/FIXED, 9-point align, two-pass measure/place, parity-tested vs Python) will eventually port into `design-foundry` as `@design-foundry/operator-autolayout` with parity tests preserved. It is the single source of autolayout code in the workspace and stays here until the port.

**This repo stays a sibling.** No merger with `canonical-spacing-spec` or any other repo is planned. `canonical-spacing-spec` is and remains a sibling spec repo that feeds multiple consumers; this repo is and remains an independent tool/repo.

**Rules for ongoing work in this repo:**

- Continue refactoring, bug-fixing, and shipping features here. This repo is in active production use; do NOT block on the pivot.
- Do NOT migrate code to `design-foundry` yet. The target kernel (graph runtime, operator interface, render IR) does not exist there yet. Migrating now means designing against a phantom.
- **No-double-work guarantee:** design-foundry will not build a parallel autolayout. When the port happens, the code in `packages/layout-engine/` physically relocates into `design-foundry/packages/operator-autolayout/` and is wrapped in a thin adapter. Until then, autolayout work happens in exactly one place: here.
- Do NOT introduce new persisted format identifiers that embed the package name or repo name. If a new file extension or `kind` discriminator is needed, use a short stable acronym (e.g. `dg`) decoupled from package naming so future renames are cheap. Example: `*.dg.json` and `"kind": "dg.diagram"`, never `*.diagram-generator.json`.
- Keep public function signatures of `packages/layout-engine/` stable when you can. They are the de-facto interface for the eventual operator port. Breaking changes are allowed, just record them in `HISTORY.md` so the eventual porting agent knows what shifted.
- Cross-repo structural decisions (anything affecting how this repo relates to design-foundry, canonical-spacing-spec, or a4-generator) belong in `AGENT-INBOX.md` for the user to review, not in this file. The current cross-repo plan of record is `../design-foundry/PIVOT.md`.

Everything below this section is the existing workflow contract for this repo; it is unchanged by the pivot.

---

## Documentation structure


| File | Role | Who writes |
|------|------|-----------|
| `.github/copilot-instructions.md` | Rules. Workflow discipline, anti-patch protocol, session protocol. | Agent maintains |
| `.github/agents/agent.md` | Optional resume-agent prompt for repo-specific continuation. | Agent maintains |
| `.github/skills/` | Optional workflow skills. Repeatable on-demand procedures. | Agent maintains |
| `README.md` | Overview. Repo summary and workflow map. | User + agent maintain |
| `DIAGRAM.md` | Diagram language. Canonical tokens, visual rules, and output constraints. | Agent maintains |
| `ROADMAP.md` | Long-term. Product direction, stages, future ideas. | Agent updates rarely |
| `TODO.md` | Active plan. Current execution queue, principles, architecture notes. | Agent updates every session |
| `INBOX.md` | User inbox. Async user notes that should stay easy to scan. | User writes, agent drains |
| `AGENT-INBOX.md` | Agent inbox. Long machine-generated handoffs, cross-repo notes, and diagnostics awaiting triage. | Agents and automation write, agent drains |
| `STATUS.md` | Cold start. Repo orientation, current state, key files, invariants. | Agent updates when state changes |
| `HISTORY.md` | Archive. Completed work log. | Agent appends when tasks complete |
| `docs/specs.md` | Specs. Governing references, local source assets, sibling repos. | Agent updates when source paths change |

No other files should carry duplicate TODO lists, handoff notes, or parallel status tracking.

## Instruction file scope

- `.github/copilot-instructions.md` owns **workflow discipline**: how to work, when to stop, how to classify requests, how to avoid patching. It does NOT contain diagram visual rules.
- `DIAGRAM.md` owns the **diagram language contract**: colors, typography, spacing, box anatomy, arrow routing, component types. Read it before any diagram work. Do not duplicate its rules elsewhere.
- `.github/agents/agent.md` owns **resume guidance**: first-read order, cold-start question, pipeline selection.
- `.github/skills/` owns **procedures**: step-by-step how-to for repeatable tasks. Skills reference `DIAGRAM.md` for rules — they do not restate them.

When deciding where extra detail belongs:

| Information | Goes in |
|-------------|---------|
| Visual rules, tokens, box/arrow/text contracts | `DIAGRAM.md` |
| Workflow protocol, session discipline, anti-patch rules | `.github/copilot-instructions.md` |
| Current state, key files, pipeline descriptions | `STATUS.md` |
| Active tasks, architecture decisions | `TODO.md` |
| Long-term direction | `ROADMAP.md` |
| Completed work | `HISTORY.md` |
| Source-of-truth references | `docs/specs.md` |
| Human-readable overview | `README.md` |
| Async user notes | `INBOX.md` |
| Agent-generated handoffs or diagnostics | `AGENT-INBOX.md` |

## Source-of-truth precedence

When sources disagree, use this order:

1. Source sketches, reference assets, or explicitly referenced source material in `docs/specs.md`
2. `DIAGRAM.md`
3. `ROADMAP.md`
4. `.github/copilot-instructions.md`
5. `STATUS.md` and `HISTORY.md`
6. `README.md` and `docs/specs.md`
7. `INBOX.md`
8. `AGENT-INBOX.md`
9. Local implementation details that are not clearly intentional or documented

Do not rewrite higher-priority docs to match lower-priority implementation drift.

---

## Anti-Patch Protocol

This is the most important section. Every change must pass through this protocol. No exceptions. We are not under time pressure. We only make progress if we work with discipline.

### Classify before coding

Every request gets classified into exactly one of these before any file is touched:

| Classification | Where the fix lands | Example |
|---|---|---|
| **Contract change** | New primitive/default/invariant in the engine | "Boxes should have per-side padding" |
| **Configuration** | New YAML field or token value — no logic changes | "This diagram needs 5 columns" |
| **Bug** | Existing contract is violated — fix at the owning layer | "Text wraps too early" |
| **Feature** | New capability that composes with existing primitives | "Add min/max constraints" |
| **One-off** | Only acceptable for final deliverable customization | "This specific box should be 300px" |

If the request can't be cleanly classified, ask for clarification. Do not start coding.

### Patch smell test (5 questions — any "yes" means stop)

Before writing code, ask:

1. **Am I adding a special case for one specific diagram?** → Generalize or refuse.
2. **Am I touching a file that already has a workaround for this category?** → Fix the root, don't stack.
3. **Am I duplicating logic that exists in another layer?** → Route through the owning layer.
4. **Would this break if I changed the diagram that triggered it?** → It's a patch, not a rule.
5. **Is this fix at the layer that owns the concept?** → If no, find the right layer.

### Layer ownership map

```
┌─────────────────────────────────────────────────┐
│ Frame YAML (source of truth for structure)       │
├─────────────────────────────────────────────────┤
│ frame_loader.py (parse + defaults contract)      │
├─────────────────────────────────────────────────┤
│ layout_v3.py (measure + place — spatial truth)   │
│   owns: text wrapping, sizing, alignment, snap   │
├─────────────────────────────────────────────────┤
│ diagram_shared.py (tokens + shared measurement)  │
├─────────────────────────────────────────────────┤
│ diagram_render_svg.py (emit SVG from primitives) │
│   ONLY converts engine decisions to markup       │
├─────────────────────────────────────────────────┤
│ preview_server.py (serve + relayout API)         │
│   ONLY relays engine results to browser          │
├─────────────────────────────────────────────────┤
│ editor.js (interaction + display)                │
│   NEVER invents layout facts                     │
└─────────────────────────────────────────────────┘
```

If a fix touches a layer that doesn't own the concept, it's a patch. Stop and redirect.

### Flag mechanism

When a request would cause patching, report:

> **Patch risk detected.**
> - Request: [what was asked]
> - Naive fix: [the quick local change]
> - Why it's a patch: [which rule it violates]
> - Correct fix: [what to do instead, at which layer]
> - Stress test: [what must still pass after the fix]

The user can override with "proceed anyway" but the flag must be recorded in TODO.md as technical debt.

### After implementing

- Run ALL existing diagrams through the engine, not just the triggering one.
- If any regresses, the change is wrong — revert and redesign.
- One feature at a time. Do not stack unverified changes.
- Browser-verify UI work before claiming it works.

---

## Planning threshold

- Small task: act directly.
- Medium task: write a short plan in `STATUS.md` before execution.
- Large, architectural, or cross-repo task: create or update a dedicated plan section before broad changes.

## History rules

- Record completed short-term items under a short-term section.
- Record completed long-term items under a long-term section.
- Move items to history only when actually complete.
- Do not use history as a backlog or scratchpad.
- When `HISTORY.md` exceeds ~200 lines, archive older entries under `docs/archive/`.

### The inbox pattern

`INBOX.md` is the user write-only channel. `AGENT-INBOX.md` is the machine-generated handoff channel. At session start, the agent must:

1. Read `INBOX.md` and triage each item into `TODO.md` (near-term) or `ROADMAP.md` (longer-term).
2. Read `AGENT-INBOX.md` and triage durable facts into `TODO.md`, `ROADMAP.md`, `STATUS.md`, `HISTORY.md`, or `docs/specs.md`.
3. Empty both files back to their header templates.

If an INBOX item includes bug screenshots or image attachments: inspect the images first, implement the fix, present for confirmation, only then delete the images.

## Agent workflow

### Session start

1. Read `STATUS.md` for orientation.
2. Drain `INBOX.md` → triage into plan or roadmap, then empty it.
3. Drain `AGENT-INBOX.md` → triage into canonical files, then empty it.
4. Read `TODO.md` for current tasks.
5. Read `DIAGRAM.md` before any diagram or layout work.
6. Read `docs/specs.md` before changing spec-governed behavior.
7. **Classify the user's request** through the anti-patch protocol before starting implementation.

### During work

- Mark tasks done in `TODO.md` as you complete them.
- Move completed items to `HISTORY.md`.
- Run the patch smell test before every implementation.

### Session end

1. Update `STATUS.md` if the current-state section is stale.
2. Update `TODO.md` with any new tasks that emerged.
3. Ensure `INBOX.md` is empty.
4. Ensure `AGENT-INBOX.md` is empty.
5. Do not create new markdown files to document status unless explicitly requested.

## Validation

### v3 frame engine (Pipeline 3)

The focused validation command is:

```bash
python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q
```

After any layout, render, or preview change, browser-verify the affected diagram at `http://127.0.0.1:8100/view/v3:<slug>`.

### Adding a new diagram

When a new frame YAML is added to `scripts/diagrams/frames/`:

1. The preview server sidenav auto-populates from the filesystem — no manual registration is needed. The new slug appears in the **Autolayout** group on the next page load.
2. After creating or modifying the YAML, **always open the diagram in the browser** at `http://127.0.0.1:8100/view/v3:<slug>` and take a screenshot to verify the output before treating the task as done.
3. Run the focused v3 test suite to confirm no regressions.
4. Render all diagrams (`glob diagrams/frames/*.yaml`) to confirm no existing diagram broke.

### v2 declarative pipeline (Pipeline 2)

Deleted. The repo uses a single render engine: v3 autolayout.

### Deliverable SVGs

```bash
python scripts/svg_illustrator_sanitize.py --write <svg>
```

### Draw.io safety

When modifying manually edited draw.io files, use the review-copy workflow. See the `drawio-review-promote` skill.

## Agent environment rules

- Use VS Code integrated terminals the user can monitor.
- Prefer reusing a small number of foreground terminals.
- Close terminals that hang or are no longer needed.
- When using Playwright or browser automation, use Chrome, not Edge.

## Repo boundary

- Work in this repo unless the user explicitly redirects elsewhere.
- Sibling repos are read-only references unless the user redirects.

## Commit message discipline

Prefix with the area touched: `engine:`, `svg:`, `drawio:`, `workflow:`, `docs:`, `scripts:`, `icons:`, or `assets:`. Keep the first line under 72 characters.

## Autonomous continuation rule

If the user explicitly says to proceed autonomously, treat that as standing approval to keep executing without pausing for small confirmations.

In that mode:

1. Work through the current plan until you hit a real blocker.
2. Make small validated checkpoint commits after substantive chunks.
3. Re-read `TODO.md` after major chunks.
4. Update the canonical docs as work lands.
5. Do not stop just to ask whether to continue.

### Maximising autonomous run length

- Narrow the scope per burst.
- Checkpoint and resume after each substantive chunk.
- Keep TODO items small enough to complete in one focused burst.
- Prefer sequential single-repo sessions over multi-repo autonomous runs.

## Cross-repo coordination

When work in this repo creates a dependency or follow-up in another repo:

1. Drop a note in the target repo's `AGENT-INBOX.md`.
2. Do not attempt the cross-repo change in the same session unless explicitly redirected.
3. Prefer sequential single-repo sessions with inbox handoffs.

## Agent file roles

- `.github/copilot-instructions.md` — workflow discipline (this file).
- `.github/agents/agent.md` — resume guidance only.
- `DIAGRAM.md` — the canonical diagram-language contract. ALL visual rules live here.
- `.github/skills/` — repeatable procedures that reference `DIAGRAM.md` for rules.
- Do not duplicate visual rules across these files. If you find the same rule in two places, delete one.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/009-client-side-ts-rendering/plan.md
<!-- SPECKIT END -->
