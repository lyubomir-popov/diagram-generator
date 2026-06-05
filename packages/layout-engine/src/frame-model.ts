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

// ---------------------------------------------------------------------------
// Text & appearance types (from diagram_model.py)
// ---------------------------------------------------------------------------

/** Single line of text inside a component. */
export interface Line {
  readonly content: string;
  readonly size?: string;       // default "18"
  readonly weight?: string;     // default "400"
  readonly fill?: string;       // default "#000000"
  readonly smallCaps?: boolean; // default false
  readonly letterSpacing?: string; // CSS-compatible SVG value, e.g. "0.05em"
  readonly lineStep?: number;   // override default line step
  readonly fontFamily?: string; // override (e.g. mono)
}

export function createLine(content: string, overrides?: Partial<Omit<Line, 'content'>>): Line {
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
} as const;

export type Fill = (typeof Fill)[keyof typeof Fill];

/** Visible border style for boxes and panels. */
export enum Border {
  SOLID = 'SOLID',
  NONE = 'NONE',
  DASHED = 'DASHED',
  FILL = 'FILL',
}

// ---------------------------------------------------------------------------
// Layout enums
// ---------------------------------------------------------------------------

export enum Direction {
  HORIZONTAL = 'HORIZONTAL',
  VERTICAL = 'VERTICAL',
}

export enum Sizing {
  HUG = 'HUG',
  FILL = 'FILL',
  FIXED = 'FIXED',
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
export enum Justify {
  PACKED = 'PACKED',
  SPACE_BETWEEN = 'SPACE_BETWEEN',
  SPACE_AROUND = 'SPACE_AROUND',
  SPACE_EVENLY = 'SPACE_EVENLY',
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
export enum Align {
  TOP_LEFT = 'TOP_LEFT',
  TOP_CENTER = 'TOP_CENTER',
  TOP_RIGHT = 'TOP_RIGHT',
  CENTER_LEFT = 'CENTER_LEFT',
  CENTER = 'CENTER',
  CENTER_RIGHT = 'CENTER_RIGHT',
  BOTTOM_LEFT = 'BOTTOM_LEFT',
  BOTTOM_CENTER = 'BOTTOM_CENTER',
  BOTTOM_RIGHT = 'BOTTOM_RIGHT',
}

// ---------------------------------------------------------------------------
// Arrow (connector between components)
// ---------------------------------------------------------------------------

export interface Arrow {
  source: string;
  target: string;
  id?: string;
  color?: string;                       // default "#E95420"
  waypoints?: [number, number][];
  /** Full orthogonal polyline from ELK (or other layout engine); bypasses box-edge inference. */
  layoutPath?: [number, number][];
  label?: Line[];
  labelGap?: number;
}

// ---------------------------------------------------------------------------
// Diagram overlay (dashed bounding-rect over a named group of frames)
// ---------------------------------------------------------------------------

export interface DiagramOverlay {
  id?: string;
  label?: string;
  members: string[];
}

export function createArrow(source: string, target: string, overrides?: Partial<Omit<Arrow, 'source' | 'target'>>): Arrow {
  return {
    source,
    target,
    color: '#E95420',
    waypoints: [],
    label: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Frame node
// ---------------------------------------------------------------------------

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

function emptyLayoutState(): LayoutState {
  return { measuredW: 0, measuredH: 0, placedX: 0, placedY: 0, placedW: 0, placedH: 0, resolvedW: undefined };
}

export interface FrameInit {
  id?: string;

  // Layout properties
  direction?: Direction;
  gap?: number;
  padding?: number;
  align?: Align;
  justify?: Justify;
  wrap?: boolean;

  // Per-axis sizing
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

  // Per-side padding
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;

  // Position within parent
  positionType?: PositionType;
  x?: number;
  y?: number;

  // Appearance
  fill?: Fill;
  border?: Border;
  heading?: Line;
  icon?: string;
  iconFill?: string;
  level?: number;

  // Resolved style snapshot (set by resolveStyles(), not by YAML)
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

  // Content (leaf)
  label?: Line[];
  role?: string;

  // Grid span (semantic — resolved to width at layout time)
  colSpan?: number;

  // Children (container)
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
export class Frame {
  readonly id: string;

  // Layout properties
  direction: Direction;
  gap: number;
  padding: number;
  align: Align;
  justify: Justify;
  wrap: boolean;

  // Per-axis sizing
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

  // Per-side padding (resolved from `padding` if not explicit)
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;

  // Position within parent
  positionType: PositionType;
  x: number;
  y: number;

  // Appearance
  fill: Fill;
  border: Border;
  heading: Line | undefined;
  icon: string | undefined;
  iconFill: string | undefined;
  level: number | undefined;

  // Resolved style snapshot (set by resolveStyles())
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

  // Content (leaf)
  label: Line[];
  role: string;

  // Grid column span — resolved to explicit width during layout (semantic field)
  colSpan: number | undefined;

  // Children (container)
  children: Frame[];

  // Computed during layout
  _layout: LayoutState;

  constructor(init?: FrameInit) {
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

  private _validateConstraints(): void {
    for (const attr of ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'] as const) {
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

  get isLeaf(): boolean {
    return this.children.length === 0;
  }

  get isContainer(): boolean {
    return this.children.length > 0;
  }
}

// ---------------------------------------------------------------------------
// Diagram root (Frame tree + arrows + metadata)
// ---------------------------------------------------------------------------

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

export class FrameDiagram {
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

  constructor(init?: FrameDiagramInit) {
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

// ---------------------------------------------------------------------------
// Coercion: enforce FILL/HUG invariant (Figma rule)
// ---------------------------------------------------------------------------

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
export function enforceFillHugInvariant(
  frame: Frame,
  coerced?: Map<string, CoercedOverride>,
): Map<string, CoercedOverride> {
  if (!coerced) coerced = new Map();

  for (const child of frame.children) {
    enforceFillHugInvariant(child, coerced);
  }

  if (frame.isLeaf) return coerced;

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
  } else {
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
