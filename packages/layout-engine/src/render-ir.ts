export interface Color {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export interface Paint {
  readonly color: Color;
}

export interface StrokeStyle {
  readonly width: number;
  readonly dashArray?: readonly number[];
}

export interface AssetRef {
  readonly kind: "font" | "image";
  readonly uri: string;
}

export interface ShapedGlyph {
  readonly glyphId: number;
  readonly cluster: number;
  readonly xAdvance: number;
  readonly yAdvance: number;
  readonly xOffset: number;
  readonly yOffset: number;
}

export interface ShapedRun {
  readonly fontRef: AssetRef;
  readonly fontSize: number;
  readonly glyphs: readonly ShapedGlyph[];
  readonly text: string;
  readonly fontFamily?: string;
  readonly fontWeight?: number;
  readonly letterSpacing?: string | null;
  readonly smallCaps?: boolean;
}

export type PathCommand =
  | { readonly kind: "M"; readonly x: number; readonly y: number }
  | { readonly kind: "L"; readonly x: number; readonly y: number }
  | { readonly kind: "Z" };

interface DisplayListItemBase {
  readonly id?: string;
  readonly opacity?: number;
}

export interface RectItem extends DisplayListItemBase {
  readonly kind: "rect";
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill?: Paint;
  readonly stroke?: Paint;
  readonly strokeStyle?: StrokeStyle;
}

export interface LineItem extends DisplayListItemBase {
  readonly kind: "line";
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly stroke: Paint;
  readonly strokeStyle?: StrokeStyle;
}

export interface PathItem extends DisplayListItemBase {
  readonly kind: "path";
  readonly commands: readonly PathCommand[];
  readonly fill?: Paint;
  readonly stroke?: Paint;
  readonly strokeStyle?: StrokeStyle;
}

export interface GlyphRunItem extends DisplayListItemBase {
  readonly kind: "glyph-run";
  readonly x: number;
  readonly y: number;
  readonly run: ShapedRun;
  readonly fill?: Paint;
}

export interface GroupItem extends DisplayListItemBase {
  readonly kind: "group";
  readonly children: readonly DisplayListItem[];
}

export type DisplayListItem = RectItem | LineItem | PathItem | GlyphRunItem | GroupItem;

export interface Viewport {
  readonly width: number;
  readonly height: number;
  readonly background?: Color;
}

export interface DisplayList {
  readonly viewport: Viewport;
  readonly items: readonly DisplayListItem[];
}
