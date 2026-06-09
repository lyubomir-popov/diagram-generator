import { parseArrowShorthand } from './arrow-shorthand.js';
import { normalizeLineArray } from './normalize-lines.js';
function normalizeArrow(entry, path) {
    if (typeof entry === 'string') {
        return parseArrowShorthand(entry, path);
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return {
            diagnostics: [
                {
                    code: 'ARROW_INVALID_REF',
                    level: 'error',
                    message: 'Arrow entry must be a shorthand string or mapping.',
                    path,
                },
            ],
        };
    }
    const record = entry;
    if (typeof record.source !== 'string' || typeof record.target !== 'string') {
        return {
            diagnostics: [
                {
                    code: 'ARROW_INVALID_REF',
                    level: 'error',
                    message: 'Arrow object entries require string `source` and `target` fields.',
                    path,
                },
            ],
        };
    }
    return {
        arrow: {
            id: typeof record.id === 'string' ? record.id : undefined,
            source: record.source,
            target: record.target,
            kind: 'directed',
            label: normalizeLineArray(record.label),
            style: typeof record.style === 'string' ? record.style : undefined,
            color: typeof record.color === 'string' ? record.color : undefined,
            labelGap: typeof record.label_gap === 'number'
                ? record.label_gap
                : typeof record.labelGap === 'number'
                    ? record.labelGap
                    : undefined,
            waypoints: Array.isArray(record.waypoints)
                ? record.waypoints
                : undefined,
        },
        diagnostics: [],
    };
}
export function normalizeArrows(value) {
    if (!Array.isArray(value)) {
        return { arrows: [], diagnostics: [] };
    }
    const diagnostics = [];
    const arrows = [];
    value.forEach((entry, index) => {
        const result = normalizeArrow(entry, `arrows[${index}]`);
        diagnostics.push(...result.diagnostics);
        if (result.arrow) {
            arrows.push(result.arrow);
        }
    });
    return { arrows, diagnostics };
}
//# sourceMappingURL=normalize-arrows.js.map