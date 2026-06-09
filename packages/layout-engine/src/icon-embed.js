/**
 * Embed assets/icons/*.svg into batch SVG output (Node).
 * Mirrors preview layout-bridge icon fetch + Python diagram_shared.load_icon.
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
const RECOLOR_VALUES = /^(black|#000|#000000|currentcolor)$/i;
/** Basename-only icon file name; rejects path traversal. */
export function safeIconFileName(name) {
    if (!name || name.includes('..'))
        return null;
    const safe = basename(name);
    if (!safe || !/\.svg$/i.test(safe))
        return null;
    return safe;
}
/** Strip outer <svg> wrapper; return child markup. */
export function extractSvgInnerMarkup(svgText) {
    const trimmed = svgText.trim();
    const match = trimmed.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i);
    if (match?.[1])
        return match[1].trim();
    return trimmed;
}
/** Apply iconFill to shape fills/strokes that use template black/currentColor. */
export function tintIconInnerMarkup(markup, fill) {
    if (!fill)
        return markup;
    const esc = fill.replace(/"/g, '&quot;');
    return markup.replace(/(<(?:path|circle|rect|polygon|ellipse)\b[^>]*\s)(fill|stroke)="([^"]*)"/gi, (full, prefix, attr, value) => {
        if (!RECOLOR_VALUES.test(value.trim()))
            return full;
        return `${prefix}${attr}="${esc}"`;
    });
}
export function createFsIconLoader(iconsDir) {
    const cache = new Map();
    return (name) => {
        const safe = safeIconFileName(name);
        if (!safe)
            return null;
        if (cache.has(safe))
            return cache.get(safe) ?? null;
        const path = join(iconsDir, safe);
        if (!existsSync(path)) {
            cache.set(safe, null);
            return null;
        }
        try {
            const inner = extractSvgInnerMarkup(readFileSync(path, 'utf-8'));
            cache.set(safe, inner);
            return inner;
        }
        catch {
            cache.set(safe, null);
            return null;
        }
    };
}
export function collectIconNames(frame, out = new Set()) {
    if (frame.icon)
        out.add(frame.icon);
    for (const child of frame.children)
        collectIconNames(child, out);
    return out;
}
export function preloadIconMarkup(loader, names) {
    const map = new Map();
    for (const name of names) {
        const inner = loader(name);
        if (inner)
            map.set(name, inner);
    }
    return map;
}
//# sourceMappingURL=icon-embed.js.map