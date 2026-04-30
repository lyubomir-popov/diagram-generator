"use strict";
// ---------------------------------------------------------------------------
// ComponentModel – client-side tree model for the diagram editor
// ---------------------------------------------------------------------------
// Wraps the flat server component tree into an indexed model with
// parent/child navigation, override management, and delta computation.
// ---------------------------------------------------------------------------

class ComponentNode {
  constructor(data, parent) {
    this.id = data.id;
    this.type = data.type || "box";
    this.data = data;            // raw server JSON
    this.parent = parent;        // ComponentNode | null
    this.children = [];          // ComponentNode[]
    this.layout = data.layout || "";        // "vertical", "horizontal", "grid", ""
    this.layoutGap = data.layout_gap || 0;  // gap between children
    this.layoutColGap = data.layout_col_gap || data.layout_gap || 0;
    this.layoutRowGap = data.layout_row_gap || data.layout_gap || 0;
    this.pad = data.pad || 0;               // internal padding (INSET for bordered, 0 for borderless)
    this.headingHeight = data.heading_height || 0; // panel heading height incl gap
    if (data.children) {
      for (const child of data.children) {
        this.children.push(new ComponentNode(child, this));
      }
    }
  }

  /** All ancestor IDs from root to direct parent (excludes self). */
  get ancestorIds() {
    const trail = [];
    let node = this.parent;
    while (node) {
      trail.unshift(node.id);
      node = node.parent;
    }
    return trail;
  }

  /** All descendant IDs (excludes self). */
  get descendantIds() {
    const acc = [];
    function collect(nodes) {
      for (const n of nodes) { acc.push(n.id); collect(n.children); }
    }
    collect(this.children);
    return acc;
  }

  /** The root ancestor (top-level component). */
  get root() {
    let node = this;
    while (node.parent) node = node.parent;
    return node;
  }
}


class ComponentModel {
  constructor() {
    this._roots = [];       // ComponentNode[] – top-level nodes
    this._index = new Map(); // id → ComponentNode
    this.overrides = {};     // id → { dx?, dy?, dw?, dh?, waypoints?, text? }
    this.gridOverrides = {}; // { col_gap?, row_gap?, outer_margin? }
    this.definitionHash = "";
    this.isStale = false;
  }

  /** Replace tree from server JSON array. */
  loadTree(treeJson) {
    this._roots = [];
    this._index = new Map();
    for (const item of treeJson) {
      const node = new ComponentNode(item, null);
      this._roots.push(node);
      this._indexNode(node);
    }
  }

  _indexNode(node) {
    this._index.set(node.id, node);
    for (const child of node.children) {
      this._indexNode(child);
    }
  }

  /** Get a node by ID. */
  get(id) { return this._index.get(id) || null; }

  /** Top-level nodes. */
  get roots() { return this._roots; }

  /** All node IDs. */
  get allIds() { return [...this._index.keys()]; }

  /** Ancestor IDs of a component (root-first, excludes self). */
  getAncestors(id) {
    const node = this.get(id);
    return node ? node.ancestorIds : [];
  }

  /** Parent node of a component. */
  getParent(id) {
    const node = this.get(id);
    return node ? node.parent : null;
  }

  /** Descendant IDs (excludes self). */
  getDescendants(id) {
    const node = this.get(id);
    return node ? node.descendantIds : [];
  }

  /** Component type string. */
  getType(id) {
    const node = this.get(id);
    return node ? node.type : null;
  }

  /** Own override delta for a component. */
  getOwnDelta(id) {
    const d = this.overrides[id];
    return { dx: d ? (d.dx || 0) : 0, dy: d ? (d.dy || 0) : 0,
             dw: d ? (d.dw || 0) : 0, dh: d ? (d.dh || 0) : 0 };
  }

  /** Effective delta: own + all ancestors. */
  getEffectiveDelta(id) {
    let dx = 0, dy = 0;
    for (const aid of this.getAncestors(id)) {
      const d = this.overrides[aid];
      if (d) { dx += (d.dx || 0); dy += (d.dy || 0); }
    }
    const own = this.overrides[id];
    if (own) { dx += (own.dx || 0); dy += (own.dy || 0); }
    return { dx, dy, dw: own ? (own.dw || 0) : 0, dh: own ? (own.dh || 0) : 0 };
  }

  /** Set (merge) override fields for a component. */
  setOverride(id, partial) {
    if (!this.overrides[id]) this.overrides[id] = {};
    Object.assign(this.overrides[id], partial);
  }

  /** Set waypoint override directly. */
  setWaypointOverride(id, waypoints) {
    if (!this.overrides[id]) this.overrides[id] = {};
    this.overrides[id].waypoints = waypoints;
  }

  /** Remove a single override, cleaning empty entries. */
  clearOverride(id) {
    delete this.overrides[id];
  }

  /** Remove all overrides. */
  clearAllOverrides() {
    this.overrides = {};
  }

  /** Clean an override by removing zero-value fields. */
  cleanOverride(id) {
    const d = this.overrides[id];
    if (!d) return;
    for (const k of ["dx", "dy", "dw", "dh"]) {
      if (d[k] === 0) delete d[k];
    }
    if (Object.keys(d).length === 0) delete this.overrides[id];
  }

  /** Count of components with overrides. */
  get overrideCount() {
    return Object.keys(this.overrides).length;
  }

  /** Hit-test: find deepest component at (x, y) at a given depth level. */
  findAtDepth(x, y, targetDepth, svgEl) {
    let found = null;
    function walk(nodes, depth) {
      for (const node of nodes) {
        if (node.type === "arrow" || node.type === "separator") continue;
        const gs = svgEl.querySelectorAll('[data-component-id="' + node.id + '"]');
        for (const g of gs) {
          const r = g.querySelector("rect");
          if (!r) continue;
          const bx = parseFloat(r.getAttribute("x") || "0");
          const by = parseFloat(r.getAttribute("y") || "0");
          const bw = parseFloat(r.getAttribute("width") || "0");
          const bh = parseFloat(r.getAttribute("height") || "0");
          if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
            if (depth === targetDepth) found = node.id;
            if (depth < targetDepth && node.children.length > 0) {
              walk(node.children, depth + 1);
            }
          }
        }
      }
    }
    walk(this._roots, 0);
    return found;
  }

  /** Walk entire tree calling fn(node, depth) for each node. */
  walk(fn) {
    function visit(nodes, depth) {
      for (const node of nodes) {
        fn(node, depth);
        visit(node.children, depth + 1);
      }
    }
    visit(this._roots, 0);
  }

  /** Get sibling nodes of a component (same parent, excludes self). */
  getSiblings(id) {
    const node = this.get(id);
    if (!node) return [];
    const siblings = node.parent ? node.parent.children : this._roots;
    return siblings.filter(n => n.id !== id);
  }

  /** Get the layout-eligible children of a node (non-arrow, non-separator). */
  getLayoutChildren(id) {
    const node = this.get(id);
    if (!node) return [];
    return node.children.filter(n => n.type !== "arrow" && n.type !== "separator");
  }

  /**
   * Gutter-preserving auto-layout: recompute child positions and sizes
   * so they fill the parent's content area with fixed gutters.
   *
   * Given the parent's effective bounds (base + overrides), this function:
   * 1. Computes the content area (parent size - 2×pad - heading)
   * 2. Distributes available space among children with fixed gutters
   * 3. Returns overrides { childId: { dx, dy, dw, dh } } to apply
   *
   * The gutter between children is ALWAYS node.layoutGap — never proportional.
   *
   * @param {string} parentId — the parent whose children to relayout
   * @param {number} parentDw — the parent's dw override (0 = unchanged)
   * @param {number} parentDh — the parent's dh override (0 = unchanged)
   * @returns {{ [childId: string]: { dx?: number, dy?: number, dw?: number, dh?: number } }}
   */
  relayoutChildren(parentId, parentDw, parentDh) {
    const node = this.get(parentId);
    if (!node || node.children.length === 0) return {};
    const layoutChildren = this.getLayoutChildren(parentId);
    if (layoutChildren.length === 0) return {};

    const layout = node.layout || "";
    if (!layout) return {};

    const colGap = node.layoutColGap;
    const rowGap = node.layoutRowGap;
    const pad = node.pad;
    const headingH = node.headingHeight;
    const result = {};

    // Parent's effective content area
    const parentW = node.data.width + parentDw;
    const parentH = node.data.height + parentDh;
    const contentW = parentW - 2 * pad;
    const contentH = parentH - 2 * pad - headingH;

    // Content area origin relative to parent's original position
    const contentX0 = node.data.x + pad;
    const contentY0 = node.data.y + pad + headingH;

    if (layout === "vertical") {
      // Vertical: all children get full width, height distributed equally
      const n = layoutChildren.length;
      const availH = contentH - (n - 1) * rowGap;
      const childH = Math.round(availH / n / 8) * 8;

      let cy = contentY0;
      for (const child of layoutChildren) {
        const dx = contentX0 - child.data.x;
        const dy = cy - child.data.y;
        const dw = contentW - child.data.width;
        const dh = childH - child.data.height;
        result[child.id] = {
          dx: Math.round(dx / 8) * 8,
          dy: Math.round(dy / 8) * 8,
          dw: Math.round(dw / 8) * 8,
          dh: Math.round(dh / 8) * 8,
        };
        cy += childH + rowGap;
      }
    } else if (layout === "horizontal") {
      // Horizontal: width distributed equally, height unchanged (cross-axis)
      const n = layoutChildren.length;
      const availW = contentW - (n - 1) * colGap;
      const childW = Math.round(availW / n / 8) * 8;

      let cx = contentX0;
      for (const child of layoutChildren) {
        const dx = cx - child.data.x;
        const dw = childW - child.data.width;
        result[child.id] = {
          dx: Math.round(dx / 8) * 8,
          dy: 0,
          dw: Math.round(dw / 8) * 8,
          dh: 0,
        };
        cx += childW + colGap;
      }
    } else if (layout === "grid") {
      // Grid: identify columns and rows from children's original positions.
      // Distribute width equally among columns, height equally among rows.
      const colXs = [...new Set(layoutChildren.map(c => c.data.x))].sort((a, b) => a - b);
      const rowYs = [...new Set(layoutChildren.map(c => c.data.y))].sort((a, b) => a - b);
      const numCols = colXs.length || 1;
      const numRows = rowYs.length || 1;

      const availW = contentW - (numCols - 1) * colGap;
      const availH = contentH - (numRows - 1) * rowGap;
      const cellW = Math.round(availW / numCols / 8) * 8;
      const cellH = Math.round(availH / numRows / 8) * 8;

      // Build column X positions and row Y positions
      const newColXs = [];
      for (let c = 0; c < numCols; c++) {
        newColXs.push(contentX0 + c * (cellW + colGap));
      }
      const newRowYs = [];
      for (let r = 0; r < numRows; r++) {
        newRowYs.push(contentY0 + r * (cellH + rowGap));
      }

      for (const child of layoutChildren) {
        const colIdx = colXs.indexOf(child.data.x);
        const rowIdx = rowYs.indexOf(child.data.y);
        const ci = colIdx >= 0 ? colIdx : 0;
        const ri = rowIdx >= 0 ? rowIdx : 0;
        const dx = newColXs[ci] - child.data.x;
        const dy = newRowYs[ri] - child.data.y;
        const dw = cellW - child.data.width;
        const dh = cellH - child.data.height;
        result[child.id] = {
          dx: Math.round(dx / 8) * 8,
          dy: Math.round(dy / 8) * 8,
          dw: Math.round(dw / 8) * 8,
          dh: Math.round(dh / 8) * 8,
        };
      }
    }
    return result;
  }

  /**
   * Relayout after a child is resized: keep sibling sizes the same,
   * but shift siblings that come after the resized child so gutters
   * stay exactly at layoutGap.
   *
   * Returns { siblingId: { dx?, dy?, dw?, dh? } } deltas to apply.
   */
  relayoutSiblingsAfterChildResize(childId, childDw, childDh) {
    const node = this.get(childId);
    if (!node || !node.parent) return {};
    const parent = node.parent;
    const layout = parent.layout || "";
    const layoutChildren = this.getLayoutChildren(parent.id);
    if (layoutChildren.length <= 1) return {};

    const result = {};
    const childIdx = layoutChildren.indexOf(node);

    if (layout === "vertical" && childDh !== 0) {
      // Shift all siblings below the resized child by childDh
      for (let i = childIdx + 1; i < layoutChildren.length; i++) {
        const sib = layoutChildren[i];
        result[sib.id] = { dy: childDh };
      }
    } else if (layout === "horizontal" && childDw !== 0) {
      // Shift all siblings to the right of the resized child by childDw
      for (let i = childIdx + 1; i < layoutChildren.length; i++) {
        const sib = layoutChildren[i];
        result[sib.id] = { dx: childDw };
      }
    } else if (layout === "grid") {
      // Grid: shift same-row siblings after resized child horizontally,
      // shift same-column siblings after resized child vertically.
      const childX = node.data.x;
      const childY = node.data.y;
      const colXs = [...new Set(layoutChildren.map(c => c.data.x))].sort((a, b) => a - b);
      const rowYs = [...new Set(layoutChildren.map(c => c.data.y))].sort((a, b) => a - b);
      const childColIdx = colXs.indexOf(childX);
      const childRowIdx = rowYs.indexOf(childY);

      for (const sib of layoutChildren) {
        if (sib.id === childId) continue;
        const sibColIdx = colXs.indexOf(sib.data.x);
        const sibRowIdx = rowYs.indexOf(sib.data.y);
        const patch = {};
        // Same row, later column → shift right
        if (sibRowIdx === childRowIdx && sibColIdx > childColIdx && childDw !== 0) {
          patch.dx = childDw;
        }
        // Same column, later row → shift down
        if (sibColIdx === childColIdx && sibRowIdx > childRowIdx && childDh !== 0) {
          patch.dy = childDh;
        }
        if (Object.keys(patch).length > 0) {
          result[sib.id] = patch;
        }
      }
    }
    return result;
  }

  /** Serialise overrides for saving. */
  toOverridePayload() {
    const payload = {
      definition_hash: this.definitionHash,
      overrides: this.overrides,
      format_version: 1,
    };
    if (this.gridOverrides && Object.keys(this.gridOverrides).length > 0) {
      payload.grid_overrides = this.gridOverrides;
    }
    return payload;
  }

  /** Load overrides from server response. */
  loadOverrides(serverData) {
    this.overrides = serverData.overrides || {};
    this.definitionHash = serverData.definition_hash || "";
    this.isStale = !!serverData.stale;
    this.gridOverrides = serverData.grid_overrides || {};
  }
}


// ---------------------------------------------------------------------------
// InteractionManager – state machine for editor interactions
// ---------------------------------------------------------------------------
// Replaces scattered dragState/resizeState/wpDragState/textEditState globals
// with a single mode-based state machine.
// ---------------------------------------------------------------------------

const InteractionMode = Object.freeze({
  IDLE: "idle",
  SELECTING: "selecting",
  DRAGGING: "dragging",
  RESIZING: "resizing",
  WAYPOINT_DRAGGING: "waypoint_dragging",
  TEXT_EDITING: "text_editing",
});

class InteractionManager {
  constructor() {
    this.mode = InteractionMode.IDLE;
    this.state = null;        // mode-specific state object
    this.selectedIds = new Set();
    this.selectionDepth = 0;
    this.isDirty = false;

    // Undo/redo
    this.undoStack = [];
    this.redoStack = [];
    this.lastSavedState = null;
    this.maxUndoSize = 50;

    // Guide mode
    this.guideMode = "off";
    this.guideModes = ["off", "composition", "baseline"];
  }

  /** Check if a specific interaction is active. */
  isMode(mode) { return this.mode === mode; }

  /** Check if any interaction (other than idle) is active. */
  get isBusy() { return this.mode !== InteractionMode.IDLE; }

  /** Check if dragging or resizing (for suppressing hover). */
  get suppressHover() {
    return this.mode === InteractionMode.DRAGGING ||
           this.mode === InteractionMode.RESIZING;
  }

  /** Enter drag mode. */
  startDrag(state) {
    this.mode = InteractionMode.DRAGGING;
    this.state = state;
  }

  /** Enter resize mode. */
  startResize(state) {
    this.mode = InteractionMode.RESIZING;
    this.state = state;
  }

  /** Enter waypoint drag mode. */
  startWaypointDrag(state) {
    this.mode = InteractionMode.WAYPOINT_DRAGGING;
    this.state = state;
  }

  /** Enter text editing mode. */
  startTextEdit(state) {
    this.mode = InteractionMode.TEXT_EDITING;
    this.state = state;
  }

  /** Return to idle. */
  endInteraction() {
    this.mode = InteractionMode.IDLE;
    this.state = null;
  }

  // ---- Selection ----

  hasSelection() { return this.selectedIds.size > 0; }

  isSelected(id) { return this.selectedIds.has(id); }

  select(id, additive) {
    if (additive) {
      if (this.selectedIds.has(id)) {
        this.selectedIds.delete(id);
      } else {
        this.selectedIds.add(id);
      }
    } else {
      this.selectedIds.clear();
      this.selectedIds.add(id);
    }
  }

  deselectAll() {
    this.selectedIds.clear();
    this.selectionDepth = 0;
  }

  // ---- Undo/Redo ----

  pushSnapshot(overridesClone) {
    this.undoStack.push(overridesClone);
    if (this.undoStack.length > this.maxUndoSize) this.undoStack.shift();
    this.redoStack = [];
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  /** Cycle guide mode (off → composition → baseline → off). */
  cycleGuideMode() {
    const idx = this.guideModes.indexOf(this.guideMode);
    this.guideMode = this.guideModes[(idx + 1) % this.guideModes.length];
    return this.guideMode;
  }
}


// Expose to global scope for use by editor.js
window.ComponentModel = ComponentModel;
window.ComponentNode = ComponentNode;
window.InteractionManager = InteractionManager;
window.InteractionMode = InteractionMode;
