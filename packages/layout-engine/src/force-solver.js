import { Quadtree } from './force-quadtree.js';
export const BASELINE_UNIT = 8;
const LCG_A = 1664525;
const LCG_C = 1013904223;
const LCG_M = 4294967296;
export function lcg() {
    let state = 1;
    return () => {
        state = (LCG_A * state + LCG_C) % LCG_M;
        return state / LCG_M;
    };
}
export function jiggle(random) {
    return (random() - 0.5) * 1e-6;
}
export class ForceNode {
    index = 0;
    x = 0;
    y = 0;
    vx = 0;
    vy = 0;
    fx = null;
    fy = null;
    width = 192;
    height = 64;
    componentId = '';
    constructor(init = {}) {
        Object.assign(this, init);
    }
}
export class ForceLink {
    index = 0;
    source = 0;
    target = 0;
    arrowIndex = -1;
    constructor(init = {}) {
        Object.assign(this, init);
    }
}
function isInternalQuad(node) {
    return Array.isArray(node);
}
export class ForceCenter {
    _x;
    _y;
    _strength = 1;
    _nodes = [];
    constructor(x = 0, y = 0) {
        this._x = x;
        this._y = y;
    }
    initialize(nodes) {
        this._nodes = nodes;
    }
    apply() {
        const nodes = this._nodes;
        const count = nodes.length;
        if (count === 0) {
            return;
        }
        let sx = 0;
        let sy = 0;
        for (const node of nodes) {
            sx += node.x;
            sy += node.y;
        }
        sx = (sx / count - this._x) * this._strength;
        sy = (sy / count - this._y) * this._strength;
        for (const node of nodes) {
            node.x -= sx;
            node.y -= sy;
        }
    }
    x(value) {
        this._x = value;
        return this;
    }
    y(value) {
        this._y = value;
        return this;
    }
    strength(value) {
        this._strength = value;
        return this;
    }
}
export class ForceManyBody {
    _strengthFn = () => -30;
    _strengths = [];
    _distanceMin2 = 1;
    _distanceMax2 = Number.POSITIVE_INFINITY;
    _theta2 = 0.81;
    _nodes = [];
    _random = lcg();
    initialize(nodes, random) {
        this._nodes = nodes;
        this._random = random;
        this.initStrength();
    }
    initStrength() {
        this._strengths = this._nodes.map((node, index, nodes) => this._strengthFn(node, index, nodes));
    }
    apply(alpha) {
        const nodes = this._nodes;
        if (nodes.length === 0) {
            return;
        }
        const tree = new Quadtree(undefined, undefined, nodes);
        const acc = new WeakMap();
        tree.visitAfter((quad) => {
            if (quad === null) {
                return;
            }
            let strengthSum = 0;
            let weight = 0;
            let cx = 0;
            let cy = 0;
            if (isInternalQuad(quad)) {
                for (let index = 0; index < 4; index += 1) {
                    const child = quad[index];
                    if (child !== null) {
                        const entry = acc.get(child);
                        if (entry) {
                            const magnitude = Math.abs(entry.value);
                            if (magnitude) {
                                strengthSum += entry.value;
                                weight += magnitude;
                                cx += magnitude * entry.cx;
                                cy += magnitude * entry.cy;
                            }
                        }
                    }
                }
                if (weight) {
                    cx /= weight;
                    cy /= weight;
                }
            }
            else {
                cx = quad.data.x;
                cy = quad.data.y;
                let leaf = quad;
                while (leaf !== null) {
                    strengthSum += this._strengths[leaf.data.index] ?? 0;
                    leaf = leaf.next;
                }
            }
            acc.set(quad, { value: strengthSum, cx, cy });
        });
        for (let index = 0; index < nodes.length; index += 1) {
            const node = nodes[index];
            tree.visit((quad, x0, y0, x1, y1) => {
                if (quad === null) {
                    return true;
                }
                const entry = acc.get(quad);
                if (!entry || !entry.value) {
                    return true;
                }
                let dx = entry.cx - node.x;
                let dy = entry.cy - node.y;
                const width = x1 - x0;
                let length = dx * dx + dy * dy;
                if ((width * width) / this._theta2 < length) {
                    if (length < this._distanceMax2) {
                        if (dx === 0) {
                            dx = jiggle(this._random);
                            length += dx * dx;
                        }
                        if (dy === 0) {
                            dy = jiggle(this._random);
                            length += dy * dy;
                        }
                        if (length < this._distanceMin2) {
                            length = Math.sqrt(this._distanceMin2 * length);
                        }
                        node.vx += (dx * entry.value * alpha) / length;
                        node.vy += (dy * entry.value * alpha) / length;
                    }
                    return true;
                }
                if (isInternalQuad(quad) || length >= this._distanceMax2) {
                    return false;
                }
                let leafNode = quad;
                if (leafNode.data !== node || leafNode.next !== null) {
                    if (dx === 0) {
                        dx = jiggle(this._random);
                        length += dx * dx;
                    }
                    if (dy === 0) {
                        dy = jiggle(this._random);
                        length += dy * dy;
                    }
                    if (length < this._distanceMin2) {
                        length = Math.sqrt(this._distanceMin2 * length);
                    }
                }
                while (leafNode !== null) {
                    if (leafNode.data !== node) {
                        const weight = ((this._strengths[leafNode.data.index] ?? 0) * alpha) / length;
                        node.vx += dx * weight;
                        node.vy += dy * weight;
                    }
                    leafNode = leafNode.next;
                }
                return false;
            });
        }
    }
    strength(value) {
        this._strengthFn = typeof value === 'function' ? value : () => value;
        this.initStrength();
        return this;
    }
    distanceMin(value) {
        this._distanceMin2 = value * value;
        return this;
    }
    distanceMax(value) {
        this._distanceMax2 = value * value;
        return this;
    }
    theta(value) {
        this._theta2 = value * value;
        return this;
    }
}
export class ForceCollideRect {
    _padding;
    _strength = 1;
    _iterations = 1;
    _nodes = [];
    _random = lcg();
    constructor(padding = 0) {
        this._padding = padding;
    }
    initialize(nodes, random) {
        this._nodes = nodes;
        this._random = random;
    }
    apply() {
        const nodes = this._nodes;
        if (nodes.length === 0) {
            return;
        }
        for (let iteration = 0; iteration < this._iterations; iteration += 1) {
            const tree = new Quadtree((datum) => datum.x + datum.vx, (datum) => datum.y + datum.vy, nodes);
            const hwMap = new WeakMap();
            const hhMap = new WeakMap();
            tree.visitAfter((quad) => {
                if (quad === null) {
                    return;
                }
                if (!isInternalQuad(quad)) {
                    hwMap.set(quad, quad.data.width / 2 + this._padding);
                    hhMap.set(quad, quad.data.height / 2 + this._padding);
                    return;
                }
                let maxHalfWidth = 0;
                let maxHalfHeight = 0;
                for (let childIndex = 0; childIndex < 4; childIndex += 1) {
                    const child = quad[childIndex];
                    if (child !== null) {
                        maxHalfWidth = Math.max(maxHalfWidth, hwMap.get(child) ?? 0);
                        maxHalfHeight = Math.max(maxHalfHeight, hhMap.get(child) ?? 0);
                    }
                }
                hwMap.set(quad, maxHalfWidth);
                hhMap.set(quad, maxHalfHeight);
            });
            for (let index = 0; index < nodes.length; index += 1) {
                const ni = nodes[index];
                const halfWidthI = ni.width / 2 + this._padding;
                const halfHeightI = ni.height / 2 + this._padding;
                const xi = ni.x + ni.vx;
                const yi = ni.y + ni.vy;
                tree.visit((quad, x0, y0, x1, y1) => {
                    if (quad === null) {
                        return true;
                    }
                    if (!isInternalQuad(quad)) {
                        let leaf = quad;
                        while (leaf !== null) {
                            const data = leaf.data;
                            if (data.index > ni.index) {
                                const halfWidthJ = data.width / 2 + this._padding;
                                const halfHeightJ = data.height / 2 + this._padding;
                                let dx = xi - data.x - data.vx;
                                let dy = yi - data.y - data.vy;
                                const overlapX = halfWidthI + halfWidthJ - Math.abs(dx);
                                const overlapY = halfHeightI + halfHeightJ - Math.abs(dy);
                                if (overlapX > 0 && overlapY > 0) {
                                    if (overlapX < overlapY) {
                                        if (dx === 0) {
                                            dx = jiggle(this._random);
                                        }
                                        const sign = dx > 0 ? 1 : -1;
                                        const push = overlapX * this._strength * 0.5 * sign;
                                        ni.vx += push;
                                        data.vx -= push;
                                    }
                                    else {
                                        if (dy === 0) {
                                            dy = jiggle(this._random);
                                        }
                                        const sign = dy > 0 ? 1 : -1;
                                        const push = overlapY * this._strength * 0.5 * sign;
                                        ni.vy += push;
                                        data.vy -= push;
                                    }
                                }
                            }
                            leaf = leaf.next;
                        }
                        return true;
                    }
                    const maxHalfWidth = hwMap.get(quad) ?? 0;
                    const maxHalfHeight = hhMap.get(quad) ?? 0;
                    const reachWidth = halfWidthI + maxHalfWidth;
                    const reachHeight = halfHeightI + maxHalfHeight;
                    if (x0 > xi + reachWidth || x1 < xi - reachWidth || y0 > yi + reachHeight || y1 < yi - reachHeight) {
                        return true;
                    }
                    return false;
                });
            }
        }
    }
    padding(value) {
        this._padding = value;
        return this;
    }
    strength(value) {
        this._strength = value;
        return this;
    }
    iterations(value) {
        this._iterations = value;
        return this;
    }
}
export class ForceLinkForce {
    _links;
    _idFn = (node) => node.index;
    _strengthFn = null;
    _distanceFn = () => 30;
    _strengths = [];
    _distances = [];
    _bias = [];
    _count = [];
    _nodes = [];
    _random = lcg();
    _iterations = 1;
    constructor(links = []) {
        this._links = links;
    }
    defaultStrength(link) {
        return 1 / Math.min(this._count[link.source.index], this._count[link.target.index]);
    }
    initialize(nodes, random) {
        this._nodes = nodes;
        this._random = random;
        this.initLinks();
    }
    initLinks() {
        const nodes = this._nodes;
        if (nodes.length === 0) {
            return;
        }
        const nodeById = new Map();
        nodes.forEach((node, index) => {
            nodeById.set(this._idFn(node, index, nodes), node);
        });
        this._count = new Array(nodes.length).fill(0);
        this._links.forEach((link, index) => {
            link.index = index;
            if (!(link.source instanceof ForceNode)) {
                link.source = nodeById.get(link.source);
            }
            if (!(link.target instanceof ForceNode)) {
                link.target = nodeById.get(link.target);
            }
            this._count[link.source.index] += 1;
            this._count[link.target.index] += 1;
        });
        this._bias = new Array(this._links.length).fill(0);
        this._links.forEach((link, index) => {
            this._bias[index] = this._count[link.source.index] /
                (this._count[link.source.index] + this._count[link.target.index]);
        });
        const strengthFn = this._strengthFn ?? ((link) => this.defaultStrength(link));
        this._strengths = this._links.map((link, index, links) => strengthFn(link, index, links));
        this._distances = this._links.map((link, index, links) => this._distanceFn(link, index, links));
    }
    apply(alpha) {
        for (let iteration = 0; iteration < this._iterations; iteration += 1) {
            this._links.forEach((link, index) => {
                const source = link.source;
                const target = link.target;
                let dx = target.x + target.vx - source.x - source.vx;
                let dy = target.y + target.vy - source.y - source.vy;
                if (dx === 0) {
                    dx = jiggle(this._random);
                }
                if (dy === 0) {
                    dy = jiggle(this._random);
                }
                let length = Math.sqrt(dx * dx + dy * dy);
                length = ((length - this._distances[index]) / length) * alpha * this._strengths[index];
                dx *= length;
                dy *= length;
                const bias = this._bias[index];
                target.vx -= dx * bias;
                target.vy -= dy * bias;
                source.vx += dx * (1 - bias);
                source.vy += dy * (1 - bias);
            });
        }
    }
    links(value) {
        this._links = value;
        this.initLinks();
        return this;
    }
    id(fn) {
        this._idFn = fn;
        return this;
    }
    iterations(value) {
        this._iterations = value;
        return this;
    }
    strength(value) {
        this._strengthFn = typeof value === 'function' ? value : () => value;
        if (this._nodes.length > 0) {
            const strengthFn = this._strengthFn;
            this._strengths = this._links.map((link, index, links) => strengthFn(link, index, links));
        }
        return this;
    }
    distance(value) {
        this._distanceFn = typeof value === 'function' ? value : () => value;
        if (this._nodes.length > 0) {
            this._distances = this._links.map((link, index, links) => this._distanceFn(link, index, links));
        }
        return this;
    }
}
export class ForceSimulation {
    static INITIAL_RADIUS = 10;
    static INITIAL_ANGLE = Math.PI * (3 - Math.sqrt(5));
    _nodes;
    _alpha = 1;
    _alphaMin = 0.001;
    _alphaDecay = 1 - Math.pow(this._alphaMin, 1 / 300);
    _alphaTarget = 0;
    _velocityDecay = 0.6;
    _forces = new Map();
    _random = lcg();
    constructor(nodes = []) {
        this._nodes = nodes;
        this.initializeNodes();
    }
    initializeNodes() {
        this._nodes.forEach((node, index) => {
            node.index = index;
            if (node.fx != null) {
                node.x = node.fx;
            }
            if (node.fy != null) {
                node.y = node.fy;
            }
            if (Number.isNaN(node.x) || Number.isNaN(node.y)) {
                const radius = ForceSimulation.INITIAL_RADIUS * Math.sqrt(0.5 + index);
                const angle = index * ForceSimulation.INITIAL_ANGLE;
                node.x = radius * Math.cos(angle);
                node.y = radius * Math.sin(angle);
            }
            if (Number.isNaN(node.vx) || Number.isNaN(node.vy)) {
                node.vx = 0;
                node.vy = 0;
            }
        });
    }
    initializeForce(force) {
        force.initialize?.(this._nodes, this._random);
        return force;
    }
    tick(iterations = 1) {
        for (let iteration = 0; iteration < iterations; iteration += 1) {
            this._alpha += (this._alphaTarget - this._alpha) * this._alphaDecay;
            for (const force of this._forces.values()) {
                force.apply(this._alpha);
            }
            for (const node of this._nodes) {
                if (node.fx == null) {
                    node.vx *= this._velocityDecay;
                    node.x += node.vx;
                }
                else {
                    node.x = node.fx;
                    node.vx = 0;
                }
                if (node.fy == null) {
                    node.vy *= this._velocityDecay;
                    node.y += node.vy;
                }
                else {
                    node.y = node.fy;
                    node.vy = 0;
                }
            }
        }
        return this;
    }
    run(maxIterations = 300) {
        for (let iteration = 0; iteration < maxIterations; iteration += 1) {
            if (this._alpha < this._alphaMin) {
                break;
            }
            this.tick();
        }
        return this;
    }
    find(x, y, radius) {
        let best = null;
        let bestDistance2 = radius != null ? radius * radius : Number.POSITIVE_INFINITY;
        for (const node of this._nodes) {
            const dx = x - node.x;
            const dy = y - node.y;
            const distance2 = dx * dx + dy * dy;
            if (distance2 < bestDistance2) {
                best = node;
                bestDistance2 = distance2;
            }
        }
        return best;
    }
    get nodes() {
        return this._nodes;
    }
    set nodes(value) {
        this._nodes = value;
        this.initializeNodes();
        for (const force of this._forces.values()) {
            this.initializeForce(force);
        }
    }
    get alpha() {
        return this._alpha;
    }
    set alpha(value) {
        this._alpha = value;
    }
    get alphaMin() {
        return this._alphaMin;
    }
    set alphaMin(value) {
        this._alphaMin = value;
    }
    get alphaDecay() {
        return this._alphaDecay;
    }
    set alphaDecay(value) {
        this._alphaDecay = value;
    }
    get alphaTarget() {
        return this._alphaTarget;
    }
    set alphaTarget(value) {
        this._alphaTarget = value;
    }
    get velocityDecay() {
        return 1 - this._velocityDecay;
    }
    set velocityDecay(value) {
        this._velocityDecay = 1 - value;
    }
    force(name, force) {
        if (force === undefined) {
            return this._forces.get(name);
        }
        if (force === false) {
            this._forces.delete(name);
            return this;
        }
        this._forces.set(name, this.initializeForce(force));
        return this;
    }
}
export function snapToGrid(value, unit = BASELINE_UNIT) {
    return Math.round(value / unit) * unit;
}
//# sourceMappingURL=force-solver.js.map