import type { CompatibilityResult, PreviewEngineContext, PreviewEngineManifest } from './types.js';
export declare const ELK_LAYERED_PREVIEW_ENGINE: PreviewEngineManifest;
export declare const FORCE_PREVIEW_ENGINE: PreviewEngineManifest;
export declare const SEQUENCE_PREVIEW_ENGINE: PreviewEngineManifest;
/** Registered preview engines — extend here when onboarding new packages. */
export declare const PREVIEW_ENGINE_REGISTRY: readonly PreviewEngineManifest[];
export declare function listPreviewEngines(): PreviewEngineManifest[];
export declare function getPreviewEngine(id: string): PreviewEngineManifest | undefined;
export declare function resolvePreviewEngine(context: PreviewEngineContext): PreviewEngineManifest | undefined;
export declare function listHostableLayoutEngineKeys(): string[];
/**
 * Evaluate whether an engine is compatible with the given context.
 * Returns a detailed result with a reason when incompatible.
 */
export declare function evaluatePreviewEngineCompatibility(engine: PreviewEngineManifest, context: PreviewEngineContext): CompatibilityResult;
export declare function isPreviewEngineCompatible(engine: PreviewEngineManifest, context: PreviewEngineContext): boolean;
export declare function listCompatiblePreviewEngines(context: PreviewEngineContext): PreviewEngineManifest[];
/**
 * List all engines with their compatibility status for the given context.
 * Useful for building a switcher UI that shows disabled engines with reasons.
 */
export declare function listPreviewEnginesWithCompatibility(context: PreviewEngineContext): Array<{
    engine: PreviewEngineManifest;
    compatibility: CompatibilityResult;
}>;
/** JSON-serializable manifest list for preview-server consumption. */
export declare function serializePreviewEngineManifest(): PreviewEngineManifest[];
//# sourceMappingURL=registry.d.ts.map