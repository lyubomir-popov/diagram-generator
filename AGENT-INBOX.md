# Agent Inbox

Machine-generated handoffs, long diagnostics, and cross-repo follow-up notes go here.

Do not use this file for user notes. User-authored async notes belong in `INBOX.md`.

The agent should triage anything durable from this file into `TODO.md`, `STATUS.md`, `HISTORY.md`, or `docs/specs.md`, then empty this file back to this header template.

---

## Composer brief — spec 026 after spec 025 closeout

Spec 025 is complete on `main`. Do not reopen the save contract or preview-engine manifest work unless you hit a concrete defect.

Your target is **spec 026 T012** plus the smallest adjacent cleanup it unlocks:

1. Extract shared editor state helpers from `scripts/preview/editor.js` into a dedicated state container.
	- Scope: dirty snapshot state, undo/redo stacks, pending grid action, overrides/grid state accessors, and any tiny helpers that obviously belong with that state.
	- Keep DOM-heavy inspector/render/event code out of this slice.
2. Keep `editor.js` as a thin coordinator.
	- No opportunistic refactors.
	- No new engine-specific business logic branches.
3. Prefer TS-owned logic where the extracted code is non-trivial.
	- Thin JS bootstrap/event hookup is acceptable if the state container still needs to start in JS for now, but bias toward the spec 026 TS-first direction.
4. Add focused regression coverage for the extracted state boundary.
	- The tests should fail if dirty tracking / undo state / shared override state silently fall back into `editor.js`.

Guardrails:

- Do not rewrite `layout-bridge.js` in the same slice.
- Do not reopen spec 025 manifest/bootstrap decisions.
- Do not widen into spec 024 ELK node-alignment behavior.

Expected validation:

```bash
python -m pytest scripts/test_preview_elk_controller.py scripts/test_preview_save_client.py scripts/test_preview_engine_manifest.py scripts/test_preview_elk_layout_save.py scripts/test_frame_yaml_persistence.py scripts/test_elk_preview_qa.py scripts/test_preview_shell_bf_contract.py scripts/test_preview_force_api.py -q
npm --prefix packages/layout-engine test -- tests/preview-engine-registry.test.ts tests/force-runtime.test.ts
```
