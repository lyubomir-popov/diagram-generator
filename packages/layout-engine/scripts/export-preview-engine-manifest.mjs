#!/usr/bin/env node
/** Emit preview-engine manifest JSON for preview_server.py (spec 025 T002). */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { distImport, pkgRoot } from './_dist-import.mjs';

const { serializePreviewEngineManifest } = await distImport('preview-engine/index.js');
const manifest = serializePreviewEngineManifest();
const outPath = join(pkgRoot, 'dist', 'preview-engine-manifest.json');
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
process.stdout.write(`${outPath}\n`);
