# Research: heading + body layout region

## R1: Current `__heading` / `__body` synthesis

**Decision**: The synthesis in `frame_loader.py` lines 213–268 creates two synthetic children but the `__body` frame only copies `direction`, `gap`, `align`, and `justify`. It **does not** copy `wrap`, `sizing_w`, `sizing_h`, `fill_weight`, or any `padding_*` fields.

**Rationale**: The original code was written for simple vertical containers. The missing fields cause layout bugs when parents use `wrap: true`, non-default `fill_weight`, or per-side padding.

**Alternatives considered**: Fixing at the layout layer (layout_v3.py) was rejected – the synthesis is a parsing concern owned by `frame_loader.py`. Adding a post-processing pass was considered but would duplicate knowledge of which fields are layout-affecting.

## R2: Heading zone height calculation

**Decision**: The heading zone height must be `max(text_line_height, ICON_SIZE)` where `ICON_SIZE = 40`. Currently the `__heading` synthetic child sets `min_height=ICON_SIZE` but the layout engine's `_leaf_natural_size()` uses `INSET + ICON_SIZE + INSET = 64` as the minimum height for bordered boxes. Since `__heading` has `border=Border.NONE`, it falls through to a plain text height – the icon minimum only applies via `min_height`.

**Rationale**: The `min_height=ICON_SIZE` on the heading child is correct for ensuring the heading is at least icon-tall. The layout engine already respects `min_height` constraints in `_clamp_to_constraints()`. No change needed here.

**Alternatives considered**: Computing heading zone height in `layout_v3.py` was considered but would violate the "frame_loader owns structure" principle.

## R3: Fields that must be copied to `__body`

**Decision**: The full set of layout-affecting fields that `__body` must inherit from the parent:

| Field | Current state | Needed? |
|-------|--------------|---------|
| `direction` | ✅ Copied | Yes – body must preserve parent's child layout direction |
| `gap` | ✅ Copied | Yes – body uses same gap between its children |
| `align` | ✅ Copied | Yes – body alignment matches parent intent |
| `justify` | ✅ Copied (horizontal only) | Yes – both directions need it |
| `wrap` | ❌ Missing | Yes – body must wrap if parent wraps |
| `sizing_w` | ❌ Missing (hardcoded FILL) | Partially – body should be FILL width (spans parent), this is correct |
| `sizing_h` | ❌ Missing (hardcoded HUG) | Partially – body should be FILL height when parent uses FILL height, HUG otherwise |
| `fill_weight` | ❌ Missing | Yes – if parent has `fill_weight: 2`, body should inherit for correct fill distribution context |
| `padding_*` | ❌ Missing (hardcoded 0) | No – body padding should be 0; the parent owns the outer padding |

**Rationale**: `__body` is an internal layout wrapper. Its `sizing_w: FILL` and `padding: 0` are correct defaults – the body should fill the parent's content area and the parent's padding already provides the outer spacing. The missing fields are `wrap`, `justify` (for vertical case), and `fill_weight`.

**Alternatives considered**: Copying all fields blindly was rejected because some fields (like `padding`, `border`, `fill`) are intentionally different for the wrapper.

## R4: Heading position contract

**Decision**: The `__heading` child uses `align: TOP_LEFT` implicitly (it's the Frame default). The heading text appears at `(x + padding_left, y + padding_top)` via the renderer's `_frame_box()` function, which reads `prim.padding_left` and `prim.padding_top`. The icon appears at `(x + width - padding_right - ICON_SIZE, y + padding_top)`.

**Rationale**: This is already correctly implemented by the renderer at `diagram_render_svg.py` lines 255–262. No renderer changes needed.

## R5: Vertical vs horizontal parent handling

**Decision**: The current code has two branches:
- **Horizontal parent**: wraps children in `__body` with `direction=HORIZONTAL`, switches parent to `VERTICAL`. Copies `gap`, `align`, `justify`.
- **Vertical parent**: wraps children in `__body` with `direction=VERTICAL`. Copies `gap`, `align` but **not** `justify`.

Both branches are missing `wrap` and `fill_weight`. The vertical branch is also missing `justify`.

**Rationale**: Both branches should copy the same set of fields for consistency.

## R6: Regression risk assessment

**Decision**: 31 existing frame YAML files. Of these, the following use `heading:` and are directly affected:
- `android-security-comparison.yaml`
- `request-to-hardware-stack.yaml`
- `maas-architecture.yaml`
- `maas-machine-lifecycle.yaml`
- `android-container-vs-vm.yaml`
- `android-graphics-stack.yaml`
- `example-platform-architecture.yaml`
- Various test YAMLs with heading panels

**Rationale**: All diagrams must be rendered before and after to confirm no regressions. The heading-bearing diagrams should specifically show improved layout.
