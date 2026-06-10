import { describe, expect, it } from 'vitest';
import {
  ELK_LAYERED_PREVIEW_ENGINE,
  FORCE_PREVIEW_ENGINE,
  FORCE_PREVIEW_PARAM_SPECS,
  PREVIEW_ENGINE_REGISTRY,
  SEQUENCE_PREVIEW_ENGINE,
  V3_PREVIEW_ENGINE,
  evaluatePreviewEngineCompatibility,
  getPreviewEngine,
  isPreviewEngineCompatible,
  listCompatiblePreviewEngines,
  listHostableLayoutEngineKeys,
  listPreviewEngines,
  listPreviewEnginesWithCompatibility,
  resolvePreviewEngine,
  serializePreviewEngineManifest,
} from '../src/preview-engine/index.js';

describe('preview-engine registry', () => {
  it('registers native v3, ELK, force, and sequence engines', () => {
    expect(PREVIEW_ENGINE_REGISTRY.map((entry) => entry.id)).toEqual(['v3', 'elk-layered', 'force', 'sequence']);
  });

  it('exposes ELK control specs from the TS authority path', () => {
    const elk = getPreviewEngine('elk-layered');
    expect(elk).toBeDefined();
    expect(elk?.controlSpecs.length).toBeGreaterThan(5);
    expect(elk?.controlSpecs.some((spec) => spec.key === 'elk.direction')).toBe(true);
    expect(elk?.controlSpecs.every((spec) => spec.persistNamespace === 'meta.elk')).toBe(true);
    expect(elk?.scripts).toEqual(['elk-layout-controls.js', 'elk-controller.js']);
  });

  it('exposes force simulation/render control specs', () => {
    expect(FORCE_PREVIEW_PARAM_SPECS.some((spec) => spec.key === 'link_distance')).toBe(true);
    expect(FORCE_PREVIEW_ENGINE.controlSpecs).toEqual(FORCE_PREVIEW_PARAM_SPECS);
    expect(FORCE_PREVIEW_ENGINE.apiRoutes?.save).toBe('/api/force-save/{slug}');
    expect(FORCE_PREVIEW_ENGINE.apiRoutes?.spec).toBe('/api/force-spec/{slug}');
    expect(FORCE_PREVIEW_ENGINE.apiRoutes?.params).toBeUndefined();
  });

  it('resolves engines by layoutEngine key or shell mode', () => {
    expect(resolvePreviewEngine({ layoutEngine: 'elk-layered' })?.id).toBe('elk-layered');
    expect(resolvePreviewEngine({ shellMode: 'force' })?.id).toBe('force');
    expect(resolvePreviewEngine({ shellMode: 'grid', layoutEngine: 'vertical-stack' })).toBeUndefined();
  });

  it('defaults blank frame-diagram docs to native v3 and offers elk as an alternative', () => {
    const context = {
      shellMode: 'grid' as const,
      previewDocumentKind: 'frame-diagram' as const,
      frameDiagramSummary: { arrowCount: 1 },
    };

    expect(resolvePreviewEngine(context)?.id).toBe('v3');
    expect(listCompatiblePreviewEngines(context).map((entry) => entry.id)).toEqual([
      'v3',
      'elk-layered',
    ]);
  });

  it('serializes a JSON-safe manifest list for preview-server consumption', () => {
    const serialized = serializePreviewEngineManifest();
    expect(serialized).toHaveLength(4);
    const roundTrip = JSON.parse(JSON.stringify(serialized));
    expect(roundTrip[0].id).toBe('v3');
    expect(roundTrip[1].id).toBe('elk-layered');
    expect(roundTrip[2].capabilities.simulationControls).toBe(true);
    expect(roundTrip[3].id).toBe('sequence');
    expect(roundTrip[0].compatibility.documentKinds).toEqual(['frame-diagram']);
    expect(roundTrip[3].compatibility.requiredLayoutEngineKey).toBe('sequence');
    expect(listPreviewEngines()).toEqual(serialized);
  });

  it('declares expected shell capabilities per engine lane', () => {
    expect(V3_PREVIEW_ENGINE.capabilities.localRelayout).toBe(true);
    expect(V3_PREVIEW_ENGINE.capabilities.gridEditing).toBe(true);
    expect(ELK_LAYERED_PREVIEW_ENGINE.capabilities.serverRelayout).toBe(true);
    expect(ELK_LAYERED_PREVIEW_ENGINE.capabilities.localRelayout).toBe(false);
    expect(FORCE_PREVIEW_ENGINE.capabilities.localRelayout).toBe(true);
    expect(FORCE_PREVIEW_ENGINE.capabilities.simulationControls).toBe(true);
    expect(SEQUENCE_PREVIEW_ENGINE.capabilities.localRelayout).toBe(true);
    expect(SEQUENCE_PREVIEW_ENGINE.capabilities.nodeInspector).toBe(false);
  });

  it('exposes hostable layout-engine keys and typed compatibility helpers', () => {
    expect(listHostableLayoutEngineKeys()).toEqual(['v3', 'elk-layered', 'sequence']);
    expect(
      isPreviewEngineCompatible(ELK_LAYERED_PREVIEW_ENGINE, {
        previewDocumentKind: 'frame-diagram',
        layoutEngine: 'elk-layered',
        frameDiagramSummary: { arrowCount: 2 },
      }),
    ).toBe(true);
    expect(
      isPreviewEngineCompatible(ELK_LAYERED_PREVIEW_ENGINE, {
        previewDocumentKind: 'sequence',
      }),
    ).toBe(false);
    expect(
      listCompatiblePreviewEngines({
        previewDocumentKind: 'frame-diagram',
        frameDiagramSummary: { arrowCount: 2 },
      }).map((entry) => entry.id),
    ).toEqual(['v3', 'elk-layered']);
    expect(
      listCompatiblePreviewEngines({ previewDocumentKind: 'force-spec' }).map((entry) => entry.id),
    ).toEqual(['force']);
    expect(
      listCompatiblePreviewEngines({
        previewDocumentKind: 'force-spec',
        shellMode: 'grid',
      }),
    ).toEqual([]);
  });

  it('evaluates compatibility with detailed reasons for incompatible engines', () => {
    // ELK engine incompatible with sequence document
    const elkResult = evaluatePreviewEngineCompatibility(ELK_LAYERED_PREVIEW_ENGINE, {
      previewDocumentKind: 'sequence',
    });
    expect(elkResult.compatible).toBe(false);
    expect(elkResult.reason).toContain('sequence');

    // Force engine incompatible with grid shell mode
    const forceResult = evaluatePreviewEngineCompatibility(FORCE_PREVIEW_ENGINE, {
      shellMode: 'grid',
    });
    expect(forceResult.compatible).toBe(false);
    expect(forceResult.reason).toContain('shell mode');

    // Sequence engine incompatible with wrong layout engine key
    const seqResult = evaluatePreviewEngineCompatibility(SEQUENCE_PREVIEW_ENGINE, {
      previewDocumentKind: 'sequence',
      layoutEngine: 'elk-layered',
    });
    expect(seqResult.compatible).toBe(false);
    expect(seqResult.reason).toContain('layout engine');

    const arrowlessElkResult = evaluatePreviewEngineCompatibility(ELK_LAYERED_PREVIEW_ENGINE, {
      previewDocumentKind: 'frame-diagram',
      frameDiagramSummary: { arrowCount: 0 },
    });
    expect(arrowlessElkResult.compatible).toBe(false);
    expect(arrowlessElkResult.reason).toContain('arrow');
  });

  it('returns compatible result for matching engines', () => {
    const elkResult = evaluatePreviewEngineCompatibility(ELK_LAYERED_PREVIEW_ENGINE, {
      previewDocumentKind: 'frame-diagram',
      layoutEngine: 'elk-layered',
      frameDiagramSummary: { arrowCount: 1 },
    });
    expect(elkResult.compatible).toBe(true);
    expect(elkResult.reason).toBeUndefined();

    const forceResult = evaluatePreviewEngineCompatibility(FORCE_PREVIEW_ENGINE, {
      previewDocumentKind: 'force-spec',
      shellMode: 'force',
    });
    expect(forceResult.compatible).toBe(true);
    expect(forceResult.reason).toBeUndefined();
  });

  it('lists all engines with compatibility status for switcher UI', () => {
    const results = listPreviewEnginesWithCompatibility({
      previewDocumentKind: 'frame-diagram',
      layoutEngine: 'elk-layered',
      frameDiagramSummary: { arrowCount: 2 },
    });
    expect(results).toHaveLength(4);
    expect(results[0].engine.id).toBe('v3');
    expect(results[0].compatibility.compatible).toBe(true);
    expect(results[1].engine.id).toBe('elk-layered');
    expect(results[1].compatibility.compatible).toBe(true);
    expect(results[2].engine.id).toBe('force');
    expect(results[2].compatibility.compatible).toBe(false);
    expect(results[2].compatibility.reason).toBeDefined();
    expect(results[3].engine.id).toBe('sequence');
    expect(results[3].compatibility.compatible).toBe(false);
  });

  it('exposes engine descriptions for switcher UI', () => {
    expect(V3_PREVIEW_ENGINE.compatibility.description).toBeDefined();
    expect(V3_PREVIEW_ENGINE.compatibility.description).toContain('v3');
    expect(ELK_LAYERED_PREVIEW_ENGINE.compatibility.description).toBeDefined();
    expect(ELK_LAYERED_PREVIEW_ENGINE.compatibility.description).toContain('layered');
    expect(FORCE_PREVIEW_ENGINE.compatibility.description).toBeDefined();
    expect(FORCE_PREVIEW_ENGINE.compatibility.description).toContain('force');
    expect(SEQUENCE_PREVIEW_ENGINE.compatibility.description).toBeDefined();
    expect(SEQUENCE_PREVIEW_ENGINE.compatibility.description).toContain('sequence');
  });

  it('omits elk layered from arrowless frame diagrams', () => {
    const context = {
      shellMode: 'grid' as const,
      previewDocumentKind: 'frame-diagram' as const,
      frameDiagramSummary: { arrowCount: 0 },
    };

    expect(resolvePreviewEngine(context)?.id).toBe('v3');
    expect(listCompatiblePreviewEngines(context).map((entry) => entry.id)).toEqual(['v3']);
  });

  it('falls back from an explicitly persisted incompatible elk choice', () => {
    expect(
      resolvePreviewEngine({
        layoutEngine: 'elk-layered',
        shellMode: 'grid',
        previewDocumentKind: 'frame-diagram',
        frameDiagramSummary: { arrowCount: 0 },
      })?.id,
    ).toBe('v3');
  });
});
