import { parseYamlDocument } from './parse-yaml.js';
import type { CompileOptions, CompileResult, DiagramDocument } from './types.js';

function asRecordMap(value: unknown): Record<string, Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? { ...(entry as Record<string, unknown>) }
        : {},
    ]),
  );
}

function buildMetadata(source: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      schema: source.schema,
      title: source.title,
      engine: source.engine,
    }).filter(([, value]) => value !== undefined),
  );
}

function createScaffoldAst(source: Record<string, unknown>): DiagramDocument {
  return {
    metadata: buildMetadata(source),
    defaults: asRecordMap(source.defaults),
    nodes: {},
    groups: {},
    edges: [],
    layoutTree: null,
    source: { ...source },
  };
}

export function compileDiagramYaml(raw: string, options: CompileOptions = {}): CompileResult {
  const parsed = parseYamlDocument(raw, options);
  const ast = createScaffoldAst(parsed);
  const diagnostics = [];

  return {
    ast,
    diagnostics,
    errors: [],
    warnings: [],
    raw: parsed,
    normalized: parsed,
  };
}