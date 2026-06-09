/**
 * Native frame YAML → FrameDiagram (v3).
 * TypeScript source of truth for batch export; mirrors scripts/frame_loader.py.
 */
import type { FrameDiagram } from './frame-model.js';
export declare function loadFrameYamlFromString(raw: string, sourcePath?: string): FrameDiagram;
export declare function loadFrameYaml(path: string): FrameDiagram;
//# sourceMappingURL=frame-yaml-loader.d.ts.map