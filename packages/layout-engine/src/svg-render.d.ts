/**
 * SVG string renderer for batch export (Node + browser).
 * Mirrors scripts/preview/layout-bridge.js DOM renderer.
 */
import { FrameDiagram } from './frame-model.js';
import { type TextMeasureAdapter } from './text-measure.js';
import type { LayoutOutput } from './layout.js';
export interface SvgRenderOptions {
    /** Inner SVG markup per icon file name (from assets/icons). */
    iconMarkupByName?: Map<string, string>;
}
export declare function renderFrameDiagramToSvg(diagram: FrameDiagram, result: LayoutOutput, adapter: TextMeasureAdapter, options?: SvgRenderOptions): string;
//# sourceMappingURL=svg-render.d.ts.map