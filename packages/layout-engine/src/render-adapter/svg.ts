import type {
  Color,
  DisplayList,
  DisplayListItem,
  GlyphRunItem,
  GroupItem,
  LineItem,
  PathCommand,
  PathItem,
  RectItem,
} from "../render-ir.js";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function colorToCss(color: Color): string {
  if (color.a === 0) return "transparent";
  const r = Math.round(color.r * 255)
    .toString(16)
    .padStart(2, "0");
  const g = Math.round(color.g * 255)
    .toString(16)
    .padStart(2, "0");
  const b = Math.round(color.b * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${r}${g}${b}`.toUpperCase();
}

function renderRect(item: RectItem): string {
  const attrs = [
    `x="${fmt(item.x)}"`,
    `y="${fmt(item.y)}"`,
    `width="${fmt(item.width)}"`,
    `height="${fmt(item.height)}"`,
    `fill="${esc(item.fill ? colorToCss(item.fill.color) : "none")}"`,
    `stroke="${esc(item.stroke ? colorToCss(item.stroke.color) : "none")}"`,
  ];
  if (item.strokeStyle) {
    attrs.push(`stroke-width="${item.strokeStyle.width}"`);
    attrs.push(`stroke-miterlimit="10"`);
    if (item.strokeStyle.dashArray && item.strokeStyle.dashArray.length > 0) {
      attrs.push(`stroke-dasharray="${item.strokeStyle.dashArray.join(" ")}"`);
    }
  }
  if (item.opacity != null) {
    attrs.push(`opacity="${item.opacity}"`);
  }
  return `<rect ${attrs.join(" ")}/>`;
}

function renderLine(item: LineItem): string {
  const attrs = [
    `x1="${fmt(item.x1)}"`,
    `y1="${fmt(item.y1)}"`,
    `x2="${fmt(item.x2)}"`,
    `y2="${fmt(item.y2)}"`,
    `fill="none"`,
    `stroke="${esc(colorToCss(item.stroke.color))}"`,
  ];
  if (item.strokeStyle) {
    attrs.push(`stroke-width="${item.strokeStyle.width}"`);
    attrs.push(`stroke-miterlimit="10"`);
    if (item.strokeStyle.dashArray && item.strokeStyle.dashArray.length > 0) {
      attrs.push(`stroke-dasharray="${item.strokeStyle.dashArray.join(" ")}"`);
    }
  }
  if (item.opacity != null) {
    attrs.push(`opacity="${item.opacity}"`);
  }
  return `<line ${attrs.join(" ")}/>`;
}

function renderPathCommands(commands: readonly PathCommand[]): string {
  return commands
    .map((command) => {
      switch (command.kind) {
        case "M":
        case "L":
          return `${command.kind} ${fmt(command.x)} ${fmt(command.y)}`;
        case "Z":
          return "Z";
      }
    })
    .join(" ");
}

function renderPath(item: PathItem): string {
  const attrs = [`d="${renderPathCommands(item.commands)}"`];
  attrs.push(`fill="${esc(item.fill ? colorToCss(item.fill.color) : "none")}"`);
  attrs.push(`stroke="${esc(item.stroke ? colorToCss(item.stroke.color) : "none")}"`);
  if (item.strokeStyle) {
    attrs.push(`stroke-width="${item.strokeStyle.width}"`);
    attrs.push(`stroke-miterlimit="10"`);
    if (item.strokeStyle.dashArray && item.strokeStyle.dashArray.length > 0) {
      attrs.push(`stroke-dasharray="${item.strokeStyle.dashArray.join(" ")}"`);
    }
  }
  if (item.opacity != null) {
    attrs.push(`opacity="${item.opacity}"`);
  }
  return `<path ${attrs.join(" ")}/>`;
}

function renderGlyphRun(item: GlyphRunItem): string {
  const attrs = [
    `x="${fmt(item.x)}"`,
    `y="${fmt(item.y)}"`,
    `font-size="${item.run.fontSize}"`,
    `font-weight="${item.run.fontWeight ?? 400}"`,
    `fill="${esc(colorToCss(item.fill?.color ?? { r: 0, g: 0, b: 0, a: 1 }))}"`,
  ];
  if (item.run.letterSpacing) {
    attrs.push(`letter-spacing="${esc(item.run.letterSpacing)}"`);
  }
  const family = item.run.fontFamily ?? "Ubuntu Sans";
  return `<text font-family="${esc(family)}"><tspan ${attrs.join(" ")}>${esc(item.run.text)}</tspan></text>`;
}

function renderGroup(item: GroupItem): string {
  const idAttr = item.id ? ` data-component-id="${esc(item.id)}"` : "";
  const opacityAttr = item.opacity != null ? ` opacity="${item.opacity}"` : "";
  return `<g${idAttr}${opacityAttr}>${item.children.map(renderItem).join("")}</g>`;
}

function renderItem(item: DisplayListItem): string {
  switch (item.kind) {
    case "rect":
      return renderRect(item);
    case "line":
      return renderLine(item);
    case "path":
      return renderPath(item);
    case "glyph-run":
      return renderGlyphRun(item);
    case "group":
      return renderGroup(item);
  }
}

export function renderDisplayListToSvg(displayList: DisplayList): string {
  const background = displayList.viewport.background
    ? `<rect width="${displayList.viewport.width}" height="${displayList.viewport.height}" fill="${colorToCss(displayList.viewport.background)}"/>`
    : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${displayList.viewport.width}" height="${displayList.viewport.height}" viewBox="0 0 ${displayList.viewport.width} ${displayList.viewport.height}" xml:space="preserve">` +
    background +
    displayList.items.map(renderItem).join("") +
    `</svg>\n`
  );
}
