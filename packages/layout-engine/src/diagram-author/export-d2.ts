import { extractArrowRefId, extractBaseFrameId } from './ref-grammar.js';
import type { AuthorArrow, AuthorFrameNode, DiagramDocument, Diagnostic, FrameIndexEntry } from './types.js';

export interface D2ExportResult {
  d2: string;
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

function escapeD2String(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function formatMultilineLabel(lines: string[]): string {
  const first = lines[0] ?? '';
  if (lines.length === 1 && /^[\w .-]+$/.test(first)) {
    return first;
  }
  return `"${lines.map(escapeD2String).join('\\n')}"`;
}

function formatNodeLabel(node: AuthorFrameNode, path: string, warnings: Diagnostic[]): string | null {
  if (node.label?.length && node.heading) {
    warnings.push({
      code: 'D2_AMBIGUOUS_CONTAINER_LABEL',
      level: 'warning',
      message: `D2 export prefers label over heading for frame: ${node.id}`,
      path,
    });
  }
  if (node.label?.length) {
    return formatMultilineLabel(node.label.map(line => line.text));
  }
  if (node.heading) {
    return formatMultilineLabel([node.heading.text]);
  }
  return null;
}

function buildD2Path(
  frameId: string,
  frameIndex: Record<string, FrameIndexEntry>,
  pageId: string | undefined,
): string {
  const chain: string[] = [];
  let current = frameIndex[frameId];
  while (current) {
    if (current.id !== pageId) {
      chain.unshift(current.id);
    }
    if (!current.parentId || current.parentId === pageId) {
      break;
    }
    current = frameIndex[current.parentId];
  }
  return chain.join('.');
}

function collectFrameWarnings(node: AuthorFrameNode, path: string, warnings: Diagnostic[]): void {
  if (node.icon || node.iconFill) {
    warnings.push({
      code: 'D2_UNSUPPORTED_ICON',
      level: 'warning',
      message: `D2 export ignores icon metadata for frame: ${node.id}`,
      path,
    });
  }

  if (UNSUPPORTED_LAYOUT_FIELDS.some(field => node[field] !== undefined)) {
    warnings.push({
      code: 'D2_UNSUPPORTED_LAYOUT',
      level: 'warning',
      message: `D2 export ignores layout metadata for frame: ${node.id}`,
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
  path: string,
  warnings: Diagnostic[],
): void {
  const label = formatNodeLabel(node, path, warnings);

  if (node.children.length > 0) {
    const header = label ? `${node.id}: ${label} {` : `${node.id}: {`;
    lines.push(`${indent}${header}`);
    node.children.forEach((child, index) => {
      renderFrameNode(child, lines, `${indent}  `, `${path}.children[${index}]`, warnings);
    });
    lines.push(`${indent}}`);
    return;
  }

  if (label) {
    lines.push(`${indent}${node.id}: ${label}`);
    return;
  }

  lines.push(`${indent}${node.id}`);
}

function renderArrow(
  arrow: AuthorArrow,
  index: number,
  lines: string[],
  warnings: Diagnostic[],
  frameIndex: Record<string, FrameIndexEntry>,
  rootId: string | undefined,
): void {
  const sourceArrowId = extractArrowRefId(arrow.source);
  const targetArrowId = extractArrowRefId(arrow.target);
  const sourceBase = extractBaseFrameId(arrow.source);
  const targetBase = extractBaseFrameId(arrow.target);

  if (rootId && (sourceBase === rootId || targetBase === rootId)) {
    warnings.push({
      code: 'D2_ROOT_ENDPOINT_UNSUPPORTED',
      level: 'warning',
      message: `D2 export skips arrows that target the root canvas frame: ${arrow.source} -> ${arrow.target}`,
      path: `arrows[${index}]`,
    });
    return;
  }

  if (sourceArrowId || targetArrowId) {
    if (sourceArrowId) {
      warnings.push({
        code: 'D2_UNSUPPORTED_ANCHOR_REF',
        level: 'warning',
        message: `D2 export skips arrow-to-arrow source ref: ${arrow.source}`,
        path: `arrows[${index}]`,
      });
    }
    if (targetArrowId) {
      warnings.push({
        code: 'D2_UNSUPPORTED_ANCHOR_REF',
        level: 'warning',
        message: `D2 export skips arrow-to-arrow target ref: ${arrow.target}`,
        path: `arrows[${index}]`,
      });
    }
    return;
  }

  if (arrow.source !== sourceBase) {
    warnings.push({
      code: 'D2_UNSUPPORTED_ANCHOR_REF',
      level: 'warning',
      message: `D2 export degrades anchor-qualified source ref: ${arrow.source}`,
      path: `arrows[${index}]`,
    });
  }
  if (arrow.target !== targetBase) {
    warnings.push({
      code: 'D2_UNSUPPORTED_ANCHOR_REF',
      level: 'warning',
      message: `D2 export degrades anchor-qualified target ref: ${arrow.target}`,
      path: `arrows[${index}]`,
    });
  }

  if (arrow.waypoints?.length) {
    warnings.push({
      code: 'D2_UNSUPPORTED_WAYPOINTS',
      level: 'warning',
      message: `D2 export ignores arrow waypoints: ${arrow.source} -> ${arrow.target}`,
      path: `arrows[${index}]`,
    });
  }

  if (arrow.style || arrow.color || arrow.labelGap != null) {
    warnings.push({
      code: 'D2_UNSUPPORTED_ARROW_STYLE',
      level: 'warning',
      message: `D2 export ignores arrow style metadata: ${arrow.source} -> ${arrow.target}`,
      path: `arrows[${index}]`,
    });
  }

  if (!frameIndex[sourceBase]) {
    warnings.push({
      code: 'D2_MISSING_FRAME_REF',
      level: 'warning',
      message: `D2 export arrow source not found in frame index: ${sourceBase}`,
      path: `arrows[${index}]`,
    });
  }
  if (!frameIndex[targetBase]) {
    warnings.push({
      code: 'D2_MISSING_FRAME_REF',
      level: 'warning',
      message: `D2 export arrow target not found in frame index: ${targetBase}`,
      path: `arrows[${index}]`,
    });
  }

  if (!frameIndex[sourceBase] || !frameIndex[targetBase]) {
    return;
  }

  const sourcePath = buildD2Path(sourceBase, frameIndex, rootId);
  const targetPath = buildD2Path(targetBase, frameIndex, rootId);

  const arrowLabel = arrow.label?.length
    ? formatMultilineLabel(arrow.label.map(line => line.text))
    : null;
  const connection = arrowLabel
    ? `${sourcePath} -> ${targetPath}: ${arrowLabel}`
    : `${sourcePath} -> ${targetPath}`;

  lines.push(connection);
}

function renderD2Config(ast: DiagramDocument): string[] {
  const meta = (ast.source?.meta ?? ast.metadata) as Record<string, unknown> | undefined;
  const layoutEngine = meta?.layout_engine;
  if (typeof layoutEngine !== 'string' || !layoutEngine.includes('elk')) {
    return [];
  }

  return [
    'vars: {',
    '  d2-config: {',
    '    layout-engine: elk',
    '  }',
    '}',
    '',
  ];
}

export function exportD2(ast: DiagramDocument): D2ExportResult {
  const warnings: Diagnostic[] = [];
  const lines: string[] = [...renderD2Config(ast)];

  if (!ast.root) {
    return { d2: `${lines.join('\n').trimEnd()}\n`, warnings };
  }

  const pageId = ast.root.id;
  const exportRoots = ast.root.children.length > 0
    ? ast.root.children
    : [ast.root];
  exportRoots.forEach((child, index) => {
    const path = ast.root?.children.length ? `root.children[${index}]` : 'root';
    collectFrameWarnings(child, path, warnings);
    renderFrameNode(child, lines, '', path, warnings);
  });

  if (ast.arrows.length > 0) {
    lines.push('');
    ast.arrows.forEach((arrow, index) => {
      renderArrow(arrow, index, lines, warnings, ast.frameIndex, pageId);
    });
  }

  return {
    d2: `${lines.join('\n').trimEnd()}\n`,
    warnings,
  };
}
