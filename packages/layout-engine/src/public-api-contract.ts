import {
  buildComponentTree,
  buildGridInfo,
  createEditorStateStore,
  layoutFrameTree,
  layoutSequenceDiagram,
  loadFrameYaml,
  renderFrameDiagramToSvg,
  renderSequenceDiagramToSvg,
  serializeFrameDiagram,
  serializePreviewEngineManifest,
  type ComponentInfo,
  type EditorStateStore,
  type Frame,
  type FrameDiagram,
  type GridInfo,
  type LayoutOptions,
  type LayoutOutput,
  type PreviewEngineManifest,
  type SequenceDiagramSpec,
  type SequenceLayoutConfig,
  type SequenceLayoutResult,
  type SequenceSvgRenderOptions,
  type SvgRenderOptions,
  type TextMeasureAdapter,
} from "./index.js";

const layoutFrameTreeContract: (
  root: Frame,
  adapter: TextMeasureAdapter,
  options?: LayoutOptions,
) => LayoutOutput = layoutFrameTree;

const renderFrameDiagramToSvgContract: (
  diagram: FrameDiagram,
  result: LayoutOutput,
  adapter: TextMeasureAdapter,
  options?: SvgRenderOptions,
) => string = renderFrameDiagramToSvg;

const loadFrameYamlContract: (path: string) => FrameDiagram = loadFrameYaml;
const serializeFrameDiagramContract: (diagram: FrameDiagram) => Record<string, unknown> = serializeFrameDiagram;
const buildGridInfoContract: (diagram: FrameDiagram, root: Frame) => GridInfo = buildGridInfo;
const buildComponentTreeContract: (root: Frame) => ComponentInfo[] = buildComponentTree;
const previewManifestContract: () => PreviewEngineManifest[] = serializePreviewEngineManifest;
const editorStateStoreContract: typeof createEditorStateStore = createEditorStateStore;

const layoutSequenceDiagramContract: (
  diagram: SequenceDiagramSpec,
  config?: SequenceLayoutConfig,
) => SequenceLayoutResult = layoutSequenceDiagram;

const renderSequenceDiagramToSvgContract: (
  diagram: SequenceDiagramSpec,
  result: SequenceLayoutResult,
  options?: SequenceSvgRenderOptions,
) => string = renderSequenceDiagramToSvg;

void [
  layoutFrameTreeContract,
  renderFrameDiagramToSvgContract,
  loadFrameYamlContract,
  serializeFrameDiagramContract,
  buildGridInfoContract,
  buildComponentTreeContract,
  previewManifestContract,
  editorStateStoreContract,
  layoutSequenceDiagramContract,
  renderSequenceDiagramToSvgContract,
];

export type PublicApiContractSmoke =
  | typeof layoutFrameTreeContract
  | typeof renderFrameDiagramToSvgContract
  | typeof layoutSequenceDiagramContract;
