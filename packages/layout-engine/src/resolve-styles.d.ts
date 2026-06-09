/**
 * Style resolution — TypeScript port of frame_loader.py resolve_styles().
 *
 * Walks a Frame tree and sets resolvedFill / resolvedStroke on every frame
 * based on the four-class hierarchy:
 *   Section  (level 3): bold heading token, transparent, black border
 *   Panel    (level 2): bold heading, grey fill, grey border
 *   Leaf     (level 1): regular heading, transparent, black border
 *   Annotation:         borderless leaf — transparent, no border
 *
 * This is the single source of truth for visual style semantics.
 * Renderers consume resolvedFill/resolvedStroke directly — no re-derivation.
 */
import { Frame } from './frame-model.js';
/**
 * Compute the effective prominence level for a frame.
 *
 * If `frame.level` is explicitly set (e.g. from YAML or override), use it.
 * Otherwise apply safe defaults:
 *   depth 0                           → 0 (root, invisible)
 *   container without heading         → 0 (layout wrapper, invisible)
 *   everything else                   → 1 (outlined box)
 *
 * Grey panel treatment (level 2) is never guessed — it must be opted into
 * via `level: 2` in the YAML or an explicit override.
 */
export declare function computeLevel(frame: Frame, depth: number): number;
interface ResolveStylesContext {
    depth: number;
    parentIsPanel: boolean;
    parentIsSection: boolean;
    parentIsHighlight: boolean;
}
/**
 * Walk the tree and set resolvedFill / resolvedStroke on every frame.
 *
 * Must be called before layout so typography-affecting mutations
 * participate in measurement. Mirrors the Python `resolve_styles()`
 * in `frame_loader.py` exactly.
 */
export declare function resolveStyles(root: Frame, ctx?: Partial<ResolveStylesContext>): void;
export {};
//# sourceMappingURL=resolve-styles.d.ts.map