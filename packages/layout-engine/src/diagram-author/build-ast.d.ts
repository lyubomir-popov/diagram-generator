import type { AuthorFrameNode, Diagnostic, FrameIndexEntry, FrameTemplate } from './types.js';
export declare function normalizeFrameTemplate(record: Record<string, unknown>): FrameTemplate;
export declare function normalizeFrameNode(value: unknown, path: string): {
    node?: AuthorFrameNode;
    diagnostics: Diagnostic[];
};
export declare function buildFrameIndex(root: AuthorFrameNode | null): {
    frameIndex: Record<string, FrameIndexEntry>;
    diagnostics: Diagnostic[];
};
export declare function buildFrameAst(rawRoot: unknown): {
    root: AuthorFrameNode | null;
    frameIndex: Record<string, FrameIndexEntry>;
    diagnostics: Diagnostic[];
};
//# sourceMappingURL=build-ast.d.ts.map