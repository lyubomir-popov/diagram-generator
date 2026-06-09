import type { DiagramDocument, Diagnostic } from './types.js';
export interface MermaidExportResult {
    mermaid: string;
    warnings: Diagnostic[];
}
export declare function exportMermaid(ast: DiagramDocument): MermaidExportResult;
//# sourceMappingURL=export-mermaid.d.ts.map