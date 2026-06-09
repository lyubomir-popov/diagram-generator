/**
 * Serializable editor snapshot helpers for the preview shell (spec 026 T012).
 */
export interface EditorSnapshot {
    o: Record<string, unknown>;
    g: Record<string, unknown>;
    e?: Record<string, unknown>;
    r?: string[];
    f?: unknown;
}
export interface EditorSnapshotInput {
    overrides: Record<string, unknown>;
    gridOverrides?: Record<string, unknown> | null;
    elkLayoutOverrides?: Record<string, unknown> | null;
    removedIds?: Iterable<string> | null;
    frameTree?: unknown | null;
}
export declare function cloneEditorSnapshotValue<T>(value: T): T;
export declare function normalizeGridOverrides(gridOverrides: Record<string, unknown> | null | undefined): Record<string, unknown>;
export declare function captureEditorSnapshot(input: EditorSnapshotInput): EditorSnapshot;
export declare function serializeEditorSnapshot(snapshot: EditorSnapshot): string;
export declare function parseEditorSnapshot(serialized: string | null | undefined): EditorSnapshot;
//# sourceMappingURL=editor-snapshot.d.ts.map