/**
 * Serializable editor snapshot helpers for the preview shell (spec 026 T012).
 */
export function cloneEditorSnapshotValue(value) {
    return JSON.parse(JSON.stringify(value ?? {}));
}
export function normalizeGridOverrides(gridOverrides) {
    const next = {};
    if (!gridOverrides)
        return next;
    if (Number.isFinite(gridOverrides.cols))
        next.cols = gridOverrides.cols;
    if (Number.isFinite(gridOverrides.rows))
        next.rows = gridOverrides.rows;
    if (Number.isFinite(gridOverrides.col_gap))
        next.col_gap = gridOverrides.col_gap;
    if (Number.isFinite(gridOverrides.row_gap))
        next.row_gap = gridOverrides.row_gap;
    if (Number.isFinite(gridOverrides.margin_top))
        next.margin_top = gridOverrides.margin_top;
    if (Number.isFinite(gridOverrides.margin_right))
        next.margin_right = gridOverrides.margin_right;
    if (Number.isFinite(gridOverrides.margin_bottom))
        next.margin_bottom = gridOverrides.margin_bottom;
    if (Number.isFinite(gridOverrides.margin_left))
        next.margin_left = gridOverrides.margin_left;
    if (Number.isFinite(next.margin_top)) {
        next.outer_margin = next.margin_top;
    }
    else if (Number.isFinite(next.col_gap)) {
        next.outer_margin = next.col_gap;
    }
    if (typeof gridOverrides.link_to_root === 'boolean')
        next.link_to_root = gridOverrides.link_to_root;
    if (typeof gridOverrides.slack_absorption === 'boolean') {
        next.slack_absorption = gridOverrides.slack_absorption;
    }
    return next;
}
export function captureEditorSnapshot(input) {
    const snapshot = {
        o: cloneEditorSnapshotValue(input.overrides),
        g: cloneEditorSnapshotValue(input.gridOverrides || {}),
    };
    if (input.elkLayoutOverrides && Object.keys(input.elkLayoutOverrides).length > 0) {
        snapshot.e = cloneEditorSnapshotValue(input.elkLayoutOverrides);
    }
    if (input.removedIds) {
        const removed = [...input.removedIds];
        if (removed.length > 0)
            snapshot.r = removed;
    }
    if (input.frameTree != null)
        snapshot.f = input.frameTree;
    return snapshot;
}
export function serializeEditorSnapshot(snapshot) {
    return JSON.stringify(snapshot);
}
export function parseEditorSnapshot(serialized) {
    const parsed = JSON.parse(serialized || '{}');
    return {
        o: cloneEditorSnapshotValue(parsed.o || {}),
        g: cloneEditorSnapshotValue(parsed.g || {}),
        e: parsed.e ? cloneEditorSnapshotValue(parsed.e) : undefined,
        r: Array.isArray(parsed.r) ? [...parsed.r] : undefined,
        f: parsed.f,
    };
}
//# sourceMappingURL=editor-snapshot.js.map