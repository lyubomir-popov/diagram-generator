/**
 * Single source of truth for preview frame override key allowlists.
 * Consumed by persistence (frame-diagram.ts), layout-bridge.js, and editor.js.
 */

/** Keys that may be written to frame YAML via persistFrameDiagramOverridePayloadToYaml. */
export const PERSIST_FRAME_KEYS = [
  'direction',
  'gap',
  'gap_delta',
  'padding',
  'padding_top',
  'padding_right',
  'padding_bottom',
  'padding_left',
  'sizing',
  'sizing_w',
  'sizing_h',
  'fill_weight',
  'align',
  'wrap',
  'width',
  'height',
  'min_width',
  'max_width',
  'max_width_chars',
  'min_height',
  'max_height',
  'fill',
  'border',
  'level',
  'position',
  'x',
  'y',
  'children_order',
  'text',
  'style',
] as const;

/** Transient editor keys that must never be persisted to YAML. */
export const UNSUPPORTED_PERSIST_FRAME_KEYS = ['dx', 'dy', 'dw', 'dh', 'waypoints'] as const;

/** Persist keys that must be coerced to integers on save. */
export const PERSIST_INT_FRAME_KEYS = [
  'gap',
  'gap_delta',
  'padding',
  'padding_top',
  'padding_right',
  'padding_bottom',
  'padding_left',
  'width',
  'height',
  'min_width',
  'max_width',
  'max_width_chars',
  'min_height',
  'max_height',
  'level',
  'x',
  'y',
] as const;

/** Persist keys stored lowercased in YAML. */
export const PERSIST_LOWER_FRAME_KEYS = [
  'direction',
  'sizing',
  'sizing_w',
  'sizing_h',
  'fill',
  'border',
  'position',
] as const;

/** Override keys forwarded into client-side v3 relayout (excludes persist-only style). */
export const RELAYOUT_FRAME_KEYS = PERSIST_FRAME_KEYS.filter((key) => key !== 'style');

/** Override keys that should trigger a v3 relayout after undo/redo restore. */
export const UNDO_RELAYOUT_FRAME_KEYS = [
  'text',
  'direction',
  'gap',
  'gap_delta',
  'padding',
  'padding_top',
  'padding_right',
  'padding_bottom',
  'padding_left',
  'sizing',
  'sizing_w',
  'sizing_h',
  'fill_weight',
  'align',
  'wrap',
  'width',
  'height',
  'min_width',
  'max_width',
  'max_width_chars',
  'min_height',
  'max_height',
  'fill',
  'border',
  'level',
  'position',
  'x',
  'y',
  'children_order',
] as const;

export type PersistFrameKey = (typeof PERSIST_FRAME_KEYS)[number];
export type RelayoutFrameKey = (typeof RELAYOUT_FRAME_KEYS)[number];

export function hasV3FrameOverride(ovr: Record<string, unknown> | null | undefined): boolean {
  if (!ovr) return false;
  return UNDO_RELAYOUT_FRAME_KEYS.some((key) => ovr[key] !== undefined && ovr[key] !== null);
}

export function filterRelayoutOverrideEntry(
  ovr: Record<string, unknown>,
): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  for (const key of RELAYOUT_FRAME_KEYS) {
    if (ovr[key] !== undefined) entry[key] = ovr[key];
  }
  return entry;
}
