# Adversarial review — Spec 035 (Compatible engine switcher), post-merge to `main`

**Reviewer:** Cline (adversarial pass #2, post-merge)
**Date:** 2026-06-09
**HEAD reviewed:** `b4546ba` (`main` == `feat/035-compatible-engine-switcher`)
**035 commits in scope:** `548bb4b` (Phase 1 contract + persistence guard), `b4546ba` (docs/handoff)

## Verdict

**The spec was merged to `main` in a Phase-1-only state and the headline feature still
does not exist.** What landed is the typed compatibility contract and a `meta.layout_engine`
persistence primitive — both green under test — but there is **no switcher UI, no rerender
path, and the compatibility API has zero non-test callers.** The spec's own Status field is
still `Draft` (spec.md:9) and tasks T010–T022 are unchecked, yet the branch is now `main`.

The "ChatGPT finished" claim is contradicted by the tree: a compiled Phase-2 switcher model
(`apps/preview/dist/preview-engine-switcher.js`) exists locally with **no source file behind
it**, is **not imported anywhere**, lives in a **git-ignored `dist/`**, and is coded against a
document shape the server never produces. The Phase-2 work was, at best, half-written, never
wired, and never actually committed to `main`.

## Findings

| Severity | Area | Finding | Evidence | Recommended fix |
|----------|------|---------|----------|-----------------|
| **P1** | Scope / process | Incomplete spec merged to `main`. Phase 2 (T010–T012 switcher UI + rerender) and Phase 3 (T020–T022 round-trip/docs/closeout) are unimplemented. FR-003, FR-004, Mission, User Stories 1 & 2 are unmet. There is no dropdown, no UI, no rerender. | `tasks.md:30-37` all `[ ]`; `spec.md:9` Status `Draft`; `git log` shows `main`==`feat/035-...` @ `b4546ba` | Either revert 035 off `main` until the feature lands, or explicitly relabel as "035-phase1 (contract only)" and open 035b for the switcher. Do not let `Draft` specs ride `main` silently. |
| **P1** | Dead code | The compatibility API is unreachable in product. `evaluatePreviewEngineCompatibility`, `isPreviewEngineCompatible`, `listCompatiblePreviewEngines`, `listPreviewEnginesWithCompatibility` have **zero callers** outside `preview-engine-registry.test.ts`. `server.ts` still resolves engines only via `resolvePreviewEngine(...)`. FR-002/FR-003 "typed compatibility" exists only as exported, untested-in-prod functions. | grep: the four fns appear only in `registry.ts` (defs), `index.ts` (re-exports), and the test file | Wire into `buildGridViewerHtml`/shell in Phase 2, or the contract stays decorative. |
| **P1** | Provenance | Orphaned Phase-2 artifact with no source. `apps/preview/dist/preview-engine-switcher.js` implements `buildPreviewEngineSwitcherModel`, `compatiblePreviewEngines`, `resolveActivePreviewEngine`, `previewEngineContextFromDocument` — but there is **no `apps/preview/src/preview-engine-switcher.ts`** (src has only `server.ts` + `persistence/*`). `dist/` is git-ignored (0 tracked files), so none of it is on `main`. It is also unimported. | `Test-Path dist/preview-engine-switcher.js` → True; `git ls-files apps/preview/dist` → 0; src listing has no switcher | Delete the stale dist artifact, OR recover the lost source into `apps/preview/src/` and actually wire + test it. As-is it is misleading evidence of a feature that isn't there. |
| **P2** | Correctness | Persistence write-guard does **not** use the compatibility contract; it can persist cross-document-kind engines. `/api/overrides/{slug}` validates only via `normalizeLayoutEngine`/`hostableGridLayoutKeys` = `{elk-layered, sequence}`. So `layout_engine: "sequence"` is **accepted onto a `frame-diagram`** doc; on reload `resolvePreviewEngine` returns the sequence engine for a non-sequence doc. FR-003 / Success Criterion 2 ("filters by typed compatibility") is not enforced at the only enforcement point that exists. | `server.ts:315-319, 804-816`; `registry.ts` sequence has `layoutEngineKey:'sequence'`, `shellMode:'grid'` | Gate the write with `evaluatePreviewEngineCompatibility(engine, {previewDocumentKind, shellMode})` using the doc's actual kind, not just "is it a hostable grid key". |
| **P2** | Architecture gap | grid↔force shell boundary blocks the core "compare engines" story. `server.ts` hardcodes `shellMode:"grid"` for frame YAML and `evaluatePreviewEngineCompatibility` hard-gates on `shellMode`, so the `force` lane can never surface in a grid switcher. User Story 1 has no path across the boundary; the orphan Phase-2 model inherits the same limitation. Undocumented. | `server.ts:563,609,696,702,726`; `registry.ts:136-142` | Decide explicitly: either model "force" as a compatible alternative (cross-mode switch + navigation) or document it as out of scope in the spec Non-Goals. |
| **P3** | Permissive predicate | `requiredLayoutEngineKey` only fails when `context.layoutEngine` is non-empty AND mismatched. For the common empty-`layout_engine` doc, an engine that *requires* a key is still reported compatible — document-kind is the only real gate, making the key near-decorative. | `registry.ts:158-165` | Acceptable as documented "offer filter," but the comment overstates its strictness; tighten or note in tests. |
| **P3** | Test quality | No persist→reload→resolve round-trip test (T020). Persistence tests prove the YAML *write* only; one even round-trips a bogus `vertical-stack`. Registry tests over-fit to array order/index and author-written description substrings rather than user-observable switcher behavior. Green ≠ feature-covered. | `frame-diagram.test.ts` (write-only); `preview-engine-registry.test.ts:135-158` | Add a real round-trip + an incompatible-hidden test against the real registry (was deferred to the non-existent Phase 2). |
| **P3** | Bookkeeping | AGENT-INBOX.md still carries the **prior** un-triaged Phase-1 review; its own header says triage into TODO/STATUS/HISTORY then empty. The merge commit "add Phase 2 handoff note" left it un-drained. Inbox claims "registry 13/13" but the suite is **11 tests**. | `AGENT-INBOX.md:11-79`; verified run = 11 | Triage the inbox; correct the test count. |

## What I verified (commands + result)

- `packages/layout-engine` → `npx vitest run tests/preview-engine-registry.test.ts` → **11 passed / 0 failed** (inbox said 13).
- `apps/preview` → `npm test` (node --test via tsx) → **11 passed / 0 failed** (4 are the spec-035 `layout_engine` cases).
- `git ls-files apps/preview/dist` → **0** (dist is build output, not tracked).
- `Test-Path apps/preview/dist/preview-engine-switcher.js` → **True**; no `apps/preview/src/preview-engine-switcher.ts` exists.
- grep across repo: the four compatibility helpers have **no callers** outside the registry test; `server.ts` uses only `resolvePreviewEngine` + the local `normalizeLayoutEngine`/`hostableGridLayoutKeys` guard.
- `git log` confirms `main` == `feat/035-compatible-engine-switcher` @ `b4546ba`; `spec.md` Status = `Draft`.

## Top 3 risks

1. **A `Draft`, one-third-complete spec is sitting on `main` while presenting as merged work.** The feature users were promised (compatibility-aware switcher) is absent; only plumbing shipped.
2. **The compatibility contract and the persistence guard don't talk to each other**, so the one live write path can persist an engine that is incompatible with the document's kind (`sequence` onto a `frame-diagram`). This is shippable-but-wrong behavior, not just missing UI.
3. **Lost/half-finished Phase-2 work masquerading as done** — a compiled switcher model with no source, no wiring, and coded against a non-existent `allowedEngineIds` document field. Anyone trusting the dist artifact will assume the feature exists.

## Open questions for the author

- Was merging Phase 1 to `main` intentional (contract-only landing), or did the Phase-2 switcher source get dropped during the "ChatGPT finished" step? The dist artifact implies source existed and was lost.
- Is grid↔force switching in scope for 035, or should the spec's Non-Goals say it isn't?
- Should the `/api/overrides` guard enforce full document-kind compatibility now (P2 above), or is that deliberately deferred with the doc-kind unknown at the write boundary?

## Recommended minimal next steps (TS-first, no rewrite)

1. Recover or rebuild `apps/preview/src/preview-engine-switcher.ts`, wire `buildPreviewEngineSwitcherModel` into `buildGridViewerHtml`, render the dropdown, and rerender via `resolvePreviewEngine` (T010/T011).
2. Replace the hostable-key write guard with `evaluatePreviewEngineCompatibility` keyed on the document's real `previewDocumentKind` (closes the cross-kind hole).
3. Add the persist→reload→resolve round-trip test and the incompatible-hidden test (T012/T020).
4. Delete the stale `dist/preview-engine-switcher.js`; drain AGENT-INBOX; fix the "13/13"→"11/11" note.
