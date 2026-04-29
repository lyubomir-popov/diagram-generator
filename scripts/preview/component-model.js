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

  /** Serialise overrides for saving. */
  toOverridePayload() {
    return {
      definition_hash: this.definitionHash,
      overrides: this.overrides,
      format_version: 1,
    };
  }

  /** Load overrides from server response. */
  loadOverrides(serverData) {
    this.overrides = serverData.overrides || {};
    this.definitionHash = serverData.definition_hash || "";
    this.isStale = !!serverData.stale;
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
