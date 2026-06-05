/**
 * Preview-engine manifest contract (spec 025).
 *
 * TypeScript owns engine metadata; Python reads generated JSON from
 * `dist/preview-engine-manifest.json` via `/api/preview-engines` — no Python mirrors.
 */

export type PreviewShellMode = 'grid' | 'force';

export type PreviewControlKind = 'number' | 'enum' | 'boolean' | 'text';

export interface PreviewControlSpec {
  key: string;
  label: string;
  group: string;
  kind: PreviewControlKind;
  defaultValue: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  enumValues?: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  /** Persisted YAML namespace for engine-backed save flows. */
  persistNamespace?: 'meta.elk' | 'simulation' | 'render';
}

export interface PreviewEngineCapabilities {
  layoutControls: boolean;
  localRelayout: boolean;
  serverRelayout: boolean;
  engineBackedSave: boolean;
  nodeInspector: boolean;
  gridEditing: boolean;
  referenceImage: boolean;
  simulationControls: boolean;
  rawDebugView: boolean;
}

export interface PreviewEngineApiRoutes {
  save?: string;
  spec?: string;
  params?: string;
  tick?: string;
  reset?: string;
  export?: string;
}

/** Serializable manifest consumed by the preview shell and preview server. */
export interface PreviewEngineManifest {
  id: string;
  label: string;
  /** `meta.layout_engine` value when this engine backs a frame YAML diagram. */
  layoutEngineKey?: string;
  shellMode: PreviewShellMode;
  capabilities: PreviewEngineCapabilities;
  controlSpecs: PreviewControlSpec[];
  /** Relative paths under `/preview/` loaded for this engine lane. */
  scripts: string[];
  apiRoutes?: PreviewEngineApiRoutes;
}

export interface PreviewEngineContext {
  layoutEngine?: string | null;
  shellMode?: PreviewShellMode | null;
}
