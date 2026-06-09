import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ARROW_HEAD_HALF_WIDTH,
  ARROW_HEAD_LENGTH,
  BODY_LINE_STEP,
  GRID_GUTTER,
  ICON_SIZE,
  INSET,
  buildComponentTree,
  buildGridInfo,
  collectIconNames,
  createFsIconLoader,
  createHarfBuzzTextAdapter,
  evaluatePreviewEngineCompatibility,
  getPreviewEngine,
  layoutFrameTree,
  listPreviewEngines,
  loadFrameYaml,
  preloadIconMarkup,
  renderFrameDiagramToSvg,
  resolvePreviewEngine,
  serializeFrameDiagram,
  serializePreviewEngineManifest,
  type PreviewDocumentKind,
  type PreviewEngineContext,
  type PreviewEngineManifest,
} from "@diagram-generator/layout-engine";
import {
  persistForceSpecToYaml,
  persistFrameDiagramOverridePayloadToYaml,
  verifyElkLayoutPersisted,
  type PersistOverridePayload,
} from "./persistence/index.js";

const DEFAULT_PORT = 8100;
const SPEC_HOME = "specs/038-ts-authority-python-removal/";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { parse: parseYaml } = require("yaml") as { parse: (raw: string) => unknown };
const APP_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(APP_ROOT, "..", "..");
const SCRIPTS_DIR = path.join(REPO_ROOT, "scripts");
const PREVIEW_DIR = path.join(SCRIPTS_DIR, "preview");
const FRAMES_DIR = path.resolve(process.env.DG_FRAMES_DIR ?? path.join(SCRIPTS_DIR, "diagrams", "frames"));
const FORCE_DEFINITIONS_DIR = path.resolve(
  process.env.DG_FORCE_DEFINITIONS_DIR ?? path.join(SCRIPTS_DIR, "diagrams", "force"),
);
const ICONS_DIR = path.join(REPO_ROOT, "assets", "icons");
const CORPUS_REF_DIR = path.join(REPO_ROOT, "docs", "corpus-references");
const INPUT_DIRS = [path.join(REPO_ROOT, "diagrams", "1.input")];
const BF_VENDOR_ROOT = path.join(REPO_ROOT, "assets", "baseline-foundry");
const BF_VENDOR_OS_CSS = path.join(BF_VENDOR_ROOT, "os", "styles.css");
const BF_VENDOR_FONT_DIR = path.join(BF_VENDOR_ROOT, "fonts");
const LAYOUT_ENGINE_BUNDLE = path.join(
  REPO_ROOT,
  "packages",
  "layout-engine",
  "dist",
  "layout-engine.iife.js",
);
const LAYOUT_ENGINE_HARFBUZZ_BUNDLE = path.join(
  REPO_ROOT,
  "packages",
  "layout-engine",
  "dist",
  "layout-engine-harfbuzz.js",
);
const LAYOUT_ENGINE_WASM = path.join(REPO_ROOT, "packages", "layout-engine", "dist", "harfbuzz.wasm");
const LAYOUT_ENGINE_FONT = path.join(REPO_ROOT, "assets", "UbuntuSans[wdth,wght].ttf");
const LAYOUT_ENGINE_BROWSER_ENTRY = path.join(REPO_ROOT, "packages", "layout-engine", "src", "browser-entry.ts");
const LAYOUT_ENGINE_HARFBUZZ_ENTRY = path.join(
  REPO_ROOT,
  "packages",
  "layout-engine",
  "src",
  "harfbuzz-text-adapter.ts",
);
const GRAPH_LAYOUT_CORE_ENTRY = path.join(REPO_ROOT, "packages", "graph-layout-core", "src", "index.ts");
const GRAPH_LAYOUT_ELK_ENTRY = path.join(REPO_ROOT, "packages", "graph-layout-elk", "src", "index.ts");
const HARFBUZZ_WASM_SOURCE = path.join(
  REPO_ROOT,
  "packages",
  "layout-engine",
  "node_modules",
  "harfbuzzjs",
  "dist",
  "harfbuzz.wasm",
);
const VIEWER_TEMPLATE = path.join(PREVIEW_DIR, "viewer-unified.html");

const REFERENCE_MAP: Record<string, string> = {
  "memory-wall": "redo-this-image-onbrand.png",
  "attention-qkv": "image 3.png",
  "logic-data-vram": "image 4.png",
  "request-to-hardware-stack": "image 6.png",
  "inference-snaps": "image 7.png",
  "example-arrow-label-separator": "example-arrow-label-separator-rough.svg",
  "force-stakeholders": "force/IMG_3229.jpg",
  "tiered-network-architecture": "maas/tiered-network-architecture.png",
};

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const iconLoader = createFsIconLoader(ICONS_DIR);
const previewEngines = serializePreviewEngineManifest();
const hostableGridLayoutKeys = new Set(
  previewEngines
    .filter(
      (entry: PreviewEngineManifest): entry is PreviewEngineManifest & { layoutEngineKey: string } =>
        entry.shellMode === "grid" && typeof entry.layoutEngineKey === "string",
    )
    .map((entry) => entry.layoutEngineKey),
);
const textAdapterPromise = createHarfBuzzTextAdapter({
  fontData: readFileSync(path.join(REPO_ROOT, "assets", "UbuntuSans[wdth,wght].ttf")).buffer,
});
const WATCH_EXTENSIONS = new Set([".yaml", ".yml", ".json", ".html", ".css", ".js", ".svg", ".ttf", ".woff", ".woff2"]);
const WATCH_PATHS = [FRAMES_DIR, FORCE_DEFINITIONS_DIR, PREVIEW_DIR, BF_VENDOR_ROOT, path.join(REPO_ROOT, "packages", "layout-engine", "dist")];
let rebuildGeneration = 0;
let lastRebuildError: string | null = null;
let watchIntervalHandle: NodeJS.Timeout | null = null;
let lastWatchMtimes = new Map<string, number>();
const sseClients = new Set<ServerResponse>();
let previewBundleBuildPromise: Promise<void> | null = null;

function parsePort(argv: readonly string[], env: NodeJS.ProcessEnv): number {
  const rawArgPort = argv.find((arg) => arg.startsWith("--port="))?.split("=", 2)[1];
  const shortFlagIndex = argv.findIndex((arg) => arg === "--port" || arg === "-p");
  const rawFlagPort =
    shortFlagIndex >= 0 && shortFlagIndex + 1 < argv.length ? argv[shortFlagIndex + 1] : undefined;
  const rawPort = rawArgPort ?? rawFlagPort ?? env.DG_PREVIEW_PORT ?? env.PREVIEW_PORT;
  const parsed = Number.parseInt(rawPort ?? `${DEFAULT_PORT}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendHtml(res: ServerResponse, statusCode: number, html: string): void {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
    "Cache-Control": "no-store",
  });
  res.end(html);
}

function sendText(res: ServerResponse, statusCode: number, text: string): void {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Cache-Control": "no-store",
  });
  res.end(text);
}

function sendBytes(
  res: ServerResponse,
  statusCode: number,
  contentType: string,
  body: Buffer,
  cacheControl = "no-store",
): void {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": body.length,
    "Cache-Control": cacheControl,
  });
  res.end(body);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON");
  }
}

function requestUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
}

function collectWatchMtimes(): Map<string, number> {
  const mtimes = new Map<string, number>();
  const visit = (targetPath: string): void => {
    if (!existsSync(targetPath)) return;
    const stats = statSync(targetPath);
    if (stats.isFile()) {
      if (WATCH_EXTENSIONS.has(path.extname(targetPath).toLowerCase())) {
        mtimes.set(targetPath, Math.trunc(stats.mtimeMs));
      }
      return;
    }
    for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
      const childPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) {
        visit(childPath);
      } else if (entry.isFile() && WATCH_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        mtimes.set(childPath, Math.trunc(statSync(childPath).mtimeMs));
      }
    }
  };
  for (const watchPath of WATCH_PATHS) {
    visit(watchPath);
  }
  return mtimes;
}

function broadcastReloadEvent(): void {
  const payload = JSON.stringify({
    generation: rebuildGeneration,
    error: lastRebuildError,
  });
  for (const client of [...sseClients]) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
      try {
        client.end();
      } catch {
        // ignore client teardown errors
      }
    }
  }
}

function startWatchLoop(): void {
  if (watchIntervalHandle) return;
  lastWatchMtimes = collectWatchMtimes();
  watchIntervalHandle = setInterval(() => {
    try {
      const currentMtimes = collectWatchMtimes();
      let changed = currentMtimes.size !== lastWatchMtimes.size;
      if (!changed) {
        for (const [filePath, mtime] of currentMtimes) {
          if (lastWatchMtimes.get(filePath) !== mtime) {
            changed = true;
            break;
          }
        }
      }
      if (!changed) return;
      lastWatchMtimes = currentMtimes;
      rebuildGeneration += 1;
      lastRebuildError = null;
      broadcastReloadEvent();
    } catch (error) {
      rebuildGeneration += 1;
      lastRebuildError = error instanceof Error ? error.message : String(error);
      broadcastReloadEvent();
    }
  }, 500);
}

function currentGitBranch(): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isSafeSlug(slug: string): boolean {
  return /^[A-Za-z0-9._:-]+$/.test(slug);
}

function normalizeFrameSlug(slug: string): string | null {
  const value = decodeURIComponent(slug).replace(/^v3:/, "");
  return isSafeSlug(value) ? value : null;
}

function normalizeLayoutEngine(layoutEngine: string | undefined): string {
  const key = layoutEngine?.trim() ?? "";
  if (!key) return "";
  return hostableGridLayoutKeys.size === 0 || hostableGridLayoutKeys.has(key) ? key : "";
}

function listYamlSlugs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
    .map((entry) => path.basename(entry.name, ".yaml"))
    .filter((slug) => isSafeSlug(slug))
    .sort((a, b) => a.localeCompare(b));
}

function listAutolayoutDiagrams(): string[] {
  return listYamlSlugs(FRAMES_DIR);
}

function listForceExamples(): string[] {
  return listYamlSlugs(FORCE_DEFINITIONS_DIR);
}

function resolvePreviewAssetPath(filename: string): string | null {
  if (!filename || filename.includes("..")) return null;
  if (filename === "layout-engine.js") return LAYOUT_ENGINE_BUNDLE;
  if (filename === "layout-engine-harfbuzz.js") return LAYOUT_ENGINE_HARFBUZZ_BUNDLE;
  if (filename === "harfbuzz.wasm") return LAYOUT_ENGINE_WASM;
  if (filename === "layout-font.ttf") return LAYOUT_ENGINE_FONT;
  const safe = path.posix.basename(filename);
  return path.join(PREVIEW_DIR, safe);
}

async function ensureLayoutEngineBrowserAssets(): Promise<void> {
  if (existsSync(LAYOUT_ENGINE_BUNDLE) && existsSync(LAYOUT_ENGINE_HARFBUZZ_BUNDLE) && existsSync(LAYOUT_ENGINE_WASM)) {
    return;
  }
  if (previewBundleBuildPromise) {
    await previewBundleBuildPromise;
    return;
  }

  previewBundleBuildPromise = (async () => {
    mkdirSync(path.dirname(LAYOUT_ENGINE_BUNDLE), { recursive: true });
    const layoutEngineRequire = createRequire(path.join(REPO_ROOT, "packages", "layout-engine", "package.json"));
    const esbuild = layoutEngineRequire("esbuild") as {
      build: (options: {
        entryPoints: string[];
        bundle: boolean;
        format: "iife" | "esm";
        globalName?: string;
        outfile: string;
        target: string;
        platform?: "browser";
        define?: Record<string, string>;
        external?: string[];
        plugins?: Array<{
          name: string;
          setup: (build: {
            onResolve: (
              options: { filter: RegExp },
              callback: (args: { path: string }) => { path: string } | null,
            ) => void;
          }) => void;
        }>;
      }) => Promise<unknown>;
    };
    const localPackageAliasPlugin = {
      name: "local-package-alias",
      setup(build: {
        onResolve: (
          options: { filter: RegExp },
          callback: (args: { path: string }) => { path: string } | null,
        ) => void;
      }) {
        build.onResolve({ filter: /^@diagram-generator\/graph-layout-core$/ }, () => ({ path: GRAPH_LAYOUT_CORE_ENTRY }));
        build.onResolve({ filter: /^@diagram-generator\/graph-layout-elk$/ }, () => ({ path: GRAPH_LAYOUT_ELK_ENTRY }));
      },
    };

    await esbuild.build({
      entryPoints: [LAYOUT_ENGINE_BROWSER_ENTRY],
      bundle: true,
      format: "iife",
      globalName: "LayoutEngine",
      outfile: LAYOUT_ENGINE_BUNDLE,
      target: "es2022",
      plugins: [localPackageAliasPlugin],
    });

    await esbuild.build({
      entryPoints: [LAYOUT_ENGINE_HARFBUZZ_ENTRY],
      bundle: true,
      format: "esm",
      outfile: LAYOUT_ENGINE_HARFBUZZ_BUNDLE,
      platform: "browser",
      target: "es2022",
      define: {
        process: "undefined",
      },
      external: ["module"],
    });

    copyFileSync(HARFBUZZ_WASM_SOURCE, LAYOUT_ENGINE_WASM);
  })();

  try {
    await previewBundleBuildPromise;
  } finally {
    previewBundleBuildPromise = null;
  }
}

function previewAssetUrl(filename: string): string {
  const assetPath = resolvePreviewAssetPath(filename);
  const version = assetPath && existsSync(assetPath) ? Math.trunc(statSync(assetPath).mtimeMs) : 0;
  return `/preview/${filename}?v=${version}`;
}

function findReferenceImage(slug: string): string | null {
  const corpus = path.join(CORPUS_REF_DIR, `${slug}-source.png`);
  if (existsSync(corpus)) return corpus;

  const mapped = REFERENCE_MAP[slug];
  if (mapped) {
    for (const inputDir of INPUT_DIRS) {
      const candidate = path.join(inputDir, mapped);
      if (existsSync(candidate)) return candidate;
    }
  }

  const forceSpecPath = path.join(FORCE_DEFINITIONS_DIR, `${slug}.yaml`);
  if (existsSync(forceSpecPath)) {
    try {
      const parsed = parseYaml(readFileSync(forceSpecPath, "utf8"));
      const filename =
        parsed && typeof parsed === "object" && "reference_image" in parsed
          ? Reflect.get(parsed as Record<string, unknown>, "reference_image")
          : null;
      if (typeof filename === "string") {
        for (const inputDir of INPUT_DIRS) {
          const candidate = path.join(inputDir, filename);
          if (existsSync(candidate)) return candidate;
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}

function previewEngineScriptTags(
  entry: PreviewEngineManifest | undefined,
  fallbackScripts: readonly string[] = [],
): string {
  const scripts = Array.isArray(entry?.scripts) && entry.scripts.length > 0 ? entry.scripts : fallbackScripts;
  return scripts.map((script: string) => `<script src="${previewAssetUrl(script)}"></script>`).join("\n");
}

function buildPreviewNavOptions(currentPath: string): string {
  const groups: string[] = [];
  const autolayoutOptions = listAutolayoutDiagrams()
    .map((slug) => {
      const value = `/view/v3:${slug}`;
      const selected = currentPath === value ? " selected" : "";
      return `<option value="${value}"${selected}>${htmlEscape(slug)}</option>`;
    })
    .join("");
  if (autolayoutOptions) groups.push(`<optgroup label="Autolayout">${autolayoutOptions}</optgroup>`);

  const forceOptions = listForceExamples()
    .map((slug) => {
      const value = `/force/view/${slug}`;
      const selected = currentPath === value ? " selected" : "";
      return `<option value="${value}"${selected}>${htmlEscape(slug)}</option>`;
    })
    .join("");
  if (forceOptions) groups.push(`<optgroup label="Force demos">${forceOptions}</optgroup>`);

  return groups.join("");
}

function buildBrowseNav(currentPath: string): string {
  const sections: string[] = [];
  const autolayout = listAutolayoutDiagrams();
  if (autolayout.length > 0) {
    const items = autolayout
      .map((slug) => {
        const href = `/view/v3:${slug}`;
        const active = currentPath === href ? " is-active" : "";
        return `<li><a class="dg-browse-link${active}" href="${href}">${htmlEscape(slug)}</a></li>`;
      })
      .join("");
    sections.push(
      `<div class="dg-browse-group"><h3 class="dg-browse-heading">Autolayout</h3><ul class="dg-browse-list">${items}</ul></div>`,
    );
  }

  const force = listForceExamples();
  if (force.length > 0) {
    const items = force
      .map((slug) => {
        const href = `/force/view/${slug}`;
        const active = currentPath === href ? " is-active" : "";
        return `<li><a class="dg-browse-link${active}" href="${href}">${htmlEscape(slug)}</a></li>`;
      })
      .join("");
    sections.push(
      `<div class="dg-browse-group"><h3 class="dg-browse-heading">Force demos</h3><ul class="dg-browse-list">${items}</ul></div>`,
    );
  }
  return sections.join("");
}

function bfStylesLinkHtml(): string {
  return '<link rel="stylesheet" href="/preview/bf-os.css">';
}

function buildIndexSection(title: string, emptyText: string, links: Array<{ href: string; label: string }>): string {
  const content =
    links.length > 0
      ? `<ul class="dg-browse-list">${links
          .map(
            (link) =>
              `<li><a class="dg-browse-link" href="${link.href}">${htmlEscape(link.label)}</a></li>`,
          )
          .join("")}</ul>`
      : `<p class="bf-form-help">${htmlEscape(emptyText)}</p>`;
  return `<section class="dg-browse-group"><h2 class="dg-browse-heading">${htmlEscape(title)}</h2>${content}</section>`;
}

function applyUnifiedElkPlaceholders(html: string, isElk: boolean): string {
  return html
    .replace("%ELK_SECTION_HIDDEN%", isElk ? "" : "hidden")
    .replace("%ELK_LAYOUT_CONTROLS_HTML%", "");
}

function stripUnresolvedPlaceholders(html: string): string {
  return html.replace(/%[A-Z0-9_]+%/g, "");
}

function buildGridViewerHtml(slug: string): string {
  const currentPath = `/view/v3:${slug}`;
  const template = readFileSync(VIEWER_TEMPLATE, "utf8");
  const diagram = loadFrameYaml(path.join(FRAMES_DIR, `${slug}.yaml`));
  const layoutEngine = normalizeLayoutEngine(diagram.layoutEngine);
  const baselineYaml = readFileSync(path.join(FRAMES_DIR, `${slug}.yaml`), "utf8");
  const documentKind = determineFrameYamlKind(baselineYaml);
  const engineManifest = resolvePreviewEngine({ layoutEngine, shellMode: "grid", previewDocumentKind: documentKind });
  
  // Spec 035: list compatible engines for the switcher UI
  const compatibleEngines = listPreviewEngines()
    .filter((engine) => evaluatePreviewEngineCompatibility(engine, { 
      shellMode: "grid",
      previewDocumentKind: documentKind,
    }).compatible)
    .map((e) => e.layoutEngineKey)
    .filter((k) => k !== null) as string[];
  
  const isElk = layoutEngine === "elk-layered";
  const hasReference = findReferenceImage(slug) !== null;
  const configScript = [
    "window.__DG_CONFIG = {",
    `"slug":"${slug}",`,
    '"engine":"v3",',
    `"layout_engine":"${layoutEngine}",`,
    `"compatible_engines":${JSON.stringify(compatibleEngines)},`,
    '"grid":false,',
    `"inset":${INSET},`,
    `"head_len":${ARROW_HEAD_LENGTH},`,
    `"head_half":${ARROW_HEAD_HALF_WIDTH},`,
    `"icon_size":${ICON_SIZE},`,
    `"col_gap":${GRID_GUTTER},`,
    `"has_reference":${String(hasReference).toLowerCase()}`,
    "};",
  ].join("");

  const engineScripts = previewEngineScriptTags(
    engineManifest,
    isElk ? ["elk-layout-controls.js", "elk-controller.js"] : [],
  );
  const modeScripts =
    `<script src="${previewAssetUrl("layout-engine.js")}"></script>\n` +
    (engineScripts ? `${engineScripts}\n` : "") +
    `<script src="${previewAssetUrl("layout-bridge.js")}"></script>\n` +
    `<script src="${previewAssetUrl("component-model.js")}"></script>\n` +
    `<script src="${previewAssetUrl("constraints.js")}"></script>\n` +
    `<script src="${previewAssetUrl("editor.js")}"></script>`;

  return stripUnresolvedPlaceholders(
    applyUnifiedElkPlaceholders(template, isElk)
      .replace("%TITLE%", `${slug} – diagram preview`)
      .replace("%BF_STYLES%", bfStylesLinkHtml())
      .replace("%MODE%", "grid")
      .replace("%NAV_OPTIONS%", buildPreviewNavOptions(currentPath))
      .replace("%BROWSE_NAV%", buildBrowseNav(currentPath))
      .replace("%INSPECTOR_EMPTY%", "Click a component to inspect it.")
      .replace("%MODE_SCRIPTS%", modeScripts)
      .replace("%CONFIG_SCRIPT%", configScript),
  );
}

function buildForceViewerHtml(slug: string): string {
  const currentPath = `/force/view/${slug}`;
  const template = readFileSync(VIEWER_TEMPLATE, "utf8");
  const engineManifest = resolvePreviewEngine({ shellMode: "force" });
  const configScript = [
    "window.__DG_FORCE_CONFIG = {",
    `"slug":"${slug}",`,
    `"inset":${INSET},`,
    `"body_line_step":${BODY_LINE_STEP},`,
    `"head_len":${ARROW_HEAD_LENGTH},`,
    `"head_half":${ARROW_HEAD_HALF_WIDTH}`,
    "};",
  ].join("");
  const engineScripts = previewEngineScriptTags(engineManifest, ["force.js"]);
  const modeScripts =
    `<script src="${previewAssetUrl("layout-engine.js")}"></script>\n` + engineScripts;
  return stripUnresolvedPlaceholders(
    applyUnifiedElkPlaceholders(template, false)
      .replace("%TITLE%", `${slug} – force preview`)
      .replace("%BF_STYLES%", bfStylesLinkHtml())
      .replace("%MODE%", "force")
      .replace("%NAV_OPTIONS%", buildPreviewNavOptions(currentPath))
      .replace("%BROWSE_NAV%", buildBrowseNav(currentPath))
      .replace("%INSPECTOR_EMPTY%", "Click a node to select it.")
      .replace("%MODE_SCRIPTS%", modeScripts)
      .replace("%CONFIG_SCRIPT%", configScript),
  );
}

function buildIndexHtml(port: number): string {
  const autolayoutLinks = listAutolayoutDiagrams().map((slug) => ({
    href: `/view/v3:${slug}`,
    label: slug,
  }));
  const forceLinks = listForceExamples().map((slug) => ({
    href: `/force/view/${slug}`,
    label: slug,
  }));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Preview index</title>
${bfStylesLinkHtml()}
<link rel="stylesheet" href="/preview/editor.css">
</head>
<body class="bf-theme bf-tier-os is-dark">
<main class="bf-main">
  <section class="bf-panel">
    <div class="bf-panel-header">
      <h1 class="bf-h4">Preview index</h1>
      <p class="bf-form-help">Node preview app on port ${port}. Spec home: ${htmlEscape(SPEC_HOME)}</p>
    </div>
    <div class="bf-panel-content">
      ${buildIndexSection("Autolayout", "No autolayout diagrams found.", autolayoutLinks)}
      ${buildIndexSection("Force demos", "No force demos found.", forceLinks)}
    </div>
  </section>
</main>
</body>
</html>`;
}

function readForceSpec(slug: string): unknown {
  const specPath = path.join(FORCE_DEFINITIONS_DIR, `${slug}.yaml`);
  if (!existsSync(specPath)) return null;
  return parseYaml(readFileSync(specPath, "utf8"));
}

async function buildFrameDiagramState(slug: string) {
  const yamlPath = path.join(FRAMES_DIR, `${slug}.yaml`);
  const diagram = loadFrameYaml(yamlPath);
  const adapter = await textAdapterPromise;
  const layout = layoutFrameTree(diagram.root, adapter, {
    gridCols: diagram.gridCols,
    gridColGap: diagram.gridColGap,
    gridOuterMargin: diagram.gridOuterMargin,
  });
  return { diagram, layout };
}

async function renderSvgForSlug(slug: string): Promise<string> {
  const { diagram, layout } = await buildFrameDiagramState(slug);
  const iconMarkupByName = preloadIconMarkup(iconLoader, collectIconNames(diagram.root));
  const adapter = await textAdapterPromise;
  return renderFrameDiagramToSvg(diagram, layout, adapter, { iconMarkupByName });
}

function previewDocumentForSlug(slug: string) {
  const diagram = loadFrameYaml(path.join(FRAMES_DIR, `${slug}.yaml`));
  return {
    kind: "frame-diagram",
    slug,
    title: diagram.title,
    layoutEngine: diagram.layoutEngine ?? null,
    shellMode: "grid",
    frameTree: serializeFrameDiagram(diagram),
  };
}

function frameTreeForSlug(slug: string) {
  return serializeFrameDiagram(loadFrameDiagram(slug));
}

function loadFrameDiagram(slug: string) {
  return loadFrameYaml(path.join(FRAMES_DIR, `${slug}.yaml`));
}

function frameDiagramExists(slug: string): boolean {
  return existsSync(path.join(FRAMES_DIR, `${slug}.yaml`));
}

function canonicalSavedState(slug: string) {
  const diagram = loadFrameDiagram(slug);
  const previewDocument = {
    kind: "frame-diagram",
    slug,
    title: diagram.title,
    layoutEngine: diagram.layoutEngine ?? null,
    shellMode: "grid",
    frameTree: serializeFrameDiagram(diagram),
  };
  return {
    slug,
    previewDocument,
    frameTree: previewDocument.frameTree,
    componentTree: buildComponentTree(diagram.root),
    gridInfo: buildGridInfo(diagram, diagram.root),
  };
}

function canonicalForceSavedState(slug: string) {
  const authoredSpec = readForceSpec(slug);
  if (!authoredSpec) {
    throw new Error(`Canonical force spec not found after save: ${slug}`);
  }
  return {
    slug,
    authoredSpec,
  };
}

function contentTypeForPath(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Determine the preview document kind from a frame YAML file.
 * - If the YAML has a `sequence:` key, it's a sequence document
 * - Otherwise, it's a frame-diagram document
 */
function determineFrameYamlKind(yamlContent: string): PreviewDocumentKind {
  try {
    const parsed = parseYaml(yamlContent);
    if (parsed && typeof parsed === "object" && "sequence" in parsed) {
      return "sequence";
    }
  } catch {
    // Fall back to frame-diagram if parsing fails
  }
  return "frame-diagram";
}

function serveFile(res: ServerResponse, filePath: string, cacheControl = "no-store"): void {
  if (!existsSync(filePath)) {
    sendText(res, 404, "Not found");
    return;
  }
  sendBytes(res, 200, contentTypeForPath(filePath), readFileSync(filePath), cacheControl);
}

function handleRuntimeIdentity(res: ServerResponse, port: number): void {
  sendJson(res, 200, {
    ok: true,
    app: "@diagram-generator/preview-app",
    repoRoot: REPO_ROOT,
    appRoot: APP_ROOT,
    branch: currentGitBranch(),
    framesDir: FRAMES_DIR,
    pid: process.pid,
    port,
    node: process.version,
    specHome: SPEC_HOME,
  });
}

function handlePreviewEngines(res: ServerResponse): void {
  sendJson(res, 200, previewEngines);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, port: number): Promise<void> {
  const url = requestUrl(req);
  const pathname = url.pathname;

  if (req.method === "POST") {
    if (pathname.startsWith("/api/overrides/")) {
      const slug = normalizeFrameSlug(pathname.slice("/api/overrides/".length));
      if (!slug) {
        sendText(res, 400, "Invalid slug");
        return;
      }
      const framePath = path.join(FRAMES_DIR, `${slug}.yaml`);
      if (!existsSync(framePath)) {
        sendText(res, 404, `Unknown frame slug: ${slug}`);
        return;
      }
      let payload: unknown;
      try {
        payload = await readJsonBody(req);
      } catch (error) {
        sendText(res, 400, error instanceof Error ? error.message : String(error));
        return;
      }

      // Spec 035: validate engine compatibility before persisting.
      // The switcher must never write an engine the document kind cannot host.
      if (payload && typeof payload === "object" && !Array.isArray(payload) && "layout_engine" in payload) {
        const requested = (payload as Record<string, unknown>).layout_engine;
        if (requested !== null && requested !== undefined && requested !== "") {
          if (typeof requested !== "string") {
            sendText(res, 400, `Invalid layout_engine: must be a string`);
            return;
          }

          // Determine the document kind from the YAML
          let baseline: string;
          try {
            baseline = readFileSync(framePath, "utf8");
          } catch {
            sendText(res, 400, "Could not read frame file");
            return;
          }
          const documentKind = determineFrameYamlKind(baseline);

          // Get the engine manifest and evaluate compatibility
          const engine = getPreviewEngine(normalizeLayoutEngine(requested));
          if (!engine) {
            sendText(res, 400, `Unknown layout_engine: '${requested}'`);
            return;
          }

          // Evaluate compatibility with the actual document kind
          const context: PreviewEngineContext = {
            layoutEngine: requested.trim(),
            shellMode: "grid",
            previewDocumentKind: documentKind,
          };
          const compatibility = evaluatePreviewEngineCompatibility(engine, context);
          if (!compatibility.compatible) {
            sendText(
              res,
              400,
              `Cannot use engine '${requested}' with ${documentKind}: ${compatibility.reason ?? "incompatible"}`,
            );
            return;
          }
        }
      }

      try {
        const baseline = readFileSync(framePath, "utf8");
        const nextText = persistFrameDiagramOverridePayloadToYaml(
          framePath,
          baseline,
          payload as PersistOverridePayload,
        );

        if (nextText !== baseline) {
          writeFileSync(framePath, nextText, "utf8");
        }
        const elkOverrides =
          payload && typeof payload === "object" && payload !== null && "elk_layout_overrides" in payload
            ? (payload as Record<string, unknown>).elk_layout_overrides
            : null;
        if (elkOverrides && typeof elkOverrides === "object" && !Array.isArray(elkOverrides)) {
          verifyElkLayoutPersisted(nextText, elkOverrides as Record<string, unknown>);
        }
        sendJson(res, 200, {
          ok: true,
          canonicalState: canonicalSavedState(slug),
        });
      } catch (error) {
        sendText(res, 400, error instanceof Error ? error.message : String(error));
      }
      return;
    }

    if (pathname.startsWith("/api/force-save/")) {
      const slug = normalizeFrameSlug(pathname.slice("/api/force-save/".length));
      if (!slug) {
        sendText(res, 400, "Invalid slug");
        return;
      }
      const framePath = path.join(FORCE_DEFINITIONS_DIR, `${slug}.yaml`);
      if (!existsSync(framePath)) {
        sendText(res, 404, `Unknown force example: ${slug}`);
        return;
      }
      let payload: unknown;
      try {
        payload = await readJsonBody(req);
      } catch (error) {
        sendText(res, 400, error instanceof Error ? error.message : String(error));
        return;
      }
      try {
        const nextText = persistForceSpecToYaml(payload);
        writeFileSync(framePath, nextText, "utf8");
        sendJson(res, 200, {
          ok: true,
          canonicalState: canonicalForceSavedState(slug),
        });
      } catch (error) {
        sendText(res, 400, error instanceof Error ? error.message : String(error));
      }
      return;
    }

    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  if (pathname === "/") {
    sendHtml(res, 200, buildIndexHtml(port));
    return;
  }
  if (pathname === "/force") {
    sendHtml(res, 200, buildIndexHtml(port));
    return;
  }
  if (pathname === "/api/runtime-identity") {
    handleRuntimeIdentity(res, port);
    return;
  }
  if (pathname === "/api/preview-engines") {
    handlePreviewEngines(res);
    return;
  }
  if (pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    const payload = JSON.stringify({
      generation: rebuildGeneration,
      error: lastRebuildError,
    });
    res.write(`data: ${payload}\n\n`);
    sseClients.add(res);
    req.on("close", () => {
      sseClients.delete(res);
      try {
        res.end();
      } catch {
        // ignore close races
      }
    });
    return;
  }
  if (pathname === "/preview/bf-os.css") {
    if (!existsSync(BF_VENDOR_OS_CSS)) {
      sendText(
        res,
        500,
        "Baseline Foundry preview assets missing. Run the asset sync before using the Node preview app.",
      );
      return;
    }
    serveFile(res, BF_VENDOR_OS_CSS, "public, max-age=300");
    return;
  }
  if (pathname.startsWith("/preview/bf-fonts/")) {
    if (!existsSync(BF_VENDOR_FONT_DIR)) {
      sendText(
        res,
        500,
        "Baseline Foundry preview fonts missing. Run the asset sync before using the Node preview app.",
      );
      return;
    }
    const safeName = path.posix.basename(pathname.slice("/preview/bf-fonts/".length));
    serveFile(res, path.join(BF_VENDOR_FONT_DIR, safeName), "public, max-age=300");
    return;
  }
  if (pathname.startsWith("/preview/")) {
    const safeName = path.posix.basename(pathname.slice("/preview/".length));
    const assetPath = resolvePreviewAssetPath(safeName);
    if (!assetPath) {
      sendText(res, 400, "Invalid preview asset path");
      return;
    }
    if (
      (safeName === "layout-engine.js" || safeName === "layout-engine-harfbuzz.js" || safeName === "harfbuzz.wasm") &&
      !existsSync(assetPath)
    ) {
      await ensureLayoutEngineBrowserAssets();
    }
    if (!existsSync(assetPath)) {
      sendText(res, 404, `${safeName} not found`);
      return;
    }
    serveFile(res, assetPath, "public, max-age=300");
    return;
  }
  if (pathname.startsWith("/api/icon/")) {
    const safeName = path.posix.basename(decodeURIComponent(pathname.slice("/api/icon/".length)));
    if (!safeName || safeName.includes("..")) {
      sendText(res, 400, "Invalid icon name");
      return;
    }
    serveFile(res, path.join(ICONS_DIR, safeName), "public, max-age=300");
    return;
  }
  if (pathname.startsWith("/reference/")) {
    const slug = normalizeFrameSlug(pathname.slice("/reference/".length));
    if (!slug) {
      sendText(res, 400, "Invalid slug");
      return;
    }
    const refPath = findReferenceImage(slug);
    if (!refPath) {
      sendText(res, 404, `Reference image not found for ${slug}`);
      return;
    }
    serveFile(res, refPath, "public, max-age=300");
    return;
  }
  if (pathname.startsWith("/api/force-spec/")) {
    const slug = normalizeFrameSlug(pathname.slice("/api/force-spec/".length));
    if (!slug) {
      sendText(res, 400, "Invalid slug");
      return;
    }
    const spec = readForceSpec(slug);
    if (!spec) {
      sendText(res, 404, `Unknown force example: ${slug}`);
      return;
    }
    sendJson(res, 200, spec);
    return;
  }
  if (
    pathname.startsWith("/api/force/") ||
    pathname.startsWith("/api/force-reset/") ||
    pathname.startsWith("/api/force-node/") ||
    pathname.startsWith("/api/force-tick/") ||
    pathname.startsWith("/api/force-params/") ||
    pathname.startsWith("/api/force-export/")
  ) {
    sendText(res, 404, `Route retired from the Node preview app: ${pathname}`);
    return;
  }
  if (pathname.startsWith("/api/preview-document/")) {
    const slug = normalizeFrameSlug(pathname.slice("/api/preview-document/".length));
    if (!slug) {
      sendText(res, 400, "Invalid slug");
      return;
    }
    if (!frameDiagramExists(slug)) {
      sendText(res, 404, `Unknown diagram: ${slug}`);
      return;
    }
    sendJson(res, 200, previewDocumentForSlug(slug));
    return;
  }
  if (pathname.startsWith("/api/frame-tree/")) {
    const slug = normalizeFrameSlug(pathname.slice("/api/frame-tree/".length));
    if (!slug) {
      sendText(res, 400, "Invalid slug");
      return;
    }
    if (!frameDiagramExists(slug)) {
      sendText(res, 404, `Unknown diagram: ${slug}`);
      return;
    }
    sendJson(res, 200, frameTreeForSlug(slug));
    return;
  }
  if (pathname.startsWith("/api/tree/")) {
    const slug = normalizeFrameSlug(pathname.slice("/api/tree/".length));
    if (!slug) {
      sendText(res, 400, "Invalid slug");
      return;
    }
    if (!frameDiagramExists(slug)) {
      sendText(res, 404, `Unknown diagram: ${slug}`);
      return;
    }
    const diagram = loadFrameDiagram(slug);
    sendJson(res, 200, buildComponentTree(diagram.root));
    return;
  }
  if (pathname.startsWith("/api/grid/")) {
    const slug = normalizeFrameSlug(pathname.slice("/api/grid/".length));
    if (!slug) {
      sendText(res, 400, "Invalid slug");
      return;
    }
    if (!frameDiagramExists(slug)) {
      sendText(res, 404, `Unknown diagram: ${slug}`);
      return;
    }
    const diagram = loadFrameDiagram(slug);
    sendJson(res, 200, buildGridInfo(diagram, diagram.root));
    return;
  }
  if (pathname.startsWith("/svg/") || pathname.startsWith("/v3/svg/")) {
    const rawName = pathname.startsWith("/svg/")
      ? pathname.slice("/svg/".length)
      : pathname.slice("/v3/svg/".length);
    const safeName = path.posix.basename(rawName);
    const normalized =
      safeName.replace(/-onbrand-v3-grid\.svg$/i, "").replace(/-onbrand-v3\.svg$/i, "");
    const slug = normalizeFrameSlug(normalized);
    if (!slug) {
      sendText(res, 400, "Invalid SVG slug");
      return;
    }
    const svg = await renderSvgForSlug(slug);
    sendBytes(res, 200, "image/svg+xml", Buffer.from(svg, "utf8"));
    return;
  }
  if (pathname.startsWith("/force/view/")) {
    const slug = normalizeFrameSlug(pathname.slice("/force/view/".length));
    if (!slug) {
      sendText(res, 400, "Invalid slug");
      return;
    }
    if (!existsSync(path.join(FORCE_DEFINITIONS_DIR, `${slug}.yaml`))) {
      sendText(res, 404, `Unknown force example: ${slug}`);
      return;
    }
    sendHtml(res, 200, buildForceViewerHtml(slug));
    return;
  }
  if (pathname.startsWith("/v3/view/")) {
    const slug = normalizeFrameSlug(pathname.slice("/v3/view/".length));
    if (!slug) {
      sendText(res, 400, "Invalid slug");
      return;
    }
    if (!existsSync(path.join(FRAMES_DIR, `${slug}.yaml`))) {
      sendText(res, 404, `Unknown diagram: ${slug}`);
      return;
    }
    sendHtml(res, 200, buildGridViewerHtml(slug));
    return;
  }
  if (pathname.startsWith("/view/")) {
    const slug = normalizeFrameSlug(pathname.slice("/view/".length));
    if (!slug) {
      sendText(res, 400, "Invalid slug");
      return;
    }
    if (!existsSync(path.join(FRAMES_DIR, `${slug}.yaml`))) {
      sendText(res, 404, `Unknown diagram: ${slug}`);
      return;
    }
    sendHtml(res, 200, buildGridViewerHtml(slug));
    return;
  }

  sendJson(res, 501, {
    ok: false,
    error: "Preview route not implemented yet in the Node app scaffold.",
    route: pathname,
    specHome: SPEC_HOME,
  });
}

export function startPreviewServer(port = parsePort(process.argv.slice(2), process.env)) {
  startWatchLoop();
  const server = createServer((req, res) => {
    void handleRequest(req, res, port).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, {
        ok: false,
        error: message,
        specHome: SPEC_HOME,
      });
    });
  });
  server.listen(port, "127.0.0.1");
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = parsePort(process.argv.slice(2), process.env);
  const server = startPreviewServer(port);
  server.on("listening", () => {
    process.stdout.write(`[preview-app] listening on http://127.0.0.1:${port}\n`);
  });
}
