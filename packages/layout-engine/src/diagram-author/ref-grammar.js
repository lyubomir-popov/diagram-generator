export function extractBaseFrameId(ref) {
    return ref.split('.')[0] ?? ref;
}
export function validateArrowRefs(arrows, frameIndex, rootId) {
    const diagnostics = [];
    arrows.forEach((arrow, index) => {
        const sourceId = extractBaseFrameId(arrow.source);
        const targetId = extractBaseFrameId(arrow.target);
        if (rootId && (sourceId === rootId || targetId === rootId)) {
            diagnostics.push({
                code: 'ARROW_ROOT_ENDPOINT',
                level: 'error',
                message: `Arrow endpoints cannot reference the root canvas frame: ${arrow.source} -> ${arrow.target}`,
                path: `arrows[${index}]`,
            });
            return;
        }
        if (!sourceId || !frameIndex[sourceId]) {
            diagnostics.push({
                code: 'ARROW_UNKNOWN_SOURCE',
                level: 'error',
                message: `Arrow source base id does not exist: ${arrow.source}`,
                path: `arrows[${index}]`,
            });
        }
        if (!targetId || !frameIndex[targetId]) {
            diagnostics.push({
                code: 'ARROW_UNKNOWN_TARGET',
                level: 'error',
                message: `Arrow target base id does not exist: ${arrow.target}`,
                path: `arrows[${index}]`,
            });
        }
    });
    return diagnostics;
}
//# sourceMappingURL=ref-grammar.js.map