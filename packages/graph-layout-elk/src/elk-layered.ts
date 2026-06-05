import ELK from 'elkjs/lib/elk.bundled.js';
import type { GraphLayoutInput, GraphLayoutResult, LayeredCorpusFamily } from '@diagram-generator/graph-layout-core';

import { buildElkGraphFromInput, buildElkGraph } from './elk-graph-builder.js';
import {
  buildLayeredLayoutOptions,
  layeredConfigForFamily,
  resolvedElkOptionsForFamily,
  elkParamGroups,
  type LayeredLayoutConfig,
} from './layered-options.js';
import { normalizeElkLayoutResult } from './result-normalizer.js';

let sharedElk: InstanceType<typeof ELK> | null = null;

function getElk(): InstanceType<typeof ELK> {
  if (!sharedElk) {
    // Bundled build runs ELK in-process (no Web Worker). Same algorithm as Eclipse ELK Java.
    sharedElk = new ELK();
  }
  return sharedElk;
}

export interface LayoutLayeredOptions {
  /** Override direction/spacing instead of input fields. */
  config?: LayeredLayoutConfig;
  /** Shorthand: merge into config.optionOverrides */
  optionOverrides?: Record<string, string>;
}

/**
 * Run ELK Layered (Sugiyama) on a graph IR document.
 * Does not touch frame autolayout or preview — integration is a separate phase.
 */
export async function layoutLayered(
  input: GraphLayoutInput,
  options: LayoutLayeredOptions = {},
): Promise<GraphLayoutResult> {
  const familyDirection = input.direction;
  const baseConfig: LayeredLayoutConfig = options.config ?? {
    direction: familyDirection,
    spacingProfile: input.spacingProfile ?? 'normal',
    optionOverrides: options.optionOverrides,
  };
  if (options.optionOverrides) {
    baseConfig.optionOverrides = {
      ...baseConfig.optionOverrides,
      ...options.optionOverrides,
    };
  }
  const layoutOptions = buildLayeredLayoutOptions(baseConfig);

  const elkGraph = buildElkGraph(input, layoutOptions);
  const elk = getElk();
  const laidOut = await elk.layout(elkGraph);
  return normalizeElkLayoutResult(input, laidOut as Parameters<typeof normalizeElkLayoutResult>[1]);
}

export async function layoutLayeredForFamily(
  family: LayeredCorpusFamily,
  input: Omit<GraphLayoutInput, 'direction' | 'spacingProfile'>,
  optionOverrides?: Record<string, string>,
): Promise<GraphLayoutResult> {
  const config = layeredConfigForFamily(family);
  if (optionOverrides) {
    config.optionOverrides = optionOverrides;
  }
  return layoutLayered(
    {
      ...input,
      direction: config.direction,
      spacingProfile: config.spacingProfile,
    },
    { config },
  );
}

export { buildElkGraphFromInput, layeredConfigForFamily, buildLayeredLayoutOptions, resolvedElkOptionsForFamily, elkParamGroups };
