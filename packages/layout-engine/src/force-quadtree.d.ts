export type QuadtreeAccessor<T> = (datum: T) => number;
export declare class QuadLeaf<T> {
    data: T;
    next: QuadLeaf<T> | null;
    constructor(data: T, next?: QuadLeaf<T> | null);
}
export type QuadtreeInternalNode<T> = [
    QuadtreeNode<T> | null,
    QuadtreeNode<T> | null,
    QuadtreeNode<T> | null,
    QuadtreeNode<T> | null
];
export type QuadtreeNode<T> = QuadLeaf<T> | QuadtreeInternalNode<T>;
export declare class Quadtree<T extends {
    x: number;
    y: number;
}> {
    _x: QuadtreeAccessor<T>;
    _y: QuadtreeAccessor<T>;
    _x0: number;
    _y0: number;
    _x1: number;
    _y1: number;
    _root: QuadtreeNode<T> | null;
    constructor(x?: QuadtreeAccessor<T>, y?: QuadtreeAccessor<T>, data?: Iterable<T>);
    cover(x: number, y: number): Quadtree<T>;
    add(datum: T): Quadtree<T>;
    addAll(data: Iterable<T>): Quadtree<T>;
    remove(datum: T): Quadtree<T>;
    removeAll(data: Iterable<T>): Quadtree<T>;
    find(x: number, y: number, radius?: number): T | null;
    visit(callback: (node: QuadtreeNode<T> | null, x0: number, y0: number, x1: number, y1: number) => boolean | void): Quadtree<T>;
    visitAfter(callback: (node: QuadtreeNode<T> | null, x0: number, y0: number, x1: number, y1: number) => void): Quadtree<T>;
    copy(): Quadtree<T>;
    data(): T[];
    size(): number;
    extent(ext?: [[number, number], [number, number]]): [[number, number], [number, number]] | Quadtree<T> | null;
    get root(): QuadtreeNode<T> | null;
    x(fn?: QuadtreeAccessor<T>): QuadtreeAccessor<T> | Quadtree<T>;
    y(fn?: QuadtreeAccessor<T>): QuadtreeAccessor<T> | Quadtree<T>;
}
//# sourceMappingURL=force-quadtree.d.ts.map