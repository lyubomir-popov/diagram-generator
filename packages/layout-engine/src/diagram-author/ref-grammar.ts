import type { AuthorArrow, Diagnostic, FrameIndexEntry } from './types.js';

export function extractArrowRefId(ref: string): string | null {
  if (ref.startsWith('arrow:')) {
    return ref.slice('arrow:'.length) || null;
  }
  if (ref.startsWith('@')) {
    return ref.slice(1) || null;
  }
  return null;
}

export function extractBaseFrameId(ref: string): string {
  if (extractArrowRefId(ref)) return '';
  return ref.split('.')[0] ?? ref;
}

export function validateArrowRefs(
  arrows: AuthorArrow[],
  frameIndex: Record<string, FrameIndexEntry>,
  rootId?: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seenArrowIds = new Set<string>();

  arrows.forEach((arrow, index) => {
    const sourceArrowId = extractArrowRefId(arrow.source);
    const targetArrowId = extractArrowRefId(arrow.target);
    const sourceId = extractBaseFrameId(arrow.source);
    const targetId = extractBaseFrameId(arrow.target);

    if (rootId && ((sourceId && sourceId === rootId) || (targetId && targetId === rootId))) {
      diagnostics.push({
        code: 'ARROW_ROOT_ENDPOINT',
        level: 'error',
        message: `Arrow endpoints cannot reference the root canvas frame: ${arrow.source} -> ${arrow.target}`,
        path: `arrows[${index}]`,
      });
      return;
    }

    if (sourceArrowId) {
      if (!seenArrowIds.has(sourceArrowId)) {
        diagnostics.push({
          code: 'ARROW_UNKNOWN_SOURCE_ARROW',
          level: 'error',
          message: `Arrow source must reference an already-defined arrow id: ${arrow.source}`,
          path: `arrows[${index}]`,
        });
      }
    } else if (!sourceId || !frameIndex[sourceId]) {
      diagnostics.push({
        code: 'ARROW_UNKNOWN_SOURCE',
        level: 'error',
        message: `Arrow source base id does not exist: ${arrow.source}`,
        path: `arrows[${index}]`,
      });
    }

    if (targetArrowId) {
      if (!seenArrowIds.has(targetArrowId)) {
        diagnostics.push({
          code: 'ARROW_UNKNOWN_TARGET_ARROW',
          level: 'error',
          message: `Arrow target must reference an already-defined arrow id: ${arrow.target}`,
          path: `arrows[${index}]`,
        });
      }
    } else if (!targetId || !frameIndex[targetId]) {
      diagnostics.push({
        code: 'ARROW_UNKNOWN_TARGET',
        level: 'error',
        message: `Arrow target base id does not exist: ${arrow.target}`,
        path: `arrows[${index}]`,
      });
    }

    if (arrow.id) {
      seenArrowIds.add(arrow.id);
    }
  });

  return diagnostics;
}