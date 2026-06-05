"use strict";
// ---------------------------------------------------------------------------
// layout-bridge.js — Client-side layout using the TS layout engine
// ---------------------------------------------------------------------------
// Bridges between the server's serialized Frame tree (JSON) and the
// LayoutEngine global (IIFE bundle).  Provides performLocalRelayout()
// which replaces the server round-trip requestV3Relayout().
// ---------------------------------------------------------------------------

/**
 * Reconstruct a LayoutEngine.Frame from a serialized JSON object.
 * The JSON comes from the server's /api/frame-tree/<slug> endpoint.
 */
function deserializeFrame(json) {
  const children = (json.children || []).map(deserializeFrame);
  const headingJson = json.heading;
  const headingLine = headingJson
    ? LayoutEngine.createLine(headingJson.content)
    : undefined;
  const frame = new LayoutEngine.Frame({
    id: json.id || "",
    direction: json.direction || "VERTICAL",
    gap: json.gap ?? 24,
    padding: json.padding ?? 8,
    paddingTop: json.paddingTop,
    paddingRight: json.paddingRight,
    paddingBottom: json.paddingBottom,
    paddingLeft: json.paddingLeft,
    align: json.align || "TOP_LEFT",
    wrap: json.wrap ?? false,
    sizingW: json.sizingW || "HUG",
    sizingH: json.sizingH || "HUG",
    fillWeight: json.fillWeight ?? 1,
    width: json.width ?? undefined,
    height: json.height ?? undefined,
    minWidth: json.minWidth ?? undefined,
    maxWidth: json.maxWidth ?? undefined,
    maxWidthChars: json.maxWidthChars ?? json.max_width_chars ?? undefined,
    minHeight: json.minHeight ?? undefined,
    maxHeight: json.maxHeight ?? undefined,
    fill: json.fill || "#FFFFFF",
    border: json.border || "SOLID",
    heading: headingLine && children.length === 0 ? headingLine : undefined,
    icon: headingLine && children.length > 0 ? undefined : (json.icon || undefined),
    iconFill: json.iconFill || undefined,
    level: json.level ?? undefined,
    colSpan: json.colSpan ?? json.col_span ?? undefined,
    label: (json.label || []).map(ln => LayoutEngine.createLine(ln.content)),
    role: json.role || "",
    children,
    positionType: json.positionType || "AUTO",
    x: json.x ?? 0,
    y: json.y ?? 0,
  });
  if (headingLine && frame.isContainer) {
    LayoutEngine.applyHeadingAsChild(frame, headingLine, {
      icon: json.icon || undefined,
      iconFill: json.iconFill || undefined,
    });
  }
  return frame;
}

/**
 * Reconstruct a LayoutEngine.FrameDiagram from serialized JSON.
 */
function deserializeFrameDiagram(json) {
  const root = deserializeFrame(json.root);
  const arrows = (json.arrows || []).map(a => LayoutEngine.createArrow(a.source, a.target, a));
  return new LayoutEngine.FrameDiagram({
    title: json.title || "",
    root,
    arrows,
    gridCols: json.gridCols ?? 2,
    gridColGap: json.gridColGap ?? undefined,
    gridRowGap: json.gridRowGap ?? undefined,
    gridOuterMargin: json.gridOuterMargin ?? undefined,
    layoutEngine: json.layoutEngine
      ?? ((window.__DG_CONFIG && window.__DG_CONFIG.layout_engine) || undefined),
    diagramType: json.diagramType ?? undefined,
    sourceImage: json.sourceImage ?? undefined,
    elkLayout: json.elkLayout ?? undefined,
  });
}

// ---------------------------------------------------------------------------
// Override application — port of _relayout_v3's override logic
// ---------------------------------------------------------------------------

const _DIRECTION_MAP = { VERTICAL: "VERTICAL", HORIZONTAL: "HORIZONTAL" };
const _SIZING_MAP = { HUG: "HUG", FILL: "FILL", FIXED: "FIXED" };
const _FILL_MAP = { WHITE: "#FFFFFF", GREY: "#F3F3F3", BLACK: "#000000" };
const _BORDER_MAP = { SOLID: "SOLID", DASHED: "DASHED", NONE: "NONE" };

function _linkedPageGap(diagram) {
  return Math.max(
    0,
    parseInt(
      diagram.gridColGap
      ?? diagram.gridOuterMargin
      ?? diagram.root.paddingLeft
      ?? diagram.root.padding
      ?? diagram.root.gap
      ?? 24,
      10,
    ),
  );
}

function _linkedRowGap(diagram) {
  const rootDirection = String(diagram.root.direction || "VERTICAL").toUpperCase();
  const fallback = rootDirection === "VERTICAL"
    ? (diagram.root.gap ?? 24)
    : _linkedPageGap(diagram);
  return Math.max(0, parseInt(diagram.gridRowGap ?? fallback, 10));
}

function _applyLinkedRootGridSpacing(diagram) {
  const pageGap = _linkedPageGap(diagram);
  const rowGap = _linkedRowGap(diagram);
  const rootDirection = String(diagram.root.direction || "VERTICAL").toUpperCase();

  diagram.gridColGap = pageGap;
  diagram.gridOuterMargin = pageGap;
  diagram.gridRowGap = rowGap;

  diagram.root.gap = rootDirection === "VERTICAL" ? rowGap : pageGap;

  // Use per-side margins from grid overrides when available,
  // otherwise fall back to uniform pageGap
  const mTop = diagram._gridMarginTop ?? pageGap;
  const mRight = diagram._gridMarginRight ?? pageGap;
  const mBottom = diagram._gridMarginBottom ?? pageGap;
  const mLeft = diagram._gridMarginLeft ?? pageGap;

  diagram.root.padding = mTop; // legacy uniform fallback
  diagram.root.paddingTop = mTop;
  diagram.root.paddingRight = mRight;
  diagram.root.paddingBottom = mBottom;
  diagram.root.paddingLeft = mLeft;
}

function _findFrame(frame, fid) {
  if (frame.id === fid) return frame;
  for (const child of frame.children) {
    const found = _findFrame(child, fid);
    if (found) return found;
  }
  return null;
}

/**
 * Apply editor overrides to a Frame tree (mirrors Python _relayout_v3).
 */
function _findSyntheticBody(frame) {
  if (!frame || !frame.children) return null;
  return frame.children.find(
    c => c.id === "__body" || (c.id && c.id.endsWith("__body")),
  ) || null;
}

function _hasHeadingBodyLayout(frame) {
  if (!frame || !frame.children) return false;
  const body = _findSyntheticBody(frame);
  const hasHeading = frame.children.some(
    c => c.role === "heading" || (c.id && c.id.endsWith("__heading")),
  );
  return !!(body && hasHeading);
}

/** Sync cross-axis layout fields from parent to __body (align only — spec 005 WS3). */
function _syncSyntheticBodyFromParent(frame) {
  if (!_hasHeadingBodyLayout(frame)) return;
  const body = _findSyntheticBody(frame);
  if (!body) return;
  body.align = frame.align;
}

function applyOverridesToFrameTree(diagram, allOverrides, gridOverrides) {
  // Grid overrides first, so explicit frame overrides remain authoritative
  // for the root frame when both are present.
  gridOverrides = gridOverrides || {};
  const hasGridOverrides = Object.keys(gridOverrides).length > 0;
  if (gridOverrides.cols != null) {
    diagram.gridCols = Math.max(1, parseInt(gridOverrides.cols, 10));
  }
  if (gridOverrides.col_gap != null) {
    diagram.gridColGap = Math.max(0, parseInt(gridOverrides.col_gap, 10));
  }
  if (gridOverrides.row_gap != null) {
    diagram.gridRowGap = Math.max(0, parseInt(gridOverrides.row_gap, 10));
  }
  if (gridOverrides.outer_margin != null) {
    diagram.gridOuterMargin = Math.max(0, parseInt(gridOverrides.outer_margin, 10));
  }
  // Per-side margins (stored on diagram for _applyLinkedRootGridSpacing)
  if (gridOverrides.margin_top != null) diagram._gridMarginTop = Math.max(0, parseInt(gridOverrides.margin_top, 10));
  if (gridOverrides.margin_right != null) diagram._gridMarginRight = Math.max(0, parseInt(gridOverrides.margin_right, 10));
  if (gridOverrides.margin_bottom != null) diagram._gridMarginBottom = Math.max(0, parseInt(gridOverrides.margin_bottom, 10));
  if (gridOverrides.margin_left != null) diagram._gridMarginLeft = Math.max(0, parseInt(gridOverrides.margin_left, 10));

  // Only sync grid -> root frame when the editor is actively carrying grid
  // overrides and the "link to root" toggle is on. A clean render with no
  // grid override state must preserve authored root padding/gap from YAML.
  const linkToRoot = hasGridOverrides && gridOverrides.link_to_root !== false;
  if (linkToRoot) {
    _applyLinkedRootGridSpacing(diagram);
  }

  for (const [fid, ovr] of Object.entries(allOverrides)) {
    const target = fid === "root"
      ? diagram.root
      : _findFrame(diagram.root, fid);
    if (!target) continue;

    if (ovr.direction && _DIRECTION_MAP[ovr.direction]) {
      target.direction = ovr.direction;
      _syncSyntheticBodyFromParent(target);
    }
    if (ovr.gap != null) {
      const gap = Math.max(0, parseInt(ovr.gap, 10));
      target.gap = gap;
    }
    if (ovr.padding != null) {
      const p = Math.max(0, parseInt(ovr.padding, 10));
      target.padding = p;
      target.paddingTop = p;
      target.paddingRight = p;
      target.paddingBottom = p;
      target.paddingLeft = p;
    }
    // Per-side padding overrides (applied after uniform padding, so they win)
    if (ovr.padding_top != null) target.paddingTop = Math.max(0, parseInt(ovr.padding_top, 10));
    if (ovr.padding_right != null) target.paddingRight = Math.max(0, parseInt(ovr.padding_right, 10));
    if (ovr.padding_bottom != null) target.paddingBottom = Math.max(0, parseInt(ovr.padding_bottom, 10));
    if (ovr.padding_left != null) target.paddingLeft = Math.max(0, parseInt(ovr.padding_left, 10));
    if (ovr.sizing && _SIZING_MAP[ovr.sizing]) {
      target.sizingW = ovr.sizing;
      target.sizingH = ovr.sizing;
    }
    if (ovr.sizing_w && _SIZING_MAP[ovr.sizing_w]) {
      target.sizingW = ovr.sizing_w;
    }
    if (ovr.sizing_h && _SIZING_MAP[ovr.sizing_h]) {
      target.sizingH = ovr.sizing_h;
    }
    if (ovr.align) {
      target.align = ovr.align;
    }
    if (ovr.wrap != null) {
      target.wrap = !!ovr.wrap;
    }
    if (ovr.fill_weight != null) {
      target.fillWeight = parseFloat(ovr.fill_weight);
    }
    if (ovr.width != null) {
      target.width = parseInt(ovr.width, 10);
    }
    if (ovr.height != null) {
      target.height = parseInt(ovr.height, 10);
    }
    for (const key of ["minWidth", "maxWidth", "maxWidthChars", "minHeight", "maxHeight"]) {
      // Map snake_case override keys to camelCase Frame properties
      const snakeKey = key === "maxWidthChars"
        ? "max_width_chars"
        : key.replace(/([A-Z])/g, "_$1").toLowerCase();
      if (snakeKey in ovr) {
        if (ovr[snakeKey] == null || ovr[snakeKey] === "") {
          target[key] = undefined;
        } else {
          const val = parseInt(ovr[snakeKey], 10);
          if (val >= 0) target[key] = val;
        }
      }
    }
    if (ovr.level != null) {
      const level = parseInt(ovr.level, 10);
      if (Number.isFinite(level) && level >= 0) {
        target.level = level;
      }
    }
    if (ovr.fill && _FILL_MAP[ovr.fill]) {
      target.fill = _FILL_MAP[ovr.fill];
    }
    if (ovr.border && _BORDER_MAP[ovr.border]) {
      target.border = ovr.border;
    }
    if (ovr.position) {
      const pos = ovr.position.toUpperCase();
      if (pos === "ABSOLUTE" || pos === "AUTO") {
        target.positionType = pos;
      }
    }
    if (ovr.x != null) {
      target.x = parseInt(ovr.x, 10);
    }
    if (ovr.y != null) {
      target.y = parseInt(ovr.y, 10);
    }
    if (ovr.children_order && Array.isArray(ovr.children_order)) {
      const childMap = new Map(target.children.map(c => [c.id, c]));
      const reordered = ovr.children_order
        .filter(id => childMap.has(id))
        .map(id => childMap.get(id));
      const remaining = target.children.filter(
        c => !ovr.children_order.includes(c.id)
      );
      target.children = [...reordered, ...remaining];
    }
    if (ovr.text && typeof ovr.text === "object") {
      if (ovr.text.heading != null) {
        _applyTextHeadingOverride(target, ovr.text.heading);
      }
      if (Array.isArray(ovr.text.label)) {
        target.label = ovr.text.label.map((text, i) => {
          if (i < target.label.length) {
            return LayoutEngine.createLine(text);
          }
          return LayoutEngine.createLine(text);
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// SVG DOM patching — update SVG elements in-place from layout results
// ---------------------------------------------------------------------------

const SVG_NS = "http://www.w3.org/2000/svg";

// ---------------------------------------------------------------------------
// Icon fetching and caching
// ---------------------------------------------------------------------------

const _iconCache = new Map();

async function fetchIconSvg(name) {
  if (_iconCache.has(name)) return _iconCache.get(name);
  try {
    const resp = await fetch("/api/icon/" + encodeURIComponent(name));
    if (!resp.ok) {
      console.warn("layout-bridge: icon fetch failed for", name, resp.status);
      _iconCache.set(name, null);
      return null;
    }
    const text = await resp.text();
    _iconCache.set(name, text);
    return text;
  } catch (e) {
    console.warn("layout-bridge: icon fetch error for", name, e);
    _iconCache.set(name, null);
    return null;
  }
}

function buildIconElement(name, svgContent, fill) {
  if (!svgContent) return null;
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("class", "dg-icon");
  // Parse the SVG content and extract children of the <svg> root
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");
  const svgRoot = doc.documentElement;
  // Copy children from parsed SVG into the group
  for (const child of Array.from(svgRoot.childNodes)) {
    g.appendChild(document.importNode(child, true));
  }
  // Apply fill to shape elements
  if (fill) {
    g.querySelectorAll("path, circle, rect, polygon, ellipse").forEach(el => {
      el.setAttribute("fill", fill);
    });
  }
  return g;
}

const _ASCENT_RATIO = 0.94;

function _fmtSvgNumber(value) {
  return String(Math.round(value * 100) / 100);
}

function collectFramesById(frame, out) {
  if (!out) out = {};
  if (frame.id && !frame.id.startsWith("__")) {
    out[frame.id] = frame;
  }
  for (const child of frame.children) {
    collectFramesById(child, out);
  }
  return out;
}

function _lineTopToBaseline(top, size) {
  return top + LayoutEngine.sizeToPx(size) * _ASCENT_RATIO;
}

function _arrowLabelLines(arrow) {
  if (!arrow.label || arrow.label.length === 0) return [];
  return arrow.label.map((line) => {
    if (typeof line === "string") {
      return LayoutEngine.createLine(line);
    }
    return LayoutEngine.createLine(line.content || "", {
      size: line.size,
      weight: line.weight,
      fill: line.fill,
      smallCaps: line.smallCaps,
      letterSpacing: line.letterSpacing,
      lineStep: line.lineStep,
    });
  });
}

/** Offset label anchor perpendicular to the shaft; pick the side with more node clearance. */
function _minDistanceToBounds(lx, ly, boundsList) {
  let minDist = Infinity;
  for (const b of boundsList) {
    if (!b) continue;
    const cx = Math.max(b.x, Math.min(lx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ly, b.y + b.h));
    minDist = Math.min(minDist, Math.hypot(lx - cx, ly - cy));
  }
  return minDist;
}

function _labelAnchorForSegment(x1, y1, x2, y2, labelGap, boundsMap) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const boundsList = Object.values(boundsMap || {});
  const candidates = [
    { lx: mx + nx * labelGap, ly: my + ny * labelGap },
    { lx: mx - nx * labelGap, ly: my - ny * labelGap },
  ];
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const c of candidates) {
    const score = _minDistanceToBounds(c.lx, c.ly, boundsList);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function _buildArrowLabelsFromElk(arrow) {
  if (!arrow.elkLabels || !arrow.elkLabels.length) return null;
  if (typeof LayoutEngine.annotationTextToSpec !== "function") return null;

  const frag = document.createDocumentFragment();
  for (const lbl of arrow.elkLabels) {
    const spec = LayoutEngine.annotationTextToSpec(
      LayoutEngine.createLine(lbl.text),
    );
    const size = spec.size ?? LayoutEngine.BODY_SIZE;
    const cx = lbl.x + lbl.width / 2;
    const cy = lbl.y + lbl.height / 2;
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("font-family", "Ubuntu Sans");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    const tspan = document.createElementNS(SVG_NS, "tspan");
    tspan.setAttribute("x", _fmtSvgNumber(cx));
    tspan.setAttribute("y", _fmtSvgNumber(_lineTopToBaseline(cy - LayoutEngine.sizeToPx(size) / 2, size)));
    tspan.setAttribute("font-size", String(size));
    tspan.setAttribute("font-weight", String(spec.weight ?? "400"));
    tspan.setAttribute("fill", spec.fill ?? "#666666");
    tspan.textContent = lbl.text;
    text.appendChild(tspan);
    frag.appendChild(text);
  }
  return frag;
}

function _buildArrowLabelElement(arrow, shaftPoints, labelGap, boundsMap) {
  const elkLabels = _buildArrowLabelsFromElk(arrow);
  if (elkLabels) return elkLabels;

  const lines = _arrowLabelLines(arrow);
  if (!lines.length) return null;
  if (typeof LayoutEngine.annotationTextToSpec !== "function") return null;

  let bestIdx = 0;
  let bestLen = 0;
  for (let i = 0; i < shaftPoints.length - 1; i++) {
    const [x1, y1] = shaftPoints[i];
    const [x2, y2] = shaftPoints[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len > bestLen) {
      bestLen = len;
      bestIdx = i;
    }
  }
  const [mx1, my1] = shaftPoints[bestIdx];
  const [mx2, my2] = shaftPoints[bestIdx + 1];
  const { lx, ly } = _labelAnchorForSegment(mx1, my1, mx2, my2, labelGap, boundsMap);

  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("font-family", "Ubuntu Sans");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");

  const specs = lines.map((line) => LayoutEngine.annotationTextToSpec(line));
  if (!specs.length) return null;

  const totalHeight = specs.reduce((sum, spec, index) => {
    const lineStep = LayoutEngine.sizeToPx(spec.lineStep ?? LayoutEngine.BODY_LINE_STEP);
    return sum + (index === 0 ? 0 : lineStep);
  }, 0);
  let top = ly - totalHeight / 2;

  for (const spec of specs) {
    const size = spec.size ?? LayoutEngine.BODY_SIZE;
    const weight = spec.weight ?? "400";
    const fill = spec.fill ?? "#666666";
    const lineStep = LayoutEngine.sizeToPx(spec.lineStep ?? LayoutEngine.BODY_LINE_STEP);
    const tspan = document.createElementNS(SVG_NS, "tspan");
    tspan.setAttribute("x", _fmtSvgNumber(lx));
    tspan.setAttribute("y", _fmtSvgNumber(_lineTopToBaseline(top, size)));
    tspan.setAttribute("font-size", String(size));
    tspan.setAttribute("font-weight", String(weight));
    tspan.setAttribute("fill", fill);
    if (spec.letterSpacing) {
      tspan.setAttribute("letter-spacing", String(spec.letterSpacing));
    }
    if (spec.smallCaps) {
      tspan.setAttribute("font-variant-caps", "small-caps");
    }
    tspan.textContent = spec.content;
    text.appendChild(tspan);
    top += lineStep;
  }
  return text;
}

function _frameBoxRenderState(frame) {
  // Use resolved style values from resolveStyles() — the single source of truth.
  // resolvedFill / resolvedStroke are always set after resolveStyles() runs.
  const fill = frame.resolvedFill ?? "transparent";
  const stroke = frame.resolvedStroke ?? "none";

  let padTop = frame.paddingTop;
  let padRight = frame.paddingRight;
  const padBottom = frame.paddingBottom;
  let padLeft = frame.paddingLeft;

  const iconCol = frame.icon ? (LayoutEngine.ICON_SIZE + LayoutEngine.INSET) : 0;
  const textMaxWidth = frame._layout.placedW - padLeft - padRight - iconCol;
  const iconFill = frame.resolvedIconFill ?? frame.iconFill ?? "#000000";

  let specs = [];
  if (frame.children.length === 0) {
    if (frame.heading) specs.push(LayoutEngine.frameOwnedHeadingToSpec(frame, frame.heading));
    if (frame.label.length > 0) {
      specs.push(...frame.label.map((line, labelIndex) => LayoutEngine.frameOwnedLabelToSpec(frame, line, labelIndex)));
    }
  } else if (frame.heading) {
    specs = [LayoutEngine.frameOwnedHeadingToSpec(frame, frame.heading)];
  }
  if (specs.length > 0 && textMaxWidth > 0) {
    specs = LayoutEngine.wrapTextLines(specs, textMaxWidth, _textAdapter);
  }

  const strokeWidth = typeof LayoutEngine.effectiveResolvedStrokeWidth === "function"
    ? LayoutEngine.effectiveResolvedStrokeWidth(frame)
    : (stroke === "none" || stroke === "transparent"
      ? 0
      : (frame.resolvedStrokeWidth
        ?? (frame.border === "SOLID" || frame.border === "DASHED" ? 1 : 0)));

  return {
    fill,
    stroke,
    strokeWidth,
    dashed: frame.border === "DASHED",
    padTop,
    padRight,
    padBottom,
    padLeft,
    textMaxWidth,
    specs,
    iconFill,
  };
}

function _buildFrameTextElement(frame, renderState) {
  if (!renderState.specs.length) return null;

  const textEl = document.createElementNS(SVG_NS, "text");
  textEl.setAttribute("font-family", "Ubuntu Sans");

  let top = frame._layout.placedY + renderState.padTop;
  const x = frame._layout.placedX + renderState.padLeft;
  for (const [specIndex, spec] of renderState.specs.entries()) {
    const size = spec.size ?? LayoutEngine.BODY_SIZE;
    const weight = spec.weight ?? "400";
    const smallCaps = spec.smallCaps ?? false;
    const fill = spec.fill ?? "#000000";
    const lineStep = LayoutEngine.sizeToPx(spec.lineStep ?? LayoutEngine.BODY_LINE_STEP);
    const tspan = document.createElementNS(SVG_NS, "tspan");
    tspan.setAttribute("x", _fmtSvgNumber(x));
    tspan.setAttribute("y", _fmtSvgNumber(_lineTopToBaseline(top, size)));
    tspan.setAttribute("font-size", String(size));
    tspan.setAttribute("font-weight", String(weight));
    tspan.setAttribute("fill", fill);
    if (spec.letterSpacing) {
      tspan.setAttribute("letter-spacing", String(spec.letterSpacing));
    }
    if (spec.fontFamily) {
      tspan.setAttribute("font-family", spec.fontFamily);
    }
    if (smallCaps) {
      tspan.setAttribute("font-variant-caps", "small-caps");
    }
    tspan.textContent = spec.content;
    textEl.appendChild(tspan);
    top += lineStep;
  }

  textEl.setAttribute("data-orig-inner", textEl.innerHTML);
  return textEl;
}

function patchFrameGroup(g, frame, iconElement) {
  const renderState = _frameBoxRenderState(frame);
  const existingIcon = g.querySelector(":scope > .dg-icon");

  g.removeAttribute("transform");
  g.style.transform = "";

  const children = [];

  // Separator role: emit a visible dashed line at the top of the bounds
  if (frame.role === "separator") {
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("class", "dg-separator");
    line.setAttribute("x1", _fmtSvgNumber(frame._layout.placedX));
    line.setAttribute("y1", _fmtSvgNumber(frame._layout.placedY));
    line.setAttribute("x2", _fmtSvgNumber(frame._layout.placedX + frame._layout.placedW));
    line.setAttribute("y2", _fmtSvgNumber(frame._layout.placedY));
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#000000");
    line.setAttribute("stroke-width", "1");
    line.setAttribute("stroke-miterlimit", "10");
    line.setAttribute("stroke-dasharray", "8 8");
    children.push(line);
  }

  const rect = document.createElementNS(SVG_NS, "rect");
  rect.setAttribute("x", _fmtSvgNumber(frame._layout.placedX));
  rect.setAttribute("y", _fmtSvgNumber(frame._layout.placedY));
  rect.setAttribute("width", _fmtSvgNumber(frame._layout.placedW));
  rect.setAttribute("height", _fmtSvgNumber(frame._layout.placedH));
  rect.setAttribute("fill", renderState.fill);
  rect.setAttribute("stroke", renderState.stroke);
  rect.setAttribute("stroke-width", String(renderState.strokeWidth));
  rect.setAttribute("stroke-miterlimit", "10");
  rect.setAttribute("data-orig-width", _fmtSvgNumber(frame._layout.placedW));
  rect.setAttribute("data-orig-height", _fmtSvgNumber(frame._layout.placedH));
  if (renderState.dashed) {
    rect.setAttribute("stroke-dasharray", "8 8");
  }
  // Structural transparent rects (no text, no stroke) are pure containers —
  // keep them click-transparent so child components remain selectable.
  if (renderState.fill === "transparent" && renderState.stroke === "none"
      && !renderState.specs.length) {
    rect.setAttribute("pointer-events", "none");
  }

  children.push(rect);
  const textEl = _buildFrameTextElement(frame, renderState);
  if (textEl) {
    children.push(textEl);
  }

  const iconToUse = iconElement || existingIcon;
  if (frame.icon && iconToUse) {
    const iconX = frame._layout.placedX + frame._layout.placedW - renderState.padRight - LayoutEngine.ICON_SIZE;
    const iconY = frame._layout.placedY + renderState.padTop;
    iconToUse.setAttribute("transform", `translate(${_fmtSvgNumber(iconX)} ${_fmtSvgNumber(iconY)})`);
    iconToUse.setAttribute("data-orig-tx", _fmtSvgNumber(iconX));
    iconToUse.setAttribute("data-orig-ty", _fmtSvgNumber(iconY));
    children.push(iconToUse);
  }

  g.replaceChildren(...children);
}

/**
 * Collect { id → { x, y, w, h } } from a placed Frame tree.
 */
function collectPlacedBounds(frame, out) {
  if (!out) out = {};
  if (frame.id && !frame.id.startsWith("__")) {
    const ls = frame._layout;
    out[frame.id] = {
      x: ls.placedX,
      y: ls.placedY,
      w: ls.placedW,
      h: ls.placedH,
    };
  }
  for (const child of frame.children) {
    collectPlacedBounds(child, out);
  }
  return out;
}

/**
 * Patch SVG DOM elements to reflect new layout positions/sizes.
 * FrameBox groups are rebuilt from the relaid-out frame tree so text,
 * icon anchoring, and rect geometry stay in sync.
 */
function patchSvgFromLayout(svgEl, oldBounds, newBounds, framesById) {
  if (!svgEl) return;
  const groups = svgEl.querySelectorAll("[data-component-id]");

  for (const g of groups) {
    const cid = g.getAttribute("data-component-id");
    const newB = newBounds[cid];

    // Frame groups are fully rebuilt from the relaid-out frame tree.
    // This covers heading/body synthetic children that may not have
    // oldBounds entries in the component model.
    const frame = framesById ? framesById[cid] : null;
    if (frame && newB) {
      patchFrameGroup(g, frame);
      continue;
    }

    const oldB = oldBounds[cid];
    if (!oldB || !newB) continue;

    const dx = newB.x - oldB.x;
    const dy = newB.y - oldB.y;
    const dw = newB.w - oldB.w;
    const dh = newB.h - oldB.h;

    // Position: translate the group
    if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
      // Get existing transform and compose
      const existing = g.getAttribute("transform") || "";
      // Remove any previous layout-bridge translate
      const cleaned = existing.replace(/translate\([^)]*\)\s*/, "").trim();
      g.setAttribute("transform", `translate(${dx.toFixed(1)}, ${dy.toFixed(1)}) ${cleaned}`.trim());
    }

    // Size: update rect dimensions and positions
    if (Math.abs(dw) > 0.1 || Math.abs(dh) > 0.1) {
      const rect = g.querySelector("rect:first-of-type");
      if (rect) {
        // Rect has absolute coords — update width/height
        rect.setAttribute("width", String(newB.w));
        rect.setAttribute("height", String(newB.h));
        // Store original dimensions for applyAllOverrides compatibility
        rect.setAttribute("data-orig-width", String(newB.w));
        rect.setAttribute("data-orig-height", String(newB.h));
      }
    }
  }

  // Update SVG viewBox to match new diagram size
  const rootBounds = newBounds["root"] || Object.values(newBounds)[0];
  if (rootBounds) {
    svgEl.setAttribute("viewBox", `0 0 ${rootBounds.w} ${rootBounds.h}`);
    svgEl.setAttribute("width", String(rootBounds.w));
    svgEl.setAttribute("height", String(rootBounds.h));
  }
}

/**
 * Update the component model from a placed Frame tree.
 * This mirrors what the server returns as `tree_data`.
 */
function _headingTextForFrame(f) {
  if (f.heading && f.heading.content) return f.heading.content;
  const headingChild = (f.children || []).find(
    c => c.role === "heading" || (c.id && c.id.endsWith("__heading")),
  );
  if (headingChild && headingChild.label && headingChild.label[0]) {
    return headingChild.label[0].content || "";
  }
  return "";
}

function _resolveAuthoredLayoutFrame(f) {
  if (!f.children || f.children.length === 0) {
    return { layoutChildren: [], layoutGap: 0, layoutDirection: f.direction };
  }
  const body = f.children.find(
    c => c.id === "__body" || (c.id && c.id.endsWith("__body")),
  );
  const hasHeading = f.children.some(
    c => c.role === "heading" || (c.id && c.id.endsWith("__heading")),
  );
  if (body && hasHeading) {
    return {
      layoutChildren: body.children || [],
      layoutGap: body.gap,
      layoutDirection: body.direction,
      layoutHeaderGap: f.gap,
    };
  }
  return {
    layoutChildren: f.children.filter(
      c => !(c.id && c.id.endsWith("__body"))
        && !(c.id && c.id.endsWith("__heading"))
        && c.role !== "heading",
    ),
    layoutGap: f.gap,
    layoutDirection: f.direction,
    layoutHeaderGap: f.gap,
  };
}

function updateComponentModelFromLayout(model, frame) {
  function frameToTreeData(f) {
    if (!f.id || f.id.startsWith("__")) return null;
    const ls = f._layout;
    const { layoutChildren, layoutGap, layoutDirection, layoutHeaderGap } =
      _resolveAuthoredLayoutFrame(f);
    const children = [];
    for (const child of layoutChildren) {
      const ci = frameToTreeData(child);
      if (ci) children.push(ci);
    }
    const hasLayout = layoutChildren.length > 0;
    return {
      id: f.id,
      type: hasLayout || f.children.length > 0 ? "panel" : "box",
      x: ls.placedX,
      y: ls.placedY,
      width: ls.placedW,
      height: ls.placedH,
      children,
      layout: hasLayout
        ? (layoutDirection === "VERTICAL" ? "vertical" : "horizontal")
        : "",
      layout_gap: hasLayout ? layoutGap : 0,
      layout_col_gap: hasLayout ? layoutGap : 0,
      layout_row_gap: hasLayout ? layoutGap : 0,
      layout_header_gap: hasLayout ? layoutHeaderGap : 0,
      pad: f.border !== "NONE" ? f.paddingTop : 0,
      sizing_w: f.sizingW,
      sizing_h: f.sizingH,
      fill_weight: f.fillWeight,
      min_width: f.minWidth,
      max_width: f.maxWidth,
      max_width_chars: f.maxWidthChars,
      min_height: f.minHeight,
      max_height: f.maxHeight,
      align: f.align,
      padding_top: f.paddingTop,
      padding_right: f.paddingRight,
      padding_bottom: f.paddingBottom,
      padding_left: f.paddingLeft,
      level: f.level ?? null,
      fill: f.fill,
      border: f.border,
      heading_text: _headingTextForFrame(f),
      label_text: f.label.map(ln => ln.content),
    };
  }

  const rootData = frameToTreeData(frame);
  if (rootData) {
    // If root is anonymous, emit children as top-level
    if (frame.id && !frame.id.startsWith("__")) {
      model.loadTree([rootData]);
    } else {
      model.loadTree(rootData.children || []);
    }
  }
}

// ---------------------------------------------------------------------------
// Arrow routing (port of layout_v3.py arrow routing)
// ---------------------------------------------------------------------------

/** Match packages/layout-engine/src/svg-render.ts arrow group ids. */
function arrowComponentId(arrow) {
  if (arrow && arrow.id) return String(arrow.id);
  return `${arrow.source}->${arrow.target}`;
}

function syncArrowsInModel(model, arrows, routedArrows) {
  if (!model || typeof model.loadArrows !== "function") return;
  const routedById = new Map();
  for (const r of routedArrows || []) {
    routedById.set(r.componentId, r);
  }
  const payload = (arrows || []).map((a) => {
    const cid = arrowComponentId(a);
    const routed = routedById.get(cid);
    return {
      id: cid,
      source: a.source,
      target: a.target,
      color: a.color,
      waypoints: routed ? routed.waypoints : (a.waypoints || []),
    };
  });
  model.loadArrows(payload);
}

function _inferSides(sx, sy, sw, sh, tx, ty, tw, th) {
  const dx = (tx + tw / 2) - (sx + sw / 2);
  const dy = (ty + th / 2) - (sy + sh / 2);
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
  }
  return dx >= 0 ? ["right", "left"] : ["left", "right"];
}

function _parseRef(ref) {
  if (ref.includes(".")) {
    const parts = ref.split(".");
    const side = parts[parts.length - 1];
    if (["top", "bottom", "left", "right"].includes(side)) {
      return [parts.slice(0, -1).join("."), side];
    }
  }
  return [ref, null];
}

function _edgePoint(x, y, w, h, side) {
  switch (side) {
    case "left":   return [x, y + h / 2];
    case "right":  return [x + w, y + h / 2];
    case "top":    return [x + w / 2, y];
    case "bottom": return [x + w / 2, y + h];
    default:       return [x + w, y + h / 2];
  }
}

function _orthogonalWaypoints(start, end, srcSide, tgtSide) {
  const [sx, sy] = start;
  const [ex, ey] = end;
  if (srcSide === "right" && tgtSide === "left") {
    const midX = (sx + ex) / 2;
    return [[midX, sy], [midX, ey]];
  }
  if (srcSide === "bottom" && tgtSide === "top") {
    const midY = (sy + ey) / 2;
    return [[sx, midY], [ex, midY]];
  }
  if (srcSide === "left" && tgtSide === "right") {
    const midX = (sx + ex) / 2;
    return [[midX, sy], [midX, ey]];
  }
  if (srcSide === "top" && tgtSide === "bottom") {
    const midY = (sy + ey) / 2;
    return [[sx, midY], [ex, midY]];
  }
  return [[ex, sy]];
}

/**
 * Remove collinear intermediate points from an orthogonal path.
 * Mirrors Python's ``_simplify_path`` so the bridge produces the same
 * clean segment list the engine does.
 */
function _simplifyPath(points) {
  if (points.length <= 2) return points;
  const result = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    // Keep point only if direction changes (not collinear)
    if (!((px === cx && cx === nx) || (py === cy && cy === ny))) {
      result.push(points[i]);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

function routeArrows(arrows, boundsMap) {
  const result = [];
  for (const arrow of arrows) {
    if (arrow.layoutPath && arrow.layoutPath.length >= 2) {
      const fullPath = _simplifyPath(arrow.layoutPath.map((p) => [p[0], p[1]]));
      result.push({
        start: fullPath[0],
        end: fullPath[fullPath.length - 1],
        waypoints: fullPath.slice(1, -1),
        direction: "top",
        componentId: arrowComponentId(arrow),
        sourceRef: arrow.source,
        targetRef: arrow.target,
        color: arrow.color || "#E95420",
        label: arrow.label,
        labelGap: arrow.labelGap ?? LayoutEngine.GRID_GUTTER ?? 24,
        elkLabels: arrow.elkLabels,
      });
      continue;
    }

    const [srcId, srcSideExplicit] = _parseRef(arrow.source);
    const [tgtId, tgtSideExplicit] = _parseRef(arrow.target);
    const sb = boundsMap[srcId];
    const tb = boundsMap[tgtId];
    if (!sb || !tb) continue;

    let srcSide = srcSideExplicit;
    let tgtSide = tgtSideExplicit;
    if (!srcSide || !tgtSide) {
      const [inferredSrc, inferredTgt] = _inferSides(
        sb.x, sb.y, sb.w, sb.h, tb.x, tb.y, tb.w, tb.h
      );
      if (!srcSide) srcSide = inferredSrc;
      if (!tgtSide) tgtSide = inferredTgt;
    }

    const start = _edgePoint(sb.x, sb.y, sb.w, sb.h, srcSide);
    const end = _edgePoint(tb.x, tb.y, tb.w, tb.h, tgtSide);
    const rawWaypoints =
      arrow.waypoints && arrow.waypoints.length > 0
        ? arrow.waypoints
        : _orthogonalWaypoints(start, end, srcSide, tgtSide);
    // Simplify the full path to remove collinear points so the segment
    // count matches the number of SVG <line> elements the Python renderer
    // emitted.  Without this, straight arrows get extra midpoints and the
    // shaft-to-arrowhead junction misaligns.
    const fullPath = _simplifyPath([start, ...rawWaypoints, end]);
    const waypoints = fullPath.slice(1, -1);

    result.push({
      start: fullPath[0],
      end: fullPath[fullPath.length - 1],
      waypoints,
      direction: tgtSide,
      componentId: arrowComponentId(arrow),
      sourceRef: arrow.source,
      targetRef: arrow.target,
      color: arrow.color || "#E95420",
      label: arrow.label,
      labelGap: arrow.labelGap ?? LayoutEngine.GRID_GUTTER ?? 24,
    });
  }
  return result;
}

/**
 * Update arrow SVG elements from routed arrow data.
 */
function patchArrowsSvg(svgEl, routedArrows) {
  if (!svgEl) return;
  for (const arrow of routedArrows) {
    const g = svgEl.querySelector(
      `[data-component-id="${CSS.escape(arrow.componentId)}"]`
    );
    if (!g) continue;
    // Update visible arrow segments only. Interactive hit-area lines may
    // already exist in the group from a previous bindInteraction() pass.
    const allLines = Array.from(g.querySelectorAll("line"));
    const lines = allLines.filter((line) => line.getAttribute("stroke") !== "transparent");
    const hitLines = allLines.filter((line) => line.getAttribute("stroke") === "transparent");
    const points = [arrow.start, ...arrow.waypoints, arrow.end];
    const segmentCount = Math.max(0, points.length - 1);
    if (lines.length !== segmentCount || hitLines.length !== segmentCount) {
      const replacement = createArrowsSvg([arrow]).firstChild;
      if (replacement) {
        g.querySelectorAll("line, polygon").forEach((el) => el.remove());
        Array.from(replacement.childNodes).forEach((child) => g.appendChild(child));
      }
      continue;
    }
    if (lines.length > 0 && points.length >= 2) {
      let basePoint = null;
      const [tx, ty] = points[points.length - 1];
      const [px, py] = points[points.length - 2];
      const dx = tx - px;
      const dy = ty - py;
      const length = Math.hypot(dx, dy);
      if (length > 0) {
        const HL = window.__DG_CONFIG.head_len || 12;
        basePoint = [tx - (dx / length) * HL, ty - (dy / length) * HL];
      }

      for (let i = 0; i < lines.length && i < points.length - 1; i++) {
        lines[i].setAttribute("x1", points[i][0].toFixed(1));
        lines[i].setAttribute("y1", points[i][1].toFixed(1));
        const isLastSegment = i === points.length - 2;
        const endPoint = isLastSegment && basePoint ? basePoint : points[i + 1];
        lines[i].setAttribute("x2", endPoint[0].toFixed(1));
        lines[i].setAttribute("y2", endPoint[1].toFixed(1));
      }

      for (let i = 0; i < hitLines.length && i < lines.length; i++) {
        hitLines[i].setAttribute("x1", lines[i].getAttribute("x1"));
        hitLines[i].setAttribute("y1", lines[i].getAttribute("y1"));
        hitLines[i].setAttribute("x2", lines[i].getAttribute("x2"));
        hitLines[i].setAttribute("y2", lines[i].getAttribute("y2"));
      }
    }
    // Update arrowhead polygon
    const polygon = g.querySelector("polygon");
    if (polygon && points.length >= 2) {
      const [tx, ty] = points[points.length - 1];
      const [px, py] = points[points.length - 2];
      const dx = tx - px;
      const dy = ty - py;
      const length = Math.hypot(dx, dy);
      if (length > 0) {
        const HL = window.__DG_CONFIG.head_len || 12;
        const HH = window.__DG_CONFIG.head_half || 6;
        const ux = dx / length;
        const uy = dy / length;
        const bx = tx - ux * HL;
        const by = ty - uy * HL;
        const nx = -uy * HH;
        const ny = ux * HH;
        const pts = `${(bx + nx).toFixed(1)},${(by + ny).toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)} ${(bx - nx).toFixed(1)},${(by - ny).toFixed(1)}`;
        polygon.setAttribute("points", pts);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main entry point — called from editor.js
// ---------------------------------------------------------------------------

/** Stored frame tree JSON from the server (loaded once). */
let _frameTreeJson = null;
let _lastElkSnapshot = null;
let _lastElkFrameLabels = null;

function _elkDebugEnabled() {
  return window.__DG_elkDebugOverlay === true && !window.__DG_elkRawView;
}

function _elkRawViewEnabled() {
  return window.__DG_elkRawView === true;
}

function _collectElkFrameLabels(frame) {
  const map = {};
  function walk(f) {
    if (f.id && !String(f.id).startsWith("__")) {
      const lines = [];
      const heading = _headingTextForFrame(f);
      if (heading) lines.push(heading);
      if (f.label && f.label.length) {
        for (const ln of f.label) {
          if (ln.content) lines.push(ln.content);
        }
      }
      map[f.id] = lines.length ? lines.join("\n") : f.id;
    }
    (f.children || []).forEach(walk);
  }
  walk(frame);
  return map;
}

function _walkPlacedNodesAbsolute(nodes, visit) {
  if (!nodes) return;
  for (const node of nodes) {
    visit(node);
    if (node.children && node.children.length) {
      _walkPlacedNodesAbsolute(node.children, visit);
    }
  }
}

function renderElkDebugOverlay(snapshot) {
  const g = document.createElementNS(SVG_NS, "g");
  g.id = "dg-elk-debug-overlay";
  g.setAttribute("pointer-events", "none");

  const ox = snapshot.originX || 0;
  const oy = snapshot.originY || 0;

  _walkPlacedNodesAbsolute(snapshot.nodes, (node) => {
    const x = node.x + ox;
    const y = node.y + oy;
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", _fmtSvgNumber(x));
    rect.setAttribute("y", _fmtSvgNumber(y));
    rect.setAttribute("width", _fmtSvgNumber(node.width));
    rect.setAttribute("height", _fmtSvgNumber(node.height));
    rect.setAttribute("fill", "none");
    rect.setAttribute("stroke", node.children && node.children.length ? "#3366cc" : "#0099cc");
    rect.setAttribute("stroke-width", "1");
    rect.setAttribute("stroke-dasharray", "4 3");
    g.appendChild(rect);

    const idText = document.createElementNS(SVG_NS, "text");
    idText.setAttribute("x", _fmtSvgNumber(x + 4));
    idText.setAttribute("y", _fmtSvgNumber(y + 12));
    idText.setAttribute("font-family", "Ubuntu Sans, monospace");
    idText.setAttribute("font-size", "10");
    idText.setAttribute("fill", "#3366cc");
    idText.textContent = node.id;
    g.appendChild(idText);
  });

  for (const edge of snapshot.edges || []) {
    for (const section of edge.sections || []) {
      const points = [
        [section.startPoint.x + ox, section.startPoint.y + oy],
        ...(section.bendPoints || []).map((bp) => [bp.x + ox, bp.y + oy]),
        [section.endPoint.x + ox, section.endPoint.y + oy],
      ];
      for (let i = 0; i < points.length - 1; i++) {
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", _fmtSvgNumber(points[i][0]));
        line.setAttribute("y1", _fmtSvgNumber(points[i][1]));
        line.setAttribute("x2", _fmtSvgNumber(points[i + 1][0]));
        line.setAttribute("y2", _fmtSvgNumber(points[i + 1][1]));
        line.setAttribute("stroke", "#00aa66");
        line.setAttribute("stroke-width", "1.5");
        g.appendChild(line);
      }
    }
    for (const lbl of edge.labels || []) {
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", _fmtSvgNumber(lbl.x + ox));
      rect.setAttribute("y", _fmtSvgNumber(lbl.y + oy));
      rect.setAttribute("width", _fmtSvgNumber(lbl.width));
      rect.setAttribute("height", _fmtSvgNumber(lbl.height));
      rect.setAttribute("fill", "rgba(255, 180, 60, 0.15)");
      rect.setAttribute("stroke", "#cc7700");
      rect.setAttribute("stroke-width", "1");
      g.appendChild(rect);

      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", _fmtSvgNumber(lbl.x + ox + lbl.width / 2));
      text.setAttribute("y", _fmtSvgNumber(lbl.y + oy + lbl.height / 2 + 4));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-family", "Ubuntu Sans, monospace");
      text.setAttribute("font-size", "10");
      text.setAttribute("fill", "#884400");
      text.textContent = lbl.text;
      g.appendChild(text);
    }
  }

  const caption = document.createElementNS(SVG_NS, "text");
  caption.setAttribute("x", "8");
  caption.setAttribute("y", "16");
  caption.setAttribute("font-family", "Ubuntu Sans, monospace");
  caption.setAttribute("font-size", "11");
  caption.setAttribute("fill", "#3366cc");
  caption.textContent = "ELK debug: dashed rects = node boxes (not circles), green = edge routes, amber = ELK label boxes";
  g.appendChild(caption);

  return g;
}

/** Classic ELK renderer aesthetic — gray nodes, black orthogonal edges, label boxes. */
function renderElkRawView(snapshot, labelMap) {
  const g = document.createElementNS(SVG_NS, "g");
  g.id = "dg-elk-raw-view";
  g.setAttribute("pointer-events", "none");

  const ox = snapshot.originX || 0;
  const oy = snapshot.originY || 0;

  const caption = document.createElementNS(SVG_NS, "text");
  caption.setAttribute("x", "8");
  caption.setAttribute("y", "16");
  caption.setAttribute("font-family", "sans-serif");
  caption.setAttribute("font-size", "11");
  caption.setAttribute("fill", "#555555");
  caption.textContent = "ELK raw layout — gray nodes, black routes, ELK label boxes (toggle off for BF styling)";
  g.appendChild(caption);

  _walkPlacedNodesAbsolute(snapshot.nodes, (node) => {
    const x = node.x + ox;
    const y = node.y + oy;
    const isCompound = node.children && node.children.length > 0;

    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", _fmtSvgNumber(x));
    rect.setAttribute("y", _fmtSvgNumber(y));
    rect.setAttribute("width", _fmtSvgNumber(node.width));
    rect.setAttribute("height", _fmtSvgNumber(node.height));
    rect.setAttribute("fill", isCompound ? "#f5f5f5" : "#ececec");
    rect.setAttribute("stroke", "#333333");
    rect.setAttribute("stroke-width", "1");
    g.appendChild(rect);

    const label = (labelMap && labelMap[node.id]) || node.id;
    const lines = String(label).split("\n");
    const lineHeight = 13;
    const totalH = lines.length * lineHeight;
    let ty = y + (node.height - totalH) / 2 + 10;

    for (const line of lines) {
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", _fmtSvgNumber(x + node.width / 2));
      text.setAttribute("y", _fmtSvgNumber(ty));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-family", "sans-serif");
      text.setAttribute("font-size", "11");
      text.setAttribute("fill", "#111111");
      text.textContent = line;
      g.appendChild(text);
      ty += lineHeight;
    }
  });

  const headLen = 8;
  const headHalf = 4;

  for (const edge of snapshot.edges || []) {
    for (const section of edge.sections || []) {
      const points = [
        [section.startPoint.x + ox, section.startPoint.y + oy],
        ...(section.bendPoints || []).map((bp) => [bp.x + ox, bp.y + oy]),
        [section.endPoint.x + ox, section.endPoint.y + oy],
      ];

      for (let i = 0; i < points.length - 1; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[i + 1];
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", _fmtSvgNumber(x1));
        line.setAttribute("y1", _fmtSvgNumber(y1));
        line.setAttribute("x2", _fmtSvgNumber(x2));
        line.setAttribute("y2", _fmtSvgNumber(y2));
        line.setAttribute("stroke", "#000000");
        line.setAttribute("stroke-width", "1");
        g.appendChild(line);

        if (i === points.length - 2) {
          const head = _arrowheadPoints(x2, y2, x1, y1, headLen, headHalf);
          if (head) {
            const polygon = document.createElementNS(SVG_NS, "polygon");
            polygon.setAttribute("points", head.points);
            polygon.setAttribute("fill", "#000000");
            g.appendChild(polygon);
            const port = document.createElementNS(SVG_NS, "circle");
            port.setAttribute("cx", _fmtSvgNumber(x2));
            port.setAttribute("cy", _fmtSvgNumber(y2));
            port.setAttribute("r", "2.5");
            port.setAttribute("fill", "#000000");
            g.appendChild(port);
          }
        }
      }

      const [sx, sy] = points[0];
      const startPort = document.createElementNS(SVG_NS, "circle");
      startPort.setAttribute("cx", _fmtSvgNumber(sx));
      startPort.setAttribute("cy", _fmtSvgNumber(sy));
      startPort.setAttribute("r", "2.5");
      startPort.setAttribute("fill", "#000000");
      g.appendChild(startPort);
    }

    for (const lbl of edge.labels || []) {
      const lx = lbl.x + ox;
      const ly = lbl.y + oy;
      const box = document.createElementNS(SVG_NS, "rect");
      box.setAttribute("x", _fmtSvgNumber(lx));
      box.setAttribute("y", _fmtSvgNumber(ly));
      box.setAttribute("width", _fmtSvgNumber(lbl.width));
      box.setAttribute("height", _fmtSvgNumber(lbl.height));
      box.setAttribute("fill", "#ffffff");
      box.setAttribute("stroke", "#666666");
      box.setAttribute("stroke-width", "1");
      g.appendChild(box);

      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", _fmtSvgNumber(lx + lbl.width / 2));
      text.setAttribute("y", _fmtSvgNumber(ly + lbl.height / 2 + 4));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-family", "sans-serif");
      text.setAttribute("font-size", "10");
      text.setAttribute("fill", "#111111");
      text.textContent = lbl.text;
      g.appendChild(text);
    }
  }

  return g;
}

function refreshElkViewMode() {
  const svg = document.querySelector("#stage svg");
  if (!svg) return;

  const styled = svg.querySelector("#dg-styled-layer");
  const rawOn = _elkRawViewEnabled();

  if (styled) {
    styled.setAttribute("display", rawOn ? "none" : "inline");
  }

  svg.querySelector("#dg-elk-raw-view")?.remove();
  svg.querySelector("#dg-elk-debug-overlay")?.remove();

  if (rawOn && _lastElkSnapshot) {
    svg.appendChild(renderElkRawView(_lastElkSnapshot, _lastElkFrameLabels || {}));
    return;
  }

  if (_elkDebugEnabled() && _lastElkSnapshot) {
    svg.appendChild(renderElkDebugOverlay(_lastElkSnapshot));
  }
}

function refreshElkDebugOverlay() {
  refreshElkViewMode();
}

window.__DG_setElkDebugOverlay = function (enabled) {
  window.__DG_elkDebugOverlay = !!enabled;
  try {
    localStorage.setItem("dg.elkDebugOverlay", enabled ? "1" : "0");
  } catch (_) { /* ignore */ }
  refreshElkViewMode();
};

window.__DG_setElkRawView = function (enabled) {
  window.__DG_elkRawView = !!enabled;
  try {
    localStorage.setItem("dg.elkRawView", enabled ? "1" : "0");
  } catch (_) { /* ignore */ }
  refreshElkViewMode();
};

try {
  window.__DG_elkDebugOverlay = localStorage.getItem("dg.elkDebugOverlay") === "1";
  window.__DG_elkRawView = localStorage.getItem("dg.elkRawView") === "1";
} catch (_) {
  window.__DG_elkDebugOverlay = false;
  window.__DG_elkRawView = false;
}

/** HarfBuzz-backed text adapter for authoritative browser measurement. */
let _textAdapter = null;
let _textAdapterError = null;

function _textAdapterBackend() {
  return _textAdapter && typeof _textAdapter.measurementBackend === "string"
    ? _textAdapter.measurementBackend
    : null;
}

function _hasAuthoritativeTextAdapter() {
  return _textAdapterBackend() === "harfbuzz";
}

/** Test-only override for deterministic local-unready coverage. */
let _localRelayoutOverrideMode = "auto";

function _normaliseLocalRelayoutOverrideMode(mode) {
  return mode === "unready" ? "unready" : "auto";
}

function setLocalRelayoutOverrideMode(mode) {
  _localRelayoutOverrideMode = _normaliseLocalRelayoutOverrideMode(mode);
  return getLocalRelayoutStatus();
}

function getLocalRelayoutStatus() {
  const overrideMode = _normaliseLocalRelayoutOverrideMode(_localRelayoutOverrideMode);
  const frameTreeLoaded = !!_frameTreeJson;
  const textAdapterReady = !!_textAdapter;
  const textAdapterBackend = _textAdapterBackend();
  const textAdapterError = _textAdapterError;

  if (overrideMode === "unready") {
    return {
      ready: false,
      reason: "forced-unready",
      overrideMode,
      frameTreeLoaded,
      textAdapterReady,
      textAdapterBackend,
      textAdapterError,
    };
  }
  if (!frameTreeLoaded) {
    return {
      ready: false,
      reason: "missing-frame-tree",
      overrideMode,
      frameTreeLoaded,
      textAdapterReady,
      textAdapterBackend,
      textAdapterError,
    };
  }
  if (textAdapterError) {
    return {
      ready: false,
      reason: "text-adapter-init-failed",
      overrideMode,
      frameTreeLoaded,
      textAdapterReady,
      textAdapterBackend,
      textAdapterError,
    };
  }
  if (!textAdapterReady) {
    return {
      ready: false,
      reason: "missing-text-adapter",
      overrideMode,
      frameTreeLoaded,
      textAdapterReady,
      textAdapterBackend,
      textAdapterError,
    };
  }
  if (!_hasAuthoritativeTextAdapter()) {
    return {
      ready: false,
      reason: "non-harfbuzz-text-adapter",
      overrideMode,
      frameTreeLoaded,
      textAdapterReady,
      textAdapterBackend,
      textAdapterError,
    };
  }
  return {
    ready: true,
    reason: "ready",
    overrideMode,
    frameTreeLoaded,
    textAdapterReady,
    textAdapterBackend,
    textAdapterError,
  };
}

function isLocalRelayoutReady() {
  return getLocalRelayoutStatus().ready;
}

function getFrameTreeJson() {
  return _frameTreeJson ? JSON.parse(JSON.stringify(_frameTreeJson)) : null;
}

function _isElkLayeredDiagramJson(json) {
  if (json && json.layoutEngine === "elk-layered") return true;
  const cfg = window.__DG_CONFIG || {};
  return cfg.layout_engine === "elk-layered";
}

function _resolveElkOptionOverrides(diagram, model) {
  const fromYaml = (diagram && diagram.elkLayout) || {};
  let session = (model && model.elkLayoutOverrides) || {};
  // Model is updated on every sidebar input — prefer it over DOM reads so load/reload
  // cannot clobber saved YAML with stale server-rendered sidebar HTML.
  if (Object.keys(session).length === 0
    && window.ElkLayoutControls
    && typeof ElkLayoutControls.collectOverrides === "function") {
    session = ElkLayoutControls.collectOverrides();
    if (model) {
      model.elkLayoutOverrides = { ...session };
    }
  }
  return { ...fromYaml, ...session };
}

function setFrameTreeJson(json) {
  _frameTreeJson = json ? JSON.parse(JSON.stringify(json)) : null;
}

/**
 * Apply a session text.heading override to the frame tree (mutates target in place).
 * Containers with synthetic __heading children are updated there — clearing heading
 * text must not strip panel/section structure or demote the parent to level 0.
 */
function _applyTextHeadingOverride(target, headingText) {
  const headingChild = target.children.find(c => c.role === "heading");
  if (headingChild) {
    headingChild.label = [
      LayoutEngine.createLine(headingText || ""),
    ];
    return;
  }
  if (headingText && target.heading) {
    target.heading = LayoutEngine.createLine(headingText);
  } else if (headingText) {
    target.heading = LayoutEngine.createLine(headingText);
  } else {
    target.heading = undefined;
  }
}

/**
 * Remove frames (and subtrees) from a frame-tree JSON object (mutates in place).
 * @param {object} treeJson
 * @param {string[]} frameIds  Top-level ids to remove (ancestors win over descendants).
 * @returns {string[]} ids actually removed from the tree
 */
function applyFrameTreeRemovalsToJson(treeJson, frameIds) {
  if (!treeJson || !treeJson.root || !frameIds || frameIds.length === 0) return [];
  const rootId = treeJson.root && treeJson.root.id;
  const requested = [...new Set(frameIds.filter(id => id && id !== rootId))];
  if (requested.length === 0) return [];

  const removed = new Set();
  function collectDescendants(node) {
    if (!node || typeof node !== "object") return;
    if (node.id) removed.add(node.id);
    for (const child of node.children || []) collectDescendants(child);
  }
  function findNode(node, id) {
    if (!node) return null;
    if (node.id === id) return node;
    for (const child of node.children || []) {
      const hit = findNode(child, id);
      if (hit) return hit;
    }
    return null;
  }
  function pruneChildren(children) {
    if (!Array.isArray(children)) return [];
    const next = [];
    for (const child of children) {
      if (!child || typeof child !== "object") continue;
      if (requested.includes(child.id)) {
        collectDescendants(child);
        continue;
      }
      child.children = pruneChildren(child.children);
      next.push(child);
    }
    return next;
  }

  for (const id of requested) {
    const node = findNode(treeJson.root, id);
    if (node) collectDescendants(node);
  }
  treeJson.root.children = pruneChildren(treeJson.root.children);
  if (Array.isArray(treeJson.arrows)) {
    treeJson.arrows = treeJson.arrows.filter(
      a => a && !removed.has(a.source) && !removed.has(a.target),
    );
  }
  return [...removed];
}

/** @deprecated Prefer session-only removals via model.removedIds; mutates canonical cache. */
function applyFrameTreeRemovals(frameIds) {
  if (!_frameTreeJson) return [];
  return applyFrameTreeRemovalsToJson(_frameTreeJson, frameIds);
}

function applySessionRemovalsToDiagramJson(diagramJson, model) {
  if (!diagramJson || !model || !model.removedIds || model.removedIds.size === 0) return;
  const topIds = typeof model.topLevelRemovalIds === "function"
    ? model.topLevelRemovalIds()
    : [...model.removedIds];
  applyFrameTreeRemovalsToJson(diagramJson, topIds);
}

/**
 * Load the frame tree from the server and create the text adapter.
 * Call once during editor initialization.
 */
async function initLayoutBridge(slug) {
  _frameTreeJson = null;
  _textAdapter = null;
  _textAdapterError = null;
  try {
    const resp = await fetch("/api/frame-tree/" + slug + "?t=" + Date.now(), { cache: "no-store" });
    if (resp.ok) {
      _frameTreeJson = await resp.json();
    }
  } catch (e) {
    console.warn("layout-bridge: failed to load frame tree", e);
  }

  try {
    const hbModule = await import("/preview/layout-engine-harfbuzz.js");
    _textAdapter = await hbModule.createDefaultHarfBuzzTextAdapter({
      fontUrl: "/preview/layout-font.ttf",
    });
    if (!_hasAuthoritativeTextAdapter()) {
      throw new Error(
        "layout-bridge requires a HarfBuzz text adapter, got "
        + String(_textAdapterBackend() || "unknown"),
      );
    }
  } catch (e) {
    _textAdapter = null;
    _textAdapterError = e && e.message ? String(e.message) : String(e);
    console.error("layout-bridge: failed to initialize HarfBuzz text adapter", e);
  }
}

/**
 * Perform layout locally and patch the SVG DOM.
 * Returns { coerced, width, height } or null on failure.
 *
 * This replaces requestV3Relayout() — no server round-trip needed.
 *
 * @param {object} opts
 * @param {boolean} [opts.skipModelUpdate] - When true, the component model
 *   is NOT updated after patching the SVG.  Used during live drag/resize so
 *   snap calculations keep referencing the original positions.
 */
function _layoutOptionsFromDiagram(diagram) {
  return {
    gridCols: diagram.gridCols,
    gridColGap: diagram.gridColGap,
    gridOuterMargin: diagram.gridOuterMargin,
  };
}

function performLocalRelayout(model, overrides, gridOverrides, opts) {
  const readiness = getLocalRelayoutStatus();
  if (!readiness.ready) {
    console.warn("layout-bridge: not ready (" + readiness.reason + ")");
    return null;
  }

  try {
    // Deep-clone the stored frame tree and deserialize
    const diagramJson = JSON.parse(JSON.stringify(_frameTreeJson));
    applySessionRemovalsToDiagramJson(diagramJson, model);
    if (_isElkLayeredDiagramJson(diagramJson)) {
      console.warn("layout-bridge: performLocalRelayout skipped for elk-layered diagram");
      return null;
    }
    const diagram = deserializeFrameDiagram(diagramJson);

    // Build override map (same format as requestV3Relayout sends)
    const FRAME_KEYS = [
      "direction", "gap", "padding", "padding_top", "padding_right", "padding_bottom", "padding_left",
      "sizing", "sizing_w", "sizing_h",
      "fill_weight", "align", "wrap", "width", "height", "min_width", "max_width", "max_width_chars", "min_height",
      "max_height", "children_order", "fill", "border", "level", "text",
      "position", "x", "y",
    ];
    const allFrameOverrides = {};
    for (const [fid, ovr] of Object.entries(overrides)) {
      const entry = {};
      for (const key of FRAME_KEYS) {
        if (ovr[key] !== undefined) entry[key] = ovr[key];
      }
      if (Object.keys(entry).length > 0) allFrameOverrides[fid] = entry;
    }

    // Apply overrides to the frame tree
    applyOverridesToFrameTree(diagram, allFrameOverrides, gridOverrides);

    // Collect old bounds from component model (before layout)
    const oldBounds = {};
    for (const id of model.allIds) {
      const node = model.get(id);
      if (node) {
        oldBounds[id] = {
          x: node.data.x,
          y: node.data.y,
          w: node.data.width,
          h: node.data.height,
        };
      }
    }

    // Resolve styles before layout so typography-affecting mutations
    // (for example section small-caps headings) participate in measure/place,
    // matching the Python pipeline's resolve_styles() -> layout ordering.
    LayoutEngine.resolveStyles(diagram.root);

    // Run layout
    const result = LayoutEngine.layoutFrameTree(diagram.root, _textAdapter, _layoutOptionsFromDiagram(diagram));

    // Collect new bounds
    const newBounds = collectPlacedBounds(diagram.root, {});
    const framesById = collectFramesById(diagram.root, {});

    // Patch SVG DOM
    const svgEl = document.querySelector("#stage svg");
    patchSvgFromLayout(svgEl, oldBounds, newBounds, framesById);

    // Route and patch arrows
    let routedArrows = [];
    if (diagram.arrows && diagram.arrows.length > 0) {
      routedArrows = routeArrows(diagram.arrows, newBounds);
      patchArrowsSvg(svgEl, routedArrows);
    }

    // Update component model (skip during live resize to keep snap stable)
    if (!opts || !opts.skipModelUpdate) {
      updateComponentModelFromLayout(model, diagram.root);
      syncArrowsInModel(model, diagram.arrows, routedArrows);
    }

    return {
      coerced: result.coerced,
      width: result.width,
      height: result.height,
    };
  } catch (e) {
    console.error("layout-bridge: local relayout failed", e);
    return null;
  }
}

/**
 * Full ELK relayout + SVG replace (async). Used when ELK params or frame overrides change.
 */
async function performElkRelayout(model, overrides, gridOverrides) {
  const readiness = getLocalRelayoutStatus();
  if (!readiness.ready) {
    console.warn("layout-bridge: not ready (" + readiness.reason + ")");
    return null;
  }
  try {
    const hasGridOverrides = gridOverrides && Object.keys(gridOverrides).length > 0;
    const renderResult = await renderFreshSvg(
      overrides,
      hasGridOverrides ? gridOverrides : null,
      model,
    );
    if (!renderResult || !renderResult.svg) return null;
    const stage = document.getElementById("stage");
    if (!stage) return null;
    stage.replaceChildren(renderResult.svg);
    return {
      coerced: renderResult.coerced,
      width: renderResult.width,
      height: renderResult.height,
    };
  } catch (e) {
    console.error("layout-bridge: ELK relayout failed", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Arrow SVG creation (T007–T008)
// ---------------------------------------------------------------------------

function _arrowheadPoints(tipX, tipY, prevX, prevY, headLen, headHalf) {
  const dx = tipX - prevX;
  const dy = tipY - prevY;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const ux = dx / length;
  const uy = dy / length;
  const bx = tipX - ux * headLen;
  const by = tipY - uy * headLen;
  const nx = -uy * headHalf;
  const ny = ux * headHalf;
  return {
    base: [bx, by],
    points: `${(bx + nx).toFixed(1)},${(by + ny).toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)} ${(bx - nx).toFixed(1)},${(by - ny).toFixed(1)}`,
  };
}

function createArrowsSvg(routedArrows, boundsMap) {
  const frag = document.createDocumentFragment();
  const HL = (window.__DG_CONFIG && window.__DG_CONFIG.head_len) || 12;
  const HH = (window.__DG_CONFIG && window.__DG_CONFIG.head_half) || 6;

  for (const arrow of routedArrows) {
    const g = document.createElementNS(SVG_NS, "g");
    if (arrow.componentId) {
      g.setAttribute("data-component-id", arrow.componentId);
    }
    const points = [arrow.start, ...arrow.waypoints, arrow.end];
    if (points.length < 2) continue;

    // Compute arrowhead so shaft ends at the base
    const [tx, ty] = points[points.length - 1];
    const [px, py] = points[points.length - 2];
    const head = _arrowheadPoints(tx, ty, px, py, HL, HH);
    const shaftPoints = points.slice();
    if (head) {
      shaftPoints[shaftPoints.length - 1] = head.base;
    }

    const color = arrow.color || "#E95420";
    // Shaft segments + transparent hit areas (editor selection / knee insert)
    for (let i = 0; i < shaftPoints.length - 1; i++) {
      const x1 = shaftPoints[i][0];
      const y1 = shaftPoints[i][1];
      const x2 = shaftPoints[i + 1][0];
      const y2 = shaftPoints[i + 1][1];
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", x1.toFixed(1));
      line.setAttribute("y1", y1.toFixed(1));
      line.setAttribute("x2", x2.toFixed(1));
      line.setAttribute("y2", y2.toFixed(1));
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", color);
      line.setAttribute("stroke-width", "1");
      line.setAttribute("stroke-miterlimit", "10");
      g.appendChild(line);

      const hit = document.createElementNS(SVG_NS, "line");
      hit.setAttribute("x1", x1.toFixed(1));
      hit.setAttribute("y1", y1.toFixed(1));
      hit.setAttribute("x2", x2.toFixed(1));
      hit.setAttribute("y2", y2.toFixed(1));
      hit.setAttribute("stroke", "transparent");
      hit.setAttribute("stroke-width", "12");
      hit.style.pointerEvents = "stroke";
      g.appendChild(hit);
    }

    // Arrowhead polygon
    if (head) {
      const polygon = document.createElementNS(SVG_NS, "polygon");
      polygon.setAttribute("points", head.points);
      polygon.setAttribute("fill", color);
      g.appendChild(polygon);
    }

    // Step label on longest shaft segment — annotation typography, offset from line.
    const labelGap = arrow.labelGap ?? LayoutEngine.GRID_GUTTER ?? 24;
    const labelEl = _buildArrowLabelElement(arrow, shaftPoints, labelGap, boundsMap);
    if (labelEl) {
      g.appendChild(labelEl);
    }

    frag.appendChild(g);
  }
  return frag;
}

// ---------------------------------------------------------------------------
// Overlay SVG rendering (T009)
// ---------------------------------------------------------------------------

function renderOverlaysSvg(overlays, boundsMap) {
  const OVERLAY_PAD = 8;
  const frag = document.createDocumentFragment();
  if (!overlays || overlays.length === 0) return frag;

  for (const ov of overlays) {
    const memberBounds = ov.members
      .filter(m => boundsMap[m])
      .map(m => boundsMap[m]);
    if (memberBounds.length === 0) continue;

    const minX = Math.min(...memberBounds.map(b => b.x));
    const minY = Math.min(...memberBounds.map(b => b.y));
    const maxX = Math.max(...memberBounds.map(b => b.x + b.w));
    const maxY = Math.max(...memberBounds.map(b => b.y + b.h));

    const rx = minX - OVERLAY_PAD;
    const ry = minY - OVERLAY_PAD;
    const rw = (maxX - minX) + 2 * OVERLAY_PAD;
    const rh = (maxY - minY) + 2 * OVERLAY_PAD;

    const g = document.createElementNS(SVG_NS, "g");
    if (ov.id) g.setAttribute("data-component-id", ov.id);

    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", _fmtSvgNumber(rx));
    rect.setAttribute("y", _fmtSvgNumber(ry));
    rect.setAttribute("width", _fmtSvgNumber(rw));
    rect.setAttribute("height", _fmtSvgNumber(rh));
    rect.setAttribute("fill", "transparent");
    rect.setAttribute("stroke", "#000000");
    rect.setAttribute("stroke-width", "1");
    rect.setAttribute("stroke-dasharray", "2 4");
    g.appendChild(rect);

    if (ov.label) {
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("font-family", "Ubuntu Sans");
      text.setAttribute("font-size", "14");
      text.setAttribute("font-weight", "400");
      text.setAttribute("fill", "#000000");
      const tspan = document.createElementNS(SVG_NS, "tspan");
      tspan.setAttribute("x", _fmtSvgNumber(rx + OVERLAY_PAD));
      tspan.setAttribute("y", _fmtSvgNumber(ry - 4));
      tspan.textContent = ov.label;
      text.appendChild(tspan);
      g.appendChild(text);
    }

    frag.appendChild(g);
  }
  return frag;
}

// ---------------------------------------------------------------------------
// Core rendering: renderFrameTreeToSvg (T010)
// ---------------------------------------------------------------------------

/**
 * Build a complete SVG element from a laid-out FrameDiagram.
 *
 * @param {object} diagram  Deserialized FrameDiagram (with overlays, arrows)
 * @param {object} result   Output of layoutFrameTree() – { width, height, coerced }
 * @param {object} options
 * @param {Map<string, Element>} [options.iconElements]  Pre-built icon <g> elements keyed by icon name
 * @param {Array} [options.overlays]  Raw overlay objects from the JSON (not on TS FrameDiagram)
 * @returns {SVGSVGElement}
 */
function renderFrameTreeToSvg(diagram, result, options) {
  const width = result.width || 400;
  const height = result.height || 200;
  const iconElements = (options && options.iconElements) || new Map();
  const overlays = (options && options.overlays) || [];

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("xml:space", "preserve");

  // White background
  const bgRect = document.createElementNS(SVG_NS, "rect");
  bgRect.setAttribute("width", String(width));
  bgRect.setAttribute("height", String(height));
  bgRect.setAttribute("fill", "#FFFFFF");
  svg.appendChild(bgRect);

  const styledLayer = document.createElementNS(SVG_NS, "g");
  styledLayer.id = "dg-styled-layer";
  svg.appendChild(styledLayer);

  // Guard: empty or missing root produces valid SVG with just background
  if (!diagram || !diagram.root) {
    return svg;
  }

  // Render frame tree depth-first
  function _renderFrame(frame) {
    const cid = frame.id || null;
    const g = document.createElementNS(SVG_NS, "g");
    if (cid) {
      g.setAttribute("data-component-id", cid);
    }

    // Get pre-fetched icon element for this frame
    let iconEl = null;
    if (frame.icon && iconElements.has(frame.icon)) {
      iconEl = iconElements.get(frame.icon).cloneNode(true);
      // Apply per-frame icon fill
      const iconFill = frame.resolvedIconFill ?? frame.iconFill ?? "#000000";
      iconEl.querySelectorAll("path, circle, rect, polygon, ellipse").forEach(el => {
        el.setAttribute("fill", iconFill);
      });
    }

    patchFrameGroup(g, frame, iconEl);
    styledLayer.appendChild(g);

    // Recurse into children
    if (frame.children) {
      for (const child of frame.children) {
        _renderFrame(child);
      }
    }
  }

  _renderFrame(diagram.root);

  // Route and render arrows
  if (diagram.arrows && diagram.arrows.length > 0) {
    const boundsMap = collectPlacedBounds(diagram.root, {});
    const routed = routeArrows(diagram.arrows, boundsMap);
    const arrowFrag = createArrowsSvg(routed, boundsMap);
    styledLayer.appendChild(arrowFrag);
  }

  // Render overlays
  if (overlays.length > 0) {
    const boundsMap = collectPlacedBounds(diagram.root, {});
    const overlayFrag = renderOverlaysSvg(overlays, boundsMap);
    styledLayer.appendChild(overlayFrag);
  }

  return svg;
}

// ---------------------------------------------------------------------------
// Full fresh-render pipeline (called by editor.js loadSVG)
// ---------------------------------------------------------------------------

/**
 * Build a complete SVG element from scratch using the TS pipeline.
 *
 * Assumes initLayoutBridge() has already been called and the bridge is ready.
 *
 * @param {object} overrides       Frame-level overrides keyed by frame id
 * @param {object|null} gridOverrides  Grid-level overrides (or null)
 * @param {object} model           ComponentModel instance (for updateComponentModelFromLayout)
 * @returns {Promise<{svg: SVGSVGElement, width: number, height: number, coerced: boolean}>}
 */
async function renderFreshSvg(overrides, gridOverrides, model) {
  // Deep-clone the stored frame tree and deserialize
  const diagramJson = JSON.parse(JSON.stringify(_frameTreeJson));
  applySessionRemovalsToDiagramJson(diagramJson, model);
  const rawOverlays = diagramJson.overlays || [];
  const diagram = deserializeFrameDiagram(diagramJson);

  // Build override map (same format as performLocalRelayout)
  const FRAME_KEYS = [
    "direction", "gap", "padding", "padding_top", "padding_right", "padding_bottom", "padding_left",
    "sizing", "sizing_w", "sizing_h",
    "fill_weight", "align", "wrap", "width", "height", "min_width", "max_width", "max_width_chars", "min_height",
    "max_height", "children_order", "fill", "border", "level", "text",
    "position", "x", "y",
  ];
  const allFrameOverrides = {};
  for (const [fid, ovr] of Object.entries(overrides)) {
    const entry = {};
    for (const key of FRAME_KEYS) {
      if (ovr[key] !== undefined) entry[key] = ovr[key];
    }
    if (Object.keys(entry).length > 0) allFrameOverrides[fid] = entry;
  }

  applyOverridesToFrameTree(diagram, allFrameOverrides, gridOverrides);

  let result;
  if (_isElkLayeredDiagramJson(diagramJson) && typeof LayoutEngine.layoutElkFrameDiagram === "function") {
    const elkOptionOverrides = _resolveElkOptionOverrides(diagram, model);
    result = await LayoutEngine.layoutElkFrameDiagram(diagram, _textAdapter, {
      diagramType: diagram.diagramType,
      elkOptionOverrides,
    });
  } else {
    LayoutEngine.resolveStyles(diagram.root);
    result = LayoutEngine.layoutFrameTree(diagram.root, _textAdapter, _layoutOptionsFromDiagram(diagram));
  }

  // Collect unique icon names from the frame tree
  const iconNames = new Set();
  function _collectIcons(frame) {
    if (frame.icon) iconNames.add(frame.icon);
    if (frame.children) frame.children.forEach(_collectIcons);
  }
  _collectIcons(diagram.root);

  // Fetch all icons in parallel
  const iconElements = new Map();
  if (iconNames.size > 0) {
    const entries = await Promise.all(
      Array.from(iconNames).map(async (name) => {
        const svgContent = await fetchIconSvg(name);
        if (svgContent) {
          const el = buildIconElement(name, svgContent, null);
          return [name, el];
        }
        return [name, null];
      })
    );
    for (const [name, el] of entries) {
      if (el) iconElements.set(name, el);
    }
  }

  // Build SVG DOM
  const svgElement = renderFrameTreeToSvg(diagram, result, { iconElements, overlays: rawOverlays });

  _lastElkSnapshot = result.elkSnapshot || null;
  _lastElkFrameLabels = _lastElkSnapshot ? _collectElkFrameLabels(diagram.root) : null;
  refreshElkViewMode();

  // Update component model from layout
  updateComponentModelFromLayout(model, diagram.root);
  const boundsMap = collectPlacedBounds(diagram.root, {});
  const routedArrows = diagram.arrows && diagram.arrows.length > 0
    ? routeArrows(diagram.arrows, boundsMap)
    : [];
  syncArrowsInModel(model, diagram.arrows, routedArrows);

  return {
    svg: svgElement,
    width: result.width,
    height: result.height,
    coerced: result.coerced,
  };
}

window.isLocalRelayoutReady = isLocalRelayoutReady;
window.getLocalRelayoutStatus = getLocalRelayoutStatus;
window.__DG_TEST_setLocalRelayoutMode = setLocalRelayoutOverrideMode;
window.renderFrameTreeToSvg = renderFrameTreeToSvg;
window.fetchIconSvg = fetchIconSvg;
window.buildIconElement = buildIconElement;
window.refreshElkDebugOverlay = refreshElkDebugOverlay;
window.refreshElkViewMode = refreshElkViewMode;
window.renderFreshSvg = renderFreshSvg;
window.arrowComponentId = arrowComponentId;
window.syncArrowsInModel = syncArrowsInModel;
window.getLayoutTextAdapter = () => _textAdapter;
window.getFrameTreeJson = getFrameTreeJson;
window.setFrameTreeJson = setFrameTreeJson;
window.applyFrameTreeRemovals = applyFrameTreeRemovals;
window.applyFrameTreeRemovalsToJson = applyFrameTreeRemovalsToJson;
window.applySessionRemovalsToDiagramJson = applySessionRemovalsToDiagramJson;
