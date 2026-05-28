# Contract: `__heading` / `__body` synthesis

**Owner**: `scripts/frame_loader.py` → `_parse_frame()`

**Trigger**: A container frame (has children) with a `heading:` field in YAML.

## Pre-conditions

- `frame.is_container` is `True`
- `heading_line` is not `None` (parsed from `heading:` YAML field)

## Synthesis rules

### `__heading` child

```python
Frame(
    id=f"{frame.id}__heading",
    role="heading",
    sizing_w=Sizing.FILL,
    sizing_h=Sizing.HUG,
    min_height=ICON_SIZE,              # 40px – ensures icon fits
    border=Border.NONE,
    fill=heading_fill,                 # BLACK for highlight, WHITE otherwise
    padding=0,
    label=[heading_line],              # bold 700 text
    icon=parent_icon,                  # moved from parent
    icon_fill=heading_icon_fill,       # moved from parent
)
```

### `__body` child

For **both** horizontal and vertical parents:

```python
Frame(
    id=f"{frame.id}__body",
    direction=frame.direction,         # preserved from parent (horizontal branch keeps HORIZONTAL)
    gap=frame.gap,                     # preserved
    align=frame.align,                 # preserved
    justify=frame.justify,             # preserved (BOTH branches)
    wrap=frame.wrap,                   # NEW: preserved
    fill_weight=frame.fill_weight,     # NEW: preserved
    sizing_w=Sizing.FILL,              # body fills parent width
    sizing_h=Sizing.HUG,              # body hugs children height
    border=Border.NONE,
    padding=0,                         # parent owns outer padding
    children=list(frame.children),     # original children moved here
)
```

### Parent mutations

After synthesis:
1. `frame.children = [heading_child, body]`
2. `frame.icon = None` (moved to heading child)
3. If parent was `HORIZONTAL`: `frame.direction = VERTICAL` (heading stacks above body)

## Post-conditions

- `frame.children` has exactly 2 elements: `[__heading, __body]`
- `__heading.role == "heading"`
- `__body` contains all original children
- `__body.wrap == frame.wrap` (before mutation)
- `__body.justify == frame.justify` (before mutation)
- `__body.fill_weight == frame.fill_weight`
- `frame.icon is None`

## Heading zone layout contract

After measure/place in `layout_v3.py`:

- **Heading position**: text baseline at `(x + padding_left, y + padding_top + baseline_offset)`
- **Icon position**: `(x + width - padding_right - ICON_SIZE, y + padding_top)`
- **Body zone top**: `heading._placed_y + heading._placed_h + parent.gap`
- **Heading zone height**: determined by `max(_leaf_natural_size(__heading))` which accounts for `min_height=ICON_SIZE`

## Invariants

1. The renderer (`diagram_render_svg.py`) does not need changes – it already reads `padding_left`, `padding_top`, `padding_right` from the FrameBox primitive.
2. The style resolver (`resolve_styles()`) already handles `__heading` / `__body` wrappers via the `is_wrapper` check (`"__" in id`).
3. Level classification (`_classify_levels()`) already detects headings via `role == "heading"`.
