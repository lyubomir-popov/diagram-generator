import { FrameDiagram } from '../frame-model.js';
import type { AuthorFrameNode, DiagramDocument } from './types.js';
export declare function authorNodeToRecord(node: AuthorFrameNode): Record<string, unknown>;
export declare function lowerToFrameDiagram(ast: DiagramDocument, source: Record<string, unknown>): FrameDiagram;
//# sourceMappingURL=lower-to-frame.d.ts.map