# Workspace Instructions

## DESIGN-FOUNDRY PIVOT and TypeScript-first rule — read this first

### The bigger picture

`design-foundry` (at `../design-foundry/`) is the ultimate home for all procedural graphic design code in this workspace — a Houdini-in-spirit kernel with a typed data graph, DAG runtime, operator libraries, and multi-backend renderers. The full cross-repo architecture is documented in `../design-foundry/PIVOT.md`.

This repo (`diagram-generator`) owns the single autolayout codebase in the workspace: `packages/layout-engine/` (TypeScript). When design-foundry's kernel is ready to receive it, the TS layout engine physically relocates there as `@design-foundry/operator-autolayout` wrapped in a thin adapter. Until then, all autolayout work happens here.

### TypeScript is the agreed implementation language

TypeScript is the standard for all new feature work. The rationale (from the design-foundry pivot) is **agent productivity** — agents produce better TS than Python, and the entire design-foundry kernel is TS. WASM (Rust/Zig) is the escape hatch for profiled hot paths, not Python.

**All new features, bug fixes, and refactors target the TypeScript engine first.** Python receives matching changes only when needed for batch/export correctness. Do not start new work in Python unless it is specifically about the YAML parser or batch SVG export.

### Python's role (narrowing)

Python is retained for three things:

1. **YAML parsing** — **Frame YAML on disk is authority.** `/api/frame-tree` JSON is a derived DTO from `frame-yaml-loader.ts` + `frame-serialize.ts` (via `emit-frame-diagram-json.mjs`), not a second source of truth. `frame_loader.py` is legacy fallback only.
2. **Batch SVG export** — `node packages/layout-engine/scripts/export-frame-svg.mjs --slug <name>` (TS layout + HarfBuzz + `svg-render.ts`). `diagram_render_svg.py` remains for batch callers until spec 012 T060b.
3. **Preview** — Live v3 SVG and layout API are TS-only (`preview_ts_export.py`, `preview_ts_layout.py`, `layout-bridge.js`). TS SVG failure → HTTP 404 + log (no Python SVG fallback; spec 012 T060a). Node CLIs resolve frames via `DG_FRAMES_DIR` in `packages/layout-engine/scripts/_dist-import.mjs`.
4. **Transitional parity oracle** — TS-only fixtures under spec 011 semantics; Python layout parity is not required for new measure work.

Python does NOT do: interactive relayout, text measurement, editor state, or any new feature development. **Do not add new layout or measure logic to Python** — parse/serialize passthrough for YAML fields is acceptable.

### Frame YAML editing rule

Before editing any file under `scripts/diagrams/frames/`, **read the current file from disk**. Apply minimal diffs for the requested change. Do not revert `direction`, `gap`, `padding`, or other layout fields the user may have saved via the preview editor. If the user may have unsaved UI edits, say so and ask them to Save first. Do not reconstruct a YAML from memory, git history, or assumptions — always start from the on-disk file.

### Figma autolayout fidelity (north star)

The TS layout engine targets a **faithful port of Figma autolayout semantics**. Spec: `specs/011-figma-autolayout-fidelity/`. Text-bearing frames default to `max_width_chars: 66` (Bringhurst measure); HUG boxes wrap at that measure and hug the resulting block. Deviations require an documented exception in spec 011 or `DIAGRAM.md`.

### Rules for ongoing work

- **TS-only for layout/measure features**: implement in `packages/layout-engine/` only. Python gets YAML field passthrough at most — no new measure logic.
- **TS-first**: legacy parity port to Python is optional and fading; do not block TS work on Python parity.
- Continue shipping features here — do NOT block on the design-foundry port.
- Do NOT migrate code to design-foundry yet. The target kernel operator interface is not ready.
- **No-double-work guarantee:** design-foundry will not build a parallel autolayout.
- Keep public function signatures of `packages/layout-engine/` stable when convenient — they are the de-facto port interface.
- Do NOT introduce persisted format identifiers that embed the package/repo name. Use short stable acronyms (e.g. `dg`).
- Cross-repo structural decisions belong in `AGENT-INBOX.md` for user review.

Everything below this section is the existing workflow contract for this repo.

---

## Source-of-truth precedence

1. Source sketches, reference assets, or explicitly referenced source material in `docs/specs.md`
2. `DIAGRAM.md`
3. `.github/copilot-instructions.md`
4. `STATUS.md` and `HISTORY.md`
5. `README.md` and `docs/specs.md`
6. `INBOX.md` and `AGENT-INBOX.md`
7. Local implementation details that are not clearly intentional or documented

## Repo-specific session additions

In addition to the standard agent-workflow-kit session protocol:

- Read `DIAGRAM.md` before any diagram or layout work.
- **Classify every request** through the anti-patch protocol below before starting implementation.
- Run the patch smell test before every implementation.
- After implementing, run ALL existing diagrams through the engine, not just the triggering one.
- Browser-verify UI work before claiming it works.

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
│ TS layout engine (measure + place — spatial truth)│
│   packages/layout-engine/src/layout.ts             │
│   Python parity: layout_v3.py (batch export only)  │
├─────────────────────────────────────────────────┤
│ layout-bridge.js (client-side relayout + patching)│
├─────────────────────────────────────────────────┤
│ diagram_render_svg.py (emit SVG from primitives)  │
│   ONLY converts engine decisions to markup         │
├─────────────────────────────────────────────────┤
│ preview_server.py (serve + frame tree API)        │
│   ONLY relays engine results to browser            │
├─────────────────────────────────────────────────┤
│ editor.js (interaction + display)                 │
│   NEVER invents layout facts                      │
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

## Validation

```bash
npm --prefix packages/layout-engine test                                          # TS (primary)
python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q  # Python parity
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
at specs/010-diagram-token-audit/plan.md
<!-- SPECKIT END -->
