import { Border, } from "../frame-model.js";
import { leafIconColumnWidth } from "../spatial.js";
import { ARROW_COLOR, ARROW_HEAD_HALF_WIDTH, ARROW_HEAD_LENGTH, BODY_LINE_STEP, BODY_SIZE, GRID_GUTTER, ICON_SIZE, sizeToPx, } from "../tokens.js";
import { wrapTextLines } from "../text-measure.js";
import { effectiveResolvedStrokeWidth } from "../frame-classes.js";
import { annotationTextToSpec, frameOwnedTextBlocks, frameOwnedTextBlockGap, } from "../resolved-spec-typography.js";
import { shapeLineSpec } from "../text-adapter/shape-compatible.js";
const ASCENT_RATIO = 0.94;
const WHITE = parseColor("#FFFFFF");
function parseColor(value) {
    const normalized = value.trim().toLowerCase();
    if (normalized === "transparent" || normalized === "none") {
        return { r: 0, g: 0, b: 0, a: 0 };
    }
    if (/^#[0-9a-f]{6}$/i.test(normalized)) {
        return {
            r: Number.parseInt(normalized.slice(1, 3), 16) / 255,
            g: Number.parseInt(normalized.slice(3, 5), 16) / 255,
            b: Number.parseInt(normalized.slice(5, 7), 16) / 255,
            a: 1,
        };
    }
    throw new Error(`Unsupported color format for render-ir emit: ${value}`);
}
function paint(value) {
    if (!value || value === "none")
        return undefined;
    return { color: parseColor(value) };
}
function lineTopToBaseline(top, size) {
    return top + sizeToPx(size) * ASCENT_RATIO;
}
function frameRenderState(frame) {
    const strokeWidth = effectiveResolvedStrokeWidth(frame);
    return {
        fill: paint(frame.resolvedFill ?? "transparent"),
        stroke: paint(frame.resolvedStroke ?? "none"),
        strokeWidth,
        strokeStyle: strokeWidth > 0
            ? {
                width: strokeWidth,
                dashArray: frame.border === Border.DASHED ? [8, 8] : undefined,
            }
            : undefined,
        padTop: frame.paddingTop,
        padRight: frame.paddingRight,
        padBottom: frame.paddingBottom,
        padLeft: frame.paddingLeft,
        iconFill: paint(frame.resolvedIconFill ?? "#000000"),
    };
}
function textRunItems(frame, adapter) {
    const state = frameRenderState(frame);
    const iconCol = leafIconColumnWidth(frame);
    const textMaxWidth = frame._layout.placedW - state.padLeft - state.padRight - iconCol;
    let textBlocks = frameOwnedTextBlocks(frame);
    if (textBlocks.length > 0 && textMaxWidth > 0) {
        textBlocks = textBlocks
            .map((block) => wrapTextLines(block, textMaxWidth, adapter))
            .filter((block) => block.length > 0);
    }
    if (textBlocks.length === 0)
        return [];
    const runs = [];
    let top = frame._layout.placedY + state.padTop;
    const x = frame._layout.placedX + state.padLeft;
    for (const [blockIndex, block] of textBlocks.entries()) {
        for (const spec of block) {
            const size = String(spec.size ?? BODY_SIZE);
            runs.push({
                kind: "glyph-run",
                x,
                y: lineTopToBaseline(top, size),
                run: shapeLineSpec(adapter, spec),
                fill: paint(spec.fill ?? "#000000"),
            });
            top += sizeToPx(spec.lineStep ?? BODY_LINE_STEP);
        }
        top += frameOwnedTextBlockGap(frame, blockIndex, textBlocks.length);
    }
    return runs;
}
function emitFrameGroup(frame, adapter) {
    const state = frameRenderState(frame);
    const children = [];
    if (frame.role === "separator") {
        children.push({
            kind: "line",
            x1: frame._layout.placedX,
            y1: frame._layout.placedY,
            x2: frame._layout.placedX + frame._layout.placedW,
            y2: frame._layout.placedY,
            stroke: paint("#000000"),
            strokeStyle: { width: 1, dashArray: [8, 8] },
        });
    }
    children.push({
        kind: "rect",
        x: frame._layout.placedX,
        y: frame._layout.placedY,
        width: frame._layout.placedW,
        height: frame._layout.placedH,
        fill: state.fill,
        stroke: state.stroke,
        strokeStyle: state.strokeStyle,
    });
    children.push(...textRunItems(frame, adapter));
    if (frame.icon) {
        children.push({
            kind: "rect",
            x: frame._layout.placedX + frame._layout.placedW - state.padRight - ICON_SIZE,
            y: frame._layout.placedY + state.padTop,
            width: ICON_SIZE,
            height: ICON_SIZE,
            fill: state.iconFill,
            opacity: 0.15,
        });
    }
    for (const child of frame.children) {
        children.push(emitFrameGroup(child, adapter));
    }
    return {
        kind: "group",
        id: frame.id && !frame.id.startsWith("__") ? frame.id : undefined,
        children,
    };
}
function collectBounds(frame, out = {}) {
    if (frame.id && !frame.id.startsWith("__")) {
        out[frame.id] = {
            x: frame._layout.placedX,
            y: frame._layout.placedY,
            w: frame._layout.placedW,
            h: frame._layout.placedH,
        };
    }
    for (const child of frame.children)
        collectBounds(child, out);
    return out;
}
function simplifyPath(points) {
    if (points.length <= 2)
        return points;
    const result = [points[0]];
    for (let index = 1; index < points.length - 1; index += 1) {
        const [px, py] = points[index - 1];
        const [cx, cy] = points[index];
        const [nx, ny] = points[index + 1];
        if (!((px === cx && cx === nx) || (py === cy && cy === ny))) {
            result.push(points[index]);
        }
    }
    result.push(points[points.length - 1]);
    return result;
}
function inferSides(sx, sy, sw, sh, tx, ty, tw, th) {
    const dx = tx + tw / 2 - (sx + sw / 2);
    const dy = ty + th / 2 - (sy + sh / 2);
    if (Math.abs(dy) >= Math.abs(dx)) {
        return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
    }
    return dx >= 0 ? ["right", "left"] : ["left", "right"];
}
function parseRef(ref) {
    if (ref.includes(".")) {
        const parts = ref.split(".");
        const side = parts[parts.length - 1];
        if (side === "top" || side === "bottom" || side === "left" || side === "right") {
            return [parts.slice(0, -1).join("."), side];
        }
    }
    return [ref, null];
}
function edgePoint(x, y, w, h, side) {
    switch (side) {
        case "left":
            return [x, y + h / 2];
        case "right":
            return [x + w, y + h / 2];
        case "top":
            return [x + w / 2, y];
        case "bottom":
            return [x + w / 2, y + h];
    }
}
function orthogonalWaypoints(start, end, srcSide, tgtSide) {
    const [sx, sy] = start;
    const [ex, ey] = end;
    if ((srcSide === "right" && tgtSide === "left") || (srcSide === "left" && tgtSide === "right")) {
        const midX = (sx + ex) / 2;
        return [
            [midX, sy],
            [midX, ey],
        ];
    }
    if ((srcSide === "bottom" && tgtSide === "top") || (srcSide === "top" && tgtSide === "bottom")) {
        const midY = (sy + ey) / 2;
        return [
            [sx, midY],
            [ex, midY],
        ];
    }
    return [[ex, sy]];
}
function routeArrows(arrows, bounds) {
    const result = [];
    for (const arrow of arrows) {
        const [srcId, srcSideExplicit] = parseRef(arrow.source);
        const [tgtId, tgtSideExplicit] = parseRef(arrow.target);
        const source = bounds[srcId];
        const target = bounds[tgtId];
        if (!source || !target)
            continue;
        if (arrow.layoutPath && arrow.layoutPath.length >= 2) {
            result.push({
                points: simplifyPath(arrow.layoutPath.map((point) => [point[0], point[1]])),
                color: arrow.color ?? ARROW_COLOR,
                label: arrow.label && arrow.label.length > 0 ? arrow.label : undefined,
                labelGap: arrow.labelGap ?? GRID_GUTTER,
                componentId: arrow.id ?? `${arrow.source}->${arrow.target}`,
            });
            continue;
        }
        let srcSide = srcSideExplicit;
        let tgtSide = tgtSideExplicit;
        if (!srcSide || !tgtSide) {
            const [inferredSrc, inferredTgt] = inferSides(source.x, source.y, source.w, source.h, target.x, target.y, target.w, target.h);
            srcSide ??= inferredSrc;
            tgtSide ??= inferredTgt;
        }
        const start = edgePoint(source.x, source.y, source.w, source.h, srcSide);
        const end = edgePoint(target.x, target.y, target.w, target.h, tgtSide);
        const rawWaypoints = arrow.waypoints && arrow.waypoints.length > 0
            ? arrow.waypoints
            : orthogonalWaypoints(start, end, srcSide, tgtSide);
        result.push({
            points: simplifyPath([start, ...rawWaypoints, end]),
            color: arrow.color ?? ARROW_COLOR,
            label: arrow.label && arrow.label.length > 0 ? arrow.label : undefined,
            labelGap: arrow.labelGap ?? GRID_GUTTER,
            componentId: arrow.id ?? `${arrow.source}->${arrow.target}`,
        });
    }
    return result;
}
function arrowheadPath(tipX, tipY, prevX, prevY) {
    const dx = tipX - prevX;
    const dy = tipY - prevY;
    const length = Math.hypot(dx, dy);
    if (length === 0)
        return null;
    const ux = dx / length;
    const uy = dy / length;
    const bx = tipX - ux * ARROW_HEAD_LENGTH;
    const by = tipY - uy * ARROW_HEAD_LENGTH;
    const nx = -uy * ARROW_HEAD_HALF_WIDTH;
    const ny = ux * ARROW_HEAD_HALF_WIDTH;
    return {
        base: [bx, by],
        commands: [
            { kind: "M", x: bx + nx, y: by + ny },
            { kind: "L", x: tipX, y: tipY },
            { kind: "L", x: bx - nx, y: by - ny },
            { kind: "Z" },
        ],
    };
}
function labelAnchorForSegment(x1, y1, x2, y2, labelGap) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    return {
        x: mx + (-dy / len) * labelGap,
        y: my + (dx / len) * labelGap,
    };
}
function emitArrowGroups(arrows, adapter, bounds) {
    return routeArrows(arrows, bounds).map((arrow) => {
        const children = [];
        const shaftPoints = [...arrow.points];
        const tip = shaftPoints[shaftPoints.length - 1];
        const prev = shaftPoints[shaftPoints.length - 2];
        const head = arrowheadPath(tip[0], tip[1], prev[0], prev[1]);
        if (head) {
            shaftPoints[shaftPoints.length - 1] = head.base;
        }
        for (let index = 0; index < shaftPoints.length - 1; index += 1) {
            const [x1, y1] = shaftPoints[index];
            const [x2, y2] = shaftPoints[index + 1];
            children.push({
                kind: "line",
                x1,
                y1,
                x2,
                y2,
                stroke: paint(arrow.color),
                strokeStyle: { width: 1 },
            });
        }
        if (head) {
            children.push({
                kind: "path",
                commands: head.commands,
                fill: paint(arrow.color),
            });
        }
        if (arrow.label && arrow.label.length > 0) {
            let bestIndex = 0;
            let bestLength = 0;
            for (let index = 0; index < shaftPoints.length - 1; index += 1) {
                const [x1, y1] = shaftPoints[index];
                const [x2, y2] = shaftPoints[index + 1];
                const length = Math.hypot(x2 - x1, y2 - y1);
                if (length > bestLength) {
                    bestLength = length;
                    bestIndex = index;
                }
            }
            const [x1, y1] = shaftPoints[bestIndex];
            const [x2, y2] = shaftPoints[bestIndex + 1];
            const anchor = labelAnchorForSegment(x1, y1, x2, y2, arrow.labelGap);
            const specs = arrow.label.map(annotationTextToSpec);
            const totalHeight = specs.reduce((sum, spec, index) => {
                const lineStep = sizeToPx(spec.lineStep ?? BODY_LINE_STEP);
                return sum + (index === 0 ? 0 : lineStep);
            }, 0);
            let top = anchor.y - totalHeight / 2;
            for (const spec of specs) {
                const size = String(spec.size ?? BODY_SIZE);
                children.push({
                    kind: "glyph-run",
                    x: anchor.x,
                    y: lineTopToBaseline(top, size),
                    run: shapeLineSpec(adapter, spec),
                    fill: paint(spec.fill ?? "#666666"),
                });
                top += sizeToPx(spec.lineStep ?? BODY_LINE_STEP);
            }
        }
        return {
            kind: "group",
            id: arrow.componentId,
            children,
        };
    });
}
function emitOverlayGroups(overlays, adapter, bounds) {
    const OVERLAY_PAD = 8;
    const result = [];
    for (const overlay of overlays) {
        const members = overlay.members.filter((member) => bounds[member]).map((member) => bounds[member]);
        if (members.length === 0)
            continue;
        const minX = Math.min(...members.map((member) => member.x));
        const minY = Math.min(...members.map((member) => member.y));
        const maxX = Math.max(...members.map((member) => member.x + member.w));
        const maxY = Math.max(...members.map((member) => member.y + member.h));
        const x = minX - OVERLAY_PAD;
        const y = minY - OVERLAY_PAD;
        const width = maxX - minX + 2 * OVERLAY_PAD;
        const height = maxY - minY + 2 * OVERLAY_PAD;
        const children = [
            {
                kind: "rect",
                x,
                y,
                width,
                height,
                fill: paint("transparent"),
                stroke: paint("#000000"),
                strokeStyle: { width: 1, dashArray: [2, 4] },
            },
        ];
        if (overlay.label) {
            const spec = {
                content: overlay.label,
                size: String(BODY_SIZE),
                weight: "400",
                fill: "#000000",
            };
            children.push({
                kind: "glyph-run",
                x: x + OVERLAY_PAD,
                y: y - 4 + sizeToPx(BODY_SIZE) * ASCENT_RATIO,
                run: shapeLineSpec(adapter, spec),
                fill: paint("#000000"),
            });
        }
        result.push({
            kind: "group",
            id: overlay.id,
            children,
        });
    }
    return result;
}
export function emitFrameDiagramDisplayList(diagram, result, adapter) {
    const viewport = {
        width: result.width || 400,
        height: result.height || 200,
        background: WHITE,
    };
    const frameGroup = emitFrameGroup(diagram.root, adapter);
    const bounds = collectBounds(diagram.root);
    return {
        viewport,
        items: [
            frameGroup,
            ...emitArrowGroups(diagram.arrows, adapter, bounds),
            ...emitOverlayGroups(diagram.overlays, adapter, bounds),
        ],
    };
}
//# sourceMappingURL=display-list.js.map