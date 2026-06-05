import { describe, expect, it } from 'vitest';

import { compileDiagramYaml } from '../src/index.js';

describe('compileDiagramYaml', () => {
  it('parses authoring YAML into a scaffold AST with empty diagnostics', () => {
    const result = compileDiagramYaml(
      [
        'schema: author-v1',
        'title: Example diagram',
        'engine: v3',
        'layout:',
        '  group: page',
        '  children: []',
        'edges: []',
        '',
      ].join('\n'),
    );

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.diagnostics).toEqual([]);
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
    expect(result.ast.edges).toEqual([]);
    expect(result.ast.nodes).toEqual({});
    expect(result.ast.groups).toEqual({});
    expect(result.ast.layoutTree).toBeNull();
    expect(result.ast.source).toMatchObject({
      title: 'Example diagram',
      engine: 'v3',
    });
  });
});