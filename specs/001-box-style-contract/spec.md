# Feature Specification: Box style contract – two-tier model

**Feature Branch**: `feat/001-box-style-contract`

**Created**: 2026-05-28

**Status**: Draft

**Input**: Stabilise the inconsistent box styling across all diagrams by formalising a two-tier visual model in DIAGRAM.md, frame_loader.py, and the v3 renderer.

## User Scenarios & Testing

### User Story 1 – Sensible defaults from minimal YAML (Priority: P1)

A diagram author writes a frame YAML with containers and leaf nodes. Without specifying `fill`, `border`, or text weight, the engine produces correctly styled output: containers get grey fills with bold headings top-left, leaf boxes get 1px black outlines with regular-weight text top-left.

**Why this priority**: This is the foundational contract. Every other feature depends on the engine producing correct defaults without manual overrides.

**Independent Test**: Create a minimal YAML with one container holding two leaf children. Render it. Verify: container has grey background, no border, bold heading top-left; children have 1px black border, white/transparent fill, regular text top-left.

**Acceptance Scenarios**:

1. **Given** a container frame with `heading: "Panel"` and two leaf children with `label: [Item]`, **When** no `fill`, `border`, or text weight is specified, **Then** the container renders with `#F3F3F3` fill, no stroke, bold heading top-left; children render with 1px black stroke, transparent fill, regular text top-left.
2. **Given** a leaf frame with only `label: [CPU]`, **When** no styling is specified, **Then** it renders as an outlined box (1px black, transparent fill, regular weight).
3. **Given** a container that has no children but has `heading:`, **When** rendered, **Then** it still gets grey fill, no border, bold heading – it is not downgraded to a leaf style.

---

### User Story 2 – Highlight variant inverts any box (Priority: P1)

A diagram author applies `variant: highlight` to either a leaf or a container. The box becomes black-filled with white text and white icons, regardless of its tier.

**Why this priority**: Highlight is used in production diagrams (lt-diagram-generator) and must work consistently on both tiers.

**Independent Test**: Apply `variant: highlight` to a leaf box and a container. Verify both render with black fill, white text, white icon fill.

**Acceptance Scenarios**:

1. **Given** a leaf frame with `variant: highlight`, **When** rendered, **Then** fill is black, text is white, icon fill is `#FFFFFF`, border is none.
2. **Given** a container frame with `variant: highlight` and leaf children, **When** rendered, **Then** container fill is black, heading text is white; children inherit their own styling (not forced to highlight).

---

### User Story 3 – Text hierarchy within a single box (Priority: P2)

A diagram author writes a box with mixed text weights in its `label` – a bold title line followed by regular-weight body text. This is the "card" pattern used in support-engineering-flow.

**Why this priority**: Several production diagrams use text hierarchy inside leaves. The engine must render bold + regular lines correctly, with the bold line top-left.

**Independent Test**: Create a leaf box with `label: [{text: "Title", weight: "700"}, "", "Body paragraph text"]`. Verify: first line renders bold, remaining lines render regular weight, all text starts from top-left corner with INSET padding.

**Acceptance Scenarios**:

1. **Given** a leaf with mixed-weight label lines, **When** rendered, **Then** bold lines use weight 600–700, regular lines use weight 400, text starts at `(x + padding_left, y + padding_top)` – not centred.
2. **Given** a leaf with mixed-weight label and `fill: grey`, **When** rendered, **Then** it displays as a grey box with no border stroke, matching the "card" style.

---

### User Story 4 – Container heading + body layout region (Priority: P2)

A container with `heading:` has a clear two-zone layout: header zone (heading text top-left, icon top-right) and body zone (children below, with consistent gap/padding). The heading text is always bold and always in the top-left corner.

**Why this priority**: The request-to-hardware-stack diagram demonstrates this working. But the synthetic `__heading`/`__body` system loses fields and doesn't reliably position the heading top-left.

**Independent Test**: Render request-to-hardware-stack. Verify: each panel heading ("Orchestration layer", "Model runtime", etc.) appears bold, top-left, with its icon top-right; children appear in a body zone below with correct gap.

**Acceptance Scenarios**:

1. **Given** a container with `heading: "Panel"` and `icon: Cloud.svg`, **When** rendered, **Then** the heading text sits at top-left (padding_left from left edge, padding_top from top edge), the icon sits top-right (padding_right from right edge).
2. **Given** a container with children, **When** the heading zone is rendered, **Then** children start below the heading at `heading_height + gap`, not overlapping the heading.

---

### User Story 5 – Icons at both tiers (Priority: P3)

Both containers and leaf boxes can have icons. Icons always sit in the top-right corner of the box, with INSET padding from the edges.

**Why this priority**: The request-to-hardware-stack diagram uses icons on containers and on some leaves. Both must work identically in placement.

**Independent Test**: Create a container with `icon: Snap.svg` and a child leaf with `icon: Chip.svg`. Verify both icons render at top-right with correct padding.

**Acceptance Scenarios**:

1. **Given** any frame with `icon: <name>.svg`, **When** rendered, **Then** the icon is positioned at `(x + w - padding_right - ICON_SIZE, y + padding_top)`, sized `ICON_SIZE × ICON_SIZE`.

---

### Edge Cases

- What happens when a container has no heading and no children? → It should render as an empty grey box.
- What happens when `variant: highlight` is applied to an annotation (border: none, no fill)? → It should override to black fill, black stroke, white text.
- What happens when a leaf explicitly sets `fill: grey`? → It renders as a grey box with `stroke: #F3F3F3` (card style), matching the grey-box row in the allowed styles table.
- What happens when a container explicitly sets `border: solid`? → It renders with a solid border AND its fill (grey or explicit), overriding the default no-border container style.

## Requirements

### Functional Requirements

- **FR-001**: The engine MUST auto-detect leaf vs container based on presence of children and apply the correct default style without explicit YAML overrides.
- **FR-002**: The four allowed box styles (outlined, grey, annotation, highlight) MUST be the only styles the engine can produce. No other fill/border combinations are valid.
- **FR-003**: Text in all boxes MUST be positioned starting from top-left (padding_left, padding_top), never centred.
- **FR-004**: Every box MUST have a 1px stroke. Stroke colour matches fill for invisible borders (`#F3F3F3` for grey, `transparent` for annotations, `#000000` for highlight). This eliminates the `+1px` padding compensation hack – padding uses INSET (8px) uniformly everywhere.
- **FR-005**: The `variant` overlay system MUST apply correctly to both leaf and container frames.
- **FR-006**: Style resolution MUST happen in exactly one place (frame_loader.py defaults), not duplicated across loader and renderer.
- **FR-007**: The renderer MUST NOT invent styling decisions – it MUST only read the resolved style from the Frame object.

### Key Entities

- **Frame**: The recursive tree node. Has `fill`, `border`, `icon`, `label`, `heading`, `children`, `variant`, `padding_*`.
- **Fill**: Enum – `white`, `grey`, `black`.
- **Border**: Enum – `solid`, `none`, `dashed`, `fill`.
- **Variant**: String overlay – `highlight`, `annotation`. Applied after defaults, before rendering.

## Success Criteria

### Measurable Outcomes

- **SC-001**: All 20+ existing diagrams render without regression after the change.
- **SC-002**: request-to-hardware-stack renders identically to the current screenshot (the reference implementation).
- **SC-003**: A new minimal YAML with containers and leaves produces correct styling without any explicit `fill` or `border` fields.
- **SC-004**: No diagram YAML needs `fill: grey` on individual leaf boxes inside a grey container – the container fill provides the visual grouping.

## Assumptions

- The four box styles in DIAGRAM.md are complete and correct. No fifth style is needed.
- The INSET value (8px) is the canonical padding for all boxes. No box should use any other padding unless it has an explicit per-side override in YAML.
- The highlight variant is limited to at most one per diagram by convention, but the engine does not enforce this limit.
- Arrow styling and routing are out of scope for this feature (covered by feature 003).
- Existing diagram YAMLs may need configuration updates (covered by feature 004) after this contract is implemented.
