import type { AuthorArrow, AuthorFrameNode, Diagnostic, FrameIndexEntry, FrameTemplate } from './types.js';
export declare function collectCompileWarnings(input: {
    root: AuthorFrameNode | null;
    arrows: AuthorArrow[];
    defaults: Record<string, FrameTemplate>;
    frameIndex: Record<string, FrameIndexEntry>;
    usedTemplates: Set<string>;
}): Diagnostic[];
export declare function applyStrictMode(diagnostics: Diagnostic[], strict: boolean): Diagnostic[];
//# sourceMappingURL=validate.d.ts.map