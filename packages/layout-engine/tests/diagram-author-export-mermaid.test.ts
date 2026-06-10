import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { compileDiagramYaml } from '../src/diagram-author/compile.js';
import { exportMermaid } from '../src/diagram-author/export-mermaid.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('exportMermaid', () => {
  it('exports nested containers, multiline labels, and arrows for the tiered-network shape', () => {
    const result = compileDiagramYaml(
      [
        'engine: v3',
        'title: Tiered network architecture',
        'arrows:',
        '  - public_repo -> global_server',
        '  - global_server -> tier2_left',
        'root:',
        '  id: page',
        '  direction: vertical',
        '  padding: 24',
        '  align: top-center',
        '  children:',
        '    - id: public_repo',
        '      label:',
        '        - Public',
        '        - repository',
        '      icon: Cloud.svg',
        '      sizing_w: fill',
        '    - id: global_server',
        '      label:',
        '        - Tier 1',
        '        - Global server',
        '      icon: Server.svg',
        '    - id: tier2_row',
        '      direction: horizontal',
        '      children:',
        '        - id: group_left',
        '          direction: vertical',
        '          children:',
        '            - id: tier2_left',
        '              label:',
        '                - Tier 2',
        '                - Network server',
        '              icon: Network.svg',
        '            - id: client_l1',
        '              label: Client',
        '              icon: Laptop.svg',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    const exported = exportMermaid(result.ast);

    expect(exported.mermaid).toBe(
      [
        'flowchart TB',
        '',
        '  public_repo["Public<br/>repository"]',
        '  global_server["Tier 1<br/>Global server"]',
        '  subgraph tier2_row',
        '    subgraph group_left',
        '      tier2_left["Tier 2<br/>Network server"]',
        '      client_l1["Client"]',
        '    end',
        '  end',
        '',
        '  public_repo --> global_server',
        '  global_server --> tier2_left',
        '',
      ].join('\n'),
    );
    expect(exported.warnings).toContainEqual(
      expect.objectContaining({
        code: 'MERMAID_UNSUPPORTED_ICON',
        path: 'root.children[0]',
      }),
    );
    expect(exported.warnings).toContainEqual(
      expect.objectContaining({
        code: 'MERMAID_UNSUPPORTED_LAYOUT',
        path: 'root.children[0]',
      }),
    );
  });

  it('degrades anchor-qualified arrow refs with warnings', () => {
    const result = compileDiagramYaml(
      [
        'engine: v3',
        'title: Anchored arrows',
        'arrows:',
        '  - tier2_row.left -> global_server.right',
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
    const exported = exportMermaid(result.ast);

    expect(exported.mermaid).toContain('tier2_row --> global_server');
    expect(exported.warnings).toContainEqual(
      expect.objectContaining({
        code: 'MERMAID_UNSUPPORTED_ANCHOR_REF',
        path: 'arrows[0]',
      }),
    );
  });

  it('exports the tiered-network corpus fixture with all authored edges', () => {
    const yamlPath = join(repoRoot, 'scripts', 'diagrams', 'frames', 'tiered-network-architecture.yaml');
    const compiled = compileDiagramYaml(readFileSync(yamlPath, 'utf-8'), { sourcePath: yamlPath });

    expect(compiled.errors).toEqual([]);
    const exported = exportMermaid(compiled.ast);
    const edgeCount = (exported.mermaid.match(/-->/g) ?? []).length;

    expect(exported.mermaid).toContain('subgraph tier2_row');
    expect(exported.mermaid).toContain('public_repo["Public<br/>repository"]');
    expect(edgeCount).toBe(compiled.ast.arrows.length);
    expect(exported.warnings.some(w => w.code.startsWith('MERMAID_UNSUPPORTED_'))).toBe(true);
  });

  it('skips arrows that target the root canvas frame and warns defensively', () => {
    const ast = {
      metadata: {},
      defaults: {},
      root: {
        id: 'page',
        children: [{ id: 'client', children: [] }],
      },
      arrows: [{ source: 'client', target: 'page', kind: 'directed' as const }],
      frameIndex: {
        page: { id: 'page', isContainer: true, path: 'root' },
        client: { id: 'client', isContainer: false, path: 'root.children[0]', parentId: 'page' },
      },
      source: {},
    };

    const exported = exportMermaid(ast);

    expect(exported.mermaid).not.toContain('client --> page');
    expect(exported.warnings).toContainEqual(
      expect.objectContaining({
        code: 'MERMAID_ROOT_ENDPOINT_UNSUPPORTED',
        path: 'arrows[0]',
      }),
    );
  });

  it('warns on missing frame refs and skips invalid arrows', () => {
    const ast = {
      metadata: {},
      defaults: {},
      root: { id: 'page', children: [{ id: 'only_node', children: [] }] },
      arrows: [{ source: 'missing', target: 'only_node', kind: 'directed' as const }],
      frameIndex: {
        only_node: { id: 'only_node', isContainer: false, path: 'root.children[0]', parentId: 'page' },
      },
      source: {},
    };

    const exported = exportMermaid(ast);

    expect(exported.mermaid).not.toContain('missing -->');
    expect(exported.warnings).toContainEqual(
      expect.objectContaining({
        code: 'MERMAID_MISSING_FRAME_REF',
        path: 'arrows[0]',
      }),
    );
  });

  it('warns cleanly for arrow-to-arrow refs without misreporting missing frames', () => {
    const ast = {
      metadata: {},
      defaults: {},
      root: { id: 'page', children: [{ id: 'source', children: [] }, { id: 'target', children: [] }] },
      arrows: [
        { id: 'stem', source: 'source', target: 'target', kind: 'directed' as const },
        { source: 'arrow:stem', target: 'target', kind: 'directed' as const },
      ],
      frameIndex: {
        source: { id: 'source', isContainer: false, path: 'root.children[0]', parentId: 'page' },
        target: { id: 'target', isContainer: false, path: 'root.children[1]', parentId: 'page' },
      },
      source: {},
    };

    const exported = exportMermaid(ast);

    expect(exported.mermaid).toContain('source --> target');
    expect(exported.warnings).toContainEqual(
      expect.objectContaining({
        code: 'MERMAID_UNSUPPORTED_ANCHOR_REF',
        path: 'arrows[1]',
      }),
    );
    expect(exported.warnings).not.toContainEqual(
      expect.objectContaining({
        code: 'MERMAID_MISSING_FRAME_REF',
        path: 'arrows[1]',
      }),
    );
  });
});
