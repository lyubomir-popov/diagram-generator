/**
 * Serialize FrameDiagram to JSON DTO for preview wire transport.
 * Field names match preview_server / layout-bridge deserializeFrame.
 */
import { Frame, FrameDiagram } from './frame-model.js';
export declare function serializeFrame(frame: Frame): Record<string, unknown>;
export declare function serializeFrameDiagram(diagram: FrameDiagram): Record<string, unknown>;
//# sourceMappingURL=frame-serialize.d.ts.map