import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const yaml = require("yaml") as {
  parse: (raw: string) => unknown;
  stringify: (value: unknown, options?: Record<string, unknown>) => string;
};

const STYLE_SEMANTICS: Record<string, { level: number | null; fill: string; border: string }> = {
  default: { level: 1, fill: "white", border: "solid" },
  parent: { level: 2, fill: "grey", border: "solid" },
  section: { level: 3, fill: "white", border: "solid" },
  annotation: { level: null, fill: "white", border: "none" },
  highlight: { level: null, fill: "black", border: "none" },
};

const SUPPORTED_FRAME_KEYS = new Set([
  "direction",
  "gap",
  "padding",
  "padding_top",
  "padding_right",
  "padding_bottom",
  "padding_left",
  "sizing",
  "sizing_w",
  "sizing_h",
  "fill_weight",
  "align",
  "wrap",
  "width",
  "height",
  "min_width",
  "max_width",
  "max_width_chars",
  "min_height",
  "max_height",
  "fill",
  "border",
  "level",
  "position",
  "x",
  "y",
  "children_order",
  "text",
  "style",
]);

const UNSUPPORTED_FRAME_KEYS = new Set(["dx", "dy", "dw", "dh", "waypoints"]);
const SUPPORTED_GRID_KEYS = new Set(["cols", "col_gap", "row_gap", "outer_margin"]);
const IGNORED_GRID_KEYS = new Set(["link_to_root"]);
const UNSUPPORTED_GRID_KEYS = new Set(["rows", "slack_absorption"]);
const LOWER_KEYS = new Set(["direction", "sizing", "sizing_w", "sizing_h", "fill", "border", "position"]);
const INT_KEYS = new Set([
  "gap",
  "padding",
  "padding_top",
  "padding_right",
  "padding_bottom",
  "padding_left",
  "width",
  "height",
  "min_width",
  "max_width",
  "max_width_chars",
  "min_height",
  "max_height",
  "level",
  "x",
  "y",
]);

export interface PersistOverridePayload {
  overrides?: Record<string, unknown>;
  removed_ids?: unknown[];
  grid_overrides?: Record<string, unknown>;
  elk_layout_overrides?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeStyleName(styleName: unknown): string | null {
  if (typeof styleName !== "string") return null;
  const canonical = styleName.trim();
  return canonical.length > 0 ? canonical : null;
}

function styleSemantics(styleName: unknown): Record<string, unknown> | null {
  const canonical = normalizeStyleName(styleName);
  if (!canonical) return null;
  const semantic = STYLE_SEMANTICS[canonical];
  if (!semantic) return null;
  return { ...semantic, style: canonical };
}

function coerceInt(value: unknown, fieldName: string): number {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) {
    throw new Error(`${fieldName} must be an integer`);
  }
  return numeric;
}

function coerceFloat(value: unknown, fieldName: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${fieldName} must be numeric`);
  }
  return numeric;
}

function yamlAlign(value: unknown): string {
  if (typeof value !== "string") throw new Error("align must be a string");
  return value.trim().toLowerCase().replaceAll("_", "-");
}

function yamlTextScalar(existing: unknown, text: string): unknown {
  if (isRecord(existing)) {
    return { text };
  }
  return text;
}

function updateTextFields(frameData: Record<string, unknown>, textOverride: unknown): void {
  if (!isRecord(textOverride)) {
    throw new Error("text override must be an object");
  }
  if ("heading" in textOverride) {
    const heading = textOverride.heading;
    if (heading == null || heading === "") {
      delete frameData.heading;
    } else if (typeof heading !== "string") {
      throw new Error("text.heading must be a string");
    } else {
      frameData.heading = yamlTextScalar(frameData.heading, heading);
    }
  }
  if ("label" in textOverride) {
    const label = textOverride.label;
    if (!Array.isArray(label) || label.some((line) => typeof line !== "string")) {
      throw new Error("text.label must be a list of strings");
    }
    const existing = frameData.label;
    const existingLines = Array.isArray(existing) ? existing : existing != null ? [existing] : [];
    frameData.label = label.map((line, index) =>
      yamlTextScalar(index < existingLines.length ? existingLines[index] : null, line),
    );
  }
}

function reorderChildren(frameData: Record<string, unknown>, childOrder: unknown, frameId: string): void {
  if (!Array.isArray(childOrder) || childOrder.some((item) => typeof item !== "string")) {
    throw new Error("children_order must be a list of child ids");
  }
  const children = frameData.children;
  if (!Array.isArray(children)) {
    throw new Error(`${frameId} has no children to reorder`);
  }
  const childMap = new Map<string, Record<string, unknown>>();
  for (const child of children) {
    if (isRecord(child) && typeof child.id === "string") {
      childMap.set(child.id, child);
    }
  }
  const missing = childOrder.filter((childId) => !childMap.has(childId));
  if (missing.length > 0) {
    throw new Error(`${frameId} children_order references unknown child ids: ${missing.join(", ")}`);
  }
  const reordered = childOrder.map((childId) => childMap.get(childId) as Record<string, unknown>);
  const remaining = children.filter(
    (child) => !isRecord(child) || typeof child.id !== "string" || !childOrder.includes(child.id),
  );
  frameData.children = [...reordered, ...remaining];
}

function applyGridOverrides(document: Record<string, unknown>, gridOverrides: unknown): void {
  if (!isRecord(gridOverrides)) {
    throw new Error("grid_overrides must be an object");
  }
  const grid = isRecord(document.grid) ? document.grid : {};
  document.grid = grid;

  for (const key of UNSUPPORTED_GRID_KEYS) {
    if (key in gridOverrides && gridOverrides[key] !== null && gridOverrides[key] !== true) {
      throw new Error(`${key} is not persistable in frame YAML`);
    }
  }
  if ("link_to_root" in gridOverrides && gridOverrides.link_to_root !== null && gridOverrides.link_to_root !== true) {
    throw new Error("link_to_root=false is not persistable in frame YAML");
  }

  const marginKeys = ["margin_top", "margin_right", "margin_bottom", "margin_left"] as const;
  const marginValues = marginKeys.filter((key) => key in gridOverrides).map((key) => gridOverrides[key]);
  if (marginValues.length > 0) {
    const numericMargins = marginValues.map((value) => coerceInt(value, "grid_overrides.margin"));
    if (new Set(numericMargins).size !== 1) {
      throw new Error("per-side grid margins are not persistable in frame YAML; values must be uniform");
    }
    grid.outer_margin = numericMargins[0];
  }

  for (const [key, value] of Object.entries(gridOverrides)) {
    if (SUPPORTED_GRID_KEYS.has(key)) {
      grid[key] = coerceInt(value, `grid_overrides.${key}`);
    } else if (
      !IGNORED_GRID_KEYS.has(key) &&
      !UNSUPPORTED_GRID_KEYS.has(key) &&
      !marginKeys.includes(key as (typeof marginKeys)[number])
    ) {
      throw new Error(`Unknown grid_overrides key: ${key}`);
    }
  }
}

function applyStyleFields(frameData: Record<string, unknown>, styleName: unknown): void {
  delete frameData.style;
  const semantic = styleSemantics(styleName);
  if (!semantic) {
    delete frameData.level;
    delete frameData.fill;
    delete frameData.border;
    return;
  }
  if (semantic.level == null) {
    delete frameData.level;
  } else {
    frameData.level = semantic.level;
  }
  frameData.fill = semantic.fill;
  frameData.border = semantic.border;
}

function isImplicitStructuralWrapperFrame(frameData: Record<string, unknown>): boolean {
  const children = frameData.children;
  if (!Array.isArray(children) || children.length === 0) {
    return false;
  }
  const heading = frameData.heading;
  if (typeof heading === "string" && heading.trim()) return false;
  if (isRecord(heading) && String(heading.text ?? "").trim()) return false;
  return !("level" in frameData) && !("fill" in frameData) && !("border" in frameData) && !("variant" in frameData);
}

function applyDirectField(frameData: Record<string, unknown>, key: string, value: unknown): void {
  if (key === "align") {
    frameData[key] = yamlAlign(value);
    return;
  }
  if (key === "fill_weight") {
    const coerced = coerceFloat(value, key);
    frameData[key] = Number.isInteger(coerced) ? Math.trunc(coerced) : coerced;
    return;
  }
  if (key === "wrap") {
    frameData[key] = Boolean(value);
    return;
  }
  if (LOWER_KEYS.has(key)) {
    if (typeof value !== "string") throw new Error(`${key} must be a string`);
    frameData[key] = value.trim().toLowerCase();
    return;
  }
  if (INT_KEYS.has(key)) {
    frameData[key] = coerceInt(value, key);
    return;
  }
  throw new Error(`Unsupported canonical field: ${key}`);
}

function removeFrameFromTree(frameData: Record<string, unknown>, frameId: string): boolean {
  const children = frameData.children;
  if (!Array.isArray(children)) return false;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (!isRecord(child)) continue;
    if (child.id === frameId) {
      children.splice(index, 1);
      return true;
    }
    if (removeFrameFromTree(child, frameId)) return true;
  }
  return false;
}

function applyRemovedFrameIds(document: Record<string, unknown>, removedIds: string[]): void {
  if (removedIds.length === 0) return;
  const rootData = document.root;
  if (!isRecord(rootData)) throw new Error("root must be a mapping");
  const rootId = typeof rootData.id === "string" ? rootData.id : "";
  const removed = new Set(removedIds.filter((frameId) => typeof frameId === "string" && frameId));
  if (rootId && removed.has(rootId)) {
    throw new Error(`Cannot remove diagram root frame: ${rootId}`);
  }
  for (const frameId of [...removed].sort()) {
    if (frameId !== rootId) {
      removeFrameFromTree(rootData, frameId);
    }
  }
  if (Array.isArray(document.arrows)) {
    document.arrows = document.arrows.filter(
      (arrow) =>
        isRecord(arrow) &&
        !removed.has(String(arrow.source ?? "")) &&
        !removed.has(String(arrow.target ?? "")),
    );
  }
}

function findFrameData(frameData: Record<string, unknown>, frameId: string): Record<string, unknown> | null {
  if (frameData.id === frameId) return frameData;
  const children = frameData.children;
  if (!Array.isArray(children)) return null;
  for (const child of children) {
    if (!isRecord(child)) continue;
    const found = findFrameData(child, frameId);
    if (found) return found;
  }
  return null;
}

function applyFrameOverride(frameData: Record<string, unknown>, override: unknown, frameId: string): void {
  if (!isRecord(override)) {
    throw new Error(`Override for ${frameId} must be an object`);
  }
  const unsupported = Object.keys(override).filter((key) => UNSUPPORTED_FRAME_KEYS.has(key)).sort();
  if (unsupported.length > 0) {
    throw new Error(
      `${frameId} includes non-canonical transient keys that cannot be saved to YAML: ${unsupported.join(", ")}`,
    );
  }

  const styleName = override.style;
  if ("style" in override) {
    if (isImplicitStructuralWrapperFrame(frameData) && normalizeStyleName(styleName)) {
      // no-op: keep wrappers structural-only
    } else {
      applyStyleFields(frameData, styleName);
    }
  }

  for (const [key, value] of Object.entries(override)) {
    if (!SUPPORTED_FRAME_KEYS.has(key) && !UNSUPPORTED_FRAME_KEYS.has(key)) {
      throw new Error(`Unknown override key for ${frameId}: ${key}`);
    }
    if (key === "style") continue;
    if (key === "children_order") {
      reorderChildren(frameData, value, frameId);
      continue;
    }
    if (key === "text") {
      updateTextFields(frameData, value);
      continue;
    }
    if (key === "sizing") {
      applyDirectField(frameData, "sizing_w", value);
      applyDirectField(frameData, "sizing_h", value);
      delete frameData.sizing;
      continue;
    }
    if (key === "padding") {
      applyDirectField(frameData, key, value);
      delete frameData.padding_top;
      delete frameData.padding_right;
      delete frameData.padding_bottom;
      delete frameData.padding_left;
      continue;
    }
    if ((key === "level" || key === "fill" || key === "border") && "style" in override) {
      continue;
    }
    if (
      [
        "direction",
        "gap",
        "padding_top",
        "padding_right",
        "padding_bottom",
        "padding_left",
        "sizing_w",
        "sizing_h",
        "fill_weight",
        "align",
        "wrap",
        "width",
        "height",
        "min_width",
        "max_width",
        "max_width_chars",
        "min_height",
        "max_height",
        "fill",
        "border",
        "level",
        "position",
        "x",
        "y",
      ].includes(key)
    ) {
      applyDirectField(frameData, key, value);
    }
  }
}

function applyElkLayoutOverrides(document: Record<string, unknown>, elkOverrides: Record<string, unknown>): void {
  if (Object.keys(elkOverrides).length === 0) return;
  const meta = isRecord(document.meta) ? document.meta : {};
  document.meta = meta;
  const elk: Record<string, string> = isRecord(meta.elk)
    ? Object.fromEntries(Object.entries(meta.elk).map(([key, value]) => [String(key), String(value)]))
    : {};
  for (const [key, value] of Object.entries(elkOverrides)) {
    if (value == null || String(value) === "") {
      delete elk[String(key)];
    } else {
      elk[String(key)] = String(value);
    }
  }
  if (Object.keys(elk).length > 0) {
    meta.elk = elk;
  } else {
    delete meta.elk;
  }
}

export function verifyElkLayoutPersisted(documentText: string, expected: Record<string, unknown>): void {
  if (Object.keys(expected).length === 0) return;
  const document = yaml.parse(documentText);
  if (!isRecord(document)) throw new Error("expected top-level mapping after save");
  if (!isRecord(document.meta)) throw new Error("meta missing after ELK save");
  if (!isRecord(document.meta.elk)) throw new Error("meta.elk missing after ELK save");
  for (const [key, raw] of Object.entries(expected)) {
    const want = String(raw);
    const got = document.meta.elk[key];
    if (got == null) {
      throw new Error(`meta.elk missing key ${JSON.stringify(key)} after save`);
    }
    if (String(got) !== want) {
      throw new Error(`meta.elk[${JSON.stringify(key)}] is ${JSON.stringify(got)}, expected ${JSON.stringify(want)} after save`);
    }
  }
}

export function persistOverridePayloadToYaml(
  framePath: string,
  baselineText: string,
  payload: PersistOverridePayload,
): string {
  if (!isRecord(payload)) throw new Error("Expected JSON object");
  const overrides = isRecord(payload.overrides) ? payload.overrides : {};
  if ("overrides" in payload && !isRecord(payload.overrides)) {
    throw new Error("overrides must be an object");
  }
  const removedIds = payload.removed_ids == null ? [] : payload.removed_ids;
  if (!Array.isArray(removedIds)) {
    throw new Error("removed_ids must be an array");
  }
  const gridOverrides = payload.grid_overrides;
  const hasGridOverrides = isRecord(gridOverrides) && Object.keys(gridOverrides).length > 0;
  const elkLayoutOverrides = payload.elk_layout_overrides;
  const hasElkOverrides = isRecord(elkLayoutOverrides) && Object.keys(elkLayoutOverrides).length > 0;
  if (Object.keys(overrides).length === 0 && !hasGridOverrides && removedIds.length === 0 && !hasElkOverrides) {
    return baselineText;
  }

  const document = yaml.parse(baselineText);
  if (!isRecord(document)) throw new Error(`${framePath}: expected top-level mapping`);
  if (document.engine !== "v3") {
    throw new Error(`${framePath}: not a native frame YAML (missing engine: v3)`);
  }
  const rootData = document.root;
  if (!isRecord(rootData)) throw new Error(`${framePath}: root must be a mapping`);

  if ("grid_overrides" in payload) {
    applyGridOverrides(document, gridOverrides ?? {});
  }
  if (hasElkOverrides) {
    applyElkLayoutOverrides(document, elkLayoutOverrides);
  }
  if (removedIds.length > 0) {
    applyRemovedFrameIds(
      document,
      removedIds.filter((frameId): frameId is string => typeof frameId === "string"),
    );
  }
  for (const [frameId, override] of Object.entries(overrides)) {
    const target = findFrameData(rootData, frameId);
    if (!target) {
      throw new Error(`Unknown component id in overrides: ${frameId}`);
    }
    applyFrameOverride(target, override, frameId);
  }

  return yaml.stringify(document, {
    aliasDuplicateObjects: false,
    lineWidth: 1000,
    sortMapEntries: false,
  });
}

export function persistForceAuthoredSpecToYaml(
  framePath: string,
  payload: unknown,
): string {
  if (!isRecord(payload) || !Array.isArray(payload.nodes) || !Array.isArray(payload.links)) {
    throw new Error("Expected authored force spec JSON payload");
  }
  const simulation = payload.simulation;
  if (isRecord(simulation) && isRecord(simulation.params)) {
    throw new Error("Expected authored force spec JSON payload, not runtime snapshot state");
  }
  return yaml.stringify(payload, {
    aliasDuplicateObjects: false,
    lineWidth: 1000,
    sortMapEntries: false,
  });
}

export function fileLabelForError(filePath: string): string {
  return path.basename(filePath);
}
