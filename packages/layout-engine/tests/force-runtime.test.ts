import { describe, expect, it } from 'vitest';

import {
  applyForceNodePatch,
  createInitialForceSnapshot,
  exportForceSnapshot,
  tickForceSimulation,
  type ForceAuthoredSpec,
} from '../src/force-runtime.js';

describe('createInitialForceSnapshot', () => {
  it('builds a force snapshot with preview defaults and seeded simulation state', () => {
    const spec: ForceAuthoredSpec = {
      title: 'Stakeholders',
      reference_image: 'force/IMG_3229.jpg',
      canvas: { width: 960, height: 640 },
      render: {
        curve_handle_ratio: 0.35,
        curve_handle_min: 24,
        curve_handle_max: 64,
      },
      simulation: {
        ticks_per_frame: 1,
        max_iterations: 220,
        charge_strength: -900,
        link_distance: 256,
        link_strength: 0.08,
        collision_padding: 24,
        collision_iterations: 4,
        velocity_decay: 0.34,
        alpha_min: 0.006,
        center: [480, 320],
      },
      nodes: [
        {
          id: 'users',
          label: ['Users'],
          width: 192,
          height: 64,
          x: 240,
          y: 392,
        },
        {
          id: 'software',
          label: ['The software', 'itself'],
          width: 192,
          height: 64,
          x: 720,
          y: 392,
          fill: '#000000',
          text_fill: '#FFFFFF',
        },
      ],
      links: [
        {
          source: 'users',
          target: 'software',
          stroke: '#E95420',
          stroke_width: 1,
        },
      ],
    };

    const snapshot = createInitialForceSnapshot(spec);

    expect(snapshot.title).toBe('Stakeholders');
    expect(snapshot.reference_image).toBe('force/IMG_3229.jpg');
    expect(snapshot.definition_stale).toBe(false);
    expect(snapshot.simulation.tick_count).toBe(0);
    expect(snapshot.simulation.alpha).toBe(1);
    expect(snapshot.simulation.settled).toBe(false);
    expect(snapshot.simulation.params.link_distance).toBe(256);
    expect(snapshot.render.curve_handle_max).toBe(64);

    expect(snapshot.nodes[0]).toMatchObject({
      id: 'users',
      fill: '#FFFFFF',
      text_fill: '#000000',
      stroke: '#000000',
      stroke_width: 1,
      base_style: 'default',
      style_override: null,
    });
    expect(snapshot.nodes[1]).toMatchObject({
      id: 'software',
      fill: '#000000',
      text_fill: '#FFFFFF',
      stroke: 'none',
      stroke_width: 0,
    });
  });
});

describe('applyForceNodePatch', () => {
  it('updates node coordinates and pins the node at the patched position', () => {
    const spec: ForceAuthoredSpec = {
      title: 'Stakeholders',
      reference_image: 'force/IMG_3229.jpg',
      canvas: { width: 960, height: 640 },
      render: {
        curve_handle_ratio: 0.35,
        curve_handle_min: 24,
        curve_handle_max: 64,
      },
      simulation: {
        ticks_per_frame: 1,
        max_iterations: 220,
        charge_strength: -900,
        link_distance: 256,
        link_strength: 0.08,
        collision_padding: 24,
        collision_iterations: 4,
        velocity_decay: 0.34,
        alpha_min: 0.006,
        center: [480, 320],
      },
      nodes: [
        {
          id: 'users',
          label: ['Users'],
          width: 192,
          height: 64,
          x: 240,
          y: 392,
        },
      ],
      links: [],
    };

    const snapshot = createInitialForceSnapshot(spec);

    const updated = applyForceNodePatch(snapshot, 'users', {
      x: 312,
      y: 416,
      pinned: true,
    });

    expect(updated.nodes[0]).toMatchObject({
      id: 'users',
      x: 312,
      y: 416,
      fx: 312,
      fy: 416,
    });
    expect(snapshot.nodes[0]).toMatchObject({
      id: 'users',
      x: 240,
      y: 392,
    });
    expect(snapshot.nodes[0]).not.toHaveProperty('fx');
    expect(snapshot.nodes[0]).not.toHaveProperty('fy');
  });

  it('applies a style override and can reset back to the base style', () => {
    const spec: ForceAuthoredSpec = {
      title: 'Stakeholders',
      reference_image: 'force/IMG_3229.jpg',
      canvas: { width: 960, height: 640 },
      render: {
        curve_handle_ratio: 0.35,
        curve_handle_min: 24,
        curve_handle_max: 64,
      },
      simulation: {
        ticks_per_frame: 1,
        max_iterations: 220,
        charge_strength: -900,
        link_distance: 256,
        link_strength: 0.08,
        collision_padding: 24,
        collision_iterations: 4,
        velocity_decay: 0.34,
        alpha_min: 0.006,
        center: [480, 320],
      },
      nodes: [
        {
          id: 'users',
          label: ['Users'],
          width: 192,
          height: 64,
          x: 240,
          y: 392,
        },
      ],
      links: [],
    };

    const snapshot = createInitialForceSnapshot(spec);
    const highlighted = applyForceNodePatch(snapshot, 'users', { style: 'highlight' });
    const reset = applyForceNodePatch(highlighted, 'users', { style: null });

    expect(highlighted.nodes[0]).toMatchObject({
      id: 'users',
      base_style: 'default',
      style_override: 'highlight',
      fill: '#000000',
      text_fill: '#FFFFFF',
    });
    expect(reset.nodes[0]).toMatchObject({
      id: 'users',
      base_style: 'default',
      style_override: null,
      fill: '#FFFFFF',
      text_fill: '#000000',
    });
  });

  it('accepts frame-style aliases exposed by the force picker', () => {
    const spec: ForceAuthoredSpec = {
      title: 'Stakeholders',
      reference_image: 'force/IMG_3229.jpg',
      canvas: { width: 960, height: 640 },
      render: {
        curve_handle_ratio: 0.35,
        curve_handle_min: 24,
        curve_handle_max: 64,
      },
      simulation: {
        ticks_per_frame: 1,
        max_iterations: 220,
        charge_strength: -900,
        link_distance: 256,
        link_strength: 0.08,
        collision_padding: 24,
        collision_iterations: 4,
        velocity_decay: 0.34,
        alpha_min: 0.006,
        center: [480, 320],
      },
      nodes: [
        {
          id: 'users',
          label: ['Users'],
          width: 192,
          height: 64,
          x: 240,
          y: 392,
        },
      ],
      links: [],
    };

    const snapshot = createInitialForceSnapshot(spec);
    const parent = applyForceNodePatch(snapshot, 'users', { style: 'parent' });
    const annotation = applyForceNodePatch(parent, 'users', { style: 'annotation' });

    expect(parent.nodes[0]).toMatchObject({
      style_override: 'parent',
      fill: '#F3F3F3',
      stroke: 'none',
      stroke_width: 0,
    });
    expect(annotation.nodes[0]).toMatchObject({
      style_override: 'annotation',
      fill: 'transparent',
      text_fill: '#666666',
      stroke: 'none',
      stroke_width: 0,
    });
  });
});

describe('tickForceSimulation', () => {
  it('advances the local simulation by moving unpinned nodes while pinned nodes stay fixed', () => {
    const spec: ForceAuthoredSpec = {
      title: 'Stakeholders',
      reference_image: 'force/IMG_3229.jpg',
      canvas: { width: 960, height: 640 },
      render: {
        curve_handle_ratio: 0.35,
        curve_handle_min: 24,
        curve_handle_max: 64,
      },
      simulation: {
        ticks_per_frame: 1,
        max_iterations: 220,
        charge_strength: -900,
        link_distance: 256,
        link_strength: 0.08,
        collision_padding: 24,
        collision_iterations: 4,
        velocity_decay: 0.34,
        alpha_min: 0.006,
        center: [480, 320],
      },
      nodes: [
        {
          id: 'users',
          label: ['Users'],
          width: 192,
          height: 64,
          x: 120,
          y: 320,
        },
        {
          id: 'software',
          label: ['The software', 'itself'],
          width: 192,
          height: 64,
          x: 720,
          y: 320,
          fx: 720,
          fy: 320,
        },
      ],
      links: [
        {
          source: 'users',
          target: 'software',
        },
      ],
    };

    const snapshot = createInitialForceSnapshot(spec);

    const advanced = tickForceSimulation(snapshot, 1);

    expect(advanced.simulation.tick_count).toBe(1);
    expect(advanced.simulation.alpha).toBeLessThan(1);
    expect(advanced.simulation.settled).toBe(false);
    expect(advanced.nodes[0].x).toBeGreaterThan(snapshot.nodes[0].x);
    expect(advanced.nodes[0].y).toBeCloseTo(snapshot.nodes[0].y, 6);
    expect(advanced.nodes[1]).toMatchObject({
      id: 'software',
      x: 720,
      y: 320,
      fx: 720,
      fy: 320,
    });
  });
});

describe('exportForceSnapshot', () => {
  it('snaps exported positions to the grid and reset reloads the authored state', () => {
    const spec: ForceAuthoredSpec = {
      title: 'Stakeholders',
      reference_image: 'force/IMG_3229.jpg',
      canvas: { width: 960, height: 640 },
      render: {
        curve_handle_ratio: 0.35,
        curve_handle_min: 24,
        curve_handle_max: 64,
      },
      simulation: {
        ticks_per_frame: 1,
        max_iterations: 220,
        charge_strength: -900,
        link_distance: 256,
        link_strength: 0.08,
        collision_padding: 24,
        collision_iterations: 4,
        velocity_decay: 0.34,
        alpha_min: 0.006,
        center: [480, 320],
      },
      nodes: [
        {
          id: 'users',
          label: ['Users'],
          width: 192,
          height: 64,
          x: 241,
          y: 389,
        },
      ],
      links: [],
    };

    const snapshot = createInitialForceSnapshot(spec);
    const moved = applyForceNodePatch(snapshot, 'users', {
      x: 313,
      y: 418,
      style: 'annotation',
    });

    const exported = windowStructuredCloneSafe(exportForceSnapshot(moved));
    const reset = createInitialForceSnapshot(spec);

    expect(exported.nodes[0]).toMatchObject({
      id: 'users',
      x: 312,
      y: 416,
      style: 'annotation',
      style_override: 'annotation',
      text_fill: '#666666',
      stroke: 'none',
      stroke_width: 0,
    });
    expect(spec.nodes[0]).toMatchObject({ x: 241, y: 389 });
    expect(reset.nodes[0]).toMatchObject({
      id: 'users',
      x: 241,
      y: 389,
      style: 'default',
      style_override: null,
    });
  });
});

function windowStructuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}