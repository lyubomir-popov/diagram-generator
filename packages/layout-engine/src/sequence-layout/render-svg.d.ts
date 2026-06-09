import type { SequenceDiagramSpec } from './model.js';
import type { SequenceLayoutResult } from './layout.js';
export interface SequenceSvgRenderOptions {
    title?: string;
}
export declare function renderSequenceDiagramToSvg(spec: SequenceDiagramSpec, layout: SequenceLayoutResult, options?: SequenceSvgRenderOptions): string;
//# sourceMappingURL=render-svg.d.ts.map