import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadFrameYaml } from "../src/frame-yaml-loader.js";
import { layoutFrameTree } from "../src/layout.js";
import { emitFrameDiagramDisplayList } from "../src/render-adapter/display-list.js";
import { renderDisplayListToSvg } from "../src/render-adapter/svg.js";
import { renderFrameDiagramToSvg } from "../src/svg-render.js";
import { MockTextAdapter } from "../src/text-measure.js";

const ROOT = join(process.cwd(), "..", "..", "scripts", "diagrams", "frames");

function loadDiagram(slug: string) {
  return loadFrameYaml(join(ROOT, `${slug}.yaml`));
}

function normalizeGeometry(svg: string) {
  const rects = [...svg.matchAll(/<rect ([^>]+?)\/>/g)].map((match) => ({
    x: Number(match[1]!.match(/\bx="([^"]+)"/)?.[1] ?? "0"),
    y: Number(match[1]!.match(/\by="([^"]+)"/)?.[1] ?? "0"),
    width: Number(match[1]!.match(/\bwidth="([^"]+)"/)?.[1] ?? "0"),
    height: Number(match[1]!.match(/\bheight="([^"]+)"/)?.[1] ?? "0"),
    fill: match[1]!.match(/\bfill="([^"]+)"/)?.[1] ?? "",
    stroke: match[1]!.match(/\bstroke="([^"]+)"/)?.[1] ?? "",
  }));
  const lines = [...svg.matchAll(/<line ([^>]+?)\/>/g)].map((match) => ({
    x1: Number(match[1]!.match(/\bx1="([^"]+)"/)?.[1] ?? "0"),
    y1: Number(match[1]!.match(/\by1="([^"]+)"/)?.[1] ?? "0"),
    x2: Number(match[1]!.match(/\bx2="([^"]+)"/)?.[1] ?? "0"),
    y2: Number(match[1]!.match(/\by2="([^"]+)"/)?.[1] ?? "0"),
    stroke: match[1]!.match(/\bstroke="([^"]+)"/)?.[1] ?? "",
    dash: match[1]!.match(/\bstroke-dasharray="([^"]+)"/)?.[1] ?? "",
  }));
  const tspans = [...svg.matchAll(/<tspan ([^>]+?)>([^<]*)<\/tspan>/g)].map((match) => ({
    x: Number(match[1]!.match(/\bx="([^"]+)"/)?.[1] ?? "0"),
    y: Number(match[1]!.match(/\by="([^"]+)"/)?.[1] ?? "0"),
    size: match[1]!.match(/\bfont-size="([^"]+)"/)?.[1] ?? "",
    weight: match[1]!.match(/\bfont-weight="([^"]+)"/)?.[1] ?? "",
    fill: match[1]!.match(/\bfill="([^"]+)"/)?.[1] ?? "",
    text: match[2]!,
  }));
  return { rects, lines, tspans };
}

describe("render-ir parity", () => {
  for (const slug of ["preview-smoke", "support-engineering-flow"]) {
    it(`emits equivalent geometry for ${slug}`, () => {
      const diagram = loadDiagram(slug);
      const adapter = new MockTextAdapter();
      const layout = layoutFrameTree(diagram.root, adapter, {
        gridCols: diagram.gridCols,
        gridColGap: diagram.gridColGap,
        gridOuterMargin: diagram.gridOuterMargin,
      });
      const displayList = emitFrameDiagramDisplayList(diagram, layout, adapter);
      const legacySvg = renderFrameDiagramToSvg(diagram, layout, adapter);
      const displayListSvg = renderDisplayListToSvg(displayList);

      expect(normalizeGeometry(displayListSvg)).toEqual(normalizeGeometry(legacySvg));
    });
  }
});
