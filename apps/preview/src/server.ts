import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
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
  layoutFrameTree,
  loadFrameYaml,
  preloadIconMarkup,
  renderFrameDiagramToSvg,
  resolvePreviewEngine,
  serializeFrameDiagram,
  serializePreviewEngineManifest,
  type PreviewEngineManifest,
} from "@diagram-generator/layout-engine";
import {
  persistForceAuthoredSpecToYaml,
  persistOverridePayloadToYaml,
  verifyElkLayoutPersisted,
  type PersistOverridePayload,
} from "./frame-yaml-persistence.js";

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
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const iconLoader = createFsIconLoader(ICONS_DIR);
const previewEngines = serializePreviewEngineManifest();
const hostableGridLayoutKeys = new Set(
  previewEngines
    .filter((entry) => entry.shellMode === "grid" && typeof entry.layoutEngineKey === "string")
    .map((entry) => entry.layoutEngineKey as string),
);
const textAdapterPromise = createHarfBuzzTextAdapter({
  fontData: readFileSync(path.join(REPO_ROOT, "assets", "UbuntuSans[wdth,wght].ttf")).buffer,
});

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
  const safe = path.posix.basename(filename);
  return path.join(PREVIEW_DIR, safe);
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
  return scripts.map((script) => `<script src="${previewAssetUrl(script)}"></script>`).join("\n");
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
  const engineManifest = resolvePreviewEngine({ layoutEngine, shellMode: "grid" });
  const isElk = layoutEngine === "elk-layered";
  const hasReference = findReferenceImage(slug) !== null;
  const configScript = [
    "window.__DG_CONFIG = {",
    `"slug":"${slug}",`,
    '"engine":"v3",',
    `"layout_engine":"${layoutEngine}",`,
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
  const autolayoutLinks = listAutolayoutDiagrams()
    .map((slug) => `<a href="/view/v3:${slug}">${htmlEscape(slug)}</a>`)
    .join("\n");
  const forceLinks = listForceExamples()
    .map((slug) => `<a href="/force/view/${slug}">${htmlEscape(slug)}</a>`)
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Preview index</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Ubuntu Sans', system-ui, sans-serif; background: #1a1a1a; color: #e0e0e0; }
  .page { padding: 16px 24px 32px; }
  .section { margin-top: 20px; }
  h1 { font-size: 16px; font-weight: 600; }
  h2 { font-size: 13px; font-weight: 600; color: #aaa; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
  .meta { color: #aaa; margin-top: 8px; font-size: 13px; }
  .nav { display: flex; flex-wrap: wrap; gap: 8px; }
  .nav a { color: #6cc; text-decoration: none; padding: 6px 12px; border-radius: 4px; background: #2a2a2a; font-size: 14px; }
  .nav a:hover { background: #3a3a3a; }
</style>
</head>
<body>
<div class="page">
  <h1>Preview index</h1>
  <div class="meta">Node preview app on port ${port}. Spec home: ${SPEC_HOME}</div>
  <div class="section">
    <h2>Autolayout</h2>
    <div class="nav">${autolayoutLinks || "<span>No autolayout diagrams found.</span>"}</div>
  </div>
  <div class="section">
    <h2>Force demos</h2>
    <div class="nav">${forceLinks || "<span>No force demos found.</span>"}</div>
  </div>
</div>
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

function loadFrameDiagram(slug: string) {
  return loadFrameYaml(path.join(FRAMES_DIR, `${slug}.yaml`));
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
      try {
        const baseline = readFileSync(framePath, "utf8");
        const nextText = persistOverridePayloadToYaml(framePath, baseline, payload as PersistOverridePayload);
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
        const nextText = persistForceAuthoredSpecToYaml(framePath, payload);
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
  if (pathname === "/api/runtime-identity") {
    handleRuntimeIdentity(res, port);
    return;
  }
  if (pathname === "/api/preview-engines") {
    handlePreviewEngines(res);
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
    if (safeName === "layout-engine.js" && !existsSync(assetPath)) {
      sendText(res, 404, "Layout engine bundle not built");
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
  if (pathname.startsWith("/api/preview-document/")) {
    const slug = normalizeFrameSlug(pathname.slice("/api/preview-document/".length));
    if (!slug) {
      sendText(res, 400, "Invalid slug");
      return;
    }
    sendJson(res, 200, previewDocumentForSlug(slug));
    return;
  }
  if (pathname.startsWith("/api/tree/")) {
    const slug = normalizeFrameSlug(pathname.slice("/api/tree/".length));
    if (!slug) {
      sendText(res, 400, "Invalid slug");
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
