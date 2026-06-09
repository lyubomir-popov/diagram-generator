import { FrameDiagram, type Arrow, type DiagramOverlay, type Frame } from "../frame-model.js";
export declare const AUTOLAYOUT_DOCUMENT_KIND = "frame-diagram";
export interface AutolayoutDocument {
    readonly kind: typeof AUTOLAYOUT_DOCUMENT_KIND;
    readonly title: string;
    readonly root: Frame;
    readonly arrows: readonly Arrow[];
    readonly overlays: readonly DiagramOverlay[];
    readonly gridCols: number;
    readonly gridColGap?: number;
    readonly gridRowGap?: number;
    readonly gridOuterMargin?: number;
    readonly layoutEngine?: string;
    readonly diagramType?: string;
    readonly sourceImage?: string;
    readonly elkLayout?: Readonly<Record<string, string>>;
}
export declare function fromFrameDiagram(diagram: FrameDiagram): AutolayoutDocument;
export declare function toFrameDiagram(document: AutolayoutDocument): FrameDiagram;
//# sourceMappingURL=schema.d.ts.map