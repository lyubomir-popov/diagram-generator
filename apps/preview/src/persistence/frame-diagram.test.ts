import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  persistFrameDiagramOverridePayloadToYaml,
  verifyElkLayoutPersisted,
  type PersistOverridePayload,
} from "./frame-diagram.js";
import {
  loadFrameYaml,
  resolvePreviewEngine,
  type PreviewEngineContext,
} from "@diagram-generator/layout-engine";

const REPO_ROOT = path.resolve(process.cwd(), "..", "..");
const FRAME_FIXTURE = path.join(REPO_ROOT, "scripts", "diagrams", "frames", "support-engineering-flow.yaml");

function writeTempFrame(name: string, content: string): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dg-frame-yaml-"));
  const framePath = path.join(tempDir, name);
  fs.writeFileSync(framePath, content, "utf8");
  return framePath;
}

function persistToYaml(name: string, baselineText: string, payload: PersistOverridePayload): string {
  const framePath = writeTempFrame(name, baselineText);
  return persistFrameDiagramOverridePayloadToYaml(framePath, baselineText, payload);
}

test("persist override payload writes canonical yaml fields", () => {
  const baselineText = fs.readFileSync(FRAME_FIXTURE, "utf8");
  const output = persistToYaml("support-engineering-flow.yaml", baselineText, {
    overrides: {
      step_fix: {
        style: "parent",
        text: {
          heading: "The updated fix",
          label: ["", "Canonical YAML save path."],
        },
      },
    },
  });

  assert.match(output, /heading: The updated fix/);
  assert.match(output, /label:\r?\n\s*- ''\r?\n\s*- Canonical YAML save path\./);
  assert.doesNotMatch(output, /style:/);
  assert.doesNotMatch(output, /overrideRole/);
  assert.doesNotMatch(output, /grid_overrides:/);
});

test("persist elk layout overrides writes meta.elk", () => {
  const baselineText = [
    "engine: v3",
    "title: Demo",
    "meta:",
    "  layout_engine: elk-layered",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "    - id: leaf_a",
    "      label: [A]",
    "",
  ].join("\n");
  const output = persistToYaml("demo.yaml", baselineText, {
    overrides: {},
    elk_layout_overrides: {
      "elk.layered.spacing.nodeNodeBetweenLayers": "144",
      "elk.spacing.edgeNode": "56",
    },
  });
  const expected = [
    "engine: v3",
    "title: Demo",
    "meta:",
    "  layout_engine: elk-layered",
    "  elk:",
    "    elk.layered.spacing.nodeNodeBetweenLayers: '144'",
    "    elk.spacing.edgeNode: '56'",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "  - id: leaf_a",
    "    label:",
    "    - A",
    "",
  ].join("\r\n");

  assert.strictEqual(output, expected);
  verifyElkLayoutPersisted(output, {
    "elk.layered.spacing.nodeNodeBetweenLayers": "144",
    "elk.spacing.edgeNode": "56",
  });
});

test("persist elk layout overrides replaces meta.elk entries canonically", () => {
  const baselineText = [
    "engine: v3",
    "title: Demo",
    "meta:",
    "  layout_engine: elk-layered",
    "  elk:",
    "    elk.spacing.nodeNode: \"48\"",
    "    elk.layered.nodePlacement.strategy: NETWORK_SIMPLEX",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "    - id: leaf_a",
    "      label: [A]",
    "",
  ].join("\n");
  const output = persistToYaml("demo.yaml", baselineText, {
    overrides: {},
    elk_layout_overrides: {
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.padding": "[top=0,left=0,bottom=0,right=0]",
    },
  });
  const expected = [
    "engine: v3",
    "title: Demo",
    "meta:",
    "  layout_engine: elk-layered",
    "  elk:",
    "    elk.spacing.nodeNode: '48'",
    "    elk.layered.nodePlacement.strategy: BRANDES_KOEPF",
    "    elk.padding: '[top=0,left=0,bottom=0,right=0]'",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "  - id: leaf_a",
    "    label:",
    "    - A",
    "",
  ].join("\r\n");

  assert.strictEqual(output, expected);
  verifyElkLayoutPersisted(output, {
    "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
    "elk.padding": "[top=0,left=0,bottom=0,right=0]",
    "elk.spacing.nodeNode": "48",
  });
});

test("persist removed ids prunes frames and arrows", () => {
  const baselineText = [
    "engine: v3",
    "title: Demo",
    "arrows:",
    "  - source: leaf_a",
    "    target: leaf_b",
    "root:",
    "  id: page",
    "  direction: horizontal",
    "  children:",
    "    - id: panel",
    "      direction: vertical",
    "      children:",
    "        - id: leaf_a",
    "          label: [A]",
    "        - id: leaf_b",
    "          label: [B]",
    "",
  ].join("\n");
  const output = persistToYaml("demo.yaml", baselineText, {
    overrides: {},
    removed_ids: ["leaf_a"],
  });
  const expected = [
    "engine: v3",
    "title: Demo",
    "arrows: []",
    "root:",
    "  id: page",
    "  direction: horizontal",
    "  children:",
    "  - id: panel",
    "    direction: vertical",
    "    children:",
    "    - id: leaf_b",
    "      label:",
    "      - B",
    "",
  ].join("\r\n");

  assert.strictEqual(output, expected);
});

test("empty payload is a no-op without rewriting yaml", () => {
  const baselineText = fs.readFileSync(FRAME_FIXTURE, "utf8");
  const output = persistToYaml("support-engineering-flow.yaml", baselineText, {
    overrides: {},
    grid_overrides: {},
  });

  assert.strictEqual(output, baselineText);
});

test("persist→reload round-trip: gap_delta survives write without emitting absolute gap", () => {
  const baselineText = [
    "engine: v3",
    "title: Gap delta",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "    - id: flow",
    "      direction: vertical",
    "      children:",
    "        - id: phase",
    "          label: [Phase]",
    "        - id: purpose",
    "          label: [Purpose]",
    "",
  ].join("\n");

  const persistent = persistToYaml("gap-delta-roundtrip.yaml", baselineText, {
    overrides: {
      flow: {
        gap_delta: 16,
      },
    },
  });

  assert.match(persistent, /gap_delta: 16/);
  assert.doesNotMatch(persistent, /\n\s+gap: 24/);

  const reloadedPath = writeTempFrame("gap-delta-reloaded.yaml", persistent);
  const reloaded = loadFrameYaml(reloadedPath);
  const flow = reloaded.root.children.find((child) => child.id === "flow");

  assert.ok(flow, "flow frame must survive save + reload");
  assert.strictEqual(flow?.gap, 24, "gap_delta should add to the derived 8px leaf-stack gap");
});

test("persist style does not promote implicit headingless wrapper", () => {
  const baselineText = [
    "engine: v3",
    "title: Wrapper",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "    - id: wrapper",
    "      direction: horizontal",
    "      children:",
    "        - id: leaf_a",
    "          label: [A]",
    "        - id: leaf_b",
    "          label: [B]",
    "",
  ].join("\n");
  const output = persistToYaml("wrapper.yaml", baselineText, {
    overrides: { wrapper: { style: "parent" } },
  });
  const expected = [
    "engine: v3",
    "title: Wrapper",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "  - id: wrapper",
    "    direction: horizontal",
    "    children:",
    "    - id: leaf_a",
    "      label:",
    "      - A",
    "    - id: leaf_b",
    "      label:",
    "      - B",
    "",
  ].join("\r\n");

  assert.strictEqual(output, expected);
});

test("persist style preserves explicit visible headingless group", () => {
  const baselineText = [
    "engine: v3",
    "title: Group",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "    - id: group",
    "      level: 2",
    "      direction: horizontal",
    "      children:",
    "        - id: leaf_a",
    "          label: [A]",
    "        - id: leaf_b",
    "          label: [B]",
    "",
  ].join("\n");
  const output = persistToYaml("group.yaml", baselineText, {
    overrides: { group: { style: "section" } },
  });
  const expected = [
    "engine: v3",
    "title: Group",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "  - id: group",
    "    level: 3",
    "    direction: horizontal",
    "    children:",
    "    - id: leaf_a",
    "      label:",
    "      - A",
    "    - id: leaf_b",
    "      label:",
    "      - B",
    "    fill: white",
    "    border: solid",
    "",
  ].join("\r\n");

  assert.strictEqual(output, expected);
});

test("persist layout_engine writes meta.layout_engine (spec 035)", () => {
  const baselineText = [
    "engine: v3",
    "title: Demo",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "    - id: leaf_a",
    "      label: [A]",
    "",
  ].join("\n");
  const output = persistToYaml("demo.yaml", baselineText, {
    layout_engine: "elk-layered",
  });
  // When meta is added to a document that didn't have it, YAML serializer
  // appends it at the end. The key order doesn't affect parsing.
  const expected = [
    "engine: v3",
    "title: Demo",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "  - id: leaf_a",
    "    label:",
    "    - A",
    "meta:",
    "  layout_engine: elk-layered",
    "",
  ].join("\r\n");

  assert.strictEqual(output, expected);
});

test("persist layout_engine updates existing meta.layout_engine (spec 035)", () => {
  const baselineText = [
    "engine: v3",
    "title: Demo",
    "meta:",
    "  layout_engine: vertical-stack",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "    - id: leaf_a",
    "      label: [A]",
    "",
  ].join("\n");
  const output = persistToYaml("demo.yaml", baselineText, {
    layout_engine: "elk-layered",
  });
  const expected = [
    "engine: v3",
    "title: Demo",
    "meta:",
    "  layout_engine: elk-layered",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "  - id: leaf_a",
    "    label:",
    "    - A",
    "",
  ].join("\r\n");

  assert.strictEqual(output, expected);
});

test("persist layout_engine null clears meta.layout_engine (spec 035)", () => {
  const baselineText = [
    "engine: v3",
    "title: Demo",
    "meta:",
    "  layout_engine: elk-layered",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "    - id: leaf_a",
    "      label: [A]",
    "",
  ].join("\n");
  const output = persistToYaml("demo.yaml", baselineText, {
    layout_engine: null,
  });
  const expected = [
    "engine: v3",
    "title: Demo",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "  - id: leaf_a",
    "    label:",
    "    - A",
    "",
  ].join("\r\n");

  assert.strictEqual(output, expected);
});

test("persist layout_engine preserves other meta fields (spec 035)", () => {
  const baselineText = [
    "engine: v3",
    "title: Demo",
    "meta:",
    "  elk:",
    "    elk.direction: DOWN",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "    - id: leaf_a",
    "      label: [A]",
    "",
  ].join("\n");
  const output = persistToYaml("demo.yaml", baselineText, {
    layout_engine: "elk-layered",
  });
  const expected = [
    "engine: v3",
    "title: Demo",
    "meta:",
    "  elk:",
    "    elk.direction: DOWN",
    "  layout_engine: elk-layered",
    "root:",
    "  id: page",
    "  direction: vertical",
    "  children:",
    "  - id: leaf_a",
    "    label:",
    "    - A",
    "",
  ].join("\r\n");

  assert.strictEqual(output, expected);
});

test("persist→reload round-trip: layout_engine survives write and resolves via registry (spec 035, T020)", () => {
  const baselineText = fs.readFileSync(FRAME_FIXTURE, "utf8");

  // Step 1: Persist an engine choice onto a real frame YAML.
  const persistent = persistToYaml("roundtrip.yaml", baselineText, {
    layout_engine: "elk-layered",
  });
  assert.match(persistent, /layout_engine: elk-layered/);

  // Step 2: Write the persisted YAML to disk and reload it through the actual
  // loader the preview server uses — no string inspection.
  const reloadedPath = writeTempFrame("roundtrip-reloaded.yaml", persistent);
  const reloaded = loadFrameYaml(reloadedPath);

  // Step 3: The reloaded diagram must carry the persisted engine key.
  assert.strictEqual(
    reloaded.layoutEngine,
    "elk-layered",
    "layout_engine must survive write + re-parse via loadFrameYaml",
  );

  // Step 4: Resolve the engine through the registry, exactly as the server does.
  const context: PreviewEngineContext = {
    layoutEngine: reloaded.layoutEngine,
    shellMode: "grid",
    previewDocumentKind: "frame-diagram",
  };
  const resolved = resolvePreviewEngine(context);
  assert.ok(resolved, "registry must resolve a preview engine for the persisted key");
  assert.strictEqual(
    resolved?.layoutEngineKey,
    "elk-layered",
    "resolved engine must match the persisted layout_engine key",
  );
});
