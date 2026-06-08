#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SCRIPTS_DIR = path.join(ROOT, "scripts");

const ALLOWLIST = new Set([
  "design_tokens.py",

  // Dated parity oracle retained for cross-language verification only.
  "diagram_layout.py",
  "diagram_model.py",
  "diagram_shared.py",
  "frame_loader.py",
  "frame_model.py",
  "frame_style_classes.py",
  "layout_v3.py",
  "quadtree.py",
  "text_metrics.py",

  // Draw.io / export / asset-sync tooling outside the product path.
  "diagrams/__init__.py",
  "drawio_review_workflow.py",
  "drawio_style_presets.py",
  "drawio_style_sync.py",
  "drawio_style_tokens.py",
  "export_drawio_batch.py",
  "export_drawio_library.py",
  "export_layer3_mpls.py",
  "export_memory_wall_drawio.py",
  "export_png.py",
  "svg_illustrator_sanitize.py",
  "sync_baseline_foundry_assets.py",

  // Misc repo utilities outside the diagram runtime.
  "create_jira_epic.py",
  "run_elk_save_live_playwright.py",
]);

async function listPyFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listPyFiles(abs, rel)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".py")) {
      files.push(rel);
    }
  }
  return files;
}

function isAllowedNewPython(relPath) {
  return path.posix.basename(relPath).startsWith("test_");
}

const files = await listPyFiles(SCRIPTS_DIR);
const unexpected = files.filter((relPath) => !ALLOWLIST.has(relPath) && !isAllowedNewPython(relPath));

if (unexpected.length > 0) {
  console.error("spec 038 ratchet: new Python product-path files are not allowed under scripts/.");
  console.error("Move the behavior to Node / TypeScript or explicitly retire old Python first.");
  console.error("Unexpected files:");
  for (const relPath of unexpected) {
    console.error(`- scripts/${relPath}`);
  }
  process.exit(1);
}

console.log(`spec 038 ratchet: ok (${files.length} Python files scanned, no new product-path files).`);
