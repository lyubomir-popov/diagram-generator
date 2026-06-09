import { elkLayeredPreviewControlSpecs } from './elk-controls.js';
import { FORCE_PREVIEW_PARAM_SPECS } from './force-param-registry.js';
export const ELK_LAYERED_PREVIEW_ENGINE = {
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
    compatibility: {
        documentKinds: ['frame-diagram'],
        requiredLayoutEngineKey: 'elk-layered',
        description: 'Hierarchical layered layout for directed graphs and flowcharts',
    },
};
export const FORCE_PREVIEW_ENGINE = {
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
    },
    compatibility: {
        documentKinds: ['force-spec'],
        description: 'Physics-based force-directed layout for organic graph structures',
    },
};
export const SEQUENCE_PREVIEW_ENGINE = {
    id: 'sequence',
    label: 'Sequence layout',
    layoutEngineKey: 'sequence',
    shellMode: 'grid',
    capabilities: {
        layoutControls: false,
        localRelayout: true,
        serverRelayout: false,
        engineBackedSave: false,
        nodeInspector: false,
        gridEditing: false,
        referenceImage: true,
        simulationControls: false,
        rawDebugView: false,
    },
    controlSpecs: [],
    scripts: [],
    compatibility: {
        documentKinds: ['sequence'],
        requiredLayoutEngineKey: 'sequence',
        description: 'Timeline-based layout for sequence diagrams and message flows',
    },
};
/** Registered preview engines — extend here when onboarding new packages. */
export const PREVIEW_ENGINE_REGISTRY = [
    ELK_LAYERED_PREVIEW_ENGINE,
    FORCE_PREVIEW_ENGINE,
    SEQUENCE_PREVIEW_ENGINE,
];
export function listPreviewEngines() {
    return PREVIEW_ENGINE_REGISTRY.map((entry) => entry);
}
export function getPreviewEngine(id) {
    return PREVIEW_ENGINE_REGISTRY.find((entry) => entry.id === id);
}
export function resolvePreviewEngine(context) {
    const layoutEngine = context.layoutEngine?.trim();
    if (layoutEngine) {
        const byLayout = PREVIEW_ENGINE_REGISTRY.find((entry) => entry.layoutEngineKey === layoutEngine);
        if (byLayout)
            return byLayout;
    }
    const shellMode = context.shellMode;
    if (shellMode) {
        const byMode = PREVIEW_ENGINE_REGISTRY.find((entry) => entry.shellMode === shellMode);
        if (byMode && !byMode.layoutEngineKey)
            return byMode;
    }
    return undefined;
}
export function listHostableLayoutEngineKeys() {
    return PREVIEW_ENGINE_REGISTRY
        .map((entry) => entry.layoutEngineKey)
        .filter((key) => typeof key === 'string' && key.length > 0);
}
/**
 * Evaluate whether an engine is compatible with the given context.
 * Returns a detailed result with a reason when incompatible.
 */
export function evaluatePreviewEngineCompatibility(engine, context) {
    const shellMode = context.shellMode ?? null;
    if (shellMode && engine.shellMode !== shellMode) {
        return {
            compatible: false,
            reason: `Engine requires shell mode '${engine.shellMode}' but document uses '${shellMode}'`,
        };
    }
    const previewDocumentKind = context.previewDocumentKind ?? null;
    if (previewDocumentKind && !engine.compatibility.documentKinds.includes(previewDocumentKind)) {
        return {
            compatible: false,
            reason: `Engine cannot render document kind '${previewDocumentKind}'`,
        };
    }
    // `requiredLayoutEngineKey` is an OFFER filter, not an ACTIVE-resolution gate.
    // When a document has not yet chosen an engine (`layoutEngine` empty), this
    // engine is still offerable for its document kind — the switcher needs to be
    // able to propose it. The key is only enforced when the document already
    // declares a *conflicting* layout engine. Picking the active engine for a
    // chosen key is `resolvePreviewEngine`'s job, not this predicate's.
    const requiredLayoutEngineKey = engine.compatibility.requiredLayoutEngineKey;
    const layoutEngine = context.layoutEngine?.trim() ?? '';
    if (requiredLayoutEngineKey && layoutEngine && layoutEngine !== requiredLayoutEngineKey) {
        return {
            compatible: false,
            reason: `Engine requires layout engine '${requiredLayoutEngineKey}' but document uses '${layoutEngine}'`,
        };
    }
    return { compatible: true };
}
export function isPreviewEngineCompatible(engine, context) {
    return evaluatePreviewEngineCompatibility(engine, context).compatible;
}
export function listCompatiblePreviewEngines(context) {
    return PREVIEW_ENGINE_REGISTRY.filter((entry) => isPreviewEngineCompatible(entry, context));
}
/**
 * List all engines with their compatibility status for the given context.
 * Useful for building a switcher UI that shows disabled engines with reasons.
 */
export function listPreviewEnginesWithCompatibility(context) {
    return PREVIEW_ENGINE_REGISTRY.map((engine) => ({
        engine,
        compatibility: evaluatePreviewEngineCompatibility(engine, context),
    }));
}
/** JSON-serializable manifest list for preview-server consumption. */
export function serializePreviewEngineManifest() {
    return listPreviewEngines();
}
//# sourceMappingURL=registry.js.map