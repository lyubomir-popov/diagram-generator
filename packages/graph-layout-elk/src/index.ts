export {
  type LayoutDirection,
  type SpacingProfile,
  type LayeredCorpusFamily,
  type GraphNodeInput,
  type GraphEdgeInput,
  type GraphLayoutInput,
  type PlacedNode,
  type PlacedEdge,
  type GraphLayoutResult,
  GRID_BASELINE_PX,
  roundToGrid,
} from '@diagram-generator/graph-layout-core';

export {
  layoutLayered,
  layoutLayeredForFamily,
  buildElkGraphFromInput,
  layeredConfigForFamily,
  buildLayeredLayoutOptions,
  resolvedElkOptionsForFamily,
  elkParamGroups,
  type LayoutLayeredOptions,
} from './elk-layered.js';

export {
  toAbsolutePlacedNodes,
  indexPlacedNodes,
  leafNodeRects,
  edgeEndpointsTouchEndpointNodes,
  edgeEndpointsTouchLeaves,
  nearestLeafBoundaryDistance,
} from './node-bounds.js';

export type { LayeredLayoutConfig, ElkLayoutOptions, ElkParamSpec, ElkParamKind } from './layered-options.js';
export {
  ELK_LAYERED_PARAM_SPECS,
  elkParamDefaults,
  elkParamSpecByKey,
  resolveElkLayoutOptions,
} from './elk-param-registry.js';
