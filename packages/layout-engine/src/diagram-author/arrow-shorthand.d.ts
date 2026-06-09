import type { AuthorArrow, Diagnostic } from './types.js';
export interface ParseArrowResult {
    arrow?: AuthorArrow;
    diagnostics: Diagnostic[];
}
export declare function parseArrowShorthand(value: string, path: string): ParseArrowResult;
//# sourceMappingURL=arrow-shorthand.d.ts.map