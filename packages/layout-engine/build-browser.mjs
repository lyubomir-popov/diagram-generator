import { execSync } from 'node:child_process';
import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const graphLayoutElkDir = path.join(__dirname, '..', 'graph-layout-elk');

// Browser bundle imports @diagram-generator/graph-layout-elk via package "main" (dist/).
execSync('npm run build', { cwd: graphLayoutElkDir, stdio: 'inherit' });

await mkdir(distDir, { recursive: true });

await build({
  entryPoints: [path.join(__dirname, 'src', 'browser-entry.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'LayoutEngine',
  outfile: path.join(distDir, 'layout-engine.iife.js'),
  target: 'es2022',
});

await build({
  entryPoints: [path.join(__dirname, 'src', 'harfbuzz-text-adapter.ts')],
  bundle: true,
  format: 'esm',
  outfile: path.join(distDir, 'layout-engine-harfbuzz.js'),
  platform: 'browser',
  target: 'es2022',
  define: {
    process: 'undefined',
  },
  external: ['module'],
});

await copyFile(
  path.join(__dirname, 'node_modules', 'harfbuzzjs', 'dist', 'harfbuzz.wasm'),
  path.join(distDir, 'harfbuzz.wasm'),
);

execSync('node scripts/export-preview-engine-manifest.mjs', {
  cwd: __dirname,
  stdio: 'inherit',
});
