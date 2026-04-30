"use strict";
// ---------------------------------------------------------------------------
// Constraint enforcement – brand rules for the diagram editor
// ---------------------------------------------------------------------------
// Each constraint is a function: (model, svgEl) → Violation[]
// Violations are advisory (warnings) by default; violations with
// severity "error" block save.
// ---------------------------------------------------------------------------

const ViolationSeverity = Object.freeze({
  WARNING: "warning",
  ERROR: "error",
});

class Violation {
  constructor(constraintId, componentId, message, severity = ViolationSeverity.WARNING) {
    this.constraintId = constraintId;
    this.componentId = componentId;
    this.message = message;
    this.severity = severity;
  }
}


// ---------------------------------------------------------------------------
// Built-in constraints
// ---------------------------------------------------------------------------

const BASELINE_UNIT = 8;
const APPROVED_FILLS = new Set(["#FFFFFF", "#ffffff", "#F3F3F3", "#f3f3f3", "#000000", "transparent"]);
const APPROVED_STROKES = new Set(["#000000", "#E95420", "none"]);
const ARROW_COLOR = "#E95420";
const MAX_HIGHLIGHT_BOXES = 1;

/**
 * Grid alignment: all component positions should land on the 8px baseline grid.
 */
function constraintGridAlignment(model, svgEl) {
  const violations = [];
  model.walk((node) => {
    const data = node.data;
    if (data.x !== undefined && data.x % BASELINE_UNIT !== 0) {
      violations.push(new Violation("grid-align", node.id,
        `x=${data.x} is not on ${BASELINE_UNIT}px grid`, ViolationSeverity.WARNING));
    }
    if (data.y !== undefined && data.y % BASELINE_UNIT !== 0) {
      violations.push(new Violation("grid-align", node.id,
        `y=${data.y} is not on ${BASELINE_UNIT}px grid`, ViolationSeverity.WARNING));
    }
    if (data.width !== undefined && data.width % BASELINE_UNIT !== 0) {
      violations.push(new Violation("grid-align", node.id,
        `width=${data.width} is not on ${BASELINE_UNIT}px grid`, ViolationSeverity.WARNING));
    }
    if (data.height !== undefined && data.height % BASELINE_UNIT !== 0) {
      violations.push(new Violation("grid-align", node.id,
        `height=${data.height} is not on ${BASELINE_UNIT}px grid`, ViolationSeverity.WARNING));
    }
  });
  return violations;
}

/**
 * Override grid alignment: overridden positions should stay on the 8px grid.
 */
function constraintOverrideGridAlignment(model) {
  const violations = [];
  for (const [cid, ov] of Object.entries(model.overrides)) {
    for (const key of ["dx", "dy", "dw", "dh"]) {
      const val = ov[key];
      if (val !== undefined && val !== 0 && val % BASELINE_UNIT !== 0) {
        violations.push(new Violation("override-grid", cid,
          `Override ${key}=${val} is not on ${BASELINE_UNIT}px grid`, ViolationSeverity.WARNING));
      }
    }
  }
  return violations;
}

/**
 * Approved fills: only brand-approved background colours.
 */
function constraintApprovedFills(model, svgEl) {
  const violations = [];
  if (!svgEl) return violations;
  svgEl.querySelectorAll("[data-component-id] > rect:first-of-type").forEach(rect => {
    const fill = (rect.getAttribute("fill") || "").trim();
    if (fill && fill !== "none" && !APPROVED_FILLS.has(fill)) {
      const cid = rect.closest("[data-component-id]").getAttribute("data-component-id");
      violations.push(new Violation("approved-fill", cid,
        `Fill ${fill} is not in the approved palette`, ViolationSeverity.WARNING));
    }
  });
  return violations;
}

/**
 * Highlight box limit: at most one black-filled box per diagram.
 */
function constraintHighlightLimit(model, svgEl) {
  const violations = [];
  if (!svgEl) return violations;
  const blackBoxes = [];
  svgEl.querySelectorAll("[data-component-id] > rect:first-of-type").forEach(rect => {
    const fill = (rect.getAttribute("fill") || "").trim().toLowerCase();
    if (fill === "#000000" || fill === "#000") {
      const cid = rect.closest("[data-component-id]").getAttribute("data-component-id");
      blackBoxes.push(cid);
    }
  });
  if (blackBoxes.length > MAX_HIGHLIGHT_BOXES) {
    for (const cid of blackBoxes) {
      violations.push(new Violation("highlight-limit", cid,
        `${blackBoxes.length} highlight boxes found (max ${MAX_HIGHLIGHT_BOXES})`, ViolationSeverity.WARNING));
    }
  }
  return violations;
}

/**
 * Orange fill prohibition: orange (#E95420) is reserved for arrows only.
 */
function constraintNoOrangeFill(model, svgEl) {
  const violations = [];
  if (!svgEl) return violations;
  svgEl.querySelectorAll("[data-component-id] > rect:first-of-type").forEach(rect => {
    const fill = (rect.getAttribute("fill") || "").trim().toLowerCase();
    if (fill === "#e95420") {
      const cid = rect.closest("[data-component-id]").getAttribute("data-component-id");
      violations.push(new Violation("no-orange-fill", cid,
        "Orange (#E95420) is reserved for arrows – not allowed as box fill", ViolationSeverity.ERROR));
    }
  });
  return violations;
}

/**
 * Box containment: children should stay within parent bounds.
 */
function constraintBoxContainment(model) {
  const violations = [];
  model.walk((node) => {
    if (!node.parent || !node.data.x || !node.parent.data.x) return;
    const p = node.parent.data;
    const c = node.data;
    const pEff = model.getEffectiveDelta(node.parent.id);
    const cEff = model.getEffectiveDelta(node.id);
    const cOwn = model.getOwnDelta(node.id);

    const px = p.x + pEff.dx;
    const py = p.y + pEff.dy;
    const pw = (p.width || 0) + (model.getOwnDelta(node.parent.id).dw || 0);
    const ph = (p.height || 0) + (model.getOwnDelta(node.parent.id).dh || 0);

    const cx = c.x + cEff.dx;
    const cy = c.y + cEff.dy;
    const cw = (c.width || 0) + cOwn.dw;
    const ch = (c.height || 0) + cOwn.dh;

    if (cx < px || cy < py || cx + cw > px + pw || cy + ch > py + ph) {
      violations.push(new Violation("containment", node.id,
        `Extends outside parent "${node.parent.id}"`, ViolationSeverity.WARNING));
    }
  });
  return violations;
}


// ---------------------------------------------------------------------------
// Constraint registry
// ---------------------------------------------------------------------------

class ConstraintRegistry {
  constructor() {
    this._constraints = [];
  }

  /** Register a constraint function. */
  add(id, fn, description) {
    this._constraints.push({ id, fn, description });
  }

  /** Run all constraints and return violations. */
  validate(model, svgEl) {
    const all = [];
    for (const c of this._constraints) {
      try {
        const violations = c.fn(model, svgEl);
        all.push(...violations);
      } catch (e) {
        console.warn(`Constraint "${c.id}" threw:`, e);
      }
    }
    return all;
  }

  /** Count violations by severity. */
  summarise(violations) {
    let errors = 0, warnings = 0;
    for (const v of violations) {
      if (v.severity === ViolationSeverity.ERROR) errors++;
      else warnings++;
    }
    return { errors, warnings, total: violations.length };
  }

  /** Get violations for a specific component. */
  forComponent(violations, cid) {
    return violations.filter(v => v.componentId === cid);
  }
}


// ---------------------------------------------------------------------------
// Default registry with all built-in constraints
// ---------------------------------------------------------------------------

function createDefaultRegistry() {
  const reg = new ConstraintRegistry();
  reg.add("grid-align", constraintGridAlignment, "Component positions on 8px baseline grid");
  reg.add("override-grid", constraintOverrideGridAlignment, "Override deltas on 8px baseline grid");
  reg.add("approved-fill", constraintApprovedFills, "Only brand-approved background fills");
  reg.add("highlight-limit", constraintHighlightLimit, "At most 1 highlight (black) box per diagram");
  reg.add("no-orange-fill", constraintNoOrangeFill, "Orange is reserved for arrows");
  reg.add("containment", constraintBoxContainment, "Children stay within parent bounds");
  return reg;
}


// Expose to global scope
window.ConstraintRegistry = ConstraintRegistry;
window.Violation = Violation;
window.ViolationSeverity = ViolationSeverity;
window.createDefaultRegistry = createDefaultRegistry;
