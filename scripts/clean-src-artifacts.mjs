#!/usr/bin/env node
/**
 * Remove accidental TypeScript emit artifacts from source trees.
 * These files are gitignored but can shadow .ts during vitest/vite resolution.
 */
import { readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactPattern = /\.(js|js\.map|d\.ts|d\.ts\.map)$/;

function cleanSrcTree(rootDir) {
  let removed = 0;
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (artifactPattern.test(entry)) {
        rmSync(fullPath, { force: true });
        removed += 1;
      }
    }
  }
  walk(rootDir);
  return removed;
}

const targets = [
  path.join(repoRoot, 'packages'),
  path.join(repoRoot, 'apps'),
];

let total = 0;
for (const base of targets) {
  for (const pkg of readdirSync(base)) {
    const srcDir = path.join(base, pkg, 'src');
    try {
      if (statSync(srcDir).isDirectory()) {
        total += cleanSrcTree(srcDir);
      }
    } catch {
      // package has no src/
    }
  }
}

if (total > 0) {
  console.log(`clean:src-artifacts removed ${total} file(s) from packages/*/src and apps/*/src`);
}
