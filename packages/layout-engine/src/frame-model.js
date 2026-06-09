/**
 * Frame-based layout model — TypeScript port of frame_model.py + diagram_model.py types.
 *
 * A diagram is a tree of Frames. Each Frame is an auto-layout container
 * (like Figma's auto-layout) that positions its children sequentially with
 * a consistent gap between their rendered edges.
 *
 * Layout is a three-pass tree walk:
 *   1. Measure (bottom-up): compute each node's natural size from content.
 *   2. Coerce: enforce FILL/HUG invariant (Figma rule).
 *   3. Place (top-down): distribute space to children, assign positions.
 */
export function createLine(content, overrides) {
    return {
        content,
        size: '18',
        weight: '400',
        fill: '#000000',
        smallCaps: false,
        letterSpacing: undefined,
        ...overrides,
    };
}
/** Background fill color. */
export const Fill = {
    WHITE: '#FFFFFF',
    GREY: '#F3F3F3',
    BLACK: '#000000',
};
/** Visible border style for boxes and panels. */
export var Border;
(function (Border) {
    Border["SOLID"] = "SOLID";
    Border["NONE"] = "NONE";
    Border["DASHED"] = "DASHED";
    Border["FILL"] = "FILL";
})(Border || (Border = {}));
// ---------------------------------------------------------------------------
// Layout enums
// ---------------------------------------------------------------------------
export var Direction;
(function (Direction) {
    Direction["HORIZONTAL"] = "HORIZONTAL";
    Direction["VERTICAL"] = "VERTICAL";
})(Direction || (Direction = {}));
export var Sizing;
(function (Sizing) {
    Sizing["HUG"] = "HUG";
    Sizing["FILL"] = "FILL";
    Sizing["FIXED"] = "FIXED";
})(Sizing || (Sizing = {}));
/**
 * Primary-axis distribution mode (Figma justify / CSS justify-content).
 *
 * PACKED (default): children are placed sequentially with `gap` between
 * them, then the group is positioned by `align`.
 *
 * SPACE_BETWEEN: first child flush to start, last flush to end,
 * remaining space divided equally between children. `gap` is ignored.
 *
 * SPACE_AROUND: equal space around each child (half-space at edges).
 * `gap` is ignored.
 *
 * SPACE_EVENLY: equal space between children AND at start/end.
 * `gap` is ignored.
 */
export var Justify;
(function (Justify) {
    Justify["PACKED"] = "PACKED";
    Justify["SPACE_BETWEEN"] = "SPACE_BETWEEN";
    Justify["SPACE_AROUND"] = "SPACE_AROUND";
    Justify["SPACE_EVENLY"] = "SPACE_EVENLY";
})(Justify || (Justify = {}));
/**
 * Content alignment within a frame (Figma 9-point model).
 * Combines main-axis and cross-axis positions.
 */
export var Align;
(function (Align) {
    Align["TOP_LEFT"] = "TOP_LEFT";
    Align["TOP_CENTER"] = "TOP_CENTER";
    Align["TOP_RIGHT"] = "TOP_RIGHT";
    Align["CENTER_LEFT"] = "CENTER_LEFT";
    Align["CENTER"] = "CENTER";
    Align["CENTER_RIGHT"] = "CENTER_RIGHT";
    Align["BOTTOM_LEFT"] = "BOTTOM_LEFT";
    Align["BOTTOM_CENTER"] = "BOTTOM_CENTER";
    Align["BOTTOM_RIGHT"] = "BOTTOM_RIGHT";
})(Align || (Align = {}));
export function createArrow(source, target, overrides) {
    return {
        source,
        target,
        color: '#E95420',
        waypoints: [],
        label: [],
        ...overrides,
    };
}
function emptyLayoutState() {
    return { measuredW: 0, measuredH: 0, placedX: 0, placedY: 0, placedW: 0, placedH: 0, resolvedW: undefined };
}
/**
 * A layout node — either a container (has children) or a leaf (has label).
 *
 * Sizing is per-axis (Figma model):
 *   - sizingW: how this node sizes on the X axis
 *   - sizingH: how this node sizes on the Y axis
 *
 * The parent's direction determines which axis is "primary" (along layout
 * flow) and which is "counter" (cross-axis):
 *   - HORIZONTAL: primary=W, counter=H
 *   - VERTICAL:   primary=H, counter=W
 *
 * Padding: `padding` sets all four sides uniformly. Per-side overrides
 * (paddingTop/Right/Bottom/Left) take priority when explicitly provided.
 */
export class Frame {
    id;
    // Layout properties
    direction;
    gap;
    padding;
    align;
    justify;
    wrap;
    // Per-axis sizing
    sizingW;
    sizingH;
    fillWeight;
    width;
    height;
    minWidth;
    maxWidth;
    maxWidthChars;
    minHeight;
    maxHeight;
    // Per-side padding (resolved from `padding` if not explicit)
    paddingTop;
    paddingRight;
    paddingBottom;
    paddingLeft;
    // Position within parent
    positionType;
    x;
    y;
    // Appearance
    fill;
    border;
    heading;
    icon;
    iconFill;
    level;
    // Resolved style snapshot (set by resolveStyles())
    resolvedFill;
    resolvedStroke;
    resolvedStrokeWidth;
    resolvedTextFill;
    resolvedIconFill;
    resolvedHeadingWeight;
    resolvedHeadingSmallCaps;
    resolvedHeadingLetterSpacing;
    resolvedLeafLeadWeight;
    resolvedLeafLeadSmallCaps;
    resolvedLeafLeadLetterSpacing;
    // Content (leaf)
    label;
    role;
    // Grid column span — resolved to explicit width during layout (semantic field)
    colSpan;
    // Children (container)
    children;
    // Computed during layout
    _layout;
    constructor(init) {
        this.id = init?.id ?? '';
        this.direction = init?.direction ?? Direction.VERTICAL;
        this.gap = init?.gap ?? 24;
        this.padding = init?.padding ?? 8;
        this.align = init?.align ?? Align.TOP_LEFT;
        this.justify = init?.justify ?? Justify.PACKED;
        this.wrap = init?.wrap ?? false;
        this.sizingW = init?.sizingW ?? Sizing.HUG;
        this.sizingH = init?.sizingH ?? Sizing.HUG;
        this.fillWeight = init?.fillWeight ?? 1;
        this.width = init?.width;
        this.height = init?.height;
        this.minWidth = init?.minWidth;
        this.maxWidth = init?.maxWidth;
        this.maxWidthChars = init?.maxWidthChars;
        this.minHeight = init?.minHeight;
        this.maxHeight = init?.maxHeight;
        // Per-side padding: explicit values take priority, otherwise inherit from uniform padding
        this.paddingTop = init?.paddingTop ?? this.padding;
        this.paddingRight = init?.paddingRight ?? this.padding;
        this.paddingBottom = init?.paddingBottom ?? this.padding;
        this.paddingLeft = init?.paddingLeft ?? this.padding;
        this.positionType = init?.positionType ?? 'AUTO';
        this.x = init?.x ?? 0;
        this.y = init?.y ?? 0;
        this.fill = init?.fill ?? Fill.WHITE;
        this.border = init?.border ?? Border.SOLID;
        this.heading = init?.heading;
        this.icon = init?.icon;
        this.iconFill = init?.iconFill;
        this.level = init?.level;
        this.resolvedFill = init?.resolvedFill;
        this.resolvedStroke = init?.resolvedStroke;
        this.resolvedStrokeWidth = init?.resolvedStrokeWidth;
        this.resolvedTextFill = init?.resolvedTextFill;
        this.resolvedIconFill = init?.resolvedIconFill;
        this.resolvedHeadingWeight = init?.resolvedHeadingWeight;
        this.resolvedHeadingSmallCaps = init?.resolvedHeadingSmallCaps;
        this.resolvedHeadingLetterSpacing = init?.resolvedHeadingLetterSpacing;
        this.resolvedLeafLeadWeight = init?.resolvedLeafLeadWeight;
        this.resolvedLeafLeadSmallCaps = init?.resolvedLeafLeadSmallCaps;
        this.resolvedLeafLeadLetterSpacing = init?.resolvedLeafLeadLetterSpacing;
        this.label = init?.label ?? [];
        this.role = init?.role ?? '';
        this.colSpan = init?.colSpan;
        this.children = init?.children ?? [];
        this._layout = emptyLayoutState();
        // Validate constraints
        this._validateConstraints();
    }
    _validateConstraints() {
        for (const attr of ['minWidth', 'maxWidth', 'minHeight', 'maxHeight']) {
            const v = this[attr];
            if (v !== undefined && v < 0) {
                throw new Error(`${attr} cannot be negative, got ${v}`);
            }
        }
        if (this.minWidth !== undefined && this.maxWidth !== undefined && this.minWidth > this.maxWidth) {
            throw new Error(`minWidth (${this.minWidth}) > maxWidth (${this.maxWidth})`);
        }
        if (this.minHeight !== undefined && this.maxHeight !== undefined && this.minHeight > this.maxHeight) {
            throw new Error(`minHeight (${this.minHeight}) > maxHeight (${this.maxHeight})`);
        }
    }
    get isLeaf() {
        return this.children.length === 0;
    }
    get isContainer() {
        return this.children.length > 0;
    }
}
export class FrameDiagram {
    title;
    root;
    arrows;
    overlays;
    gridCols;
    gridColGap;
    gridRowGap;
    gridOuterMargin;
    layoutEngine;
    diagramType;
    sourceImage;
    elkLayout;
    constructor(init) {
        this.title = init?.title ?? '';
        this.root = init?.root ?? new Frame();
        this.arrows = init?.arrows ?? [];
        this.overlays = init?.overlays ?? [];
        this.gridCols = init?.gridCols ?? 2;
        this.gridColGap = init?.gridColGap;
        this.gridRowGap = init?.gridRowGap;
        this.gridOuterMargin = init?.gridOuterMargin;
        this.layoutEngine = init?.layoutEngine;
        this.diagramType = init?.diagramType;
        this.sourceImage = init?.sourceImage;
        this.elkLayout = init?.elkLayout;
    }
}
/**
 * Figma rule (per-axis): if a HUG parent has ANY child that is FILL on
 * the primary layout axis, the parent is coerced to FIXED on that axis,
 * freezing at its measured size.
 *
 * Cross-axis FILL is NOT coerced: even when the parent is HUG on the
 * cross axis, the cross size equals the tallest child's measured extent,
 * and shorter FILL children stretch to match.
 *
 * Recurses bottom-up so inner containers are resolved before parents.
 * The semantic Frame tree stays unchanged; callers consume the returned
 * override map as runtime coercion state for the current layout pass.
 *
 * @returns Map of coerced frame IDs → override values.
 */
export function enforceFillHugInvariant(frame, coerced) {
    if (!coerced)
        coerced = new Map();
    for (const child of frame.children) {
        enforceFillHugInvariant(child, coerced);
    }
    if (frame.isLeaf)
        return coerced;
    if (frame.direction === Direction.HORIZONTAL) {
        // Primary axis is W
        if (frame.sizingW === Sizing.HUG) {
            if (frame.children.some(c => c.sizingW === Sizing.FILL)) {
                if (frame.id) {
                    const existing = coerced.get(frame.id) ?? {};
                    existing.sizingW = 'FIXED';
                    existing.width = Math.round(frame._layout.measuredW);
                    coerced.set(frame.id, existing);
                }
            }
        }
    }
    else {
        // Primary axis is H (VERTICAL)
        if (frame.sizingH === Sizing.HUG) {
            if (frame.children.some(c => c.sizingH === Sizing.FILL)) {
                if (frame.id) {
                    const existing = coerced.get(frame.id) ?? {};
                    existing.sizingH = 'FIXED';
                    existing.height = Math.round(frame._layout.measuredH);
                    coerced.set(frame.id, existing);
                }
            }
        }
    }
    return coerced;
}
//# sourceMappingURL=frame-model.js.map