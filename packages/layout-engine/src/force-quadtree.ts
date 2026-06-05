export type QuadtreeAccessor<T> = (datum: T) => number;

export class QuadLeaf<T> {
  constructor(
    public data: T,
    public next: QuadLeaf<T> | null = null,
  ) {}
}

class TraversalQuad<T> {
  constructor(
    public node: QuadtreeNode<T> | null,
    public x0: number,
    public y0: number,
    public x1: number,
    public y1: number,
  ) {}
}

export type QuadtreeInternalNode<T> = [
  QuadtreeNode<T> | null,
  QuadtreeNode<T> | null,
  QuadtreeNode<T> | null,
  QuadtreeNode<T> | null,
];

export type QuadtreeNode<T> = QuadLeaf<T> | QuadtreeInternalNode<T>;

function defaultX(datum: { x: number }): number {
  return datum.x;
}

function defaultY(datum: { y: number }): number {
  return datum.y;
}

function createInternalNode<T>(): QuadtreeInternalNode<T> {
  return [null, null, null, null];
}

function isInternalNode<T>(node: QuadtreeNode<T> | null | undefined): node is QuadtreeInternalNode<T> {
  return Array.isArray(node);
}

function leafCopy<T>(leaf: QuadLeaf<T>): QuadLeaf<T> {
  const copy = new QuadLeaf(leaf.data);
  let current = copy;
  let source = leaf.next;
  while (source !== null) {
    current.next = new QuadLeaf(source.data);
    current = current.next;
    source = source.next;
  }
  return copy;
}

function addDatum<T extends { x: number; y: number }>(tree: Quadtree<T>, x: number, y: number, datum: T): Quadtree<T> {
  if (Number.isNaN(x) || Number.isNaN(y)) {
    return tree;
  }

  let node = tree._root;
  const leaf = new QuadLeaf(datum);
  let x0 = tree._x0;
  let y0 = tree._y0;
  let x1 = tree._x1;
  let y1 = tree._y1;

  if (node === null) {
    tree._root = leaf;
    return tree;
  }

  let parent: QuadtreeInternalNode<T> | null = null;
  let i = 0;
  while (isInternalNode(node)) {
    const xm = (x0 + x1) / 2;
    const right = Number(x >= xm);
    if (right) {
      x0 = xm;
    } else {
      x1 = xm;
    }

    const ym = (y0 + y1) / 2;
    const bottom = Number(y >= ym);
    if (bottom) {
      y0 = ym;
    } else {
      y1 = ym;
    }

    parent = node;
    i = (bottom << 1) | right;
    node = parent[i] ?? null;
    if (node === null) {
      parent[i] = leaf;
      return tree;
    }
  }

  const xp = tree._x(node.data);
  const yp = tree._y(node.data);
  if (x === xp && y === yp) {
    leaf.next = node;
    if (parent !== null) {
      parent[i] = leaf;
    } else {
      tree._root = leaf;
    }
    return tree;
  }

  while (true) {
    if (parent !== null) {
      const newInternal = createInternalNode<T>();
      parent[i] = newInternal;
      parent = newInternal;
    } else {
      parent = createInternalNode<T>();
      tree._root = parent;
    }

    const xm = (x0 + x1) / 2;
    const right = Number(x >= xm);
    if (right) {
      x0 = xm;
    } else {
      x1 = xm;
    }

    const ym = (y0 + y1) / 2;
    const bottom = Number(y >= ym);
    if (bottom) {
      y0 = ym;
    } else {
      y1 = ym;
    }

    i = (bottom << 1) | right;
    const j = (Number(yp >= ym) << 1) | Number(xp >= xm);
    if (i !== j) {
      parent[j] = node;
      parent[i] = leaf;
      return tree;
    }
  }
}

export class Quadtree<T extends { x: number; y: number }> {
  _x: QuadtreeAccessor<T>;
  _y: QuadtreeAccessor<T>;
  _x0 = Number.NaN;
  _y0 = Number.NaN;
  _x1 = Number.NaN;
  _y1 = Number.NaN;
  _root: QuadtreeNode<T> | null = null;

  constructor(
    x?: QuadtreeAccessor<T>,
    y?: QuadtreeAccessor<T>,
    data?: Iterable<T>,
  ) {
    this._x = x ?? (defaultX as QuadtreeAccessor<T>);
    this._y = y ?? (defaultY as QuadtreeAccessor<T>);
    if (data != null) {
      this.addAll(data);
    }
  }

  cover(x: number, y: number): Quadtree<T> {
    x = Number(x);
    y = Number(y);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      return this;
    }

    let x0 = this._x0;
    let y0 = this._y0;
    let x1 = this._x1;
    let y1 = this._y1;

    if (Number.isNaN(x0)) {
      x0 = Math.floor(x);
      x1 = x0 + 1;
      y0 = Math.floor(y);
      y1 = y0 + 1;
    } else {
      let z = x1 - x0 || 1;
      let node = this._root;
      while (x0 > x || x >= x1 || y0 > y || y >= y1) {
        const i = (Number(y < y0) << 1) | Number(x < x0);
        const parent = createInternalNode<T>();
        parent[i] = node;
        node = parent;
        z *= 2;

        if (i === 0) {
          x1 = x0 + z;
          y1 = y0 + z;
        } else if (i === 1) {
          x0 = x1 - z;
          y1 = y0 + z;
        } else if (i === 2) {
          x1 = x0 + z;
          y0 = y1 - z;
        } else {
          x0 = x1 - z;
          y0 = y1 - z;
        }
      }

      if (this._root !== null && isInternalNode(this._root)) {
        this._root = node;
      }
    }

    this._x0 = x0;
    this._y0 = y0;
    this._x1 = x1;
    this._y1 = y1;
    return this;
  }

  add(datum: T): Quadtree<T> {
    const x = this._x(datum);
    const y = this._y(datum);
    return addDatum(this.cover(x, y), x, y, datum);
  }

  addAll(data: Iterable<T>): Quadtree<T> {
    const items = Array.isArray(data) ? data : Array.from(data);
    const count = items.length;
    const xz = new Array<number>(count).fill(0);
    const yz = new Array<number>(count).fill(0);
    let x0 = Number.POSITIVE_INFINITY;
    let y0 = Number.POSITIVE_INFINITY;
    let x1 = Number.NEGATIVE_INFINITY;
    let y1 = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < count; index += 1) {
      const datum = items[index];
      const xi = this._x(datum);
      const yi = this._y(datum);
      if (Number.isNaN(xi) || Number.isNaN(yi)) {
        continue;
      }
      xz[index] = xi;
      yz[index] = yi;
      if (xi < x0) x0 = xi;
      if (xi > x1) x1 = xi;
      if (yi < y0) y0 = yi;
      if (yi > y1) y1 = yi;
    }

    if (x0 > x1 || y0 > y1) {
      return this;
    }

    this.cover(x0, y0).cover(x1, y1);

    for (let index = 0; index < count; index += 1) {
      addDatum(this, xz[index]!, yz[index]!, items[index]!);
    }

    return this;
  }

  remove(datum: T): Quadtree<T> {
    const x = this._x(datum);
    const y = this._y(datum);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      return this;
    }

    let node = this._root;
    if (node === null) {
      return this;
    }

    let parent: QuadtreeInternalNode<T> | null = null;
    let retainer: QuadtreeInternalNode<T> | null = null;
    let previous: QuadLeaf<T> | null = null;
    let x0 = this._x0;
    let y0 = this._y0;
    let x1 = this._x1;
    let y1 = this._y1;
    let i = 0;
    let j = 0;

    if (isInternalNode(node)) {
      while (true) {
        const xm = (x0 + x1) / 2;
        const right = Number(x >= xm);
        if (right) {
          x0 = xm;
        } else {
          x1 = xm;
        }

        const ym = (y0 + y1) / 2;
        const bottom = Number(y >= ym);
        if (bottom) {
          y0 = ym;
        } else {
          y1 = ym;
        }

        parent = node;
        i = (bottom << 1) | right;
        node = parent[i] ?? null;
        if (node === null) {
          return this;
        }
        if (!isInternalNode(node)) {
          break;
        }
        if (parent[(i + 1) & 3] || parent[(i + 2) & 3] || parent[(i + 3) & 3]) {
          retainer = parent;
          j = i;
        }
      }
    }

    while (node.data !== datum) {
      previous = node;
      node = node.next;
      if (node === null) {
        return this;
      }
    }

    const nextNode = node.next;
    node.next = null;

    if (previous !== null) {
      previous.next = nextNode;
      return this;
    }

    if (parent === null) {
      this._root = nextNode;
      return this;
    }

    parent[i] = nextNode;

    const collapsed = parent[0] || parent[1] || parent[2] || parent[3];
    if (
      collapsed !== null &&
      collapsed === (parent[3] || parent[2] || parent[1] || parent[0]) &&
      !isInternalNode(collapsed)
    ) {
      if (retainer !== null) {
        retainer[j] = collapsed;
      } else {
        this._root = collapsed;
      }
    }

    return this;
  }

  removeAll(data: Iterable<T>): Quadtree<T> {
    for (const datum of data) {
      this.remove(datum);
    }
    return this;
  }

  find(x: number, y: number, radius?: number): T | null {
    let data: T | null = null;
    let x0 = this._x0;
    let y0 = this._y0;
    let x3 = this._x1;
    let y3 = this._y1;
    const quads: TraversalQuad<T>[] = [];
    const node = this._root;

    if (node !== null) {
      quads.push(new TraversalQuad(node, x0, y0, x3, y3));
    }

    let radiusSq = Number.POSITIVE_INFINITY;
    if (radius != null) {
      x0 = x - radius;
      y0 = y - radius;
      x3 = x + radius;
      y3 = y + radius;
      radiusSq = radius * radius;
    }

    while (quads.length > 0) {
      const quad = quads.pop()!;
      const current = quad.node;
      const qx0 = quad.x0;
      const qy0 = quad.y0;
      const qx1 = quad.x1;
      const qy1 = quad.y1;

      if (qx0 > x3 || qy0 > y3 || qx1 < x0 || qy1 < y0) {
        continue;
      }

      if (isInternalNode(current)) {
        const xm = (qx0 + qx1) / 2;
        const ym = (qy0 + qy1) / 2;

        quads.push(new TraversalQuad(current[3] ?? null, xm, ym, qx1, qy1));
        quads.push(new TraversalQuad(current[2] ?? null, qx0, ym, xm, qy1));
        quads.push(new TraversalQuad(current[1] ?? null, xm, qy0, qx1, ym));
        quads.push(new TraversalQuad(current[0] ?? null, qx0, qy0, xm, ym));

        const i = (Number(y >= ym) << 1) | Number(x >= xm);
        if (i) {
          const swap = quads[quads.length - 1]!;
          quads[quads.length - 1] = quads[quads.length - 1 - i]!;
          quads[quads.length - 1 - i] = swap;
        }
      } else if (current !== null) {
        const dx = x - this._x(current.data);
        const dy = y - this._y(current.data);
        const d2 = dx * dx + dy * dy;
        if (d2 < radiusSq) {
          const d = Math.sqrt(d2);
          radiusSq = d2;
          x0 = x - d;
          y0 = y - d;
          x3 = x + d;
          y3 = y + d;
          data = current.data;
        }
      }
    }

    return data;
  }

  visit(callback: (node: QuadtreeNode<T> | null, x0: number, y0: number, x1: number, y1: number) => boolean | void): Quadtree<T> {
    const quads: TraversalQuad<T>[] = [];
    if (this._root !== null) {
      quads.push(new TraversalQuad(this._root, this._x0, this._y0, this._x1, this._y1));
    }
    while (quads.length > 0) {
      const quad = quads.pop()!;
      const node = quad.node;
      const x0 = quad.x0;
      const y0 = quad.y0;
      const x1 = quad.x1;
      const y1 = quad.y1;
      if (!callback(node, x0, y0, x1, y1) && isInternalNode(node)) {
        const xm = (x0 + x1) / 2;
        const ym = (y0 + y1) / 2;
        if (node[3] !== null) quads.push(new TraversalQuad(node[3], xm, ym, x1, y1));
        if (node[2] !== null) quads.push(new TraversalQuad(node[2], x0, ym, xm, y1));
        if (node[1] !== null) quads.push(new TraversalQuad(node[1], xm, y0, x1, ym));
        if (node[0] !== null) quads.push(new TraversalQuad(node[0], x0, y0, xm, ym));
      }
    }
    return this;
  }

  visitAfter(callback: (node: QuadtreeNode<T> | null, x0: number, y0: number, x1: number, y1: number) => void): Quadtree<T> {
    const quads: TraversalQuad<T>[] = [];
    const nextList: TraversalQuad<T>[] = [];
    if (this._root !== null) {
      quads.push(new TraversalQuad(this._root, this._x0, this._y0, this._x1, this._y1));
    }
    while (quads.length > 0) {
      const quad = quads.pop()!;
      const node = quad.node;
      if (isInternalNode(node)) {
        const x0 = quad.x0;
        const y0 = quad.y0;
        const x1 = quad.x1;
        const y1 = quad.y1;
        const xm = (x0 + x1) / 2;
        const ym = (y0 + y1) / 2;
        if (node[0] !== null) quads.push(new TraversalQuad(node[0], x0, y0, xm, ym));
        if (node[1] !== null) quads.push(new TraversalQuad(node[1], xm, y0, x1, ym));
        if (node[2] !== null) quads.push(new TraversalQuad(node[2], x0, ym, xm, y1));
        if (node[3] !== null) quads.push(new TraversalQuad(node[3], xm, ym, x1, y1));
      }
      nextList.push(quad);
    }
    while (nextList.length > 0) {
      const quad = nextList.pop()!;
      callback(quad.node, quad.x0, quad.y0, quad.x1, quad.y1);
    }
    return this;
  }

  copy(): Quadtree<T> {
    const copy = new Quadtree<T>();
    copy._x = this._x;
    copy._y = this._y;
    copy._x0 = this._x0;
    copy._y0 = this._y0;
    copy._x1 = this._x1;
    copy._y1 = this._y1;

    const node = this._root;
    if (node === null) {
      return copy;
    }

    if (!isInternalNode(node)) {
      copy._root = leafCopy(node);
      return copy;
    }

    const rootTarget = createInternalNode<T>();
    const stack: Array<{ source: QuadtreeInternalNode<T>; target: QuadtreeInternalNode<T> }> = [
      { source: node, target: rootTarget },
    ];
    copy._root = rootTarget;

    while (stack.length > 0) {
      const current = stack.pop()!;
      for (let index = 0; index < 4; index += 1) {
        const child = current.source[index];
        if (child !== null) {
          if (isInternalNode(child)) {
            const newTarget = createInternalNode<T>();
            current.target[index] = newTarget;
            stack.push({ source: child, target: newTarget });
          } else {
            current.target[index] = leafCopy(child as QuadLeaf<T>);
          }
        }
      }
    }

    return copy;
  }

  data(): T[] {
    const result: T[] = [];
    this.visit((node) => {
      if (!isInternalNode(node)) {
        let leaf: QuadLeaf<T> | null = node;
        while (leaf !== null) {
          result.push(leaf.data);
          leaf = leaf.next;
        }
      }
    });
    return result;
  }

  size(): number {
    let count = 0;
    this.visit((node) => {
      if (!isInternalNode(node)) {
        let leaf: QuadLeaf<T> | null = node;
        while (leaf !== null) {
          count += 1;
          leaf = leaf.next;
        }
      }
    });
    return count;
  }

  extent(ext?: [[number, number], [number, number]]): [[number, number], [number, number]] | Quadtree<T> | null {
    if (ext != null) {
      return this.cover(ext[0][0], ext[0][1]).cover(ext[1][0], ext[1][1]);
    }
    if (Number.isNaN(this._x0)) {
      return null;
    }
    return [[this._x0, this._y0], [this._x1, this._y1]];
  }

  get root(): QuadtreeNode<T> | null {
    return this._root;
  }

  x(fn?: QuadtreeAccessor<T>): QuadtreeAccessor<T> | Quadtree<T> {
    if (fn != null) {
      this._x = fn;
      return this;
    }
    return this._x;
  }

  y(fn?: QuadtreeAccessor<T>): QuadtreeAccessor<T> | Quadtree<T> {
    if (fn != null) {
      this._y = fn;
      return this;
    }
    return this._y;
  }
}