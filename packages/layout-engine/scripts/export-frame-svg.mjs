#!/usr/bin/env node
/**
 * Batch SVG export: YAML → TS layout (HarfBuzz) → SVG string.
 *
 * Usage:
 *   node packages/layout-engine/scripts/export-frame-svg.mjs path/to/frame.yaml
 *   node packages/layout-engine/scripts/export-frame-svg.mjs --slug support-engineering-flow
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const repoRoot = resolve(pkgRoot, '../..');

function distImport(name) {
  return import(pathToFileURL(join(pkgRoot, 'dist', name)).href);
}

const { loadFrameYaml } = await distImport('frame-yaml-loader.js');
const { layoutFrameTree } = await distImport('layout.js');
const { renderFrameDiagramToSvg } = await distImport('svg-render.js');
const { createHarfBuzzTextAdapter } = await distImport('harfbuzz-text-adapter.js');

function resolveInputPath(arg) {
  if (arg.startsWith('--slug=')) {
    const slug = arg.slice('--slug='.length);
    return join(repoRoot, 'scripts/diagrams/frames', `${slug}.yaml`);
  }
  if (arg === '--slug' && process.argv[3]) {
    return join(repoRoot, 'scripts/diagrams/frames', `${process.argv[3]}.yaml`);
  }
  return resolve(arg);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: export-frame-svg.mjs <frame.yaml> | --slug <name> [--out file.svg]');
    process.exit(1);
  }
  const yamlPath = resolveInputPath(arg);
  const outIdx = process.argv.indexOf('--out');
  const outPath = outIdx >= 0 ? resolve(process.argv[outIdx + 1]) : null;

  const fontPath = join(repoRoot, 'assets/UbuntuSans[wdth,wght].ttf');
  const fontData = readFileSync(fontPath).buffer;
  const adapter = await createHarfBuzzTextAdapter({ fontData });

  const diagram = loadFrameYaml(yamlPath);
  const result = layoutFrameTree(diagram.root, adapter, {
    gridCols: diagram.gridCols,
    gridColGap: diagram.gridColGap,
    gridRowGap: diagram.gridRowGap,
    gridOuterMargin: diagram.gridOuterMargin,
  });
  const svg = renderFrameDiagramToSvg(diagram, result, adapter);

  if (outPath) {
    writeFileSync(outPath, svg, 'utf-8');
    console.error(`Wrote ${outPath}`);
  } else {
    process.stdout.write(svg);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
