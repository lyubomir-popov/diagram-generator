# Feature Specification: Diagram audit – fix all existing YAMLs

**Feature Branch**: `feat/004-diagram-audit`

**Created**: 2026-05-28

**Status**: Draft – depends on feat/001-box-style-contract and feat/002-heading-body-layout

**Input**: Systematically review every YAML in `scripts/diagrams/frames/` and fix styling inconsistencies now that the engine's two-tier model and heading layout are correct.

## User Scenarios & Testing

### User Story 1 – Remove redundant explicit styling (Priority: P1)

With the two-tier defaults working correctly, many diagrams have manual `fill: grey` or `border: solid` overrides that are now unnecessary. Remove them so diagrams rely on the engine's defaults.

**Why this priority**: Redundant overrides mask future default changes and create maintenance burden.

**Independent Test**: For each modified YAML, render before and after. Visual output must be identical.

**Acceptance Scenarios**:

1. **Given** a container that has `fill: grey` and `border: none` explicitly, **When** both are removed, **Then** the engine's defaults produce identical output.
2. **Given** leaf boxes inside a container with `fill: grey` (to match the container), **When** `fill: grey` is removed from the leaves, **Then** they render as outlined boxes (correct tier).

---

### User Story 2 – Fix incorrect tier assignments (Priority: P1)

Some diagrams use the wrong tier: containers styled as leaves, or leaves styled as containers. Fix them to match the content's intent.

**Why this priority**: Incorrect tiers produce confusing visual hierarchy.

**Independent Test**: Render each fixed diagram and verify the visual hierarchy is correct.

**Acceptance Scenarios**:

1. **Given** support-engineering-flow with leaf boxes that have text hierarchy (bold title + body), **When** the boxes use `fill: grey` (card style), **Then** they render as grey boxes with no border, matching the grey-box row in the allowed styles table.
2. **Given** android-security-comparison with headings inside containers, **When** the container heading is positioned, **Then** it appears top-left (fixed by feat/002).

---

### User Story 3 – Consistent text hierarchy in cards (Priority: P2)

Boxes that use the "card" pattern (bold title line + regular body text) should all follow the same label format: `[{text: "Title", weight: "700"}, "", "Body text"]`.

**Why this priority**: Consistency across diagrams is the goal of this audit.

**Independent Test**: Search all YAMLs for mixed-weight labels. Verify they all use the same format.

**Acceptance Scenarios**:

1. **Given** any box with a bold title and regular body, **When** inspected, **Then** the label array uses `{text: ..., weight: "700"}` for the title line.

---

### Edge Cases

- Diagrams with intentional non-default overrides (e.g. `fill: "#666666"` for annotation text colour, `variant: highlight`) – these stay. Only overrides that duplicate the engine's level-based defaults are removed.
- `*-testcase.yaml` files (simple-testcase, complex-testcase) are production-like engine demos and are included in the audit. Unit test fixtures (`test-*.yaml`) are exempt.

## Requirements

### Functional Requirements

- **FR-001**: Every non-test YAML MUST render correctly with the new level-system defaults.
- **FR-002**: Redundant `fill` and `border` overrides MUST be removed where they match the engine's defaults.
- **FR-003**: US1 changes (redundant override removal) MUST produce pixel-identical output. US2 changes (tier-assignment fixes) may intentionally change output — document each such change.

## Success Criteria

- **SC-001**: All YAMLs pass `layout_frame_diagram()` without errors.
- **SC-002**: Browser verification of every diagram shows correct visual hierarchy.
- **SC-003**: YAMLs are shorter and cleaner – fewer explicit styling overrides.

## Assumptions

- Features 001, 002, and 003 are merged before this audit begins.
- This is configuration-only work – no engine code changes.
- Unit test YAMLs (`test-*.yaml`) are exempt from the audit. Production testcase YAMLs (`*-testcase.yaml`) are included.
