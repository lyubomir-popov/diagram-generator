import { extractArrowRefId, extractBaseFrameId } from './ref-grammar.js';
import type { AuthorArrow, AuthorFrameNode, Diagnostic, FrameIndexEntry, FrameTemplate } from './types.js';

function arrowSignature(arrow: AuthorArrow): string {
  const labelKey = arrow.label?.map(line => line.text).join('\0') ?? '';
  return `${arrow.source}\0${arrow.target}\0${labelKey}`;
}

function collectLeafIds(root: AuthorFrameNode | null): string[] {
  if (!root) {
    return [];
  }
  const leafIds: string[] = [];
  const visit = (node: AuthorFrameNode) => {
    if (node.children.length === 0 && node.id) {
      leafIds.push(node.id);
    }
    node.children.forEach(visit);
  };
  visit(root);
  return leafIds;
}

function collectEndpointFrameIds(
  ref: string,
  arrowById: Map<string, AuthorArrow>,
  ids: Set<string>,
  seenArrowIds: Set<string>,
): void {
  const arrowId = extractArrowRefId(ref);
  if (arrowId) {
    if (seenArrowIds.has(arrowId)) return;
    seenArrowIds.add(arrowId);
    const hostArrow = arrowById.get(arrowId);
    if (!hostArrow) return;
    collectEndpointFrameIds(hostArrow.source, arrowById, ids, seenArrowIds);
    collectEndpointFrameIds(hostArrow.target, arrowById, ids, seenArrowIds);
    return;
  }

  const frameId = extractBaseFrameId(ref);
  if (frameId) {
    ids.add(frameId);
  }
}

function incidentArrowCount(frameId: string, arrows: AuthorArrow[]): number {
  const arrowById = new Map(
    arrows
      .filter((arrow): arrow is AuthorArrow & { id: string } => typeof arrow.id === 'string' && arrow.id.length > 0)
      .map((arrow) => [arrow.id, arrow]),
  );

  return arrows.filter(arrow => {
    const incidentIds = new Set<string>();
    collectEndpointFrameIds(arrow.source, arrowById, incidentIds, new Set<string>());
    collectEndpointFrameIds(arrow.target, arrowById, incidentIds, new Set<string>());
    return incidentIds.has(frameId);
  }).length;
}

export function collectCompileWarnings(input: {
  root: AuthorFrameNode | null;
  arrows: AuthorArrow[];
  defaults: Record<string, FrameTemplate>;
  frameIndex: Record<string, FrameIndexEntry>;
  usedTemplates: Set<string>;
}): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  Object.keys(input.defaults).forEach(templateName => {
    if (!input.usedTemplates.has(templateName)) {
      diagnostics.push({
        code: 'UNUSED_DEFAULT',
        level: 'warning',
        message: `Default template is never referenced: ${templateName}`,
        path: `defaults.${templateName}`,
      });
    }
  });

  collectLeafIds(input.root).forEach(frameId => {
    const entry = input.frameIndex[frameId];
    if (!entry || entry.isContainer || entry.path === 'root') {
      return;
    }
    if (incidentArrowCount(frameId, input.arrows) === 0) {
      diagnostics.push({
        code: 'ORPHAN_LEAF',
        level: 'warning',
        message: `Leaf frame has no incident arrows: ${frameId}`,
        path: entry.path,
      });
    }
  });

  const seenArrows = new Map<string, number>();
  input.arrows.forEach((arrow, index) => {
    if (arrow.source === arrow.target) {
      diagnostics.push({
        code: 'SELF_LOOP_ARROW',
        level: 'warning',
        message: `Arrow source and target are identical: ${arrow.source}`,
        path: `arrows[${index}]`,
      });
    }

    const signature = arrowSignature(arrow);
    const firstIndex = seenArrows.get(signature);
    if (firstIndex !== undefined) {
      diagnostics.push({
        code: 'DUPLICATE_ARROW',
        level: 'warning',
        message: `Duplicate arrow (same source, target, and label as arrows[${firstIndex}])`,
        path: `arrows[${index}]`,
      });
    } else {
      seenArrows.set(signature, index);
    }
  });

  return diagnostics;
}

export function applyStrictMode(diagnostics: Diagnostic[], strict: boolean): Diagnostic[] {
  if (!strict) {
    return diagnostics;
  }
  return diagnostics.map(diagnostic => {
    if (diagnostic.level !== 'warning') {
      return diagnostic;
    }
    if (diagnostic.code === 'DUPLICATE_ARROW' || diagnostic.code === 'SELF_LOOP_ARROW') {
      return { ...diagnostic, level: 'error' };
    }
    return diagnostic;
  });
}
