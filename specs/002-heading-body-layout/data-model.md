# Data model: heading + body layout region

## Entities

### Frame (existing – `scripts/frame_model.py`)

The core layout node. No schema changes needed. All fields referenced by the synthesis are already present on `Frame`.

**Layout-affecting fields** (subset relevant to `__body` synthesis):

| Field | Type | Default | Role |
|-------|------|---------|------|
| `direction` | `Direction` | `VERTICAL` | Child layout direction |
| `gap` | `int` | 24 | Space between children |
| `align` | `Align` | `TOP_LEFT` | 9-point content alignment |
| `justify` | `Justify` | `PACKED` | Primary-axis distribution |
| `wrap` | `bool` | `False` | Wrap children to next row |
| `sizing_w` | `Sizing` | `HUG` | X-axis sizing mode |
| `sizing_h` | `Sizing` | `HUG` | Y-axis sizing mode |
| `fill_weight` | `float` | `1` | Proportional weight for FILL |
| `padding` | `int` | `8` | Uniform padding |
| `padding_top` | `int \| None` | `None` | Per-side override |
| `padding_right` | `int \| None` | `None` | Per-side override |
| `padding_bottom` | `int \| None` | `None` | Per-side override |
| `padding_left` | `int \| None` | `None` | Per-side override |

### Synthetic `__heading` child (created in `frame_loader._parse_frame()`)

| Field | Value | Rationale |
|-------|-------|-----------|
| `id` | `"{parent.id}__heading"` | Namespaced ID |
| `role` | `"heading"` | Identifies as heading for level classification |
| `sizing_w` | `FILL` | Spans full parent width |
| `sizing_h` | `HUG` | Wraps heading text height |
| `min_height` | `ICON_SIZE` (40) | Ensures icon doesn't overflow |
| `border` | `NONE` | Invisible wrapper |
| `fill` | Inherits parent fill (BLACK for highlight, WHITE otherwise) | Contrast for highlight variant |
| `padding` | `0` | Parent owns outer padding |
| `label` | `[heading_line]` | The heading text (bold 700) |
| `icon` | Parent's icon value | Moved from parent |
| `icon_fill` | Parent's icon_fill | Moved from parent |

### Synthetic `__body` child (created in `frame_loader._parse_frame()`)

**Current state** (incomplete):

| Field | Value | Bug? |
|-------|-------|------|
| `direction` | Copied from parent | ✅ |
| `gap` | Copied from parent | ✅ |
| `align` | Copied from parent | ✅ |
| `justify` | Copied (horizontal only) | ⚠️ Missing in vertical branch |
| `wrap` | Not copied (defaults to `False`) | ❌ |
| `fill_weight` | Not copied (defaults to `1`) | ❌ |
| `sizing_w` | Hardcoded `FILL` | ✅ Correct – body fills parent width |
| `sizing_h` | Hardcoded `HUG` | ✅ Correct for most cases |
| `padding` | Hardcoded `0` | ✅ Correct – parent owns padding |
| `border` | `NONE` | ✅ |

**Target state** (fixed):

| Field | Value | Change |
|-------|-------|--------|
| `direction` | Copied from parent | No change |
| `gap` | Copied from parent | No change |
| `align` | Copied from parent | No change |
| `justify` | Copied from parent (both branches) | **FIX**: add to vertical branch |
| `wrap` | Copied from parent | **FIX**: add to both branches |
| `fill_weight` | Copied from parent | **FIX**: add to both branches |
| `sizing_w` | `FILL` | No change |
| `sizing_h` | `HUG` | No change |
| `padding` | `0` | No change |
| `border` | `NONE` | No change |

## State transitions

No state machines in this feature. The synthesis is a one-shot transform during YAML parsing.

## Validation rules

1. `__body.wrap` must equal parent's `wrap` value at parse time
2. `__body.justify` must equal parent's `justify` value in both horizontal and vertical branches
3. `__body.fill_weight` must equal parent's `fill_weight` value
4. `__heading.sizing_w` must be `FILL` (spans full width)
5. `__heading.min_height` must be `ICON_SIZE` when parent has an icon
