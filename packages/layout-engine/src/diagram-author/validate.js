import { extractBaseFrameId } from './ref-grammar.js';
function arrowSignature(arrow) {
    const labelKey = arrow.label?.map(line => line.text).join('\0') ?? '';
    return `${arrow.source}\0${arrow.target}\0${labelKey}`;
}
function collectLeafIds(root) {
    if (!root) {
        return [];
    }
    const leafIds = [];
    const visit = (node) => {
        if (node.children.length === 0 && node.id) {
            leafIds.push(node.id);
        }
        node.children.forEach(visit);
    };
    visit(root);
    return leafIds;
}
function incidentArrowCount(frameId, arrows) {
    return arrows.filter(arrow => {
        const sourceId = extractBaseFrameId(arrow.source);
        const targetId = extractBaseFrameId(arrow.target);
        return sourceId === frameId || targetId === frameId;
    }).length;
}
export function collectCompileWarnings(input) {
    const diagnostics = [];
    Object.keys(input.defaults).forEach(templateName => {
        if (!input.usedTemplates.has(templateName)) {
            diagnostics.push({
                code: 'UNUSED_DEFAULT',
                level: 'warning',
                message: `Default template is never referenced: ${templateName}`,
                path: `defaults.${templateName}`,
            });
        }
    });
    collectLeafIds(input.root).forEach(frameId => {
        const entry = input.frameIndex[frameId];
        if (!entry || entry.isContainer || entry.path === 'root') {
            return;
        }
        if (incidentArrowCount(frameId, input.arrows) === 0) {
            diagnostics.push({
                code: 'ORPHAN_LEAF',
                level: 'warning',
                message: `Leaf frame has no incident arrows: ${frameId}`,
                path: entry.path,
            });
        }
    });
    const seenArrows = new Map();
    input.arrows.forEach((arrow, index) => {
        if (arrow.source === arrow.target) {
            diagnostics.push({
                code: 'SELF_LOOP_ARROW',
                level: 'warning',
                message: `Arrow source and target are identical: ${arrow.source}`,
                path: `arrows[${index}]`,
            });
        }
        const signature = arrowSignature(arrow);
        const firstIndex = seenArrows.get(signature);
        if (firstIndex !== undefined) {
            diagnostics.push({
                code: 'DUPLICATE_ARROW',
                level: 'warning',
                message: `Duplicate arrow (same source, target, and label as arrows[${firstIndex}])`,
                path: `arrows[${index}]`,
            });
        }
        else {
            seenArrows.set(signature, index);
        }
    });
    return diagnostics;
}
export function applyStrictMode(diagnostics, strict) {
    if (!strict) {
        return diagnostics;
    }
    return diagnostics.map(diagnostic => {
        if (diagnostic.level !== 'warning') {
            return diagnostic;
        }
        if (diagnostic.code === 'DUPLICATE_ARROW' || diagnostic.code === 'SELF_LOOP_ARROW') {
            return { ...diagnostic, level: 'error' };
        }
        return diagnostic;
    });
}
//# sourceMappingURL=validate.js.map