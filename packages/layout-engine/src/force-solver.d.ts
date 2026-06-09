export declare const BASELINE_UNIT = 8;
export declare function lcg(): () => number;
export declare function jiggle(random: () => number): number;
export declare class ForceNode {
    index: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    fx: number | null;
    fy: number | null;
    width: number;
    height: number;
    componentId: string;
    constructor(init?: Partial<ForceNode>);
}
export declare class ForceLink {
    index: number;
    source: ForceNode | number | string;
    target: ForceNode | number | string;
    arrowIndex: number;
    constructor(init?: Partial<ForceLink>);
}
export interface ForceApplier {
    initialize?(nodes: ForceNode[], random: () => number): void;
    apply(alpha: number): void;
}
type NodeStrengthFn = (node: ForceNode, index: number, nodes: ForceNode[]) => number;
type LinkIdFn = (node: ForceNode, index: number, nodes: ForceNode[]) => unknown;
type LinkStrengthFn = (link: ForceLink, index: number, links: ForceLink[]) => number;
type LinkDistanceFn = (link: ForceLink, index: number, links: ForceLink[]) => number;
export declare class ForceCenter implements ForceApplier {
    private _x;
    private _y;
    private _strength;
    private _nodes;
    constructor(x?: number, y?: number);
    initialize(nodes: ForceNode[]): void;
    apply(): void;
    x(value: number): ForceCenter;
    y(value: number): ForceCenter;
    strength(value: number): ForceCenter;
}
export declare class ForceManyBody implements ForceApplier {
    private _strengthFn;
    private _strengths;
    private _distanceMin2;
    private _distanceMax2;
    private _theta2;
    private _nodes;
    private _random;
    initialize(nodes: ForceNode[], random: () => number): void;
    private initStrength;
    apply(alpha: number): void;
    strength(value: number | NodeStrengthFn): ForceManyBody;
    distanceMin(value: number): ForceManyBody;
    distanceMax(value: number): ForceManyBody;
    theta(value: number): ForceManyBody;
}
export declare class ForceCollideRect implements ForceApplier {
    private _padding;
    private _strength;
    private _iterations;
    private _nodes;
    private _random;
    constructor(padding?: number);
    initialize(nodes: ForceNode[], random: () => number): void;
    apply(): void;
    padding(value: number): ForceCollideRect;
    strength(value: number): ForceCollideRect;
    iterations(value: number): ForceCollideRect;
}
export declare class ForceLinkForce implements ForceApplier {
    private _links;
    private _idFn;
    private _strengthFn;
    private _distanceFn;
    private _strengths;
    private _distances;
    private _bias;
    private _count;
    private _nodes;
    private _random;
    private _iterations;
    constructor(links?: ForceLink[]);
    private defaultStrength;
    initialize(nodes: ForceNode[], random: () => number): void;
    private initLinks;
    apply(alpha: number): void;
    links(value: ForceLink[]): ForceLinkForce;
    id(fn: LinkIdFn): ForceLinkForce;
    iterations(value: number): ForceLinkForce;
    strength(value: number | LinkStrengthFn): ForceLinkForce;
    distance(value: number | LinkDistanceFn): ForceLinkForce;
}
export declare class ForceSimulation {
    private static readonly INITIAL_RADIUS;
    private static readonly INITIAL_ANGLE;
    private _nodes;
    private _alpha;
    private _alphaMin;
    private _alphaDecay;
    private _alphaTarget;
    private _velocityDecay;
    private _forces;
    private _random;
    constructor(nodes?: ForceNode[]);
    private initializeNodes;
    private initializeForce;
    tick(iterations?: number): ForceSimulation;
    run(maxIterations?: number): ForceSimulation;
    find(x: number, y: number, radius?: number): ForceNode | null;
    get nodes(): ForceNode[];
    set nodes(value: ForceNode[]);
    get alpha(): number;
    set alpha(value: number);
    get alphaMin(): number;
    set alphaMin(value: number);
    get alphaDecay(): number;
    set alphaDecay(value: number);
    get alphaTarget(): number;
    set alphaTarget(value: number);
    get velocityDecay(): number;
    set velocityDecay(value: number);
    force(name: string): ForceApplier | undefined;
    force(name: string, force: ForceApplier | false): this;
}
export declare function snapToGrid(value: number, unit?: number): number;
export {};
//# sourceMappingURL=force-solver.d.ts.map