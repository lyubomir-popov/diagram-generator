import { describe, expect, it } from "vitest";

import { fromFrameDiagram } from "../src/document-model/schema.js";
import { loadFrameYaml } from "../src/frame-yaml-loader.js";
import {
  AUTOLAYOUT_OPERATOR_FACADE,
  evaluateAutolayoutOperator,
} from "../src/operator-autolayout/facade.js";
import { MockTextAdapter } from "../src/text-measure.js";

describe("operator autolayout facade", () => {
  it("evaluates a frame document through a sync operator-shaped interface", () => {
    const diagram = loadFrameYaml("../../scripts/diagrams/frames/preview-smoke.yaml");
    const document = fromFrameDiagram(diagram);
    const adapter = new MockTextAdapter();

    const result = evaluateAutolayoutOperator(document, adapter, {
      gridCols: diagram.gridCols,
      gridColGap: diagram.gridColGap,
      gridOuterMargin: diagram.gridOuterMargin,
    });

    expect(result.layout.width).toBeGreaterThan(0);
    expect(result.layout.height).toBeGreaterThan(0);
    expect(result.displayList.length).toBeGreaterThan(0);
    expect(result.componentTree[0]?.id).toBe("page");
    expect(result.gridInfo.col_xs.length).toBeGreaterThan(0);
  });

  it("declares stable operator ports and evaluate surface", () => {
    expect(AUTOLAYOUT_OPERATOR_FACADE.key).toBe("@diagram-generator/operator-autolayout");
    expect(AUTOLAYOUT_OPERATOR_FACADE.inputs.map((entry) => entry.key)).toEqual(["document", "textAdapter"]);
    expect(AUTOLAYOUT_OPERATOR_FACADE.outputs.map((entry) => entry.key)).toEqual([
      "layout",
      "viewport",
      "displayList",
      "componentTree",
      "gridInfo",
    ]);
    expect(typeof AUTOLAYOUT_OPERATOR_FACADE.evaluate).toBe("function");
  });
});
