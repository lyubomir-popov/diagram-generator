import { extractBaseFrameId } from './ref-grammar.js';
import type { AuthorArrow, AuthorFrameNode, DiagramDocument, Diagnostic } from './types.js';

export interface MermaidExportResult {
  mermaid: string;
  warnings: Diagnostic[];
}

const UNSUPPORTED_LAYOUT_FIELDS: (keyof AuthorFrameNode)[] = [
  'direction',
  'gap',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'sizing',
  'sizingW',
  'sizingH',
  'fillWeight',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'maxWidthChars',
  'minHeight',
  'maxHeight',
  'align',
  'justify',
  'wrap',
  'fill',
  'border',
  'position',
  'x',
  'y',
  'colSpan',
  'level',
  'variant',
  'role',
];

function escapeMermaidLabel(text: string): string {
  return text.replace(/"/g, '#quot;');
}

function formatNodeLabel(node: AuthorFrameNode): string {
  if (node.label?.length) {
    return node.label.map(line => escapeMermaidLabel(line.text)).join('<br/>');
  }
  if (node.heading) {
    return escapeMermaidLabel(node.heading.text);
  }
  return escapeMermaidLabel(node.id);
}

function collectFrameWarnings(node: AuthorFrameNode, path: string, warnings: Diagnostic[]): void {
  if (node.icon || node.iconFill) {
    warnings.push({
      code: 'MERMAID_UNSUPPORTED_ICON',
      level: 'warning',
      message: `Mermaid export ignores icon metadata for frame: ${node.id}`,
      path,
    });
  }

  if (node.children.length > 0 && (node.label?.length || node.heading)) {
    warnings.push({
      code: 'MERMAID_UNSUPPORTED_CONTAINER_LABEL',
      level: 'warning',
      message: `Mermaid export ignores container label/heading metadata for frame: ${node.id}`,
      path,
    });
  }

  if (UNSUPPORTED_LAYOUT_FIELDS.some(field => node[field] !== undefined)) {
    warnings.push({
      code: 'MERMAID_UNSUPPORTED_LAYOUT',
      level: 'warning',
      message: `Mermaid export ignores layout metadata for frame: ${node.id}`,
      path,
    });
  }

  node.children.forEach((child, index) => {
    collectFrameWarnings(child, `${path}.children[${index}]`, warnings);
  });
}

function renderFrameNode(
  node: AuthorFrameNode,
  lines: string[],
  indent: string,
): void {
  if (node.children.length > 0) {
    lines.push(`${indent}subgraph ${node.id}`);
    node.children.forEach(child => renderFrameNode(child, lines, `${indent}  `));
    lines.push(`${indent}end`);
    return;
  }

  lines.push(`${indent}${node.id}["${formatNodeLabel(node)}"]`);
}

function renderArrow(
  arrow: AuthorArrow,
  index: number,
  lines: string[],
  warnings: Diagnostic[],
  ast: DiagramDocument,
): void {
  const sourceBase = extractBaseFrameId(arrow.source);
  const targetBase = extractBaseFrameId(arrow.target);

  if (ast.root && (sourceBase === ast.root.id || targetBase === ast.root.id)) {
    warnings.push({
      code: 'MERMAID_ROOT_ENDPOINT_UNSUPPORTED',
      level: 'warning',
      message: `Mermaid export skips arrows that target the root canvas frame: ${arrow.source} -> ${arrow.target}`,
      path: `arrows[${index}]`,
    });
    return;
  }

  if (!ast.frameIndex[sourceBase] || !ast.frameIndex[targetBase]) {
    warnings.push({
      code: 'MERMAID_MISSING_FRAME_REF',
      level: 'warning',
      message: `Mermaid export skips arrow with missing frame refs: ${arrow.source} -> ${arrow.target}`,
      path: `arrows[${index}]`,
    });
    return;
  }

  if (arrow.source !== sourceBase) {
    warnings.push({
      code: 'MERMAID_UNSUPPORTED_ANCHOR_REF',
      level: 'warning',
      message: `Mermaid export degrades anchor-qualified source ref: ${arrow.source}`,
      path: `arrows[${index}]`,
    });
  }
  if (arrow.target !== targetBase) {
    warnings.push({
      code: 'MERMAID_UNSUPPORTED_ANCHOR_REF',
      level: 'warning',
      message: `Mermaid export degrades anchor-qualified target ref: ${arrow.target}`,
      path: `arrows[${index}]`,
    });
  }

  if (arrow.label?.length) {
    warnings.push({
      code: 'MERMAID_UNSUPPORTED_ARROW_LABEL',
      level: 'warning',
      message: `Mermaid export ignores arrow label metadata: ${arrow.source} -> ${arrow.target}`,
      path: `arrows[${index}]`,
    });
  }
  if (arrow.waypoints?.length) {
    warnings.push({
      code: 'MERMAID_UNSUPPORTED_WAYPOINTS',
      level: 'warning',
      message: `Mermaid export ignores arrow waypoints: ${arrow.source} -> ${arrow.target}`,
      path: `arrows[${index}]`,
    });
  }

  lines.push(`  ${sourceBase} --> ${targetBase}`);
}

export function exportMermaid(ast: DiagramDocument): MermaidExportResult {
  const warnings: Diagnostic[] = [];
  const lines = ['flowchart TB', ''];

  if (!ast.root) {
    return { mermaid: 'flowchart TB\n', warnings };
  }

  const exportRoots = ast.root.children.length > 0 ? ast.root.children : [ast.root];
  exportRoots.forEach((child, index) => {
    const path = ast.root?.children.length ? `root.children[${index}]` : 'root';
    collectFrameWarnings(child, path, warnings);
    renderFrameNode(child, lines, '  ');
  });

  lines.push('');
  ast.arrows.forEach((arrow, index) => {
    renderArrow(arrow, index, lines, warnings, ast);
  });

  return {
    mermaid: `${lines.join('\n').trimEnd()}\n`,
    warnings,
  };
}
