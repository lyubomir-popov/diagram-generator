import { FrameDiagram, type Arrow, type DiagramOverlay, type Frame } from "../frame-model.js";

export const AUTOLAYOUT_DOCUMENT_KIND = "frame-diagram";

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

export function fromFrameDiagram(diagram: FrameDiagram): AutolayoutDocument {
  return {
    kind: AUTOLAYOUT_DOCUMENT_KIND,
    title: diagram.title,
    root: diagram.root,
    arrows: diagram.arrows,
    overlays: diagram.overlays,
    gridCols: diagram.gridCols,
    gridColGap: diagram.gridColGap,
    gridRowGap: diagram.gridRowGap,
    gridOuterMargin: diagram.gridOuterMargin,
    layoutEngine: diagram.layoutEngine,
    diagramType: diagram.diagramType,
    sourceImage: diagram.sourceImage,
    elkLayout: diagram.elkLayout,
  };
}

export function toFrameDiagram(document: AutolayoutDocument): FrameDiagram {
  return new FrameDiagram({
    title: document.title,
    root: document.root,
    arrows: [...document.arrows],
    overlays: [...document.overlays],
    gridCols: document.gridCols,
    gridColGap: document.gridColGap,
    gridRowGap: document.gridRowGap,
    gridOuterMargin: document.gridOuterMargin,
    layoutEngine: document.layoutEngine,
    diagramType: document.diagramType,
    sourceImage: document.sourceImage,
    elkLayout: document.elkLayout ? { ...document.elkLayout } : undefined,
  });
}
