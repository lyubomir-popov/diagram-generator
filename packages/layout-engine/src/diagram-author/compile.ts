import { buildFrameAst } from './build-ast.js';
import { expandFrameDefaults } from './expand-defaults.js';
import { lowerToFrameDiagram } from './lower-to-frame.js';
import { normalizeArrows } from './normalize-arrows.js';
import { parseYamlDocument } from './parse-yaml.js';
import { validateArrowRefs } from './ref-grammar.js';
import { applyStrictMode, collectCompileWarnings } from './validate.js';
import type {
  CompileOptions,
  CompileResult,
  DiagramDocument,
  Diagnostic,
} from './types.js';

function buildMetadata(source: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      schema: source.schema,
      title: source.title,
      engine: source.engine,
    }).filter(([, value]) => value !== undefined),
  );
}

function createScaffoldAst(
  source: Record<string, unknown>,
  options: CompileOptions,
): { ast: DiagramDocument; diagnostics: Diagnostic[] } {
  const frameAst = buildFrameAst(source.root);
  const expanded = expandFrameDefaults(frameAst.root, source.defaults);
  const normalizedArrows = normalizeArrows(source.arrows);
  const ast: DiagramDocument = {
    metadata: buildMetadata(source),
    defaults: expanded.defaults,
    root: expanded.root,
    arrows: normalizedArrows.arrows,
    frameIndex: frameAst.frameIndex,
    source: { ...source },
  };
  const diagnostics = applyStrictMode(
    [
      ...frameAst.diagnostics,
      ...expanded.diagnostics,
      ...normalizedArrows.diagnostics,
      ...validateArrowRefs(normalizedArrows.arrows, frameAst.frameIndex, frameAst.root?.id),
      ...collectCompileWarnings({
        root: ast.root,
        arrows: ast.arrows,
        defaults: ast.defaults,
        frameIndex: ast.frameIndex,
        usedTemplates: expanded.usedTemplates,
      }),
    ],
    options.strict === true,
  );
  return { ast, diagnostics };
}

export function compileDiagramYaml(raw: string, options: CompileOptions = {}): CompileResult {
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
