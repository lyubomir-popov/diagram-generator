import { FrameDiagram } from "../frame-model.js";
export const AUTOLAYOUT_DOCUMENT_KIND = "frame-diagram";
export function fromFrameDiagram(diagram) {
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
export function toFrameDiagram(document) {
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
//# sourceMappingURL=schema.js.map