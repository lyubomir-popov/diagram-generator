/**
 * ELK Layered (Sugiyama) layout options aligned with planning `layout_mapping.py`.
 *
 * Reference: https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html
 * elkjs uses the same option keys as Eclipse ELK (prefix `elk.`).
 */

import type {
  LayeredCorpusFamily,
  LayoutDirection,
  SpacingProfile,
} from '@diagram-generator/graph-layout-core';

import {
  ELK_LAYERED_PARAM_SPECS,
  elkParamDefaults,
  resolveElkLayoutOptions,
} from './elk-param-registry.js';

export type ElkLayoutOptions = Record<string, string>;

export type { ElkParamSpec, ElkParamKind } from './elk-param-registry.js';
export {
  ELK_LAYERED_PARAM_SPECS,
  elkParamDefaults,
  elkParamSpecByKey,
  resolveElkLayoutOptions,
} from './elk-param-registry.js';

const DIRECTION: Record<LayoutDirection, string> = {
  TB: 'DOWN',
  LR: 'RIGHT',
};

/** Between-layer spacing (nodeNodeBetweenLayers) in px. */
const BETWEEN_LAYERS: Record<SpacingProfile, string> = {
  compact: '16',
  normal: '24',
  loose: '48',
};

/** Same-layer node spacing (nodeNode) in px. */
const SAME_LAYER: Record<SpacingProfile, string> = {
  compact: '16',
  normal: '24',
  loose: '32',
};

export interface LayeredLayoutConfig {
  direction: LayoutDirection;
  spacingProfile: SpacingProfile;
  /** Override `elk.layered.spacing.nodeNodeBetweenLayers` (px). */
  betweenLayersPx?: number;
  /** Override `elk.spacing.nodeNode` (px). */
  sameLayerPx?: number;
  /** Session/YAML overrides keyed by full ELK option id. */
  optionOverrides?: Record<string, string>;
}

export function layeredConfigForFamily(family: LayeredCorpusFamily): LayeredLayoutConfig {
  switch (family) {
    case 'data_flow_and_integration':
      return { direction: 'LR', spacingProfile: 'normal' };
    case 'deployment_and_runtime_topology':
      return { direction: 'TB', spacingProfile: 'normal' };
    case 'process_and_workflow':
      return {
        direction: 'TB',
        spacingProfile: 'normal',
        optionOverrides: {
          'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
          'elk.padding': '[top=0,left=0,bottom=0,right=0]',
        },
      };
  }
}

/**
 * Build ELK layoutOptions for org.eclipse.elk.layered (Sugiyama pipeline).
 */
export function buildLayeredLayoutOptions(config: LayeredLayoutConfig): ElkLayoutOptions {
  const { direction, spacingProfile } = config;
  const overrides = config.optionOverrides ?? {};

  const base = elkParamDefaults();
  base['elk.direction'] = DIRECTION[direction];
  // YAML/session overrides must win — never let family betweenLayersPx clobber saved meta.elk.
  base['elk.layered.spacing.nodeNodeBetweenLayers'] = String(
    overrides['elk.layered.spacing.nodeNodeBetweenLayers']
      ?? config.betweenLayersPx
      ?? BETWEEN_LAYERS[spacingProfile],
  );
  base['elk.spacing.nodeNode'] = String(
    overrides['elk.spacing.nodeNode']
      ?? config.sameLayerPx
      ?? SAME_LAYER[spacingProfile],
  );
  base['elk.edgeLabels.inline'] = 'true';

  return resolveElkLayoutOptions(base, config.optionOverrides);
}

/** Resolved defaults for preview UI (family + optional YAML/session overrides). */
export function resolvedElkOptionsForFamily(
  family: LayeredCorpusFamily,
  optionOverrides?: Record<string, string>,
): ElkLayoutOptions {
  const config = layeredConfigForFamily(family);
  config.optionOverrides = {
    ...(config.optionOverrides ?? {}),
    ...(optionOverrides ?? {}),
  };
  return buildLayeredLayoutOptions(config);
}

/** Param catalog grouped for sidebar rendering. */
export function elkParamGroups(): { group: string; specs: typeof ELK_LAYERED_PARAM_SPECS }[] {
  const order = ['Graph', 'Spacing', 'Edges', 'Layering', 'Compound'];
  const buckets = new Map<string, typeof ELK_LAYERED_PARAM_SPECS>();
  for (const spec of ELK_LAYERED_PARAM_SPECS) {
    const list = buckets.get(spec.group) ?? [];
    list.push(spec);
    buckets.set(spec.group, list);
  }
  return order
    .filter((g) => buckets.has(g))
    .map((group) => ({ group, specs: buckets.get(group)! }));
}
