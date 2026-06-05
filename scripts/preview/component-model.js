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
    this.layoutGap = data.layout_gap ?? 0;  // gap between leaf stack children (0 is valid)
    this.layoutHeaderGap = data.layout_header_gap ?? 0;  // heading → body when hoisted
    this.layoutColGap = data.layout_col_gap ?? data.layout_gap ?? 0;
    this.layoutRowGap = data.layout_row_gap ?? data.layout_gap ?? 0;
    this.layoutCols = data.layout_cols || 0;
    this.layoutRows = data.layout_rows || 0;
    this.pad = data.pad || 0;               // internal padding (INSET for bordered, 0 for borderless)
    this.headingHeight = data.heading_height || 0; // panel heading height incl gap
    this.gridCol = data.grid_col || 0;
    this.gridRow = data.grid_row || 0;
    this.gridColSpan = data.grid_col_span || 1;
    this.gridRowSpan = data.grid_row_span || 1;
    this.sizing_w = data.sizing_w || "";
    this.sizing_h = data.sizing_h || "";
    this.fill_weight = data.fill_weight ?? 1;
    this.wrap = data.wrap || false;
    this.min_width = data.min_width;
    this.max_width = data.max_width;
    this.max_width_chars = data.max_width_chars;
    this.min_height = data.min_height;
    this.max_height = data.max_height;
    this.heading_text = data.heading_text || "";
    this.align = data.align || "";
    this.level = data.level ?? null;
    this.fill = data.fill || "";
    this.border = data.border || "";
    this.padding_top = data.padding_top || 0;
    this.padding_right = data.padding_right || 0;
    this.padding_bottom = data.padding_bottom || 0;
    this.padding_left = data.padding_left || 0;
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
    this.elkLayoutOverrides = {}; // { "elk.spacing.nodeNode": "48", ... }
    this.diagramGrid = null; // { col_gap, row_gap, outer_margin, ... } — diagram-level grid
    /** Frame ids removed since last save (persisted as removed_ids on save). */
    this.removedIds = new Set();
  }

  /** Store diagram-level grid info so root nodes participate in relayout. */
  setDiagramGrid(info) {
    this.diagramGrid = info || null;
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

  /**
   * Index diagram arrows for selection / waypoint editing (not shown in frame tree).
   * Each entry needs source, target, and a stable id (see layout-bridge arrowComponentId).
   */
  loadArrows(arrowList) {
    for (const [id, node] of [...this._index.entries()]) {
      if (node.type === "arrow") this._index.delete(id);
    }
    if (!arrowList || !arrowList.length) return;
    for (const raw of arrowList) {
      if (!raw || !raw.source || !raw.target) continue;
      const id = raw.id || `${raw.source}->${raw.target}`;
      const data = {
        id,
        type: "arrow",
        source: raw.source,
        target: raw.target,
        color: raw.color,
        waypoints: raw.waypoints
          ? JSON.parse(JSON.stringify(raw.waypoints))
          : [],
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        children: [],
      };
      this._index.set(id, new ComponentNode(data, null));
    }
  }

  /** Stable ids for all indexed arrows. */
  arrowIds() {
    const ids = [];
    for (const node of this._index.values()) {
      if (node.type === "arrow") ids.push(node.id);
    }
    return ids;
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
    return node.children
      .filter(n => n.type !== "arrow" && n.type !== "separator")
      .sort((left, right) => {
        if (left.gridRow !== right.gridRow) return left.gridRow - right.gridRow;
        if (left.gridCol !== right.gridCol) return left.gridCol - right.gridCol;
        if (left.data.y !== right.data.y) return left.data.y - right.data.y;
        return left.data.x - right.data.x;
      });
  }

  /**
   * Recompute child positions and sizes after a parent resize.
   *
   * The preview model mirrors the solver's intent closely enough to keep
   * drag-resize interactions trustworthy before the server relayout lands:
   * - fixed/HUG children keep their current effective size on the primary axis
   * - explicit FILL children split remaining space continuously
   * - gutters stay fixed at the parent's declared layout gaps
   *
   * @param {string} parentId
   * @param {number} parentDx
   * @param {number} parentDy
   * @param {number} parentDw
   * @param {number} parentDh
   * @param {{ [id: string]: { dx?: number, dy?: number, dw?: number, dh?: number } }} [baseOverrides]
   * @returns {{ [childId: string]: { dx?: number, dy?: number, dw?: number, dh?: number } }}
   */
  relayoutChildren(parentId, parentDx, parentDy, parentDw, parentDh, baseOverrides) {
    const node = this.get(parentId);
    if (!node || node.children.length === 0) return {};
    const layoutChildren = this.getLayoutChildren(parentId);
    if (layoutChildren.length === 0) return {};

    const layout = node.layout || "";
    if (!layout) return {};

    const colGap = node.layoutColGap;
    const rowGap = node.layoutRowGap;
    const padLeft = node.padding_left || node.pad;
    const padRight = node.padding_right || node.pad;
    const padTop = node.padding_top || node.pad;
    const padBottom = node.padding_bottom || node.pad;
    const headingH = node.headingHeight;
    const result = {};

    const parentBase = (baseOverrides && baseOverrides[parentId]) || this.getOwnDelta(parentId);
    const baseParentX = node.data.x + (parentBase.dx || 0);
    const baseParentY = node.data.y + (parentBase.dy || 0);
    const parentX = node.data.x + parentDx;
    const parentY = node.data.y + parentDy;

    // Parent's effective content area
    const parentW = node.data.width + parentDw;
    const parentH = node.data.height + parentDh;
    const contentW = parentW - padLeft - padRight;
    const contentH = parentH - padTop - padBottom - headingH;

    // Content area origin relative to parent's original position
    const contentX0 = parentX + padLeft;
    const contentY0 = parentY + padTop + headingH;

    const childBase = (child) => {
      return (baseOverrides && baseOverrides[child.id]) || this.getOwnDelta(child.id);
    };

    function effectiveRect(child) {
      const base = childBase(child);
      return {
        x: child.data.x + (base.dx || 0),
        y: child.data.y + (base.dy || 0),
        w: child.data.width + (base.dw || 0),
        h: child.data.height + (base.dh || 0),
      };
    }

    if (layout === "vertical") {
      const availH = contentH - (layoutChildren.length - 1) * rowGap;
      let fixedH = 0;
      const fillChildren = [];

      for (const child of layoutChildren) {
        const rect = effectiveRect(child);
        if (child.sizing_h === "FILL") {
          fillChildren.push(child);
        } else {
          fixedH += rect.h;
        }
      }

      const fillH = fillChildren.length > 0 ? Math.max(0, availH - fixedH) / fillChildren.length : 0;
      const parentShiftX = parentX - baseParentX;

      let cy = contentY0;
      for (const child of layoutChildren) {
        const rect = effectiveRect(child);
        const targetW = child.sizing_w === "FILL" ? contentW : rect.w;
        const targetH = child.sizing_h === "FILL" ? fillH : rect.h;
        const targetX = child.sizing_w === "FILL" ? contentX0 : rect.x + parentShiftX;
        const dx = targetX - child.data.x;
        const dy = cy - child.data.y;
        const dw = targetW - child.data.width;
        const dh = targetH - child.data.height;
        result[child.id] = {
          dx,
          dy,
          dw,
          dh,
        };
        cy += targetH + rowGap;
      }
    } else if (layout === "horizontal") {
      const availW = contentW - (layoutChildren.length - 1) * colGap;
      let fixedW = 0;
      const fillChildren = [];

      for (const child of layoutChildren) {
        const rect = effectiveRect(child);
        if (child.sizing_w === "FILL") {
          fillChildren.push(child);
        } else {
          fixedW += rect.w;
        }
      }

      const fillW = fillChildren.length > 0 ? Math.max(0, availW - fixedW) / fillChildren.length : 0;
      const parentShiftY = parentY - baseParentY;

      let cx = contentX0;
      for (const child of layoutChildren) {
        const rect = effectiveRect(child);
        const targetW = child.sizing_w === "FILL" ? fillW : rect.w;
        const targetH = child.sizing_h === "FILL" ? contentH : rect.h;
        const targetY = child.sizing_h === "FILL" ? contentY0 : rect.y + parentShiftY;
        const dx = cx - child.data.x;
        const dw = targetW - child.data.width;
        result[child.id] = {
          dx,
          dy: targetY - child.data.y,
          dw,
          dh: targetH - child.data.height,
        };
        cx += targetW + colGap;
      }
    } else if (layout === "grid") {
      // Grid: use the server-declared slot model instead of inferring
      // columns/rows back from absolute geometry.
      const maxCol = layoutChildren.reduce((max, child) => {
        return Math.max(max, (child.gridCol || 0) + (child.gridColSpan || 1));
      }, 0);
      const maxRow = layoutChildren.reduce((max, child) => {
        return Math.max(max, (child.gridRow || 0) + (child.gridRowSpan || 1));
      }, 0);
      const numCols = Math.max(1, node.layoutCols || maxCol);
      const numRows = Math.max(1, node.layoutRows || maxRow);

      const availW = contentW - (numCols - 1) * colGap;
      const availH = contentH - (numRows - 1) * rowGap;
      const cellW = equalSplitCell(availW, numCols);
      const cellH = equalSplitCell(availH, numRows);

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
        const ci = Math.max(0, Math.min(numCols - 1, child.gridCol || 0));
        const ri = Math.max(0, Math.min(numRows - 1, child.gridRow || 0));
        const colSpan = Math.max(1, Math.min(numCols - ci, child.gridColSpan || 1));
        const rowSpan = Math.max(1, Math.min(numRows - ri, child.gridRowSpan || 1));

        const spanW = spanSize(cellW, colSpan, colGap);
        const spanH = spanSize(cellH, rowSpan, rowGap);

        const dx = newColXs[ci] - child.data.x;
        const dy = newRowYs[ri] - child.data.y;
        const dw = spanW - child.data.width;
        const dh = spanH - child.data.height;
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
   * Works for both nested children (node has a parent with layout) and
   * root-level nodes (when diagramGrid supplies the grid context).
   *
   * Returns { siblingId: { dx?, dy?, dw?, dh? } } deltas to apply.
   */
  relayoutSiblingsAfterChildResize(childId, childRightDelta, childBottomDelta) {
    const node = this.get(childId);
    if (!node) return {};

    // Determine layout context: either from parent or from diagram grid
    let layout, layoutChildren;
    if (node.parent) {
      const parent = node.parent;
      layout = parent.layout || "";
      layoutChildren = this.getLayoutChildren(parent.id);
    } else if (this.diagramGrid) {
      layout = "grid";
      layoutChildren = this._roots
        .filter(n => n.type !== "arrow" && n.type !== "separator");
    } else {
      return {};
    }
    if (layoutChildren.length <= 1) return {};

    const result = {};
    const childIdx = layoutChildren.indexOf(node);

    if (layout === "vertical" && childBottomDelta !== 0) {
      // Shift all siblings below the resized child by the bottom-edge delta.
      for (let i = childIdx + 1; i < layoutChildren.length; i++) {
        const sib = layoutChildren[i];
        result[sib.id] = { dy: childBottomDelta };
      }
    } else if (layout === "horizontal" && childRightDelta !== 0) {
      // Shift all siblings to the right of the resized child by the right-edge delta.
      for (let i = childIdx + 1; i < layoutChildren.length; i++) {
        const sib = layoutChildren[i];
        result[sib.id] = { dx: childRightDelta };
      }
    } else if (layout === "grid") {
      // Grid: shift same-row siblings after resized child horizontally,
      // shift same-column siblings after resized child vertically.
      const childColIdx = node.gridCol || 0;
      const childRowIdx = node.gridRow || 0;

      for (const sib of layoutChildren) {
        if (sib.id === childId) continue;
        const sibColIdx = sib.gridCol || 0;
        const sibRowIdx = sib.gridRow || 0;
        const patch = {};
        // Same row, later column → shift right
        if (sibRowIdx === childRowIdx && sibColIdx > childColIdx && childRightDelta !== 0) {
          patch.dx = childRightDelta;
        }
        // Same column, later row → shift down
        if (sibColIdx === childColIdx && sibRowIdx > childRowIdx && childBottomDelta !== 0) {
          patch.dy = childBottomDelta;
        }
        if (Object.keys(patch).length > 0) {
          result[sib.id] = patch;
        }
      }
    }
    return result;
  }

  /** Top-level frame ids to remove on save (no ancestor also listed). */
  topLevelRemovalIds() {
    const ids = [...this.removedIds];
    return ids.filter(id => {
      const node = this.get(id);
      if (!node) return true;
      return !node.ancestorIds.some(ancestor => this.removedIds.has(ancestor));
    });
  }

  /** Serialise overrides for saving. */
  toOverridePayload() {
    const payload = {
      overrides: this.overrides,
      format_version: 1,
    };
    const removed = this.topLevelRemovalIds();
    if (removed.length > 0) {
      payload.removed_ids = removed;
    }
    if (this.gridOverrides && Object.keys(this.gridOverrides).length > 0) {
      const persistableGridOverrides = { ...this.gridOverrides };
      delete persistableGridOverrides.rows;
      delete persistableGridOverrides.slack_absorption;
      if (Object.keys(persistableGridOverrides).length > 0) {
        payload.grid_overrides = persistableGridOverrides;
      }
    }
    if (this.elkLayoutOverrides && Object.keys(this.elkLayoutOverrides).length > 0) {
      payload.elk_layout_overrides = { ...this.elkLayoutOverrides };
    }
    return payload;
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
