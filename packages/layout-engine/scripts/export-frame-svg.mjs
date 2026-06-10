#!/usr/bin/env node
/**
 * Batch SVG export: YAML → TS layout (HarfBuzz) → SVG string.
 *
 * Usage:
 *   node packages/layout-engine/scripts/export-frame-svg.mjs path/to/frame.yaml
 *   node packages/layout-engine/scripts/export-frame-svg.mjs --slug support-engineering-flow
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { distImport, repoRoot, resolveFrameYamlPath } from './_dist-import.mjs';

const { loadFrameYaml } = await distImport('frame-yaml-loader.js');
const { layoutFrameTree } = await distImport('layout.js');
const { renderFrameDiagramToSvg } = await distImport('svg-render.js');
const { createHarfBuzzTextAdapter } = await distImport('harfbuzz-text-adapter.js');
const {
  collectIconNames,
  createFsIconLoader,
  preloadIconMarkup,
} = await distImport('icon-embed.js');

const ICONS_DIR = join(repoRoot, 'assets/icons');

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: export-frame-svg.mjs <frame.yaml> | --slug <name> [--out file.svg]');
    process.exit(1);
  }
  const yamlPath = resolveFrameYamlPath(arg, process.argv);
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
    arrows: diagram.arrows,
  });
  const iconLoader = createFsIconLoader(ICONS_DIR);
  const iconMarkupByName = preloadIconMarkup(iconLoader, collectIconNames(diagram.root));
  const svg = renderFrameDiagramToSvg(diagram, result, adapter, { iconMarkupByName });

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
