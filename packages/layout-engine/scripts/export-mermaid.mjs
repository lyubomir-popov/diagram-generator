#!/usr/bin/env node
/**
 * Mermaid export: authored frame YAML → compile → Mermaid flowchart string.
 *
 * Usage:
 *   node packages/layout-engine/scripts/export-mermaid.mjs path/to/frame.yaml
 *   node packages/layout-engine/scripts/export-mermaid.mjs --slug tiered-network-architecture
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { distImport, resolveFrameYamlPath } from './_dist-import.mjs';

const { compileDiagramYaml, exportMermaid } = await distImport('index.js');

function formatDiagnostics(diagnostics, sourcePath) {
  const prefix = sourcePath ? `${sourcePath}: ` : '';
  return diagnostics
    .map(entry => `${prefix}${entry.path ?? 'document'}: [${entry.code}] ${entry.message}`)
    .join('\n');
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: export-mermaid.mjs <frame.yaml> | --slug <name> [--out file.mmd] [--strict]');
    process.exit(1);
  }

  const yamlPath = resolveFrameYamlPath(arg, process.argv);
  const outIdx = process.argv.indexOf('--out');
  const outPath = outIdx >= 0 ? resolve(process.argv[outIdx + 1]) : null;
  const strict = process.argv.includes('--strict');
  const raw = readFileSync(yamlPath, 'utf-8');
  const compiled = compileDiagramYaml(raw, { sourcePath: yamlPath, strict });
  const blocking = [...compiled.errors, ...(strict ? compiled.warnings : [])];

  if (blocking.length > 0) {
    console.error(formatDiagnostics(blocking, yamlPath));
    process.exit(1);
  }

  const exported = exportMermaid(compiled.ast);
  if (exported.warnings.length > 0) {
    console.error(formatDiagnostics(exported.warnings, yamlPath));
  }

  if (outPath) {
    writeFileSync(outPath, exported.mermaid, 'utf-8');
    console.error(`Wrote ${outPath}`);
  } else {
    process.stdout.write(exported.mermaid);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
