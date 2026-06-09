import type { DiagramDocument, Diagnostic } from './types.js';
export interface D2ExportResult {
    d2: string;
    warnings: Diagnostic[];
}
export declare function exportD2(ast: DiagramDocument): D2ExportResult;
//# sourceMappingURL=export-d2.d.ts.map