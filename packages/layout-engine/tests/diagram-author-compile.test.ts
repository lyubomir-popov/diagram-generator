import { describe, expect, it } from 'vitest';

import { compileDiagramYaml } from '../src/index.js';

describe('compileDiagramYaml', () => {
  it('parses frame-tree-native authoring YAML into a scaffold AST with no errors', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Example diagram',
        'engine: v3',
        'arrows: []',
        'root:',
        '  id: page',
        '  children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.raw).toMatchObject({
      schema: 'author-v1',
      title: 'Example diagram',
      engine: 'v3',
    });
    expect(result.ast.metadata).toMatchObject({
      schema: 'author-v1',
      title: 'Example diagram',
      engine: 'v3',
    });
    expect(result.ast.arrows).toEqual([]);
    expect(result.ast.root?.id).toBe('page');
    expect(result.ast.root?.children).toEqual([]);
    expect(result.ast.frameIndex).toMatchObject({
      page: {
        id: 'page',
        isContainer: false,
        path: 'root',
      },
    });
    expect(result.ast.source).toMatchObject({
      title: 'Example diagram',
      engine: 'v3',
    });
  });

  it('normalizes shorthand and object arrows while preserving authored refs', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Arrow example',
        'engine: v3',
        'arrows:',
        '  - tier2_row -> global_server',
        '  - source: global_server.right',
        '    target: tier2_left.left',
        'root:',
        '  id: page',
        '  children:',
        '    - id: tier2_row',
        '      children:',
        '        - id: tier2_left',
        '          children: []',
        '    - id: global_server',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.ast.arrows).toEqual([
      {
        source: 'tier2_row',
        target: 'global_server',
        kind: 'directed',
      },
      {
        source: 'global_server.right',
        target: 'tier2_left.left',
        kind: 'directed',
        id: undefined,
        label: undefined,
        style: undefined,
        color: undefined,
        labelGap: undefined,
        waypoints: undefined,
      },
    ]);
    expect(result.ast.frameIndex).toMatchObject({
      page: { path: 'root' },
      tier2_row: { parentId: 'page', isContainer: true },
      tier2_left: { parentId: 'tier2_row' },
      global_server: { parentId: 'page' },
    });
  });

  it('reports malformed arrow shorthand as a compile error', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Bad arrow example',
        'engine: v3',
        'arrows:',
        '  - public_repo ->',
        'root:',
        '  id: page',
        '  children:',
        '    - id: public_repo',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'ARROW_SHORTHAND_PARSE',
        level: 'error',
      }),
    );
  });

  it('reports unknown arrow source base ids while preserving anchor-qualified ref syntax', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Unknown source example',
        'engine: v3',
        'arrows:',
        '  - missing_box.right -> global_server.left',
        'root:',
        '  id: page',
        '  children:',
        '    - id: global_server',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'ARROW_UNKNOWN_SOURCE',
        level: 'error',
        path: 'arrows[0]',
      }),
    );
  });

  it('reports unknown arrow target base ids while preserving valid source container refs', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Unknown target example',
        'engine: v3',
        'arrows:',
        '  - tier2_row -> missing_box.left',
        'root:',
        '  id: page',
        '  children:',
        '    - id: tier2_row',
        '      children:',
        '        - id: tier2_left',
        '          children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'ARROW_UNKNOWN_TARGET',
        level: 'error',
        path: 'arrows[0]',
      }),
    );
    expect(result.errors).not.toContainEqual(
      expect.objectContaining({
        code: 'ARROW_UNKNOWN_SOURCE',
        path: 'arrows[0]',
      }),
    );
  });

  it('preserves nested container trees and normalizes canonical frame fields', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Nested tree',
        'engine: v3',
        'arrows: []',
        'root:',
        '  id: page',
        '  direction: vertical',
        '  children:',
        '    - id: tier2_row',
        '      direction: horizontal',
        '      padding: 16',
        '      children:',
        '        - id: tier2_left',
        '          label: Left leaf',
        '          sizing_w: fill',
        '          children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.ast.root).toMatchObject({
      id: 'page',
      direction: 'vertical',
      children: [
        {
          id: 'tier2_row',
          direction: 'horizontal',
          padding: 16,
          children: [
            {
              id: 'tier2_left',
              sizingW: 'fill',
              label: [{ text: 'Left leaf' }],
              children: [],
            },
          ],
        },
      ],
    });
    expect(result.ast.frameIndex).toMatchObject({
      page: { path: 'root', isContainer: true },
      tier2_row: { parentId: 'page', isContainer: true, path: 'root.children[0]' },
      tier2_left: { parentId: 'tier2_row', isContainer: false, path: 'root.children[0].children[0]' },
    });
  });

  it('normalizes a canonical sequence block through the authoring compiler without Mermaid runtime authority', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Sequence flow',
        'engine: v3',
        'root:',
        '  id: page',
        '  children: []',
        'sequence:',
        '  participants:',
        '    - id: user',
        '      kind: actor',
        '      label: User',
        '    - id: api',
        '      label:',
        '        - Public',
        '        - API',
        '  messages:',
        '    - from: user',
        '      to: api',
        '      label: GET /v1/things',
        '  notes:',
        '    - target: api',
        '      placement: right-of',
        '      label: Auth happens here',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.ast.sequence).toEqual({
      participants: [
        { id: 'user', kind: 'actor', label: [{ text: 'User' }] },
        { id: 'api', kind: 'participant', label: [{ text: 'Public' }, { text: 'API' }] },
      ],
      messages: [
        {
          id: 'm1',
          from: 'user',
          to: 'api',
          label: [{ text: 'GET /v1/things' }],
        },
      ],
      notes: [
        {
          id: 'note1',
          target: 'api',
          placement: 'right-of',
          label: [{ text: 'Auth happens here' }],
        },
      ],
      groups: [],
    });
  });

  it('reports duplicate frame ids', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Duplicate ids',
        'engine: v3',
        'arrows: []',
        'root:',
        '  id: page',
        '  children:',
        '    - id: dup',
        '      children: []',
        '    - id: dup',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'DUPLICATE_FRAME_ID',
        level: 'error',
        path: 'root.children[1]',
      }),
    );
  });

  it('reports invalid frame child entries', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Invalid child',
        'engine: v3',
        'arrows: []',
        'root:',
        '  id: page',
        '  children:',
        '    - not-a-frame',
        '',
      ].join('\n'),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_FRAME_CHILD',
        level: 'error',
        path: 'root.children[0]',
      }),
    );
  });

  it('reports missing root as a compile error', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Missing root',
        'engine: v3',
        'arrows: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'ROOT_MISSING',
        level: 'error',
        path: 'root',
      }),
    );
    expect(result.ast.root).toBeNull();
  });

  it('allows arrows to container frame endpoints', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Container endpoint',
        'engine: v3',
        'arrows:',
        '  - client -> tier2_row',
        'root:',
        '  id: page',
        '  children:',
        '    - id: client',
        '      children: []',
        '    - id: tier2_row',
        '      children:',
        '        - id: tier2_left',
        '          children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.ast.arrows[0]).toMatchObject({
      source: 'client',
      target: 'tier2_row',
    });
    expect(result.ast.frameIndex.tier2_row.isContainer).toBe(true);
  });

  it('rejects arrows that target the root canvas frame', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Root endpoint',
        'engine: v3',
        'arrows:',
        '  - client -> page',
        'root:',
        '  id: page',
        '  children:',
        '    - id: client',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'ARROW_ROOT_ENDPOINT',
        level: 'error',
        path: 'arrows[0]',
      }),
    );
  });

  it('preserves line-object heading style fields during frame normalization', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Heading styles',
        'engine: v3',
        'arrows: []',
        'root:',
        '  id: panel',
        '  heading:',
        '    text: Tier 1',
        '    size: heading',
        '    weight: bold',
        '  children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.ast.root?.heading).toEqual({
      text: 'Tier 1',
      size: 'heading',
      weight: 'bold',
    });
  });

  it('expands defaults templates onto frames referenced by use', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Template expansion',
        'engine: v3',
        'arrows: []',
        'defaults:',
        '  client:',
        '    label: Client',
        '    icon: Laptop.svg',
        '  network_server:',
        '    label: [Tier 2, Network server]',
        '    icon: Network.svg',
        'root:',
        '  id: page',
        '  children:',
        '    - id: client_l1',
        '      use: client',
        '      children: []',
        '    - id: tier2_left',
        '      use: network_server',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.ast.defaults.client).toEqual({
      label: [{ text: 'Client' }],
      icon: 'Laptop.svg',
    });
    expect(result.ast.defaults.network_server).toEqual({
      label: [{ text: 'Tier 2' }, { text: 'Network server' }],
      icon: 'Network.svg',
    });
    expect(result.ast.root?.children[0]).toMatchObject({
      id: 'client_l1',
      label: [{ text: 'Client' }],
      icon: 'Laptop.svg',
    });
    expect(result.ast.root?.children[0]?.use).toBeUndefined();
    expect(result.ast.root?.children[1]).toMatchObject({
      id: 'tier2_left',
      label: [{ text: 'Tier 2' }, { text: 'Network server' }],
      icon: 'Network.svg',
    });
  });

  it('lets frame-local properties override expanded defaults', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Template override',
        'engine: v3',
        'arrows: []',
        'defaults:',
        '  client:',
        '    label: Client',
        '    icon: Laptop.svg',
        'root:',
        '  id: page',
        '  children:',
        '    - id: client_l1',
        '      use: client',
        '      label: Special client',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.ast.root?.children[0]).toMatchObject({
      id: 'client_l1',
      label: [{ text: 'Special client' }],
      icon: 'Laptop.svg',
    });
  });

  it('reports unknown default templates referenced by use', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Missing template',
        'engine: v3',
        'arrows: []',
        'root:',
        '  id: page',
        '  children:',
        '    - id: client_l1',
        '      use: missing_template',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'UNKNOWN_TEMPLATE',
        level: 'error',
        path: 'root.children[0]',
      }),
    );
    expect(result.ast.root?.children[0]?.use).toBe('missing_template');
  });

  it('preserves line-object label style fields in defaults templates', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Styled template label',
        'engine: v3',
        'arrows: []',
        'defaults:',
        '  panel:',
        '    label:',
        '      - text: Tier 1',
        '        size: heading',
        '        weight: bold',
        'root:',
        '  id: page',
        '  children:',
        '    - id: tier1',
        '      use: panel',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.ast.defaults.panel?.label).toEqual([
      {
        text: 'Tier 1',
        size: 'heading',
        weight: 'bold',
      },
    ]);
    expect(result.ast.root?.children[0]?.label).toEqual([
      {
        text: 'Tier 1',
        size: 'heading',
        weight: 'bold',
      },
    ]);
  });

  it('does not warn about the layout root wrapper as an orphan leaf', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Root wrapper only',
        'engine: v3',
        'arrows: []',
        'root:',
        '  id: page',
        '  children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings.filter(w => w.code === 'ORPHAN_LEAF')).toEqual([]);
  });

  it('warns about unused default templates', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Unused default',
        'engine: v3',
        'arrows: []',
        'defaults:',
        '  client:',
        '    label: Client',
        '  unused:',
        '    label: Never referenced',
        'root:',
        '  id: page',
        '  children:',
        '    - id: client_l1',
        '      use: client',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'UNUSED_DEFAULT',
        path: 'defaults.unused',
      }),
    );
  });

  it('warns about orphan leaf frames without incident arrows', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Orphan leaf',
        'engine: v3',
        'arrows:',
        '  - client -> server',
        'root:',
        '  id: page',
        '  children:',
        '    - id: client',
        '      children: []',
        '    - id: server',
        '      children: []',
        '    - id: orphan',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'ORPHAN_LEAF',
        path: 'root.children[2]',
      }),
    );
  });

  it('treats arrow-to-arrow attachments as incident on the host arrow endpoints', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Arrow attachment incidents',
        'engine: v3',
        'arrows:',
        '  - id: stem',
        '    source: source',
        '    target: target',
        '  - source: branch',
        '    target: arrow:stem',
        'root:',
        '  id: page',
        '  children:',
        '    - id: source',
        '      children: []',
        '    - id: target',
        '      children: []',
        '    - id: branch',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings.filter(w => w.code === 'ORPHAN_LEAF')).toEqual([]);
  });

  it('warns about duplicate arrows and self-loops by default', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Arrow warnings',
        'engine: v3',
        'arrows:',
        '  - client -> client',
        '  - client -> server',
        '  - client -> server',
        'root:',
        '  id: page',
        '  children:',
        '    - id: client',
        '      children: []',
        '    - id: server',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'SELF_LOOP_ARROW',
        path: 'arrows[0]',
      }),
    );
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'DUPLICATE_ARROW',
        path: 'arrows[2]',
      }),
    );
  });

  it('promotes duplicate arrows and self-loops to errors in strict mode', () => {
    const yaml = [
      'schema: author-v1',
      'title: Strict mode',
      'engine: v3',
      'arrows:',
      '  - client -> client',
      '  - client -> server',
      '  - client -> server',
      'root:',
      '  id: page',
      '  children:',
      '    - id: client',
      '      children: []',
      '    - id: server',
      '      children: []',
      '',
    ].join('\n');

    const result = compileDiagramYaml(yaml, { strict: true });

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'SELF_LOOP_ARROW',
        level: 'error',
        path: 'arrows[0]',
      }),
    );
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'DUPLICATE_ARROW',
        level: 'error',
        path: 'arrows[2]',
      }),
    );
    expect(result.warnings.filter(w => w.code === 'SELF_LOOP_ARROW')).toEqual([]);
    expect(result.warnings.filter(w => w.code === 'DUPLICATE_ARROW')).toEqual([]);
  });

  it('keeps unknown arrow endpoint diagnostics as errors regardless of strict mode', () => {
    const yaml = [
      'schema: author-v1',
      'title: Strict unknown endpoint',
      'engine: v3',
      'arrows:',
      '  - missing -> client',
      'root:',
      '  id: page',
      '  children:',
      '    - id: client',
      '      children: []',
      '',
    ].join('\n');

    const result = compileDiagramYaml(yaml, { strict: true });

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'ARROW_UNKNOWN_SOURCE',
        level: 'error',
      }),
    );
  });

  it('reports malformed default template entries', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Bad default',
        'engine: v3',
        'arrows: []',
        'defaults:',
        '  client: Client',
        'root:',
        '  id: page',
        '  children:',
        '    - id: client_l1',
        '      use: client',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_DEFAULT',
        level: 'error',
        path: 'defaults.client',
      }),
    );
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'UNKNOWN_TEMPLATE',
        level: 'error',
        path: 'root.children[0]',
      }),
    );
    expect(result.frameDiagram).toBeUndefined();
  });

  it('reports frames with missing ids', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Missing frame id',
        'engine: v3',
        'arrows: []',
        'root:',
        '  id: page',
        '  children:',
        '    - label: Orphan entry',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'FRAME_MISSING_ID',
        level: 'error',
        path: 'root.children[0]',
      }),
    );
    expect(result.frameDiagram).toBeUndefined();
  });

  it('lowers a valid diagram to FrameDiagram when compile has no errors', () => {
    const result = compileDiagramYaml(
      [
        'engine: v3',
        'title: Preview smoke',
        'arrows:',
        '  - source: define',
        '    target: measure',
        'root:',
        '  id: page',
        '  direction: vertical',
        '  children:',
        '    - id: define',
        '      label: Define',
        '      children: []',
        '    - id: measure',
        '      label: Measure',
        '      children: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.frameDiagram).toBeDefined();
    expect(result.frameDiagram?.title).toBe('Preview smoke');
    expect(result.frameDiagram?.root.id).toBe('page');
    expect(result.frameDiagram?.arrows).toHaveLength(1);
    expect(result.frameDiagram?.arrows[0]?.source).toBe('define');
    expect(result.frameDiagram?.arrows[0]?.target).toBe('measure');
  });
});