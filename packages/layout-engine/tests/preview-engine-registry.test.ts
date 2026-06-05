import { describe, expect, it } from 'vitest';
import {
  ELK_LAYERED_PREVIEW_ENGINE,
  FORCE_PREVIEW_ENGINE,
  FORCE_PREVIEW_PARAM_SPECS,
  PREVIEW_ENGINE_REGISTRY,
  getPreviewEngine,
  listPreviewEngines,
  resolvePreviewEngine,
  serializePreviewEngineManifest,
} from '../src/preview-engine/index.js';

describe('preview-engine registry', () => {
  it('registers ELK and force as the first two engines', () => {
    expect(PREVIEW_ENGINE_REGISTRY.map((entry) => entry.id)).toEqual(['elk-layered', 'force']);
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
    expect(FORCE_PREVIEW_ENGINE.apiRoutes?.params).toBe('/api/force-params/{slug}');
  });

  it('resolves engines by layoutEngine key or shell mode', () => {
    expect(resolvePreviewEngine({ layoutEngine: 'elk-layered' })?.id).toBe('elk-layered');
    expect(resolvePreviewEngine({ shellMode: 'force' })?.id).toBe('force');
    expect(resolvePreviewEngine({ shellMode: 'grid', layoutEngine: 'vertical-stack' })).toBeUndefined();
  });

  it('serializes a JSON-safe manifest list for preview-server consumption', () => {
    const serialized = serializePreviewEngineManifest();
    expect(serialized).toHaveLength(2);
    const roundTrip = JSON.parse(JSON.stringify(serialized));
    expect(roundTrip[0].id).toBe('elk-layered');
    expect(roundTrip[1].capabilities.simulationControls).toBe(true);
    expect(listPreviewEngines()).toEqual(serialized);
  });

  it('declares expected shell capabilities per engine lane', () => {
    expect(ELK_LAYERED_PREVIEW_ENGINE.capabilities.serverRelayout).toBe(true);
    expect(ELK_LAYERED_PREVIEW_ENGINE.capabilities.localRelayout).toBe(false);
    expect(FORCE_PREVIEW_ENGINE.capabilities.localRelayout).toBe(true);
    expect(FORCE_PREVIEW_ENGINE.capabilities.simulationControls).toBe(true);
  });
});
