import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createArrow, createLine, Frame, FrameDiagram } from '../src/frame-model.js';
import { routeArrows } from '../src/arrow-routing.js';
import { loadFrameYaml } from '../src/frame-yaml-loader.js';
import { layoutFrameTree } from '../src/layout.js';
import { emitFrameDiagramDisplayList } from '../src/render-adapter/display-list.js';
import { MockTextAdapter } from '../src/text-measure.js';
import { renderFrameDiagramToSvg } from '../src/svg-render.js';

function findFrameById(frame: Frame, id: string): Frame {
  const match = maybeFindFrameById(frame, id);
  if (match) return match;
  throw new Error(`Frame not found: ${id}`);
}

function maybeFindFrameById(frame: Frame, id: string): Frame | undefined {
  if (frame.id === id) return frame;
  for (const child of frame.children) {
    const match = maybeFindFrameById(child, id);
    if (match) return match;
  }
  return undefined;
}

describe('arrow rendering parity', () => {
  it('loadFrameYaml parses arrow label arrays and label_gap', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'dg-arrow-test-'));
    const yamlPath = join(tempDir, 'arrow.yaml');

    try {
      writeFileSync(
        yamlPath,
        [
          'engine: v3',
          'title: loader parity',
          'arrows:',
          '  - source: source.right',
          '    target: target.left',
          '    label:',
          '      - fast path',
          '      - fallback',
          '    label_gap: 40',
          'root:',
          '  id: page',
          '  direction: horizontal',
          '  children:',
          '    - id: source',
          '      label: [Source]',
          '    - id: target',
          '      label: [Target]',
          '',
        ].join('\n'),
        'utf8',
      );

      const diagram = loadFrameYaml(yamlPath);

      expect(diagram.arrows).toHaveLength(1);
      expect(diagram.arrows[0]?.label?.map(line => line.content)).toEqual(['fast path', 'fallback']);
      expect(diagram.arrows[0]?.labelGap).toBe(40);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('renderFrameDiagramToSvg preserves authored arrow waypoints', () => {
    const root = new Frame({
      id: 'page',
      children: [
        new Frame({ id: 'source', label: [{ content: 'Source' }] }),
        new Frame({ id: 'target', label: [{ content: 'Target' }] }),
      ],
    });

    root._layout.placedX = 0;
    root._layout.placedY = 0;
    root._layout.placedW = 300;
    root._layout.placedH = 150;

    const source = root.children[0]!;
    source._layout.placedX = 0;
    source._layout.placedY = 0;
    source._layout.placedW = 50;
    source._layout.placedH = 50;

    const target = root.children[1]!;
    target._layout.placedX = 200;
    target._layout.placedY = 0;
    target._layout.placedW = 50;
    target._layout.placedH = 50;

    const diagram = new FrameDiagram({
      root,
      arrows: [
        createArrow('source.right', 'target.left', {
          waypoints: [[50, 100], [200, 100]],
        }),
      ],
    });

    const svg = renderFrameDiagramToSvg(diagram, { width: 300, height: 150 }, new MockTextAdapter());

    expect(svg).toContain('x1="50" y1="25" x2="50" y2="100"');
    expect(svg).toContain('x1="50" y1="100" x2="200" y2="100"');
  });

  it('ignores raw YAML line style fields in favor of semantic defaults', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'dg-line-style-test-'));
    const yamlPath = join(tempDir, 'styled-lines.yaml');

    try {
      writeFileSync(
        yamlPath,
        [
          'engine: v3',
          'title: loader strips line styling',
          'root:',
          '  id: page',
          '  children:',
          '    - id: note',
          '      variant: annotation',
          '      label:',
          '        - text: Semantic note',
          '          fill: "#FF00FF"',
          '          weight: "900"',
          '          small_caps: true',
          '',
        ].join('\n'),
        'utf8',
      );

      const diagram = loadFrameYaml(yamlPath);
      const note = diagram.root.children[0]!;

      expect(note.label[0]?.content).toBe('Semantic note');
      expect(note.label[0]?.fill).toBe('#000000');
      expect(note.label[0]?.weight).toBe('400');
      expect(note.label[0]?.smallCaps).toBe(false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('derives compact gap for plain containers whose children are all leaves', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'dg-gap-test-'));
    const yamlPath = join(tempDir, 'derived-gap.yaml');

    try {
      writeFileSync(
        yamlPath,
        [
          'engine: v3',
          'title: derived gap',
          'root:',
          '  id: page',
          '  children:',
          '    - id: cluster',
          '      children:',
          '        - id: alpha',
          '          label: [Alpha]',
          '        - id: beta',
          '          label: [Beta]',
          '',
        ].join('\n'),
        'utf8',
      );

      const diagram = loadFrameYaml(yamlPath);
      const cluster = diagram.root.children[0]!;

      expect(cluster.gap).toBe(8);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('warns when a programmatic arrow ref cannot attach to a routed host arrow', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const routed = routeArrows(
        [
          createArrow('arrow:stem', 'branch.left'),
          createArrow('source.bottom', 'target.top', { id: 'stem' }),
        ],
        {
          source: { x: 0, y: 0, w: 80, h: 40 },
          target: { x: 0, y: 120, w: 80, h: 40 },
          branch: { x: 160, y: 120, w: 80, h: 40 },
        },
      );

      expect(routed).toHaveLength(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('unresolved source arrow attachment stem'));
    } finally {
      warn.mockRestore();
    }
  });

  it('clamps dense-stack gap_delta so arrow lanes never shrink below 24px', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stack = new Frame({
      id: 'stack',
      gap: 0,
      gapDelta: -16,
      children: [
        new Frame({ id: 'alpha', label: [{ content: 'Alpha' }] }),
        new Frame({ id: 'beta', label: [{ content: 'Beta' }] }),
      ],
    });
    const root = new Frame({
      id: 'page',
      children: [stack],
    });

    try {
      layoutFrameTree(root, new MockTextAdapter(), {
        arrows: [createArrow('alpha.bottom', 'beta.top')],
      });

      const alpha = stack.children[0]!;
      const beta = stack.children[1]!;
      const actualGap = beta._layout.placedY - (alpha._layout.placedY + alpha._layout.placedH);

      expect(actualGap).toBe(24);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('clamped gap_delta'));
    } finally {
      warn.mockRestore();
    }
  });

  it('derives headed title gap 0 and body gap 24 when body contains a container', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'dg-heading-gap-test-'));
    const yamlPath = join(tempDir, 'heading-gap.yaml');

    try {
      writeFileSync(
        yamlPath,
        [
          'engine: v3',
          'title: heading gap derivation',
          'root:',
          '  id: page',
          '  children:',
          '    - id: panel',
          '      heading: Title',
          '      children:',
          '        - id: subgroup',
          '          children:',
          '            - id: item',
          '              label: [Item]',
          '',
        ].join('\n'),
        'utf8',
      );

      const diagram = loadFrameYaml(yamlPath);
      const panel = diagram.root.children[0]!;
      const body = panel.children.find(child => child.id.endsWith('__body'))!;

      expect(panel.gap).toBe(0);
      expect(body.gap).toBe(24);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('defaults plain non-root headingless container padding to 0px', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'dg-padding-test-'));
    const yamlPath = join(tempDir, 'derived-padding.yaml');

    try {
      writeFileSync(
        yamlPath,
        [
          'engine: v3',
          'title: derived padding',
          'root:',
          '  id: page',
          '  children:',
          '    - id: cluster',
          '      children:',
          '        - id: alpha',
          '          label: [Alpha]',
          '',
        ].join('\n'),
        'utf8',
      );

      const diagram = loadFrameYaml(yamlPath);
      const cluster = diagram.root.children[0]!;

      expect(cluster.padding).toBe(0);
      expect(cluster.paddingTop).toBe(0);
      expect(cluster.paddingRight).toBe(0);
      expect(cluster.paddingBottom).toBe(0);
      expect(cluster.paddingLeft).toBe(0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('renders leaf heading and body as separate blocks without needing a blank label row', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'dg-leaf-heading-test-'));
    const yamlPath = join(tempDir, 'leaf-heading.yaml');

    try {
      writeFileSync(
        yamlPath,
        [
          'engine: v3',
          'title: leaf heading',
          'root:',
          '  id: page',
          '  children:',
          '    - id: card',
          '      level: 3',
          '      heading: The problem',
          '      label: [Databases have crawled to a halt.]',
          '',
        ].join('\n'),
        'utf8',
      );

      const diagram = loadFrameYaml(yamlPath);
      const card = diagram.root.children[0]!;
      const svg = renderFrameDiagramToSvg(diagram, { width: 400, height: 160 }, new MockTextAdapter());

      expect(card.heading?.content).toBe('The problem');
      expect(svg).toContain('>The problem</tspan>');
      expect(svg).toContain('>Databases have crawled to a halt.</tspan>');
      expect(svg).toContain('font-weight="700" fill="#000000">The problem</tspan>');
      expect(svg).toContain('font-weight="400" fill="#000000">Databases have crawled to a halt.</tspan>');
      expect(svg).not.toContain('font-weight="700" fill="#000000">Databases have crawled to a halt.</tspan>');
      expect(svg).toMatch(/<text[^>]*><tspan x="8" y="24\.92"[^>]*>The problem<\/tspan><\/text><text[^>]*><tspan x="8" y="72\.92"[^>]*>Databases have crawled to a halt\.<\/tspan><\/text>/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps annotation leaf side padding at 0 while top and bottom stay at 8px', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'dg-annotation-padding-test-'));
    const yamlPath = join(tempDir, 'annotation-padding.yaml');

    try {
      writeFileSync(
        yamlPath,
        [
          'engine: v3',
          'title: annotation padding',
          'root:',
          '  id: page',
          '  children:',
          '    - id: note',
          '      variant: annotation',
          '      label: [Note]',
          '',
        ].join('\n'),
        'utf8',
      );

      const diagram = loadFrameYaml(yamlPath);
      const note = diagram.root.children[0]!;

      expect(note.paddingTop).toBe(8);
      expect(note.paddingRight).toBe(0);
      expect(note.paddingBottom).toBe(8);
      expect(note.paddingLeft).toBe(0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('renders arrow labels with annotation variant styling, not authored line styling', () => {
    const root = new Frame({
      id: 'page',
      children: [
        new Frame({ id: 'source', label: [createLine('Source')] }),
        new Frame({ id: 'target', label: [createLine('Target')] }),
      ],
    });

    root._layout.placedX = 0;
    root._layout.placedY = 0;
    root._layout.placedW = 300;
    root._layout.placedH = 150;

    const source = root.children[0]!;
    source._layout.placedX = 0;
    source._layout.placedY = 0;
    source._layout.placedW = 50;
    source._layout.placedH = 50;

    const target = root.children[1]!;
    target._layout.placedX = 200;
    target._layout.placedY = 0;
    target._layout.placedW = 50;
    target._layout.placedH = 50;

    const diagram = new FrameDiagram({
      root,
      arrows: [
        createArrow('source.right', 'target.left', {
          label: [createLine('Fast path', { fill: '#FF00FF', weight: '900', smallCaps: true })],
        }),
      ],
    });

    const svg = renderFrameDiagramToSvg(diagram, { width: 300, height: 150 }, new MockTextAdapter());

    expect(svg).toContain('>Fast path</tspan>');
    expect(svg).toContain('fill="#666666"');
    expect(svg).toContain('font-weight="400"');
    expect(svg).not.toContain('fill="#FF00FF">Fast path</tspan>');
    expect(svg).not.toContain('font-weight="900"');
    expect(svg).not.toContain('font-variant-caps="small-caps">Fast path</tspan>');
  });

  it('promotes dense leaf-stack gaps globally when arrows need inter-child lanes', () => {
    const diagram = loadFrameYaml('../../scripts/diagrams/frames/ssdlc-lifecycle.yaml');
    const adapter = new MockTextAdapter();
    layoutFrameTree(diagram.root, adapter, {
      gridCols: diagram.gridCols,
      gridColGap: diagram.gridColGap,
      gridRowGap: diagram.gridRowGap,
      gridOuterMargin: diagram.gridOuterMargin,
      arrows: diagram.arrows,
    });

    const phaseA = findFrameById(diagram.root, 'phase_a');
    const purposeA = findFrameById(diagram.root, 'purpose_a');
    const phaseB = findFrameById(diagram.root, 'phase_b');
    const purposeB = findFrameById(diagram.root, 'purpose_b');
    const phaseC = findFrameById(diagram.root, 'phase_c');
    const purposeC = findFrameById(diagram.root, 'purpose_c');

    const gapA = purposeA._layout.placedY - (phaseA._layout.placedY + phaseA._layout.placedH);
    const gapB = purposeB._layout.placedY - (phaseB._layout.placedY + phaseB._layout.placedH);
    const gapC = purposeC._layout.placedY - (phaseC._layout.placedY + phaseC._layout.placedH);

    expect(gapA).toBe(24);
    expect(gapB).toBe(24);
    expect(gapC).toBe(24);
  });

  it('applies authored gap_delta on top of the promoted dense arrow lane gap', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'dg-arrow-test-'));
    const yamlPath = join(tempDir, 'gap-delta.yaml');

    try {
      writeFileSync(
        yamlPath,
        [
          'engine: v3',
          'title: gap delta override',
          'arrows:',
          '  - source: phase',
          '    target: purpose',
          'root:',
          '  id: page',
          '  direction: vertical',
          '  children:',
          '    - id: flow',
          '      direction: vertical',
          '      gap_delta: 4',
          '      children:',
          '        - id: phase',
          '          label: [Phase]',
          '        - id: purpose',
          '          label: [Purpose]',
          '',
        ].join('\n'),
        'utf8',
      );

      const diagram = loadFrameYaml(yamlPath);
      const adapter = new MockTextAdapter();
      layoutFrameTree(diagram.root, adapter, {
        gridCols: diagram.gridCols,
        gridColGap: diagram.gridColGap,
        gridRowGap: diagram.gridRowGap,
        gridOuterMargin: diagram.gridOuterMargin,
        arrows: diagram.arrows,
      });

      const flow = findFrameById(diagram.root, 'flow');
      const phase = findFrameById(diagram.root, 'phase');
      const purpose = findFrameById(diagram.root, 'purpose');
      const gap = purpose._layout.placedY - (phase._layout.placedY + phase._layout.placedH);

      expect(flow.gap).toBe(12);
      expect(gap).toBe(28);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('routes ssdlc fan arrows from a shared bottom stem into the phase tops', () => {
    const diagram = loadFrameYaml('../../scripts/diagrams/frames/ssdlc-lifecycle.yaml');
    const adapter = new MockTextAdapter();
    const layout = layoutFrameTree(diagram.root, adapter, {
      gridCols: diagram.gridCols,
      gridColGap: diagram.gridColGap,
      gridRowGap: diagram.gridRowGap,
      gridOuterMargin: diagram.gridOuterMargin,
      arrows: diagram.arrows,
    });
    const displayList = emitFrameDiagramDisplayList(diagram, layout, adapter);

    const ssdlc = findFrameById(diagram.root, 'ssdlc');
    const phaseA = findFrameById(diagram.root, 'phase_a');
    const phaseB = findFrameById(diagram.root, 'phase_b');
    const phaseC = findFrameById(diagram.root, 'phase_c');
    const sourceCenterX = ssdlc._layout.placedX + ssdlc._layout.placedW / 2;
    const sourceBottomY = ssdlc._layout.placedY + ssdlc._layout.placedH;
    const targetCenters = new Map([
      ['ssdlc->phase_a', phaseA._layout.placedX + phaseA._layout.placedW / 2],
      ['ssdlc->phase_b', phaseB._layout.placedX + phaseB._layout.placedW / 2],
      ['ssdlc->phase_c', phaseC._layout.placedX + phaseC._layout.placedW / 2],
    ]);
    const centerArrowId = 'ssdlc->phase_b';

    for (const [arrowId, targetCenterX] of targetCenters) {
      const group = displayList.items.find(
        item => item.kind === 'group' && item.id === arrowId,
      );
      expect(group && group.kind === 'group').toBeTruthy();
      const lines = group && group.kind === 'group'
        ? group.children.filter(item => item.kind === 'line')
        : [];
      if (arrowId === centerArrowId) {
        expect(lines).toHaveLength(1);
      } else {
        expect(lines.length).toBeGreaterThan(1);
      }

      const firstLine = lines[0]!;
      expect(firstLine.x1).toBe(sourceCenterX);
      expect(firstLine.x2).toBe(sourceCenterX);
      expect(firstLine.y1).toBe(sourceBottomY);

      if (arrowId === centerArrowId) {
        expect(firstLine.x1).toBe(targetCenterX);
        expect(firstLine.x2).toBe(targetCenterX);
      } else {
        const horizontalFork = lines.find(line => line.y1 === line.y2 && line.x1 !== line.x2);
        expect(horizontalFork).toBeTruthy();
        expect(horizontalFork?.x2).toBe(targetCenterX);
      }
    }
  });

  it('attaches arrow:<id> branches onto the routed stem segment', () => {
    const routed = routeArrows(
      [
        createArrow('source.bottom', 'target.top', { id: 'stem' }),
        createArrow('arrow:stem', 'branch.left'),
      ],
      {
        source: { x: 100, y: 0, w: 60, h: 40 },
        target: { x: 100, y: 140, w: 60, h: 40 },
        branch: { x: 220, y: 60, w: 60, h: 40 },
      },
    );

    expect(routed).toHaveLength(2);
    expect(routed[1]?.points[0]).toEqual([130, 80]);
    expect(routed[1]?.points[routed[1]!.points.length - 1]).toEqual([220, 80]);
  });
});
