# Tasks: Figma autolayout fidelity

**Prerequisites**: spec.md, plan.md

**Engine rule**: TypeScript only. Python receives parse/serialize passthrough only.

## Phase 1: Core measure contract

- [x] T001 Create spec 011 package
- [x] T010 Add `DEFAULT_MAX_WIDTH_CHARS`, `maxWidthChars` on Frame
- [x] T011 Implement `text-layout.ts` (defaults, wrap width resolution, char→px)
- [x] T012 Refactor `leafNaturalSize` to use wrap-at-chars + hug longest line
- [x] T013 Call `applyTextLayoutDefaults` at layout pipeline entry

## Phase 2: Preview wiring

- [x] T020 Deserialize/serialize `maxWidthChars` in layout-bridge + preview_server
- [x] T021 Inspector: show max_width_chars + pre-populated max_width for text frames
- [x] T022 Override keys + YAML persistence passthrough

## Phase 3: Tests and docs

- [x] T030 Layout tests: HUG short text, HUG long text wrap at 66ch
- [x] T031 HarfBuzz test: `maxWidthPxFromChars(66)` stable
- [x] T032 Update copilot-instructions, agent.md, STATUS.md, docs/specs.md
- [x] T033 Adversarial review (round 2 in latest session)

## Phase 4: Fixture maintenance

- [x] T040 Extract shared `parity-fixture-builder.ts`; regenerate parity fixtures under spec 011 semantics

## Phase 5: Follow-up fixes (2026-06-03)

- [x] T050 `NO_WRAP_MAX_WIDTH_CHARS` (0) opt-out; inspector uses HarfBuzz adapter
- [x] T051 FILL/FIXED min/max W and min/max H in spec + inspector split
- [x] T052 `heading-synthesis.ts` aligned with Python loader (vertical `__body`)
- [x] T053 TS batch export: `frame-yaml-loader.ts`, `svg-render.ts`, `export-frame-svg.mjs`
- [x] T054 Preview server prefers TS export for `v3:*.svg`
