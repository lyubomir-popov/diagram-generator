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
import { Border, Fill } from './frame-model.js';
import { applyFrameClass, applyHighlightParentContrast, FRAME_CLASS_DEFS } from './frame-classes.js';
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
export function computeLevel(frame, depth) {
    if (frame.level != null) {
        return frame.level;
    }
    if (depth === 0) {
        return 0;
    }
    // Headingless containers are layout wrappers — invisible.
    // A __body child means heading synthesis ran; keep panel chrome even when
    // heading text is cleared (empty heading line on the __heading child).
    const hasHeadingStructure = frame.children.some(c => c.role === 'heading') ||
        frame.heading != null ||
        frame.children.some(c => String(c.id || '').endsWith('__body'));
    if (frame.isContainer && !hasHeadingStructure) {
        return 0;
    }
    return 1;
}
/**
 * Walk the tree and set resolvedFill / resolvedStroke on every frame.
 *
 * Must be called before layout so typography-affecting mutations
 * participate in measurement. Mirrors the Python `resolve_styles()`
 * in `frame_loader.py` exactly.
 */
export function resolveStyles(root, ctx) {
    const depth = ctx?.depth ?? 0;
    const parentIsPanel = ctx?.parentIsPanel ?? false;
    const parentIsSection = ctx?.parentIsSection ?? false;
    const parentIsHighlight = ctx?.parentIsHighlight ?? false;
    const isLayoutWrapper = (root.id || '').includes('__');
    let thisIsPanel = false;
    let thisIsSection = false;
    let thisIsHighlight = false;
    if (depth === 0) {
        // Root frame: invisible
        applyFrameClass(root, FRAME_CLASS_DEFS.hidden);
    }
    else if (isLayoutWrapper) {
        // Synthetic __heading / __body frames: transparent box chrome, but a
        // parent-applied heading snapshot must survive for __heading content.
        root.resolvedFill = 'transparent';
        root.resolvedStroke = 'none';
        root.resolvedStrokeWidth = 0;
        // __heading with a black-fill parent keeps its fill for contrast
        if (root.fill === Fill.BLACK) {
            root.resolvedFill = '#000000';
        }
        else if (root.fill === Fill.WHITE && root.role === 'heading') {
            root.resolvedFill = 'transparent';
        }
    }
    else if (root.role === 'separator') {
        applyFrameClass(root, FRAME_CLASS_DEFS.hidden);
    }
    else {
        const isHighlight = root.fill === Fill.BLACK;
        thisIsHighlight = isHighlight;
        // Normal frame: resolve from level
        let level = computeLevel(root, depth);
        // Nesting constraints: grey-on-grey has no visible boundary,
        // and section-in-section is not meaningful.
        if (level >= 2 && parentIsPanel) {
            level = 1;
        }
        if (level >= 3 && parentIsSection) {
            level = Math.min(level, 2);
        }
        if (level === 0) {
            // Level 0: headingless container / layout wrapper — invisible
            applyFrameClass(root, FRAME_CLASS_DEFS.hidden);
        }
        else if (root.border === Border.NONE && root.isLeaf && !isLayoutWrapper) {
            // Annotation: borderless leaf — no fill, no stroke
            applyFrameClass(root, FRAME_CLASS_DEFS.annotation);
        }
        else if (level >= 3) {
            // Section: small-caps bold heading, transparent fill, black border
            applyFrameClass(root, FRAME_CLASS_DEFS.section);
            thisIsSection = true;
        }
        else if (level >= 2) {
            // Panel: grey fill, grey border (invisible against fill)
            applyFrameClass(root, FRAME_CLASS_DEFS.panel);
            thisIsPanel = true;
        }
        else {
            // Leaf (level 1): outlined box, regular-weight heading
            applyFrameClass(root, FRAME_CLASS_DEFS.leaf);
        }
        if (isHighlight) {
            applyFrameClass(root, FRAME_CLASS_DEFS.highlight);
        }
        else if (parentIsHighlight) {
            // Keep leaf/panel box styling, but use white text/icons on black parent fill.
            applyHighlightParentContrast(root);
        }
    }
    // Recurse into children
    for (const child of root.children) {
        // Layout wrappers pass through the parent's panel/section status
        const childParentPanel = isLayoutWrapper ? parentIsPanel : thisIsPanel;
        const childParentSection = isLayoutWrapper ? parentIsSection : thisIsSection;
        const childParentHighlight = isLayoutWrapper
            ? parentIsHighlight
            : (parentIsHighlight || thisIsHighlight);
        resolveStyles(child, {
            depth: depth + 1,
            parentIsPanel: childParentPanel,
            parentIsSection: childParentSection,
            parentIsHighlight: childParentHighlight,
        });
    }
}
//# sourceMappingURL=resolve-styles.js.map