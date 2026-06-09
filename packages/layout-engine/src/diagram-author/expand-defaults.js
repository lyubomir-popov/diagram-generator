import { normalizeFrameTemplate } from './build-ast.js';
function normalizeDefaultsMap(value) {
    const diagnostics = [];
    if (value === undefined || value === null) {
        return { defaults: {}, diagnostics };
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
        diagnostics.push({
            code: 'INVALID_DEFAULT',
            level: 'error',
            message: 'Top-level `defaults` must be a mapping.',
            path: 'defaults',
        });
        return { defaults: {}, diagnostics };
    }
    const defaults = {};
    for (const [name, entry] of Object.entries(value)) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            diagnostics.push({
                code: 'INVALID_DEFAULT',
                level: 'error',
                message: 'Default template entry must be a mapping.',
                path: `defaults.${name}`,
            });
            continue;
        }
        defaults[name] = normalizeFrameTemplate(entry);
    }
    return { defaults, diagnostics };
}
function mergeTemplateIntoNode(node, template) {
    const { use: _use, id, children, ...localProps } = node;
    return {
        id,
        children,
        ...template,
        ...localProps,
    };
}
function expandNode(node, defaults, path, diagnostics, usedTemplates) {
    const children = node.children.map((child, index) => expandNode(child, defaults, `${path}.children[${index}]`, diagnostics, usedTemplates));
    let expanded = {
        ...node,
        children,
    };
    if (node.use) {
        usedTemplates.add(node.use);
        const template = defaults[node.use];
        if (!template) {
            diagnostics.push({
                code: 'UNKNOWN_TEMPLATE',
                level: 'error',
                message: `Unknown default template: ${node.use}`,
                path,
            });
            return expanded;
        }
        expanded = mergeTemplateIntoNode(expanded, template);
        delete expanded.use;
    }
    return expanded;
}
export function expandFrameDefaults(root, rawDefaults) {
    const normalizedDefaults = normalizeDefaultsMap(rawDefaults);
    if (!root) {
        return {
            root: null,
            defaults: normalizedDefaults.defaults,
            usedTemplates: new Set(),
            diagnostics: normalizedDefaults.diagnostics,
        };
    }
    const diagnostics = [...normalizedDefaults.diagnostics];
    const usedTemplates = new Set();
    return {
        root: expandNode(root, normalizedDefaults.defaults, 'root', diagnostics, usedTemplates),
        defaults: normalizedDefaults.defaults,
        usedTemplates,
        diagnostics,
    };
}
//# sourceMappingURL=expand-defaults.js.map