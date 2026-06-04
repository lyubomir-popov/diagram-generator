/**
 * Component tree for preview sidebar — port of layout_v3._build_component_tree.
 */

import { Frame, Border } from './frame-model.js';

export interface ComponentInfo {
  id: string;
  type: 'panel' | 'box';
  x: number;
  y: number;
  width: number;
  height: number;
  children: ComponentInfo[];
  layout: string;
  layout_gap: number;
  layout_col_gap: number;
  layout_row_gap: number;
  layout_header_gap: number;
  pad: number;
  sizing_w: string;
  sizing_h: string;
  fill_weight: number;
  align: string;
  wrap: boolean;
  padding_top: number;
  padding_right: number;
  padding_bottom: number;
  padding_left: number;
  level: number | null;
  fill: string;
  border: string;
  heading_text: string;
  label_text: string[];
  min_width?: number;
  max_width?: number;
  max_width_chars?: number;
  min_height?: number;
  max_height?: number;
}

function headingTextForFrame(frame: Frame): string {
  if (frame.heading?.content.trim()) return frame.heading.content;
  const headingChild = frame.children.find(c => c.role === 'heading');
  if (headingChild?.label[0]?.content) return headingChild.label[0].content;
  return '';
}

/** Heading synthesis uses __heading + __body; expose body children/gap on the authored parent. */
function resolveAuthoredLayoutFrame(frame: Frame): {
  layoutChildren: Frame[];
  layoutGap: number;
  layoutDirection: Frame['direction'];
  layoutHeaderGap: number;
} {
  if (frame.isLeaf) {
    return {
      layoutChildren: [],
      layoutGap: 0,
      layoutDirection: frame.direction,
      layoutHeaderGap: 0,
    };
  }
  const body = frame.children.find(
    c => c.id === '__body' || (c.id?.endsWith('__body') ?? false),
  );
  const hasHeading = frame.children.some(
    c => c.role === 'heading' || c.id === '__heading' || (c.id?.endsWith('__heading') ?? false),
  );
  if (body && hasHeading) {
    return {
      layoutChildren: body.children,
      layoutGap: body.gap,
      layoutDirection: body.direction,
      layoutHeaderGap: frame.gap,
    };
  }
  return {
    layoutChildren: frame.children.filter(
      c => !c.id?.endsWith('__body') && !c.id?.endsWith('__heading') && c.role !== 'heading',
    ),
    layoutGap: frame.gap,
    layoutDirection: frame.direction,
    layoutHeaderGap: frame.gap,
  };
}

function frameToComponentInfo(frame: Frame): ComponentInfo | null {
  const cid = frame.id;
  if (!cid || cid.startsWith('__')) return null;

  const { layoutChildren, layoutGap, layoutDirection, layoutHeaderGap } =
    resolveAuthoredLayoutFrame(frame);

  const children: ComponentInfo[] = [];
  if (!frame.isLeaf) {
    for (const child of layoutChildren) {
      const ci = frameToComponentInfo(child);
      if (ci) children.push(ci);
    }
  }

  let layout = '';
  if (!frame.isLeaf && layoutChildren.length > 0) {
    layout = layoutDirection === 'VERTICAL' ? 'vertical' : 'horizontal';
  }

  return {
    id: cid,
    type: frame.isLeaf ? 'box' : 'panel',
    x: frame._layout.placedX,
    y: frame._layout.placedY,
    width: frame._layout.placedW,
    height: frame._layout.placedH,
    children,
    layout,
    layout_gap: layoutGap,
    layout_col_gap: layoutGap,
    layout_row_gap: layoutGap,
    layout_header_gap: layoutHeaderGap,
    pad: frame.border !== Border.NONE ? frame.paddingTop : 0,
    sizing_w: frame.sizingW,
    sizing_h: frame.sizingH,
    fill_weight: frame.fillWeight,
    align: frame.align,
    wrap: frame.wrap,
    padding_top: frame.paddingTop,
    padding_right: frame.paddingRight,
    padding_bottom: frame.paddingBottom,
    padding_left: frame.paddingLeft,
    level: frame.level ?? null,
    fill: frame.fill,
    border: frame.border,
    heading_text: headingTextForFrame(frame),
    label_text: frame.label.map(ln => ln.content),
    min_width: frame.minWidth,
    max_width: frame.maxWidth,
    max_width_chars: frame.maxWidthChars,
    min_height: frame.minHeight,
    max_height: frame.maxHeight,
  };
}

export function buildComponentTree(root: Frame): ComponentInfo[] {
  if (root.id && !root.id.startsWith('__')) {
    const ci = frameToComponentInfo(root);
    return ci ? [ci] : [];
  }
  const result: ComponentInfo[] = [];
  for (const child of root.children) {
    const ci = frameToComponentInfo(child);
    if (ci) result.push(ci);
  }
  return result;
}
