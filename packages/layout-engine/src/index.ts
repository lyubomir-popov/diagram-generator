export {
  type Line,
  createLine,
  Fill,
  Border,
  Direction,
  Sizing,
  Align,
  Justify,
  type Arrow,
  createArrow,
  type DiagramOverlay,
  type LayoutState,
  type FrameInit,
  Frame,
  type PositionType,
  type FrameDiagramInit,
  FrameDiagram,
  type CoercedOverride,
  enforceFillHugInvariant,
} from './frame-model.js';

export {
  BASELINE_UNIT,
  DEFAULT_MAX_WIDTH_CHARS,
  NO_WRAP_MAX_WIDTH_CHARS,
  BLOCK_WIDTH,
  BOX_MIN_HEIGHT,
  INSET,
  GRID_GUTTER,
  DEFAULT_FRAME_STROKE_WIDTH,
  ICON_SIZE,
  BODY_LINE_STEP,
  BODY_SIZE,
  ARROW_HEAD_LENGTH,
  ARROW_HEAD_HALF_WIDTH,
  ARROW_COLOR,
  LINE_HEIGHTS_BY_SIZE,
  defaultLineStep,
  roundUpToGrid,
  sizeToPx,
  steppedLinesHeight,
  clampToConstraints,
  setActiveGridStep,
  getActiveGridStep,
} from './tokens.js';

export {
  type LineSpec,
  type TextMeasureRequest,
  type TextMeasureAdapter,
  estimateLineWidth,
  letterSpacingPx,
  letterSpacingAdvance,
  lineSpecToMeasureRequest,
  wrapTextLines,
  lineToSpec,
  linesToSpecs,
  MockTextAdapter,
} from './text-measure.js';

export {
  CanvasTextAdapter,
  type CanvasTextAdapterOptions,
} from './canvas-text-adapter.js';

export {
  HarfBuzzTextAdapter,
  createHarfBuzzTextAdapter,
  createDefaultHarfBuzzTextAdapter,
  type HarfBuzzTextAdapterOptions,
  type HarfBuzzTextAdapterFetchOptions,
} from './harfbuzz-text-adapter.js';
export {
  isTextShapeCompatibleAdapter,
  shapeLineSpec,
  type ShapeTextRunRequest,
  type TextShapeCompatibleAdapter,
} from './text-adapter/shape-compatible.js';

export {
  distributeFillSpace,
  alignOffset,
  measure,
  remeasureWithWidthConstraints,
  place,
  layoutFrameTree,
  type LayoutOutput,
  type LayoutOptions,
} from './layout.js';

export {
  computeLevel,
  resolveStyles,
} from './resolve-styles.js';

export {
  annotationTextToSpec,
  frameOwnedHeadingToSpec,
  frameOwnedLabelToSpec,
  frameOwnedTextBlocks,
  frameOwnedTextBlockGap,
  resolvedSpecTypography,
} from './resolved-spec-typography.js';

export {
  frameHasTextContent,
  applyTextLayoutDefaults,
  hasCharWrapCap,
  maxWidthPxFromChars,
  resolveLeafTextWrapWidth,
} from './text-layout.js';

export { applyHeadingAsChild } from './heading-synthesis.js';
export { loadFrameYaml } from './frame-yaml-loader.js';
export { serializeFrameDiagram, serializeFrame, deserializeFrameWire, deserializeFrameDiagramWire } from './frame-serialize.js';
export { buildGridInfo, type GridInfo } from './grid-info.js';
export { buildComponentTree, type ComponentInfo } from './component-tree.js';
export { renderFrameDiagramToSvg, type SvgRenderOptions } from './svg-render.js';
export {
  emitFrameDiagramDisplayList,
} from './render-adapter/display-list.js';
export { renderDisplayListToSvg } from './render-adapter/svg.js';
export type {
  AssetRef,
  Color,
  DisplayList,
  DisplayListItem,
  GlyphRunItem,
  GroupItem,
  LineItem,
  Paint,
  PathCommand,
  PathItem,
  RectItem,
  ShapedGlyph,
  ShapedRun,
  StrokeStyle,
  Viewport,
} from './render-ir.js';
export {
  collectIconNames,
  createFsIconLoader,
  extractSvgInnerMarkup,
  preloadIconMarkup,
  safeIconFileName,
  tintIconInnerMarkup,
  type IconInnerMarkupLoader,
} from './icon-embed.js';

export {
  FRAME_CLASS_DEFS,
  applyFrameClass,
  strokeWidthForClass,
  effectiveResolvedStrokeWidth,
  type FrameClassDefinition,
  type FrameTextStyle,
} from './frame-classes.js';

export {
  applyForceNodePatch,
  createInitialForceSnapshot,
  exportForceAuthoredSpec,
  exportForceSnapshot,
  tickForceSimulation,
  updateForceSimulationParams,
  type ForceAuthoredSpec,
  type ForceLinkSpec,
  type ForceNodePatch,
  type ForceNodeSpec,
  type ForceRenderSpec,
  type ForceSimulationConfig,
  type ForceRuntimeLink,
  type ForceRuntimeNode,
  type ForceRuntimeSnapshot,
  type ForceSimulationSpec,
} from './force-runtime.js';

export {
  layoutSequenceDiagram,
  type SequenceLayoutConfig,
  type SequenceLayoutGroupSpan,
  type SequenceLayoutMessageRow,
  type SequenceLayoutNoteBox,
  type SequenceLayoutParticipantBox,
  type SequenceLayoutResult,
} from './sequence-layout/layout.js';

export { renderSequenceDiagramToSvg } from './sequence-layout/render-svg.js';
export type { SequenceSvgRenderOptions } from './sequence-layout/render-svg.js';

export {
  normalizeSequenceDiagram,
  type NormalizeSequenceDiagramResult,
  type SequenceDiagramInput,
  type SequenceDiagramSpec,
  type SequenceGroup,
  type SequenceGroupInput,
  type SequenceLine,
  type SequenceMessage,
  type SequenceMessageInput,
  type SequenceModelDiagnostic,
  type SequenceNote,
  type SequenceNoteInput,
  type SequenceNotePlacement,
  type SequenceParticipant,
  type SequenceParticipantInput,
  type SequenceParticipantKind,
} from './sequence-layout/model.js';

export { compileDiagramYaml } from './diagram-author/compile.js';
export { exportMermaid } from './diagram-author/export-mermaid.js';
export type { MermaidExportResult } from './diagram-author/export-mermaid.js';
export { exportD2 } from './diagram-author/export-d2.js';
export type { D2ExportResult } from './diagram-author/export-d2.js';
export type {
  AuthorArrow,
  AuthorFrameNode,
  CompileOptions,
  CompileResult,
  DiagramDocument,
  Diagnostic,
  DiagnosticLevel,
  Edge,
  FrameIndexEntry,
  FrameTemplate,
  LineSpec as AuthorLineSpec,
} from './diagram-author/types.js';

export {
  captureEditorSnapshot,
  cloneEditorSnapshotValue,
  normalizeGridOverrides,
  parseEditorSnapshot,
  serializeEditorSnapshot,
  EditorUndoStack,
  createOverridePatchCommand,
  createStatePatchCommand,
  overridePatchChanged,
  EditorStateStore,
  captureOverrideEntries,
  createEditorStateStore,
  PERSIST_FRAME_KEYS,
  UNSUPPORTED_PERSIST_FRAME_KEYS,
  PERSIST_INT_FRAME_KEYS,
  PERSIST_LOWER_FRAME_KEYS,
  RELAYOUT_FRAME_KEYS,
  UNDO_RELAYOUT_FRAME_KEYS,
  hasV3FrameOverride,
  filterRelayoutOverrideEntry,
} from './preview-shell/index.js';
export type {
  EditorSnapshot,
  EditorSnapshotInput,
  EditorOverridePatchCommand,
  EditorStatePatchCommand,
  EditorUndoCommand,
  EditorUndoStackOptions,
  PendingUndoableAction,
  EditorStateStoreDeps,
  EditorStateStoreOptions,
  PersistFrameKey,
  RelayoutFrameKey,
} from './preview-shell/index.js';

export {
  AUTOLAYOUT_DOCUMENT_KIND,
  fromFrameDiagram,
  toFrameDiagram,
} from './document-model/schema.js';
export type { AutolayoutDocument } from './document-model/schema.js';

export {
  AUTOLAYOUT_OPERATOR_FACADE,
  evaluateAutolayoutOperator,
} from './operator-autolayout/facade.js';
export type {
  AutolayoutOperatorInputs,
  AutolayoutOperatorOutputs,
  AutolayoutOperatorParams,
  EvaluateContext,
  InputPort,
  OperatorDefinition,
  OutputPort,
  ParameterField,
  ParameterType,
} from './operator-autolayout/facade.js';

export {
  V3_PREVIEW_ENGINE,
  ELK_LAYERED_PREVIEW_ENGINE,
  FORCE_PREVIEW_ENGINE,
  FORCE_PREVIEW_PARAM_SPECS,
  PREVIEW_ENGINE_REGISTRY,
  elkLayeredPreviewControlSpecs,
  evaluatePreviewEngineCompatibility,
  getPreviewEngine,
  getPreviewEngineByLayoutKey,
  listCompatiblePreviewEngines,
  listPreviewEngines,
  resolvePreviewEngine,
  serializePreviewEngineManifest,
  summarizeFrameDiagramCompatibility,
} from './preview-engine/index.js';
export type {
  CompatibilityResult,
  FrameDiagramCompatibilitySummary,
  PreviewControlKind,
  PreviewControlSpec,
  PreviewDocumentKind,
  PreviewEngineApiRoutes,
  PreviewEngineCapabilities,
  PreviewEngineContext,
  PreviewEngineManifest,
  PreviewShellMode,
} from './preview-engine/index.js';
