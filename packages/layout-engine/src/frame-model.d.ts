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
/** Single line of text inside a component. */
export interface Line {
    readonly content: string;
    readonly size?: string;
    readonly weight?: string;
    readonly fill?: string;
    readonly smallCaps?: boolean;
    readonly letterSpacing?: string;
    readonly lineStep?: number;
    readonly fontFamily?: string;
}
export declare function createLine(content: string, overrides?: Partial<Omit<Line, 'content'>>): Line;
/** Background fill color. */
export declare const Fill: {
    readonly WHITE: "#FFFFFF";
    readonly GREY: "#F3F3F3";
    readonly BLACK: "#000000";
};
export type Fill = (typeof Fill)[keyof typeof Fill];
/** Visible border style for boxes and panels. */
export declare enum Border {
    SOLID = "SOLID",
    NONE = "NONE",
    DASHED = "DASHED",
    FILL = "FILL"
}
export declare enum Direction {
    HORIZONTAL = "HORIZONTAL",
    VERTICAL = "VERTICAL"
}
export declare enum Sizing {
    HUG = "HUG",
    FILL = "FILL",
    FIXED = "FIXED"
}
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
export declare enum Justify {
    PACKED = "PACKED",
    SPACE_BETWEEN = "SPACE_BETWEEN",
    SPACE_AROUND = "SPACE_AROUND",
    SPACE_EVENLY = "SPACE_EVENLY"
}
/**
 * Position type within parent auto-layout.
 * AUTO (default): child participates in flow layout.
 * ABSOLUTE: child is excluded from flow and placed at explicit x/y
 * offsets relative to the parent's content area (Figma's "Ignore auto layout").
 */
export type PositionType = 'AUTO' | 'ABSOLUTE';
/**
 * Content alignment within a frame (Figma 9-point model).
 * Combines main-axis and cross-axis positions.
 */
export declare enum Align {
    TOP_LEFT = "TOP_LEFT",
    TOP_CENTER = "TOP_CENTER",
    TOP_RIGHT = "TOP_RIGHT",
    CENTER_LEFT = "CENTER_LEFT",
    CENTER = "CENTER",
    CENTER_RIGHT = "CENTER_RIGHT",
    BOTTOM_LEFT = "BOTTOM_LEFT",
    BOTTOM_CENTER = "BOTTOM_CENTER",
    BOTTOM_RIGHT = "BOTTOM_RIGHT"
}
export interface Arrow {
    source: string;
    target: string;
    id?: string;
    color?: string;
    waypoints?: [number, number][];
    /** Full orthogonal polyline from ELK (or other layout engine); bypasses box-edge inference. */
    layoutPath?: [number, number][];
    /** ELK-placed edge label geometry (absolute canvas coordinates). */
    elkLabels?: {
        text: string;
        x: number;
        y: number;
        width: number;
        height: number;
    }[];
    label?: Line[];
    labelGap?: number;
}
export interface DiagramOverlay {
    id?: string;
    label?: string;
    members: string[];
}
export declare function createArrow(source: string, target: string, overrides?: Partial<Omit<Arrow, 'source' | 'target'>>): Arrow;
/**
 * Mutable layout state computed during measure/place passes.
 * Separated from the frame definition to keep the distinction clear.
 */
export interface LayoutState {
    measuredW: number;
    measuredH: number;
    placedX: number;
    placedY: number;
    placedW: number;
    placedH: number;
    /** Resolved width from the constrained-remeasure pass. Used for heading wrapping. */
    resolvedW: number | undefined;
}
export interface FrameInit {
    id?: string;
    direction?: Direction;
    gap?: number;
    padding?: number;
    align?: Align;
    justify?: Justify;
    wrap?: boolean;
    sizingW?: Sizing;
    sizingH?: Sizing;
    fillWeight?: number;
    width?: number;
    height?: number;
    minWidth?: number;
    maxWidth?: number;
    maxWidthChars?: number;
    minHeight?: number;
    maxHeight?: number;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    positionType?: PositionType;
    x?: number;
    y?: number;
    fill?: Fill;
    border?: Border;
    heading?: Line;
    icon?: string;
    iconFill?: string;
    level?: number;
    resolvedFill?: string;
    resolvedStroke?: string;
    resolvedStrokeWidth?: number;
    resolvedTextFill?: string;
    resolvedIconFill?: string;
    resolvedHeadingWeight?: string;
    resolvedHeadingSmallCaps?: boolean;
    resolvedHeadingLetterSpacing?: string;
    resolvedLeafLeadWeight?: string;
    resolvedLeafLeadSmallCaps?: boolean;
    resolvedLeafLeadLetterSpacing?: string;
    label?: Line[];
    role?: string;
    colSpan?: number;
    children?: Frame[];
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
export declare class Frame {
    readonly id: string;
    direction: Direction;
    gap: number;
    padding: number;
    align: Align;
    justify: Justify;
    wrap: boolean;
    sizingW: Sizing;
    sizingH: Sizing;
    fillWeight: number;
    width: number | undefined;
    height: number | undefined;
    minWidth: number | undefined;
    maxWidth: number | undefined;
    maxWidthChars: number | undefined;
    minHeight: number | undefined;
    maxHeight: number | undefined;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
    positionType: PositionType;
    x: number;
    y: number;
    fill: Fill;
    border: Border;
    heading: Line | undefined;
    icon: string | undefined;
    iconFill: string | undefined;
    level: number | undefined;
    resolvedFill: string | undefined;
    resolvedStroke: string | undefined;
    resolvedStrokeWidth: number | undefined;
    resolvedTextFill: string | undefined;
    resolvedIconFill: string | undefined;
    resolvedHeadingWeight: string | undefined;
    resolvedHeadingSmallCaps: boolean | undefined;
    resolvedHeadingLetterSpacing: string | undefined;
    resolvedLeafLeadWeight: string | undefined;
    resolvedLeafLeadSmallCaps: boolean | undefined;
    resolvedLeafLeadLetterSpacing: string | undefined;
    label: Line[];
    role: string;
    colSpan: number | undefined;
    children: Frame[];
    _layout: LayoutState;
    constructor(init?: FrameInit);
    private _validateConstraints;
    get isLeaf(): boolean;
    get isContainer(): boolean;
}
export interface FrameDiagramInit {
    title?: string;
    root?: Frame;
    arrows?: Arrow[];
    overlays?: DiagramOverlay[];
    gridCols?: number;
    gridColGap?: number;
    gridRowGap?: number;
    gridOuterMargin?: number;
    layoutEngine?: string;
    diagramType?: string;
    sourceImage?: string;
    /** ELK option overrides from YAML meta.elk */
    elkLayout?: Record<string, string>;
}
export declare class FrameDiagram {
    title: string;
    root: Frame;
    arrows: Arrow[];
    overlays: DiagramOverlay[];
    gridCols: number;
    gridColGap: number | undefined;
    gridRowGap: number | undefined;
    gridOuterMargin: number | undefined;
    layoutEngine?: string;
    diagramType?: string;
    sourceImage?: string;
    elkLayout?: Record<string, string>;
    constructor(init?: FrameDiagramInit);
}
export interface CoercedOverride {
    sizingW?: 'FIXED';
    sizingH?: 'FIXED';
    width?: number;
    height?: number;
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
export declare function enforceFillHugInvariant(frame: Frame, coerced?: Map<string, CoercedOverride>): Map<string, CoercedOverride>;
//# sourceMappingURL=frame-model.d.ts.map