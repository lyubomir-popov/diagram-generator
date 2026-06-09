/**
 * Shared frame YAML record → Frame parser used by the loader and diagram-author lowering.
 */
import { Frame, Direction, Sizing, Align, Border, Fill, Justify, createLine, } from './frame-model.js';
import { INSET } from './tokens.js';
import { applyHeadingAsChild, deriveContentGap } from './heading-synthesis.js';
const DIRECTION = {
    vertical: Direction.VERTICAL,
    horizontal: Direction.HORIZONTAL,
};
const SIZING = {
    hug: Sizing.HUG,
    fill: Sizing.FILL,
    fixed: Sizing.FIXED,
};
const FILL = {
    white: Fill.WHITE,
    grey: Fill.GREY,
    black: Fill.BLACK,
};
const BORDER = {
    solid: Border.SOLID,
    none: Border.NONE,
    dashed: Border.DASHED,
    dotted: Border.DASHED,
    fill: Border.FILL,
};
const ALIGN = {
    'top-left': Align.TOP_LEFT,
    'top-center': Align.TOP_CENTER,
    'top-right': Align.TOP_RIGHT,
    'center-left': Align.CENTER_LEFT,
    center: Align.CENTER,
    'center-right': Align.CENTER_RIGHT,
    'bottom-left': Align.BOTTOM_LEFT,
    'bottom-center': Align.BOTTOM_CENTER,
    'bottom-right': Align.BOTTOM_RIGHT,
};
const JUSTIFY = {
    packed: Justify.PACKED,
    'space-between': Justify.SPACE_BETWEEN,
    'space-around': Justify.SPACE_AROUND,
    'space-evenly': Justify.SPACE_EVENLY,
};
const VARIANT_OVERLAYS = {
    highlight: { fill: 'black', icon_fill: '#FFFFFF' },
    annotation: { border: 'none' },
};
function parseLine(raw) {
    if (typeof raw === 'string')
        return createLine(raw);
    if (raw && typeof raw === 'object') {
        const d = raw;
        return createLine(String(d.text ?? ''));
    }
    return createLine(String(raw ?? ''));
}
function applyVariant(data) {
    const variant = data.variant;
    if (!variant || !VARIANT_OVERLAYS[variant])
        return data;
    return { ...VARIANT_OVERLAYS[variant], ...data };
}
export function parseFrameRecord(data, isRoot = false) {
    data = applyVariant(data);
    const childrenData = data.children ?? [];
    const children = childrenData.map(c => parseFrameRecord(c));
    const isContainer = children.length > 0;
    let labelRaw = data.label;
    if (typeof labelRaw === 'string')
        labelRaw = [labelRaw];
    const label = (labelRaw ?? []).map(parseLine);
    let headingLine;
    if ('heading' in data) {
        const h = data.heading;
        headingLine =
            typeof h === 'string'
                ? createLine(h)
                : parseLine(h);
    }
    const defaultBorder = isContainer ? Border.NONE : Border.SOLID;
    const hasHeading = 'heading' in data;
    const borderKey = String(data.border ?? '');
    const border = BORDER[borderKey] ?? defaultBorder;
    const isPanel = border !== Border.NONE || hasHeading;
    const isAnnotation = border === Border.NONE && !isContainer;
    const defaultGap = hasHeading ? 0 : deriveContentGap(children, { isRoot });
    let sizingW;
    let sizingH;
    if ('sizing' in data) {
        const uniform = SIZING[String(data.sizing)] ?? Sizing.FILL;
        sizingW = data.sizing_w ? SIZING[String(data.sizing_w)] ?? uniform : uniform;
        sizingH = data.sizing_h ? SIZING[String(data.sizing_h)] ?? uniform : uniform;
    }
    else if (isRoot) {
        sizingW = SIZING[String(data.sizing_w ?? 'hug')] ?? Sizing.HUG;
        sizingH = SIZING[String(data.sizing_h ?? 'hug')] ?? Sizing.HUG;
    }
    else {
        sizingW = SIZING[String(data.sizing_w ?? 'fill')] ?? Sizing.FILL;
        sizingH = SIZING[String(data.sizing_h ?? 'hug')] ?? Sizing.HUG;
    }
    if ('width' in data && !('sizing_w' in data) && !('sizing' in data))
        sizingW = Sizing.FIXED;
    if ('height' in data && !('sizing_h' in data) && !('sizing' in data))
        sizingH = Sizing.FIXED;
    const defaultPadding = isRoot || (isContainer && !isPanel) ? 0 : INSET;
    const uniformPadding = Number(data.padding ?? defaultPadding);
    const frame = new Frame({
        id: String(data.id ?? ''),
        direction: DIRECTION[String(data.direction ?? 'vertical')] ?? Direction.VERTICAL,
        gap: Number(data.gap ?? defaultGap),
        padding: uniformPadding,
        paddingTop: data.padding_top != null ? Number(data.padding_top) : undefined,
        paddingRight: data.padding_right != null
            ? Number(data.padding_right)
            : isAnnotation
                ? 0
                : undefined,
        paddingBottom: data.padding_bottom != null ? Number(data.padding_bottom) : undefined,
        paddingLeft: data.padding_left != null
            ? Number(data.padding_left)
            : isAnnotation
                ? 0
                : undefined,
        sizingW,
        sizingH,
        fillWeight: Number(data.fill_weight ?? 1),
        colSpan: data.col_span != null ? Number(data.col_span) : undefined,
        align: ALIGN[String(data.align ?? 'top-left')] ?? Align.TOP_LEFT,
        justify: JUSTIFY[String(data.justify ?? 'packed')] ?? Justify.PACKED,
        wrap: Boolean(data.wrap ?? false),
        width: data.width != null ? Number(data.width) : undefined,
        height: data.height != null ? Number(data.height) : undefined,
        minWidth: data.min_width != null ? Number(data.min_width) : undefined,
        maxWidth: data.max_width != null ? Number(data.max_width) : undefined,
        maxWidthChars: data.max_width_chars != null ? Number(data.max_width_chars) : undefined,
        minHeight: data.min_height != null ? Number(data.min_height) : undefined,
        maxHeight: data.max_height != null ? Number(data.max_height) : undefined,
        fill: FILL[String(data.fill ?? 'white')] ?? Fill.WHITE,
        border,
        heading: headingLine && !isContainer ? headingLine : undefined,
        icon: headingLine && isContainer ? undefined : data.icon,
        iconFill: data.icon_fill,
        label,
        role: String(data.role ?? ''),
        level: data.level != null ? Number(data.level) : undefined,
        children,
        positionType: String(data.position ?? 'AUTO').toUpperCase(),
        x: data.x != null ? Number(data.x) : 0,
        y: data.y != null ? Number(data.y) : 0,
    });
    if (headingLine && frame.isContainer) {
        applyHeadingAsChild(frame, headingLine, {
            icon: data.icon,
            iconFill: data.icon_fill,
        });
    }
    return frame;
}
//# sourceMappingURL=frame-record-parser.js.map