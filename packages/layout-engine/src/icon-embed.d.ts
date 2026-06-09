/**
 * Embed assets/icons/*.svg into batch SVG output (Node).
 * Mirrors preview layout-bridge icon fetch + Python diagram_shared.load_icon.
 */
import type { Frame } from './frame-model.js';
export type IconInnerMarkupLoader = (name: string) => string | null;
/** Basename-only icon file name; rejects path traversal. */
export declare function safeIconFileName(name: string): string | null;
/** Strip outer <svg> wrapper; return child markup. */
export declare function extractSvgInnerMarkup(svgText: string): string;
/** Apply iconFill to shape fills/strokes that use template black/currentColor. */
export declare function tintIconInnerMarkup(markup: string, fill: string): string;
export declare function createFsIconLoader(iconsDir: string): IconInnerMarkupLoader;
export declare function collectIconNames(frame: Frame, out?: Set<string>): Set<string>;
export declare function preloadIconMarkup(loader: IconInnerMarkupLoader, names: Iterable<string>): Map<string, string>;
//# sourceMappingURL=icon-embed.d.ts.map