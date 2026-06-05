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

export interface Edge {
  id?: string;
  source: string;
  target: string;
  kind: 'directed';
  label?: string[];
  style?: string;
  waypoints?: [number, number][];
}

export interface LayoutTreeNode {
  kind: 'node' | 'group';
  id: string;
  children: LayoutTreeNode[];
}

export interface DiagramDocument {
  metadata: Record<string, unknown>;
  defaults: Record<string, Record<string, unknown>>;
  nodes: Record<string, Record<string, unknown>>;
  groups: Record<string, Record<string, unknown>>;
  edges: Edge[];
  layoutTree: LayoutTreeNode | null;
  source: Record<string, unknown>;
}

export interface CompileResult {
  ast: DiagramDocument;
  diagnostics: Diagnostic[];
  errors: Diagnostic[];
  warnings: Diagnostic[];
  raw: Record<string, unknown>;
  normalized: Record<string, unknown>;
}