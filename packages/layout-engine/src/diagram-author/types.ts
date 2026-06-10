export type DiagnosticLevel = 'error' | 'warning';

export interface Diagnostic {
  code: string;
  message: string;
  level: DiagnosticLevel;
  path?: string;
  line?: number;
  column?: number;
}

export interface CompileOptions {
  strict?: boolean;
  sourcePath?: string;
}

export interface LineSpec {
  text: string;
  size?: string;
  weight?: string;
  fill?: string;
  smallCaps?: boolean;
  letterSpacing?: string;
  lineStep?: number;
  fontFamily?: string;
}

export interface AuthorArrow {
  id?: string;
  source: string;
  target: string;
  kind: 'directed';
  label?: LineSpec[];
  style?: string;
  color?: string;
  labelGap?: number;
  waypoints?: [number, number][];
}

export interface FrameTemplate {
  label?: LineSpec[];
  icon?: string;
  iconFill?: string;
  sizingW?: string;
  sizingH?: string;
  level?: number;
  variant?: string;
  role?: string;
  heading?: LineSpec;
  direction?: 'vertical' | 'horizontal';
  gap?: number;
  gapDelta?: number;
  padding?: number;
}

export interface AuthorFrameNode {
  id: string;
  direction?: 'vertical' | 'horizontal';
  gap?: number;
  gapDelta?: number;
  padding?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  sizing?: string;
  sizingW?: string;
  sizingH?: string;
  fillWeight?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  maxWidthChars?: number;
  minHeight?: number;
  maxHeight?: number;
  align?: string;
  justify?: string;
  wrap?: boolean;
  fill?: string;
  border?: string;
  level?: number;
  variant?: string;
  role?: string;
  heading?: LineSpec;
  label?: LineSpec[];
  icon?: string;
  iconFill?: string;
  position?: 'AUTO' | 'ABSOLUTE';
  x?: number;
  y?: number;
  colSpan?: number;
  use?: string;
  children: AuthorFrameNode[];
}

export interface FrameIndexEntry {
  id: string;
  parentId?: string;
  isContainer: boolean;
  path: string;
}

import type { SequenceDiagramSpec } from '../sequence-layout/model.js';

export interface DiagramDocument {
  metadata: Record<string, unknown>;
  defaults: Record<string, FrameTemplate>;
  root: AuthorFrameNode | null;
  arrows: AuthorArrow[];
  sequence?: SequenceDiagramSpec;
  frameIndex: Record<string, FrameIndexEntry>;
  source: Record<string, unknown>;
}

import type { FrameDiagram } from '../frame-model.js';

export interface CompileResult {
  ast: DiagramDocument;
  frameDiagram?: FrameDiagram;
  diagnostics: Diagnostic[];
  errors: Diagnostic[];
  warnings: Diagnostic[];
  deprecations: Diagnostic[];
  raw: Record<string, unknown>;
  normalized: Record<string, unknown>;
}

export type Edge = AuthorArrow;
