const ARROW_SHORTHAND_PATTERN = /^\s*(.+?)\s*->\s*(.+?)\s*$/;
export function parseArrowShorthand(value, path) {
    const match = value.match(ARROW_SHORTHAND_PATTERN);
    if (!match) {
        return {
            diagnostics: [
                {
                    code: 'ARROW_SHORTHAND_PARSE',
                    level: 'error',
                    message: 'Arrow shorthand must use `source -> target`.',
                    path,
                },
            ],
        };
    }
    const source = match[1]?.trim();
    const target = match[2]?.trim();
    if (!source || !target) {
        return {
            diagnostics: [
                {
                    code: 'ARROW_SHORTHAND_PARSE',
                    level: 'error',
                    message: 'Arrow shorthand must use `source -> target`.',
                    path,
                },
            ],
        };
    }
    return {
        arrow: {
            source,
            target,
            kind: 'directed',
        },
        diagnostics: [],
    };
}
//# sourceMappingURL=arrow-shorthand.js.map