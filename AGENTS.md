# Agent instructions (diagram-generator)

Guidance for AI agents working in this repo. Goal: correct fixes with minimal token burn.

## Before you search or diff

1. **Read the flow map** for preview/persist work: [`specs/006-arrow-routing-redesign/preview-override-flow.md`](specs/006-arrow-routing-redesign/preview-override-flow.md)
2. **Keep the working tree focused.** Stash or commit unrelated edits (especially formatted frame YAML under `scripts/diagrams/frames/`) before asking an agent to review or diff. Large cosmetic YAML diffs waste context on every `git diff`.
3. **Run `npm run clean:src-artifacts`** if vitest or tsx seems to execute stale code from `packages/*/src/**/*.js` (accidental tsc emit shadows `.ts`).

## Frame override allowlists

Do not duplicate key lists. Single source:

`packages/layout-engine/src/preview-shell/frame-override-manifest.ts`

- `PERSIST_FRAME_KEYS` → YAML save (`frame-diagram.ts`)
- `RELAYOUT_FRAME_KEYS` → client relayout (`layout-bridge.js` via `LayoutEngine.filterRelayoutOverrideEntry`)
- `UNDO_RELAYOUT_FRAME_KEYS` → undo/redo relayout trigger (`editor.js` via `LayoutEngine.hasV3FrameOverride`)

## Repo search hygiene (token + reliability)

Prefer **narrow, scoped searches** over repo-wide scans.

| Do | Don't |
|----|--------|
| `rg pattern apps/preview/src` | `rg pattern` from repo root (slow on large trees) |
| `rg pattern scripts/preview/editor.js` | Chain `find … \| head` — use PowerShell-native limits (`Select-Object -First N`) on Windows |
| One targeted read after rg | Re-read the same 6k-line file in every sub-agent |
| Run the tests listed in the flow map | Launch 5 parallel “sweep” agents for a single-file bug |

**Windows note:** Agents often run in PowerShell, not bash. Commands like `head`, `cat <<'EOF'`, and `find` fail or behave differently. That causes retries, background timeouts, and extra terminal polling — which inflates token usage even though the OS does not charge “more per token.” **Linux/WSL is not inherently cheaper for LLM quota**, but bash-native one-liners fail less often, so agents finish in fewer tool rounds. Hybrid paths (`H:\` + WSL) can also slow `rg` on large trees.

## Scoped review (instead of full simo-sweep)

For localized preview/persist bugs:

1. Read the flow map section
2. Run the listed tests
3. At most **one** explore pass + **one** regression test if missing

Reserve multi-agent `/simo-sweep` for cross-cutting features (routing, ELK, new specs).

## After changing layout-engine browser surface

If you add exports used by `layout-bridge.js` or `editor.js`:

```bash
npm --prefix packages/layout-engine run build:browser
```

Preview loads `packages/layout-engine/dist/layout-engine.iife.js`, not TypeScript source.

## Commits

Do not commit unrelated frame fixture reformats or inbox notes unless the user asked for them.
