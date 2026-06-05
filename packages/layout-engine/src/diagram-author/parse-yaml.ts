import { parse as parseYaml } from 'yaml';

import type { CompileOptions } from './types.js';

export function parseYamlDocument(raw: string, _options: CompileOptions = {}): Record<string, unknown> {
  const parsed = parseYaml(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Diagram authoring document must be a YAML mapping.');
  }
  return parsed as Record<string, unknown>;
}