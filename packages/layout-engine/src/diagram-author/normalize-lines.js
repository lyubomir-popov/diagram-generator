export function normalizeLineSpec(value) {
    if (typeof value === 'string') {
        return { text: value };
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined;
    }
    const line = value;
    return {
        text: String(line.text ?? ''),
        size: typeof line.size === 'string' ? line.size : undefined,
        weight: typeof line.weight === 'string' ? line.weight : undefined,
        fill: typeof line.fill === 'string' ? line.fill : undefined,
        smallCaps: typeof line.smallCaps === 'boolean'
            ? line.smallCaps
            : typeof line.small_caps === 'boolean'
                ? line.small_caps
                : undefined,
        letterSpacing: typeof line.letterSpacing === 'string'
            ? line.letterSpacing
            : typeof line.letter_spacing === 'string'
                ? line.letter_spacing
                : undefined,
        lineStep: typeof line.lineStep === 'number'
            ? line.lineStep
            : typeof line.line_step === 'number'
                ? line.line_step
                : undefined,
        fontFamily: typeof line.fontFamily === 'string'
            ? line.fontFamily
            : typeof line.font_family === 'string'
                ? line.font_family
                : undefined,
    };
}
export function normalizeLineArray(value) {
    if (typeof value === 'string') {
        return [{ text: value }];
    }
    if (!Array.isArray(value)) {
        return undefined;
    }
    return value.map(entry => normalizeLineSpec(entry) ?? { text: String(entry ?? '') });
}
//# sourceMappingURL=normalize-lines.js.map