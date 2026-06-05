/**
 * Catalog of ELK layered layout options exposed to preview UI and YAML meta.elk.
 * Keys match elkjs / Eclipse ELK (prefix `elk.`).
 */

export type ElkParamKind = 'number' | 'enum' | 'boolean' | 'text';

export interface ElkParamSpec {
  /** Full ELK option key, e.g. elk.spacing.nodeNode */
  key: string;
  label: string;
  group: string;
  kind: ElkParamKind;
  defaultValue: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  enumValues?: { value: string; label: string }[];
}

/** All layered options we wire today — defaults match buildLayeredLayoutOptions(). */
export const ELK_LAYERED_PARAM_SPECS: ElkParamSpec[] = [
  {
    key: 'elk.direction',
    label: 'Direction',
    group: 'Graph',
    kind: 'enum',
    defaultValue: 'DOWN',
    enumValues: [
      { value: 'DOWN', label: 'Top → bottom (TB)' },
      { value: 'RIGHT', label: 'Left → right (LR)' },
      { value: 'UP', label: 'Bottom → top' },
      { value: 'LEFT', label: 'Right → left' },
    ],
    description: 'Primary flow direction for layered layout.',
  },
  {
    key: 'elk.layered.spacing.nodeNodeBetweenLayers',
    label: 'Layer gap',
    group: 'Spacing',
    kind: 'number',
    defaultValue: '96',
    min: 8,
    max: 512,
    step: 8,
    description: 'Vertical gap between layers — main control for arrow length (TB).',
  },
  {
    key: 'elk.spacing.nodeNode',
    label: 'Same-layer gap',
    group: 'Spacing',
    kind: 'number',
    defaultValue: '48',
    min: 8,
    max: 256,
    step: 8,
    description: 'Horizontal gap between nodes in the same layer.',
  },
  {
    key: 'elk.spacing.edgeNode',
    label: 'Edge ↔ node',
    group: 'Spacing',
    kind: 'number',
    defaultValue: '24',
    min: 0,
    max: 128,
    step: 4,
    description: 'Clearance between edge segments and node boxes (helps labels).',
  },
  {
    key: 'elk.spacing.edgeEdge',
    label: 'Edge ↔ edge',
    group: 'Spacing',
    kind: 'number',
    defaultValue: '32',
    min: 0,
    max: 128,
    step: 4,
    description: 'Gap between parallel edges — reduces overlap.',
  },
  {
    key: 'elk.layered.spacing.edgeEdgeBetweenLayers',
    label: 'Edge gap (layers)',
    group: 'Spacing',
    kind: 'number',
    defaultValue: '32',
    min: 0,
    max: 128,
    step: 4,
    description: 'Gap between edges that span adjacent layers.',
  },
  {
    key: 'elk.edgeRouting',
    label: 'Edge routing',
    group: 'Edges',
    kind: 'enum',
    defaultValue: 'ORTHOGONAL',
    enumValues: [
      { value: 'ORTHOGONAL', label: 'Orthogonal' },
      { value: 'POLYLINE', label: 'Polyline' },
      { value: 'SPLINES', label: 'Splines' },
    ],
  },
  {
    key: 'elk.layered.unnecessaryBendpoints',
    label: 'Remove extra bends',
    group: 'Edges',
    kind: 'boolean',
    defaultValue: 'true',
    description: 'Drop bend points that do not change routing.',
  },
  {
    key: 'elk.layered.nodePlacement.favorStraightEdges',
    label: 'Favor straight edges',
    group: 'Edges',
    kind: 'boolean',
    defaultValue: 'true',
  },
  {
    key: 'elk.layered.layering.strategy',
    label: 'Layering strategy',
    group: 'Layering',
    kind: 'enum',
    defaultValue: 'NETWORK_SIMPLEX',
    enumValues: [
      { value: 'NETWORK_SIMPLEX', label: 'Network simplex' },
      { value: 'LONGEST_PATH', label: 'Longest path' },
      { value: 'INTERACTIVE', label: 'Interactive' },
    ],
  },
  {
    key: 'elk.layered.crossingMinimization.strategy',
    label: 'Crossing minimization',
    group: 'Layering',
    kind: 'enum',
    defaultValue: 'LAYER_SWEEP',
    enumValues: [
      { value: 'LAYER_SWEEP', label: 'Layer sweep' },
      { value: 'INTERACTIVE', label: 'Interactive' },
    ],
  },
  {
    key: 'elk.layered.nodePlacement.strategy',
    label: 'Node placement',
    group: 'Layering',
    kind: 'enum',
    defaultValue: 'NETWORK_SIMPLEX',
    enumValues: [
      { value: 'NETWORK_SIMPLEX', label: 'Network simplex' },
      { value: 'BRANDES_KOEPF', label: 'Brandes-Köpf' },
      { value: 'LINEAR_SEGMENTS', label: 'Linear segments' },
      { value: 'SIMPLE', label: 'Simple' },
    ],
  },
  {
    key: 'elk.hierarchyHandling',
    label: 'Hierarchy handling',
    group: 'Compound',
    kind: 'enum',
    defaultValue: 'INCLUDE_CHILDREN',
    enumValues: [
      { value: 'INCLUDE_CHILDREN', label: 'Include children' },
      { value: 'SEPARATE_CHILDREN', label: 'Separate children' },
      { value: 'CHILDREN_ON', label: 'Children on' },
    ],
  },
  {
    key: 'elk.portConstraints',
    label: 'Port constraints',
    group: 'Compound',
    kind: 'enum',
    defaultValue: 'FREE',
    enumValues: [
      { value: 'FREE', label: 'Free' },
      { value: 'FIXED_SIDE', label: 'Fixed side' },
      { value: 'FIXED_ORDER', label: 'Fixed order' },
      { value: 'FIXED_RATIO', label: 'Fixed ratio' },
    ],
  },
  {
    key: 'elk.padding',
    label: 'Compound padding',
    group: 'Compound',
    kind: 'text',
    defaultValue: '[top=32,left=8,bottom=8,right=8]',
    description: 'ELK padding string for compound nodes.',
  },
];

export function elkParamDefaults(): Record<string, string> {
  const out: Record<string, string> = { 'elk.algorithm': 'layered' };
  for (const spec of ELK_LAYERED_PARAM_SPECS) {
    out[spec.key] = spec.defaultValue;
  }
  return out;
}

export function elkParamSpecByKey(): Map<string, ElkParamSpec> {
  return new Map(ELK_LAYERED_PARAM_SPECS.map((s) => [s.key, s]));
}

/** Merge family defaults + YAML/session overrides into ELK layoutOptions map. */
export function resolveElkLayoutOptions(
  baseOptions: Record<string, string>,
  userOverrides?: Record<string, string | null | undefined>,
): Record<string, string> {
  const merged = { ...baseOptions };
  if (!userOverrides) return merged;
  for (const [key, raw] of Object.entries(userOverrides)) {
    if (raw == null || raw === '') {
      delete merged[key];
      continue;
    }
    merged[key] = String(raw);
  }
  return merged;
}
