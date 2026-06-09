import { buildFrameAst } from './build-ast.js';
import { expandFrameDefaults } from './expand-defaults.js';
import { lowerToFrameDiagram } from './lower-to-frame.js';
import { normalizeArrows } from './normalize-arrows.js';
import { parseYamlDocument } from './parse-yaml.js';
import { validateArrowRefs } from './ref-grammar.js';
import { applyStrictMode, collectCompileWarnings } from './validate.js';
import { normalizeSequenceDiagram } from '../sequence-layout/model.js';
function buildMetadata(source) {
    return Object.fromEntries(Object.entries({
        schema: source.schema,
        title: source.title,
        engine: source.engine,
    }).filter(([, value]) => value !== undefined));
}
function normalizeSequenceBlock(source) {
    const rawSequence = source.sequence;
    if (rawSequence === undefined) {
        return { sequence: undefined, diagnostics: [] };
    }
    if (!rawSequence || typeof rawSequence !== 'object' || Array.isArray(rawSequence)) {
        return {
            diagnostics: [
                {
                    code: 'SEQUENCE_INVALID_BLOCK',
                    level: 'error',
                    message: 'Top-level `sequence` must be a mapping.',
                    path: 'sequence',
                },
            ],
        };
    }
    const record = rawSequence;
    const normalized = normalizeSequenceDiagram({
        participants: Array.isArray(record.participants) ? record.participants : [],
        messages: Array.isArray(record.messages) ? record.messages : [],
        notes: Array.isArray(record.notes) ? record.notes : undefined,
        groups: Array.isArray(record.groups) ? record.groups : undefined,
    });
    return {
        sequence: normalized.spec,
        diagnostics: normalized.errors.map((error) => ({
            code: error.code,
            level: 'error',
            message: error.message,
            path: `sequence.${error.path}`,
        })),
    };
}
function createScaffoldAst(source, options) {
    const frameAst = buildFrameAst(source.root);
    const expanded = expandFrameDefaults(frameAst.root, source.defaults);
    const normalizedArrows = normalizeArrows(source.arrows);
    const normalizedSequence = normalizeSequenceBlock(source);
    const ast = {
        metadata: buildMetadata(source),
        defaults: expanded.defaults,
        root: expanded.root,
        arrows: normalizedArrows.arrows,
        sequence: normalizedSequence.sequence,
        frameIndex: frameAst.frameIndex,
        source: { ...source },
    };
    const diagnostics = applyStrictMode([
        ...frameAst.diagnostics,
        ...expanded.diagnostics,
        ...normalizedArrows.diagnostics,
        ...normalizedSequence.diagnostics,
        ...validateArrowRefs(normalizedArrows.arrows, frameAst.frameIndex, frameAst.root?.id),
        ...collectCompileWarnings({
            root: ast.root,
            arrows: ast.arrows,
            defaults: ast.defaults,
            frameIndex: ast.frameIndex,
            usedTemplates: expanded.usedTemplates,
        }),
    ], options.strict === true);
    return { ast, diagnostics };
}
export function compileDiagramYaml(raw, options = {}) {
    const parsed = parseYamlDocument(raw, options);
    const scaffold = createScaffoldAst(parsed, options);
    const diagnostics = [...scaffold.diagnostics];
    const errors = diagnostics.filter(diagnostic => diagnostic.level === 'error');
    const warnings = diagnostics.filter(diagnostic => diagnostic.level === 'warning');
    const frameDiagram = errors.length === 0 && scaffold.ast.root
        ? lowerToFrameDiagram(scaffold.ast, parsed)
        : undefined;
    return {
        ast: scaffold.ast,
        frameDiagram,
        diagnostics,
        errors,
        warnings,
        deprecations: [],
        raw: parsed,
        normalized: parsed,
    };
}
//# sourceMappingURL=compile.js.map