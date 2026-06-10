import { normalizeLineArray, normalizeLineSpec } from './normalize-lines.js';
import type { AuthorFrameNode, Diagnostic, FrameIndexEntry, FrameTemplate } from './types.js';

function readNumber(record: Record<string, unknown>, camel: string, snake: string): number | undefined {
  const value = record[camel] ?? record[snake];
  return typeof value === 'number' ? value : undefined;
}

function readString(record: Record<string, unknown>, camel: string, snake?: string): string | undefined {
  const value = record[camel] ?? (snake ? record[snake] : undefined);
  return typeof value === 'string' ? value : undefined;
}

function readBoolean(record: Record<string, unknown>, camel: string, snake?: string): boolean | undefined {
  const value = record[camel] ?? (snake ? record[snake] : undefined);
  return typeof value === 'boolean' ? value : undefined;
}

function readDirection(record: Record<string, unknown>): AuthorFrameNode['direction'] {
  const value = readString(record, 'direction');
  return value === 'vertical' || value === 'horizontal' ? value : undefined;
}

function readPosition(record: Record<string, unknown>): AuthorFrameNode['position'] {
  const value = readString(record, 'position');
  if (!value) {
    return undefined;
  }
  const upper = value.toUpperCase();
  return upper === 'AUTO' || upper === 'ABSOLUTE' ? upper : undefined;
}

function normalizeFrameFields(record: Record<string, unknown>): Omit<AuthorFrameNode, 'children'> {
  const node: Omit<AuthorFrameNode, 'children'> = {
    id: String(record.id ?? ''),
  };

  const direction = readDirection(record);
  if (direction) node.direction = direction;

  const gap = readNumber(record, 'gap', 'gap');
  if (gap !== undefined) node.gap = gap;

  const gapDelta = readNumber(record, 'gapDelta', 'gap_delta');
  if (gapDelta !== undefined) node.gapDelta = gapDelta;

  const padding = readNumber(record, 'padding', 'padding');
  if (padding !== undefined) node.padding = padding;

  const paddingTop = readNumber(record, 'paddingTop', 'padding_top');
  if (paddingTop !== undefined) node.paddingTop = paddingTop;

  const paddingRight = readNumber(record, 'paddingRight', 'padding_right');
  if (paddingRight !== undefined) node.paddingRight = paddingRight;

  const paddingBottom = readNumber(record, 'paddingBottom', 'padding_bottom');
  if (paddingBottom !== undefined) node.paddingBottom = paddingBottom;

  const paddingLeft = readNumber(record, 'paddingLeft', 'padding_left');
  if (paddingLeft !== undefined) node.paddingLeft = paddingLeft;

  const sizing = readString(record, 'sizing', 'sizing');
  if (sizing) node.sizing = sizing;

  const sizingW = readString(record, 'sizingW', 'sizing_w');
  if (sizingW) node.sizingW = sizingW;

  const sizingH = readString(record, 'sizingH', 'sizing_h');
  if (sizingH) node.sizingH = sizingH;

  const fillWeight = readNumber(record, 'fillWeight', 'fill_weight');
  if (fillWeight !== undefined) node.fillWeight = fillWeight;

  const width = readNumber(record, 'width', 'width');
  if (width !== undefined) node.width = width;

  const height = readNumber(record, 'height', 'height');
  if (height !== undefined) node.height = height;

  const minWidth = readNumber(record, 'minWidth', 'min_width');
  if (minWidth !== undefined) node.minWidth = minWidth;

  const maxWidth = readNumber(record, 'maxWidth', 'max_width');
  if (maxWidth !== undefined) node.maxWidth = maxWidth;

  const maxWidthChars = readNumber(record, 'maxWidthChars', 'max_width_chars');
  if (maxWidthChars !== undefined) node.maxWidthChars = maxWidthChars;

  const minHeight = readNumber(record, 'minHeight', 'min_height');
  if (minHeight !== undefined) node.minHeight = minHeight;

  const maxHeight = readNumber(record, 'maxHeight', 'max_height');
  if (maxHeight !== undefined) node.maxHeight = maxHeight;

  const align = readString(record, 'align', 'align');
  if (align) node.align = align;

  const justify = readString(record, 'justify', 'justify');
  if (justify) node.justify = justify;

  const wrap = readBoolean(record, 'wrap', 'wrap');
  if (wrap !== undefined) node.wrap = wrap;

  const fill = readString(record, 'fill', 'fill');
  if (fill) node.fill = fill;

  const border = readString(record, 'border', 'border');
  if (border) node.border = border;

  const level = readNumber(record, 'level', 'level');
  if (level !== undefined) node.level = level;

  const variant = readString(record, 'variant', 'variant');
  if (variant) node.variant = variant;

  const role = readString(record, 'role', 'role');
  if (role) node.role = role;

  if ('heading' in record) {
    const heading = normalizeLineSpec(record.heading);
    if (heading) node.heading = heading;
  }

  if ('label' in record) {
    const label = normalizeLineArray(record.label);
    if (label) node.label = label;
  }

  const icon = readString(record, 'icon', 'icon');
  if (icon) node.icon = icon;

  const iconFill = readString(record, 'iconFill', 'icon_fill');
  if (iconFill) node.iconFill = iconFill;

  const position = readPosition(record);
  if (position) node.position = position;

  const x = readNumber(record, 'x', 'x');
  if (x !== undefined) node.x = x;

  const y = readNumber(record, 'y', 'y');
  if (y !== undefined) node.y = y;

  const colSpan = readNumber(record, 'colSpan', 'col_span');
  if (colSpan !== undefined) node.colSpan = colSpan;

  const use = readString(record, 'use', 'use');
  if (use) node.use = use;

  return node;
}

const FRAME_TEMPLATE_KEYS: (keyof FrameTemplate)[] = [
  'label',
  'icon',
  'iconFill',
  'sizingW',
  'sizingH',
  'level',
  'variant',
  'role',
  'heading',
  'direction',
  'gap',
  'gapDelta',
  'padding',
];

export function normalizeFrameTemplate(record: Record<string, unknown>): FrameTemplate {
  const fields = normalizeFrameFields(record);
  const template: FrameTemplate = {};
  for (const key of FRAME_TEMPLATE_KEYS) {
    const value = fields[key];
    if (value !== undefined) {
      template[key] = value as never;
    }
  }
  return template;
}

export function normalizeFrameNode(
  value: unknown,
  path: string,
): { node?: AuthorFrameNode; diagnostics: Diagnostic[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      diagnostics: [
        {
          code: path === 'root' ? 'ROOT_MISSING' : 'INVALID_FRAME_CHILD',
          level: 'error',
          message: path === 'root'
            ? 'Top-level `root` must be a frame mapping.'
            : 'Frame child entry must be a mapping.',
          path,
        },
      ],
    };
  }

  const record = value as Record<string, unknown>;
  const diagnostics: Diagnostic[] = [];
  const children: AuthorFrameNode[] = [];

  if (Array.isArray(record.children)) {
    record.children.forEach((child, index) => {
      const childPath = `${path}.children[${index}]`;
      const normalizedChild = normalizeFrameNode(child, childPath);
      diagnostics.push(...normalizedChild.diagnostics);
      if (normalizedChild.node) {
        children.push(normalizedChild.node);
      }
    });
  }

  return {
    node: {
      ...normalizeFrameFields(record),
      children,
    },
    diagnostics,
  };
}

export function buildFrameIndex(root: AuthorFrameNode | null): {
  frameIndex: Record<string, FrameIndexEntry>;
  diagnostics: Diagnostic[];
} {
  if (!root) {
    return { frameIndex: {}, diagnostics: [] };
  }

  const frameIndex: Record<string, FrameIndexEntry> = {};
  const diagnostics: Diagnostic[] = [];

  const visit = (node: AuthorFrameNode, path: string, parentId?: string) => {
    if (!node.id) {
      diagnostics.push({
        code: 'FRAME_MISSING_ID',
        level: 'error',
        message: 'Frame entry requires a non-empty id.',
        path,
      });
    } else if (frameIndex[node.id]) {
      diagnostics.push({
        code: 'DUPLICATE_FRAME_ID',
        level: 'error',
        message: `Duplicate frame id: ${node.id}`,
        path,
      });
    } else {
      frameIndex[node.id] = {
        id: node.id,
        parentId,
        isContainer: node.children.length > 0,
        path,
      };
    }
    node.children.forEach((child, childIndex) => {
      visit(child, `${path}.children[${childIndex}]`, node.id || parentId);
    });
  };

  visit(root, 'root');
  return { frameIndex, diagnostics };
}

export function buildFrameAst(rawRoot: unknown): {
  root: AuthorFrameNode | null;
  frameIndex: Record<string, FrameIndexEntry>;
  diagnostics: Diagnostic[];
} {
  if (rawRoot === undefined || rawRoot === null) {
    return {
      root: null,
      frameIndex: {},
      diagnostics: [
        {
          code: 'ROOT_MISSING',
          level: 'error',
          message: 'Top-level `root` is required.',
          path: 'root',
        },
      ],
    };
  }

  const normalized = normalizeFrameNode(rawRoot, 'root');
  const indexed = buildFrameIndex(normalized.node ?? null);

  return {
    root: normalized.node ?? null,
    frameIndex: indexed.frameIndex,
    diagnostics: [...normalized.diagnostics, ...indexed.diagnostics],
  };
}
