/**
 * EngineAdapter — abstract interface for the swappable layout engine.
 *
 * Both the grid editor (editor.js → GridEngine) and the force editor
 * (force.js → ForceEngine) implement this interface so the shared
 * interaction layer (select, drag, resize, snap, inspector) can call
 * through a single contract without knowing which back-end is active.
 *
 * The interface is consumed by shared interaction code in editor-base.js.
 * Engine-specific behaviour stays in each engine file; the interface
 * only exposes the points where shared code needs to call back.
 *
 * ── Implementation status ──────────────────────────────────────────
 * Phase 1 (current): interface definition + shared snap primitives.
 * Phase 2 (planned): shared selection manager + inspector renderer.
 * Phase 3 (planned): shared drag/resize handlers delegating to engine.
 * Phase 4 (planned): shared undo/redo command stack.
 * ───────────────────────────────────────────────────────────────────
 */

/* global */

/**
 * @typedef {Object} ComponentRect
 * @property {string} id     — Unique component identifier.
 * @property {number} x      — Left edge in SVG coordinates.
 * @property {number} y      — Top edge in SVG coordinates.
 * @property {number} width  — Width in SVG coordinates.
 * @property {number} height — Height in SVG coordinates.
 */

/**
 * @typedef {Object} GridLines
 * @property {number[]} xs — Vertical grid line x-positions.
 * @property {number[]} ys — Horizontal grid line y-positions.
 */

/**
 * Abstract base class for engine adapters.
 *
 * Subclasses must implement every method that throws.  Methods with
 * default implementations are optional overrides.
 */
class EngineAdapter {

  /** @returns {string} Engine identifier: "grid" or "force". */
  get mode() { throw new Error("EngineAdapter.mode not implemented"); }

  // ── Component queries ──────────────────────────────────────────

  /**
   * Return the effective rectangle for a component, incorporating
   * any overrides / live positions.
   * @param {string} cid — Component identifier.
   * @returns {ComponentRect|null}
   */
  getComponentRect(cid) { throw new Error("EngineAdapter.getComponentRect not implemented"); }

  /**
   * Return peer component rects for snap-target collection.
   * The returned list should exclude the component identified by `cid`.
   * @param {string} cid — Component to exclude.
   * @returns {ComponentRect[]}
   */
  getPeerRects(cid) { throw new Error("EngineAdapter.getPeerRects not implemented"); }

  // ── Grid information ───────────────────────────────────────────

  /**
   * Return Brockman grid line positions, or null if no grid is loaded.
   * @returns {GridLines|null}
   */
  getGridLines() { return null; }

  // ── Move / resize ──────────────────────────────────────────────

  /**
   * Apply a position delta to one or more components.
   * @param {string[]} cids — Components to move.
   * @param {number} dx — Horizontal delta.
   * @param {number} dy — Vertical delta.
   * @returns {Promise<void>}
   */
  async moveComponents(cids, dx, dy) { throw new Error("EngineAdapter.moveComponents not implemented"); }

  /**
   * Apply a size delta to a component.
   * @param {string} cid — Component to resize.
   * @param {number} dw — Width delta.
   * @param {number} dh — Height delta.
   * @returns {Promise<void>}
   */
  async resizeComponent(cid, dw, dh) { throw new Error("EngineAdapter.resizeComponent not implemented"); }

  // ── Selection ──────────────────────────────────────────────────

  /**
   * Select one or more components.
   * @param {string[]} cids — Components to select (empty = deselect all).
   * @param {{ additive?: boolean }} [options]
   */
  select(cids, options) { throw new Error("EngineAdapter.select not implemented"); }

  /** @returns {string[]} Currently selected component IDs. */
  getSelection() { throw new Error("EngineAdapter.getSelection not implemented"); }

  // ── Persistence ────────────────────────────────────────────────

  /** Save current state to the server. */
  async save() { throw new Error("EngineAdapter.save not implemented"); }

  /** @returns {boolean} Whether state has unsaved changes. */
  isDirty() { return false; }

  // ── Undo / redo (optional) ─────────────────────────────────────

  canUndo() { return false; }
  canRedo() { return false; }
  undo() {}
  redo() {}
}

// Expose globally so both engine files can extend it.
window.EngineAdapter = EngineAdapter;
