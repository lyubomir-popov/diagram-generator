#!/usr/bin/env node
/** Layout a frame YAML and emit grid + component-tree JSON. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { distImport, repoRoot, resolveFrameYamlPath, slugFromArgv } from './_dist-import.mjs';

const yamlPath = resolveFrameYamlPath(process.argv[2], process.argv);
const slug = slugFromArgv(process.argv);

const { loadFrameYaml } = await distImport('frame-yaml-loader.js');
const { layoutFrameTree } = await distImport('layout.js');
const { buildGridInfo } = await distImport('grid-info.js');
const { buildComponentTree } = await distImport('component-tree.js');
const { createHarfBuzzTextAdapter } = await distImport('harfbuzz-text-adapter.js');

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

const payload = {
  slug,
  width: result.width,
  height: result.height,
  coerced: result.coerced ?? false,
  gridInfo: buildGridInfo(diagram, diagram.root),
  componentTree: buildComponentTree(diagram.root),
};

process.stdout.write(`${JSON.stringify(payload)}\n`);
