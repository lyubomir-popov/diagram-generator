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
    canvas: {
        width: number;
        height: number;
    };
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
    canvas: {
        width: number;
        height: number;
    };
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
export declare function createInitialForceSnapshot(spec: ForceAuthoredSpec): ForceRuntimeSnapshot;
export declare function applyForceNodePatch(snapshot: ForceRuntimeSnapshot, nodeId: string, patch: ForceNodePatch): ForceRuntimeSnapshot;
export declare function updateForceSimulationParams(snapshot: ForceRuntimeSnapshot, patch: Partial<ForceSimulationConfig>): ForceRuntimeSnapshot;
export declare function tickForceSimulation(snapshot: ForceRuntimeSnapshot, iterations?: number): ForceRuntimeSnapshot;
export declare function exportForceSnapshot(snapshot: ForceRuntimeSnapshot): ForceRuntimeSnapshot;
export declare function exportForceAuthoredSpec(snapshot: ForceRuntimeSnapshot, options?: {
    snap?: boolean;
}): ForceAuthoredSpec;
export {};
//# sourceMappingURL=force-runtime.d.ts.map