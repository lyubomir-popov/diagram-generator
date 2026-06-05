import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { GraphLayoutInput } from '@diagram-generator/graph-layout-core';
import { GRID_BASELINE_PX } from '@diagram-generator/graph-layout-core';

import {
  edgeEndpointsTouchEndpointNodes,
  edgeEndpointsTouchLeaves,
  indexPlacedNodes,
  layoutLayered,
  layoutLayeredForFamily,
  layeredConfigForFamily,
} from '../src/index.js';

const BOX = { width: 192, height: 64 };

function chainInput(direction: 'TB' | 'LR', ids: string[]): GraphLayoutInput {
  return {
    id: 'root',
    direction,
    nodes: ids.map((id) => ({ id, ...BOX })),
    edges: ids.slice(0, -1).map((id, i) => ({
      id: `${id}->${ids[i + 1]}`,
      source: id,
      target: ids[i + 1]!,
    })),
  };
}

function onGrid(n: number): boolean {
  return Math.abs(n % GRID_BASELINE_PX) < 1e-6 || Math.abs(n % GRID_BASELINE_PX - GRID_BASELINE_PX) < 1e-6;
}

describe('ELK layered (Sugiyama)', () => {
  it('lays out a TB chain with monotonic rank (increasing Y)', async () => {
    const result = await layoutLayered(chainInput('TB', ['a', 'b', 'c']));
    const nodes = indexPlacedNodes(result.nodes);

    expect(nodes.get('a')!.y).toBeLessThan(nodes.get('b')!.y);
    expect(nodes.get('b')!.y).toBeLessThan(nodes.get('c')!.y);

    for (const node of nodes.values()) {
      expect(onGrid(node.x)).toBe(true);
      expect(onGrid(node.y)).toBe(true);
    }
  });

  it('lays out an LR chain with monotonic rank (increasing X)', async () => {
    const result = await layoutLayered(chainInput('LR', ['ingress', 'service', 'store']));
    const nodes = indexPlacedNodes(result.nodes);

    expect(nodes.get('ingress')!.x).toBeLessThan(nodes.get('service')!.x);
    expect(nodes.get('service')!.x).toBeLessThan(nodes.get('store')!.x);
  });

  it('places fork siblings on the same rank (equal Y for TB)', async () => {
    const result = await layoutLayered({
      id: 'root',
      direction: 'TB',
      nodes: [
        { id: 'root_node', ...BOX },
        { id: 'left', ...BOX },
        { id: 'right', ...BOX },
      ],
      edges: [
        { id: 'e1', source: 'root_node', target: 'left' },
        { id: 'e2', source: 'root_node', target: 'right' },
      ],
    });
    const nodes = indexPlacedNodes(result.nodes);

    expect(nodes.get('root_node')!.y).toBeLessThan(nodes.get('left')!.y);
    expect(nodes.get('left')!.y).toBe(nodes.get('right')!.y);
  });

  it('returns routed edge sections for orthogonal routing', async () => {
    const result = await layoutLayered(chainInput('TB', ['step1', 'step2']));
    expect(result.edges.length).toBe(1);
    const edge = result.edges[0]!;
    expect(edge.sections.length).toBeGreaterThan(0);
    expect(edge.sections[0]!.startPoint).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  });

  it('maps corpus families to TB vs LR per layout_mapping.py', () => {
    expect(layeredConfigForFamily('deployment_and_runtime_topology').direction).toBe('TB');
    expect(layeredConfigForFamily('process_and_workflow').direction).toBe('TB');
    expect(layeredConfigForFamily('data_flow_and_integration').direction).toBe('LR');
  });

  it('layouts compound hierarchy (nested group)', async () => {
    const result = await layoutLayered({
      id: 'root',
      direction: 'TB',
      nodes: [
        {
          id: 'cluster',
          width: 400,
          height: 200,
          children: [
            { id: 'pod_a', ...BOX },
            { id: 'pod_b', ...BOX },
          ],
        },
        { id: 'downstream', ...BOX },
      ],
      edges: [{ id: 'e1', source: 'pod_a', target: 'downstream' }],
    });

    const nodes = indexPlacedNodes(result.nodes);
    expect(nodes.has('cluster')).toBe(true);
    expect(nodes.has('pod_a')).toBe(true);
    expect(nodes.has('downstream')).toBe(true);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);

    const cluster = nodes.get('cluster')!;
    const podA = nodes.get('pod_a')!;
    expect(podA.x).toBeGreaterThanOrEqual(cluster.x);
    expect(podA.y).toBeGreaterThanOrEqual(cluster.y);
    expect(podA.x + podA.width).toBeLessThanOrEqual(cluster.x + cluster.width + 1);
  });

  it('routes corpus ubuntu-pro edges to leaf node boundaries', async () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const raw = JSON.parse(
      readFileSync(join(__dirname, '../fixtures/corpus-ubuntu-pro-wsl-deployment.graph.json'), 'utf8'),
    ) as GraphLayoutInput & { meta?: { diagramType?: string } };

    const stripLabels = (nodes: GraphLayoutInput['nodes']): GraphLayoutInput['nodes'] =>
      nodes.map(({ id, width, height, children }) => ({
        id,
        width,
        height,
        ...(children?.length ? { children: stripLabels(children) } : {}),
      }));

    const input: GraphLayoutInput = {
      id: raw.id,
      direction: raw.direction,
      spacingProfile: raw.spacingProfile,
      nodes: stripLabels(raw.nodes),
      edges: raw.edges,
    };

    const family = raw.meta?.diagramType ?? 'deployment_and_runtime_topology';
    const result = await layoutLayeredForFamily(family as 'deployment_and_runtime_topology', input);
    const nodes = indexPlacedNodes(result.nodes);

    for (const edge of result.edges) {
      for (const section of edge.sections) {
        expect(
          edgeEndpointsTouchEndpointNodes(section, edge, nodes, GRID_BASELINE_PX),
          `edge ${edge.id} endpoints should touch source/target boxes`,
        ).toBe(true);
      }
    }
  });

  it('routes corpus juju edges including intra-compound step5', async () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const raw = JSON.parse(
      readFileSync(join(__dirname, '../fixtures/corpus-juju-bootstrap-machines-process.graph.json'), 'utf8'),
    ) as GraphLayoutInput & { meta?: { diagramType?: string } };

    const stripLabels = (nodes: GraphLayoutInput['nodes']): GraphLayoutInput['nodes'] =>
      nodes.map(({ id, width, height, children }) => ({
        id,
        width,
        height,
        ...(children?.length ? { children: stripLabels(children) } : {}),
      }));

    const input: GraphLayoutInput = {
      id: raw.id,
      direction: raw.direction,
      spacingProfile: raw.spacingProfile,
      nodes: stripLabels(raw.nodes),
      edges: raw.edges,
    };

    const result = await layoutLayeredForFamily('process_and_workflow', input);
    const nodes = indexPlacedNodes(result.nodes);

    for (const edge of result.edges) {
      for (const section of edge.sections) {
        expect(
          edgeEndpointsTouchEndpointNodes(section, edge, nodes, GRID_BASELINE_PX),
          `edge ${edge.id} endpoints should touch source/target boxes`,
        ).toBe(true);
      }
    }
  });

  it('layoutLayeredForFamily applies data-flow LR defaults', async () => {
    const result = await layoutLayeredForFamily('data_flow_and_integration', {
      id: 'root',
      nodes: [{ id: 'source', ...BOX }, { id: 'sink', ...BOX }],
      edges: [{ id: 'flow', source: 'source', target: 'sink' }],
    });
    expect(result.direction).toBe('LR');
    const nodes = indexPlacedNodes(result.nodes);
    expect(nodes.get('source')!.x).toBeLessThan(nodes.get('sink')!.x);
  });
});
