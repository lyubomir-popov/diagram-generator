import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const pkgRoot = resolve(__dirname, '..');
export const repoRoot = resolve(pkgRoot, '../..');

const DEFAULT_FRAMES_DIR = join(repoRoot, 'scripts/diagrams/frames');
const SRC_DIR = join(pkgRoot, 'src');
const TS_CONFIG = join(pkgRoot, 'tsconfig.json');
const PACKAGE_JSON = join(pkgRoot, 'package.json');

let _distChecked = false;

function _safeMtimeMs(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function _newestTreeMtimeMs(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, _newestTreeMtimeMs(fullPath));
      continue;
    }
    newest = Math.max(newest, _safeMtimeMs(fullPath));
  }
  return newest;
}

function _newestSourceMtimeMs() {
  return Math.max(
    _newestTreeMtimeMs(SRC_DIR),
    _safeMtimeMs(TS_CONFIG),
    _safeMtimeMs(PACKAGE_JSON),
  );
}

function _ensureDistCurrent(name) {
  const distPath = join(pkgRoot, 'dist', name);
  if (_distChecked && _safeMtimeMs(distPath) > 0) {
    return;
  }

  const sourceMtimeMs = _newestSourceMtimeMs();
  const distMtimeMs = _safeMtimeMs(distPath);
  if (distMtimeMs >= sourceMtimeMs) {
    _distChecked = true;
    return;
  }

  execSync('npm run build', {
    cwd: pkgRoot,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  _distChecked = true;
}

/** Match preview_server.py `DG_FRAMES_DIR` override for isolated tests and custom layouts. */
export function framesDir() {
  const override = process.env.DG_FRAMES_DIR;
  if (override && String(override).trim()) {
    return resolve(String(override).trim());
  }
  return DEFAULT_FRAMES_DIR;
}

export function distImport(name) {
  _ensureDistCurrent(name);
  return import(pathToFileURL(join(pkgRoot, 'dist', name)).href);
}

export function resolveFrameYamlPath(arg, argv) {
  const base = framesDir();
  if (arg.startsWith('--slug=')) {
    const slug = arg.slice('--slug='.length);
    return join(base, `${slug}.yaml`);
  }
  if (arg === '--slug' && argv[3]) {
    return join(base, `${argv[3]}.yaml`);
  }
  return resolve(arg);
}

export function slugFromArgv(argv) {
  const arg = argv[2];
  if (!arg) return null;
  if (arg.startsWith('--slug=')) return arg.slice('--slug='.length);
  if (arg === '--slug' && argv[3]) return argv[3];
  return null;
}
