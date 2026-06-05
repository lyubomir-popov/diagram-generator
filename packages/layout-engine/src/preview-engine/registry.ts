import { elkLayeredPreviewControlSpecs } from './elk-controls.js';
import { FORCE_PREVIEW_PARAM_SPECS } from './force-param-registry.js';
import type {
  PreviewEngineContext,
  PreviewEngineManifest,
} from './types.js';

export const ELK_LAYERED_PREVIEW_ENGINE: PreviewEngineManifest = {
  id: 'elk-layered',
  label: 'ELK layered layout',
  layoutEngineKey: 'elk-layered',
  shellMode: 'grid',
  capabilities: {
    layoutControls: true,
    localRelayout: false,
    serverRelayout: true,
    engineBackedSave: true,
    nodeInspector: true,
    gridEditing: false,
    referenceImage: true,
    simulationControls: false,
    rawDebugView: false,
  },
  controlSpecs: elkLayeredPreviewControlSpecs(),
  scripts: ['elk-layout-controls.js', 'elk-controller.js'],
};

export const FORCE_PREVIEW_ENGINE: PreviewEngineManifest = {
  id: 'force',
  label: 'Force-directed layout',
  shellMode: 'force',
  capabilities: {
    layoutControls: false,
    localRelayout: true,
    serverRelayout: false,
    engineBackedSave: true,
    nodeInspector: true,
    gridEditing: false,
    referenceImage: true,
    simulationControls: true,
    rawDebugView: false,
  },
  controlSpecs: FORCE_PREVIEW_PARAM_SPECS,
  scripts: ['force.js'],
  apiRoutes: {
    save: '/api/force-save/{slug}',
    spec: '/api/force-spec/{slug}',
    params: '/api/force-params/{slug}',
    tick: '/api/force-tick/{slug}',
    reset: '/api/force-reset/{slug}',
    export: '/api/force-export/{slug}',
  },
};

/** Registered preview engines — extend here when onboarding new packages. */
export const PREVIEW_ENGINE_REGISTRY: readonly PreviewEngineManifest[] = [
  ELK_LAYERED_PREVIEW_ENGINE,
  FORCE_PREVIEW_ENGINE,
] as const;

export function listPreviewEngines(): PreviewEngineManifest[] {
  return PREVIEW_ENGINE_REGISTRY.map((entry) => entry);
}

export function getPreviewEngine(id: string): PreviewEngineManifest | undefined {
  return PREVIEW_ENGINE_REGISTRY.find((entry) => entry.id === id);
}

export function resolvePreviewEngine(
  context: PreviewEngineContext,
): PreviewEngineManifest | undefined {
  const layoutEngine = context.layoutEngine?.trim();
  if (layoutEngine) {
    const byLayout = PREVIEW_ENGINE_REGISTRY.find(
      (entry) => entry.layoutEngineKey === layoutEngine,
    );
    if (byLayout) return byLayout;
  }

  const shellMode = context.shellMode;
  if (shellMode) {
    const byMode = PREVIEW_ENGINE_REGISTRY.find((entry) => entry.shellMode === shellMode);
    if (byMode && !byMode.layoutEngineKey) return byMode;
  }

  return undefined;
}

/** JSON-serializable manifest list for preview-server consumption. */
export function serializePreviewEngineManifest(): PreviewEngineManifest[] {
  return listPreviewEngines();
}
