import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createArrow, Frame, FrameDiagram } from '../src/frame-model.js';
import { loadFrameYaml } from '../src/frame-yaml-loader.js';
import { MockTextAdapter } from '../src/text-measure.js';
import { renderFrameDiagramToSvg } from '../src/svg-render.js';

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
});