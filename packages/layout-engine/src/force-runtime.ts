import {
  BASELINE_UNIT,
  ForceCenter,
  ForceCollideRect,
  ForceLink,
  ForceLinkForce,
  ForceManyBody,
  ForceNode,
  ForceSimulation,
  snapToGrid,
} from './force-solver.js';

export interface ForceRenderSpec {
  curve_handle_ratio?: number;
  curve_handle_min?: number;
  curve_handle_max?: number;
}

export interface ForceSimulationSpec {
  alpha?: number;
  alpha_min?: number;
  alpha_decay?: number;
  alpha_target?: number;
  ticks_per_frame?: number;
  max_iterations?: number;
  charge_strength?: number;
  link_distance?: number;
  link_strength?: number;
  link_iterations?: number;
  collision_padding?: number;
  collision_iterations?: number;
  velocity_decay?: number;
  center?: [number, number];
}

export interface ForceNodeSpec {
  id: string;
  label: string[];
  width: number;
  height: number;
  x: number;
  y: number;
  fx?: number;
  fy?: number;
  fill?: string;
  text_fill?: string;
  stroke?: string;
  stroke_width?: number;
  shape?: string;
  style?: string | null;
}

export interface ForceLinkSpec {
  source: string;
  target: string;
  stroke?: string;
  stroke_width?: number;
  render?: Record<string, unknown>;
}

export interface ForceAuthoredSpec {
  title: string;
  reference_image: string;
  canvas: { width: number; height: number };
  render: ForceRenderSpec;
  simulation: ForceSimulationSpec;
  nodes: ForceNodeSpec[];
  links: ForceLinkSpec[];
}

type ForceStyleName = 'default' | 'parent' | 'section' | 'annotation' | 'highlight';

export interface ForceRuntimeNode extends ForceNodeSpec {
  fill: string;
  text_fill: string;
  stroke: string;
  stroke_width: number;
  style: ForceStyleName | null;
  base_style: ForceStyleName | null;
  style_override: ForceStyleName | null;
  vx: number;
  vy: number;
}

export interface ForceRuntimeLink {
  source: string;
  target: string;
  stroke: string;
  stroke_width: number;
  render?: Record<string, unknown>;
}

export interface ForceSimulationConfig {
  alpha: number;
  alpha_min: number;
  alpha_decay: number;
  alpha_target: number;
  ticks_per_frame: number;
  max_iterations: number;
  charge_strength: number;
  link_distance: number;
  link_strength?: number;
  link_iterations?: number;
  collision_padding: number;
  collision_iterations: number;
  velocity_decay: number;
  center: [number, number];
}

export interface ForceRuntimeSnapshot {
  title: string;
  reference_image: string;
  canvas: { width: number; height: number };
  render: Required<ForceRenderSpec>;
  simulation: ForceSimulationConfig & {
    alpha: number;
    alpha_min: number;
    tick_count: number;
    settled: boolean;
    params: ForceSimulationConfig;
  };
  definition_stale: boolean;
  nodes: ForceRuntimeNode[];
  links: ForceRuntimeLink[];
}

export interface ForceNodePatch {
  x?: number;
  y?: number;
  pinned?: boolean;
  width?: number;
  height?: number;
  style?: string | null;
  label?: string[] | null;
}

const DEFAULT_FILL = '#FFFFFF';
const DEFAULT_TEXT_FILL = '#000000';
const DEFAULT_STROKE = '#000000';
const DEFAULT_LINK_STROKE = '#E95420';
const FORCE_BOX_STYLES = {
  default: { fill: '#FFFFFF', text_fill: '#000000', stroke: '#000000', stroke_width: 1 },
  parent: { fill: '#F3F3F3', text_fill: '#000000', stroke: 'none', stroke_width: 0 },
  section: { fill: 'transparent', text_fill: '#000000', stroke: '#000000', stroke_width: 1 },
  annotation: { fill: 'transparent', text_fill: '#666666', stroke: 'none', stroke_width: 0 },
  highlight: { fill: '#000000', text_fill: '#FFFFFF', stroke: 'none', stroke_width: 0 },
} as const;

interface ForcePreviewState {
  spec: ForceAuthoredSpec;
  simulation: ForceSimulation;
  nodeIndexById: Map<string, number>;
  nodeBaseStyles: Map<string, ForceStyleName | null>;
  nodeStyleOverrides: Map<string, ForceStyleName>;
  tickCount: number;
}

const runtimeStateBySnapshot = new WeakMap<ForceRuntimeSnapshot, ForcePreviewState>();

function cloneSpec(spec: ForceAuthoredSpec): ForceAuthoredSpec {
  return {
    title: spec.title,
    reference_image: spec.reference_image,
    canvas: { ...spec.canvas },
    render: { ...spec.render },
    simulation: { ...spec.simulation },
    nodes: spec.nodes.map((node) => ({
      ...node,
      label: [...node.label],
    })),
    links: spec.links.map((link) => ({
      ...link,
      render: link.render ? { ...link.render } : undefined,
    })),
  };
}

function canvas(spec: ForceAuthoredSpec): { width: number; height: number } {
  return {
    width: Number(spec.canvas?.width ?? 1280),
    height: Number(spec.canvas?.height ?? 720),
  };
}

function normalizeRenderSpec(render: ForceRenderSpec | undefined): Required<ForceRenderSpec> {
  return {
    curve_handle_ratio: Number(render?.curve_handle_ratio ?? 0.35),
    curve_handle_min: Number(render?.curve_handle_min ?? 24),
    curve_handle_max: Number(render?.curve_handle_max ?? 72),
  };
}

function normalizeSimulationSpec(spec: ForceAuthoredSpec): ForceSimulationConfig {
  const sim = spec.simulation ?? {};
  const currentCanvas = canvas(spec);
  const alphaMin = Number(sim.alpha_min ?? 0.001);
  return {
    alpha: Number(sim.alpha ?? 1),
    alpha_min: alphaMin,
    alpha_decay: Number(sim.alpha_decay ?? (1 - Math.pow(alphaMin, 1 / 300))),
    alpha_target: Number(sim.alpha_target ?? 0),
    ticks_per_frame: Math.max(1, Math.floor(Number(sim.ticks_per_frame ?? 4))),
    max_iterations: Math.max(1, Math.floor(Number(sim.max_iterations ?? 300))),
    charge_strength: Number(sim.charge_strength ?? -220),
    link_distance: Number(sim.link_distance ?? 120),
    link_strength: sim.link_strength == null ? undefined : Number(sim.link_strength),
    link_iterations: sim.link_iterations == null ? undefined : Math.max(1, Math.floor(Number(sim.link_iterations))),
    collision_padding: Number(sim.collision_padding ?? 12),
    collision_iterations: Math.max(1, Math.floor(Number(sim.collision_iterations ?? 1))),
    velocity_decay: Number(sim.velocity_decay ?? 0.4),
    center: [
      Number(sim.center?.[0] ?? currentCanvas.width / 2),
      Number(sim.center?.[1] ?? currentCanvas.height / 2),
    ],
  };
}

function resolveStyleName(style: string | null | undefined): ForceStyleName | null {
  if (style == null || style === '') {
    return null;
  }
  if (style === 'accent') {
    return 'parent';
  }
  if (style === 'default' || style === 'parent' || style === 'section' || style === 'annotation' || style === 'highlight') {
    return style;
  }
  throw new Error(`Unknown force style: ${style}`);
}

function inferBaseStyle(nodeSpec: ForceNodeSpec): ForceStyleName | null {
  const explicit = resolveStyleName(nodeSpec.style);
  if (explicit) {
    return explicit;
  }

  if (nodeSpec.fill == null && nodeSpec.text_fill == null) {
    return 'default';
  }

  const fill = String(nodeSpec.fill ?? '').toUpperCase();
  const textFill = String(nodeSpec.text_fill ?? '').toUpperCase();
  for (const [styleName, preset] of Object.entries(FORCE_BOX_STYLES) as Array<[ForceStyleName, (typeof FORCE_BOX_STYLES)[ForceStyleName]]>) {
    if (fill === preset.fill.toUpperCase() && (!textFill || textFill === preset.text_fill.toUpperCase())) {
      return styleName;
    }
  }
  return null;
}

function clampCoordinate(value: number, halfSize: number, extent: number): number {
  const minimum = halfSize;
  const maximum = extent - halfSize;
  if (maximum < minimum) {
    return extent / 2;
  }
  return Math.max(minimum, Math.min(maximum, value));
}

function clampNodeToCanvas(node: ForceNode, currentCanvas: { width: number; height: number }): void {
  const halfWidth = node.width / 2;
  const halfHeight = node.height / 2;

  if (node.fx != null) {
    node.fx = clampCoordinate(Number(node.fx), halfWidth, currentCanvas.width);
    node.x = node.fx;
    node.vx = 0;
  } else {
    const clampedX = clampCoordinate(node.x, halfWidth, currentCanvas.width);
    if (clampedX !== node.x) {
      node.x = clampedX;
      node.vx = 0;
    }
  }

  if (node.fy != null) {
    node.fy = clampCoordinate(Number(node.fy), halfHeight, currentCanvas.height);
    node.y = node.fy;
    node.vy = 0;
  } else {
    const clampedY = clampCoordinate(node.y, halfHeight, currentCanvas.height);
    if (clampedY !== node.y) {
      node.y = clampedY;
      node.vy = 0;
    }
  }
}

function clampStateNodes(state: ForcePreviewState): void {
  const currentCanvas = canvas(state.spec);
  for (const node of state.simulation.nodes) {
    clampNodeToCanvas(node, currentCanvas);
  }
}

function restartForceAnimation(state: ForcePreviewState): void {
  const config = normalizeSimulationSpec(state.spec);
  state.tickCount = 0;
  state.simulation.alpha = config.alpha;
  for (const node of state.simulation.nodes) {
    node.vx = 0;
    node.vy = 0;
    if (node.fx != null) {
      node.x = Number(node.fx);
    }
    if (node.fy != null) {
      node.y = Number(node.fy);
    }
  }
  clampStateNodes(state);
}

function applySimulationConfig(state: ForcePreviewState): void {
  const config = normalizeSimulationSpec(state.spec);

  state.simulation.alpha = config.alpha;
  state.simulation.alphaMin = config.alpha_min;
  state.simulation.alphaDecay = config.alpha_decay;
  state.simulation.alphaTarget = config.alpha_target;
  state.simulation.velocityDecay = config.velocity_decay;

  const centerForce = state.simulation.force('center');
  if (centerForce instanceof ForceCenter) {
    centerForce.x(config.center[0]).y(config.center[1]);
  } else {
    state.simulation.force('center', new ForceCenter(config.center[0], config.center[1]));
  }

  const chargeForce = state.simulation.force('charge');
  if (chargeForce instanceof ForceManyBody) {
    chargeForce.strength(config.charge_strength);
  } else {
    state.simulation.force('charge', new ForceManyBody().strength(config.charge_strength));
  }

  const collideForce = state.simulation.force('collide');
  if (collideForce instanceof ForceCollideRect) {
    collideForce.padding(config.collision_padding).iterations(config.collision_iterations);
  } else {
    state.simulation.force(
      'collide',
      new ForceCollideRect(config.collision_padding).iterations(config.collision_iterations),
    );
  }

  if (state.spec.links.length > 0) {
    const linkForce = state.simulation.force('link');
    const nextLinkForce = linkForce instanceof ForceLinkForce ? linkForce : new ForceLinkForce();
    nextLinkForce.links(
      state.spec.links.map((linkSpec, index) => new ForceLink({
        index,
        source: linkSpec.source,
        target: linkSpec.target,
      })),
    );
    nextLinkForce.id((node) => node.componentId);
    nextLinkForce.distance(config.link_distance);
    if (config.link_iterations != null) {
      nextLinkForce.iterations(config.link_iterations);
    }
    if (config.link_strength != null) {
      nextLinkForce.strength(config.link_strength);
    }
    state.simulation.force('link', nextLinkForce);
  } else {
    state.simulation.force('link', false);
  }
}

function createForceState(spec: ForceAuthoredSpec): ForcePreviewState {
  const ownedSpec = cloneSpec(spec);
  const nodes: ForceNode[] = [];
  const nodeIndexById = new Map<string, number>();
  const nodeBaseStyles = new Map<string, ForceStyleName | null>();

  ownedSpec.nodes.forEach((nodeSpec, index) => {
    nodes.push(
      new ForceNode({
        index,
        x: Number(nodeSpec.x),
        y: Number(nodeSpec.y),
        fx: nodeSpec.fx == null ? null : Number(nodeSpec.fx),
        fy: nodeSpec.fy == null ? null : Number(nodeSpec.fy),
        width: Number(nodeSpec.width ?? 192),
        height: Number(nodeSpec.height ?? 64),
        componentId: nodeSpec.id,
      }),
    );
    nodeIndexById.set(nodeSpec.id, index);
    nodeBaseStyles.set(nodeSpec.id, inferBaseStyle(nodeSpec));
  });

  const state: ForcePreviewState = {
    spec: ownedSpec,
    simulation: new ForceSimulation(nodes),
    nodeIndexById,
    nodeBaseStyles,
    nodeStyleOverrides: new Map(),
    tickCount: 0,
  };

  applySimulationConfig(state);
  clampStateNodes(state);
  return state;
}

function resolvedStyle(state: ForcePreviewState, nodeId: string): [ForceStyleName | null, ForceStyleName | null] {
  const override = state.nodeStyleOverrides.get(nodeId) ?? null;
  const baseStyle = state.nodeBaseStyles.get(nodeId) ?? null;
  return [override ?? baseStyle, override];
}

function getState(snapshot: ForceRuntimeSnapshot): ForcePreviewState {
  const state = runtimeStateBySnapshot.get(snapshot);
  if (!state) {
    throw new Error('Force runtime state is unavailable for this snapshot');
  }
  return state;
}

function getSnapshot(state: ForcePreviewState, snap = false): ForceRuntimeSnapshot {
  const currentCanvas = canvas(state.spec);
  const simConfig = normalizeSimulationSpec(state.spec);
  const render = normalizeRenderSpec(state.spec.render);

  clampStateNodes(state);

  const nodes: ForceRuntimeNode[] = state.spec.nodes.map((nodeSpec, index) => {
    const node = state.simulation.nodes[index]!;
    const [style, styleOverride] = resolvedStyle(state, node.componentId);
    const preset = style ? FORCE_BOX_STYLES[style] : null;
    const x = snap ? clampCoordinate(snapToGrid(node.x, BASELINE_UNIT), node.width / 2, currentCanvas.width) : node.x;
    const y = snap ? clampCoordinate(snapToGrid(node.y, BASELINE_UNIT), node.height / 2, currentCanvas.height) : node.y;
    const { fx: _authoredFx, fy: _authoredFy, ...nodeSpecWithoutPin } = nodeSpec;

    return {
      ...nodeSpecWithoutPin,
      x,
      y,
      width: node.width,
      height: node.height,
      ...(node.fx == null ? {} : { fx: node.fx }),
      ...(node.fy == null ? {} : { fy: node.fy }),
      fill: preset?.fill ?? nodeSpec.fill ?? DEFAULT_FILL,
      text_fill: preset?.text_fill ?? nodeSpec.text_fill ?? DEFAULT_TEXT_FILL,
      stroke: preset?.stroke ?? nodeSpec.stroke ?? DEFAULT_STROKE,
      stroke_width: Number(preset?.stroke_width ?? nodeSpec.stroke_width ?? 1),
      style,
      base_style: state.nodeBaseStyles.get(node.componentId) ?? null,
      style_override: styleOverride,
      vx: node.vx,
      vy: node.vy,
      label: [...nodeSpec.label],
    };
  });

  const links: ForceRuntimeLink[] = state.spec.links.map((linkSpec) => ({
    source: linkSpec.source,
    target: linkSpec.target,
    stroke: linkSpec.stroke ?? DEFAULT_LINK_STROKE,
    stroke_width: Number(linkSpec.stroke_width ?? 1),
    render: linkSpec.render ? { ...linkSpec.render } : undefined,
  }));

  const snapshot: ForceRuntimeSnapshot = {
    title: state.spec.title,
    reference_image: state.spec.reference_image,
    canvas: currentCanvas,
    render,
    definition_stale: false,
    simulation: {
      ...simConfig,
      alpha: state.simulation.alpha,
      alpha_min: state.simulation.alphaMin,
      tick_count: state.tickCount,
      settled: state.simulation.alpha < state.simulation.alphaMin || state.tickCount >= simConfig.max_iterations,
      params: simConfig,
    },
    nodes,
    links,
  };

  runtimeStateBySnapshot.set(snapshot, state);
  return snapshot;
}

function applyForceNodeUpdate(
  state: ForcePreviewState,
  nodeId: string,
  patch: ForceNodePatch,
  reheat: boolean,
): void {
  const index = state.nodeIndexById.get(nodeId);
  if (index == null) {
    throw new Error(`Unknown force node: ${nodeId}`);
  }

  const node = state.simulation.nodes[index]!;
  const nodeSpec = state.spec.nodes[index]!;
  let nodeChanged = false;

  if (patch.x != null) {
    node.x = Number(patch.x);
    node.vx = 0;
    nodeSpec.x = node.x;
    if (node.fx != null && patch.pinned == null) {
      node.fx = node.x;
    }
    nodeChanged = true;
  }

  if (patch.y != null) {
    node.y = Number(patch.y);
    node.vy = 0;
    nodeSpec.y = node.y;
    if (node.fy != null && patch.pinned == null) {
      node.fy = node.y;
    }
    nodeChanged = true;
  }

  if (patch.width != null) {
    node.width = Math.max(32, Number(patch.width));
    nodeSpec.width = node.width;
    nodeChanged = true;
  }

  if (patch.height != null) {
    node.height = Math.max(24, Number(patch.height));
    nodeSpec.height = node.height;
    nodeChanged = true;
  }

  if (patch.label != null) {
    nodeSpec.label = [...patch.label];
  }

  if (patch.pinned != null) {
    if (patch.pinned) {
      node.fx = Number(node.x);
      node.fy = Number(node.y);
      nodeSpec.fx = node.fx;
      nodeSpec.fy = node.fy;
    } else {
      node.fx = null;
      node.fy = null;
      delete nodeSpec.fx;
      delete nodeSpec.fy;
    }
    nodeChanged = true;
  }

  if (patch.style !== undefined) {
    const styleName = resolveStyleName(patch.style);
    if (styleName == null) {
      state.nodeStyleOverrides.delete(nodeId);
    } else {
      state.nodeStyleOverrides.set(nodeId, styleName);
    }
  }

  clampStateNodes(state);
  if (nodeChanged && reheat) {
    restartForceAnimation(state);
  }
}

export function createInitialForceSnapshot(spec: ForceAuthoredSpec): ForceRuntimeSnapshot {
  return getSnapshot(createForceState(spec));
}

export function applyForceNodePatch(
  snapshot: ForceRuntimeSnapshot,
  nodeId: string,
  patch: ForceNodePatch,
): ForceRuntimeSnapshot {
  const state = getState(snapshot);
  applyForceNodeUpdate(state, nodeId, patch, true);
  return getSnapshot(state);
}

export function updateForceSimulationParams(
  snapshot: ForceRuntimeSnapshot,
  patch: Partial<ForceSimulationConfig>,
): ForceRuntimeSnapshot {
  const state = getState(snapshot);
  const simulationSpec = state.spec.simulation;

  if (patch.alpha != null) simulationSpec.alpha = Number(patch.alpha);
  if (patch.alpha_min != null) simulationSpec.alpha_min = Number(patch.alpha_min);
  if (patch.alpha_decay != null) simulationSpec.alpha_decay = Number(patch.alpha_decay);
  if (patch.alpha_target != null) simulationSpec.alpha_target = Number(patch.alpha_target);
  if (patch.ticks_per_frame != null) simulationSpec.ticks_per_frame = Math.max(1, Math.floor(Number(patch.ticks_per_frame)));
  if (patch.max_iterations != null) simulationSpec.max_iterations = Math.max(1, Math.floor(Number(patch.max_iterations)));
  if (patch.charge_strength != null) simulationSpec.charge_strength = Number(patch.charge_strength);
  if (patch.link_distance != null) simulationSpec.link_distance = Number(patch.link_distance);
  if (patch.link_strength != null) simulationSpec.link_strength = Number(patch.link_strength);
  if (patch.link_iterations != null) simulationSpec.link_iterations = Math.max(1, Math.floor(Number(patch.link_iterations)));
  if (patch.collision_padding != null) simulationSpec.collision_padding = Number(patch.collision_padding);
  if (patch.collision_iterations != null) simulationSpec.collision_iterations = Math.max(1, Math.floor(Number(patch.collision_iterations)));
  if (patch.velocity_decay != null) simulationSpec.velocity_decay = Number(patch.velocity_decay);
  if (patch.center != null) simulationSpec.center = [Number(patch.center[0]), Number(patch.center[1])];

  applySimulationConfig(state);
  restartForceAnimation(state);
  return getSnapshot(state);
}

export function tickForceSimulation(
  snapshot: ForceRuntimeSnapshot,
  iterations?: number,
): ForceRuntimeSnapshot {
  const state = getState(snapshot);
  const simConfig = normalizeSimulationSpec(state.spec);
  const steps = Math.max(1, Math.floor(iterations ?? simConfig.ticks_per_frame));
  const remaining = Math.max(0, simConfig.max_iterations - state.tickCount);

  if (remaining === 0 || state.simulation.alpha < state.simulation.alphaMin) {
    return getSnapshot(state);
  }

  const actualSteps = Math.min(steps, remaining);
  state.simulation.tick(actualSteps);
  state.tickCount += actualSteps;
  clampStateNodes(state);
  return getSnapshot(state);
}

export function exportForceSnapshot(snapshot: ForceRuntimeSnapshot): ForceRuntimeSnapshot {
  return getSnapshot(getState(snapshot), true);
}