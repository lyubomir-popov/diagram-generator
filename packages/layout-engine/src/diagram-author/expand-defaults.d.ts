import type { AuthorFrameNode, Diagnostic, FrameTemplate } from './types.js';
export declare function expandFrameDefaults(root: AuthorFrameNode | null, rawDefaults: unknown): {
    root: AuthorFrameNode | null;
    defaults: Record<string, FrameTemplate>;
    usedTemplates: Set<string>;
    diagnostics: Diagnostic[];
};
//# sourceMappingURL=expand-defaults.d.ts.map