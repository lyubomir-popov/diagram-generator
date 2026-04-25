from __future__ import annotations

import html
import pathlib
import re
import urllib.parse
import xml.etree.ElementTree as ET

import diagram_shared as svg
import drawio_style_tokens as dg_tokens


FONT_SOURCE = "https%3A%2F%2Ffonts.googleapis.com%2Fcss%3Ffamily%3DUbuntu%2BSans"


def infer_vertex_metadata(style: str) -> dg_tokens.CellMetadata:
    props = dg_tokens.style_lookup(style)
    if props.get("shape") == "image":
        return dg_tokens.CellMetadata(role="image", style_tokens=("image-generic",))
    if style.startswith("ellipse") or props.get("shape") == "ellipse":
        return dg_tokens.CellMetadata(role="marker", style_tokens=("marker-circle",))
    if props.get("fillColor") == "none" and props.get("strokeColor") == "none":
        if "Mono" in props.get("fontFamily", ""):
            return dg_tokens.CellMetadata(role="label", style_tokens=("label-terminal",))
        return dg_tokens.CellMetadata(role="label", style_tokens=("label-free",))
    return dg_tokens.CellMetadata(role="vertex", style_tokens=("vertex-generic",))


def infer_edge_metadata(style: str) -> dg_tokens.CellMetadata:
    props = dg_tokens.style_lookup(style)
    stroke = props.get("strokeColor", "")
    dashed = props.get("dashed") == "1"

    style_tokens: list[str] = []
    if stroke == svg.ORANGE:
        style_tokens.append("edge-orange")
    elif dashed:
        style_tokens.append("edge-dashed")
    else:
        style_tokens.append("edge-neutral")

    if props.get("endArrow") == "blockThin":
        style_tokens.append("edge-arrow")
    return dg_tokens.CellMetadata(role="edge", style_tokens=tuple(style_tokens))


def box_style_token(fill: str) -> str:
    if fill == svg.WHITE:
        return "box-default"
    if fill == svg.GREY:
        return "box-accent"
    if fill == svg.BLACK:
        return "box-highlight"
    return "box-custom"


def rect_style_token(fill: str, *, stroke: str, dashed: bool, width: float, height: float) -> str:
    if dashed:
        return "panel-dashed"
    if stroke == "none" or width == 1 or height == 1:
        return "divider-line"
    if fill == "none":
        return "panel-outline"
    if fill == svg.WHITE:
        return "panel-default"
    if fill == svg.GREY:
        return "panel-accent"
    if fill == svg.BLACK:
        return "panel-highlight"
    return "panel-custom"


def compact_svg(svg_text: str) -> str:
    return re.sub(r">\s+<", "><", " ".join(svg_text.split()))


def inline_svg_data_uri(svg_text: str) -> str:
    return "data:image/svg+xml," + urllib.parse.quote(compact_svg(svg_text), safe="")


def svg_wrapper(width: float, height: float, parts: list[str], *, background: str | None = None) -> str:
    bg = ""
    if background is not None:
        bg = f'<rect width="{svg.fmt(width)}" height="{svg.fmt(height)}" fill="{background}" />'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg.fmt(width)}" height="{svg.fmt(height)}" '
        f'viewBox="0 0 {svg.fmt(width)} {svg.fmt(height)}" xml:space="preserve">{bg}'
        + "".join(parts)
        + "</svg>"
    )


def icon_uri(name: str, fill: str = svg.BLACK) -> str:
    return inline_svg_data_uri(svg_wrapper(48, 48, [svg.load_icon(name, fill)]))


def memory_panel_uri() -> str:
    width = 192
    step = 8
    top_base = 8
    top_peak = 0
    bottom_base = 72
    bottom_peak = 80

    points: list[tuple[int, int]] = [(0, top_base)]
    use_peak = True
    for x in range(step, width + step, step):
        points.append((x, top_peak if use_peak else top_base))
        use_peak = not use_peak

    points.append((width, bottom_base))
    use_peak = True
    for x in range(width - step, -step, -step):
        points.append((x, bottom_peak if use_peak else bottom_base))
        use_peak = not use_peak

    path_d = " ".join(
        [f"M{points[0][0]} {points[0][1]}"]
        + [f"L{x} {y}" for x, y in points[1:]]
        + ["Z"]
    )
    return inline_svg_data_uri(
        f"""
        <svg xmlns="http://www.w3.org/2000/svg" width="192" height="80" viewBox="0 0 192 80">
          <path d="{path_d}" fill="#F3F3F3" stroke="#000000" stroke-width="1" stroke-miterlimit="10" />
        </svg>
        """
    )


class DrawioBuilder:
    def __init__(self, *, name: str, diagram_id: str, page_width: int, page_height: int) -> None:
        self.next_id = 2
        self.mxfile = ET.Element(
            "mxfile",
            {
                "host": "app.diagrams.net",
                "agent": "diagram-generator",
                "version": "29.3.7",
            },
        )
        self.diagram = ET.SubElement(self.mxfile, "diagram", {"name": name, "id": diagram_id})
        self.model = ET.SubElement(
            self.diagram,
            "mxGraphModel",
            {
                "grid": "1",
                "gridSize": str(svg.BASELINE_UNIT),
                "guides": "1",
                "tooltips": "1",
                "connect": "1",
                "arrows": "1",
                "fold": "1",
                "page": "1",
                "pageScale": "1",
                "pageWidth": str(page_width),
                "pageHeight": str(page_height),
                "background": "light-dark(#ffffff, #ffffff)",
                "adaptiveColors": "none",
                "math": "0",
                "shadow": "0",
            },
        )
        self.root = ET.SubElement(self.model, "root")
        ET.SubElement(self.root, "mxCell", {"id": "0"})
        ET.SubElement(self.root, "mxCell", {"id": "1", "parent": "0"})

    def new_id(self) -> str:
        cell_id = str(self.next_id)
        self.next_id += 1
        return cell_id

    def add_vertex(
        self,
        *,
        x: float,
        y: float,
        width: float,
        height: float,
        style: str,
        value: str = "",
        parent: str = "1",
        connectable: bool | None = None,
        metadata: dg_tokens.CellMetadata | None = None,
    ) -> str:
        attrs = {
            "id": self.new_id(),
            "parent": parent,
            "style": style,
            "value": value,
            "vertex": "1",
        }
        attrs.update(dg_tokens.metadata_attrs(metadata or infer_vertex_metadata(style)))
        if connectable is not None:
            attrs["connectable"] = "1" if connectable else "0"
        cell = ET.SubElement(self.root, "mxCell", attrs)
        ET.SubElement(
            cell,
            "mxGeometry",
            {
                "x": svg.fmt(x),
                "y": svg.fmt(y),
                "width": svg.fmt(width),
                "height": svg.fmt(height),
                "as": "geometry",
            },
        )
        return attrs["id"]

    def add_edge(
        self,
        *,
        style: str,
        source: str | None = None,
        target: str | None = None,
        source_point: tuple[float, float] | None = None,
        target_point: tuple[float, float] | None = None,
        waypoints: list[tuple[float, float]] | None = None,
        value: str = "",
        parent: str = "1",
        metadata: dg_tokens.CellMetadata | None = None,
    ) -> str:
        attrs = {
            "id": self.new_id(),
            "parent": parent,
            "style": style,
            "value": value,
            "edge": "1",
        }
        attrs.update(dg_tokens.metadata_attrs(metadata or infer_edge_metadata(style)))
        if source is not None:
            attrs["source"] = source
        if target is not None:
            attrs["target"] = target
        cell = ET.SubElement(self.root, "mxCell", attrs)
        geometry = ET.SubElement(cell, "mxGeometry", {"relative": "1", "as": "geometry"})
        if source_point is not None:
            ET.SubElement(
                geometry,
                "mxPoint",
                {"x": svg.fmt(source_point[0]), "y": svg.fmt(source_point[1]), "as": "sourcePoint"},
            )
        if target_point is not None:
            ET.SubElement(
                geometry,
                "mxPoint",
                {"x": svg.fmt(target_point[0]), "y": svg.fmt(target_point[1]), "as": "targetPoint"},
            )
        if waypoints:
            array = ET.SubElement(geometry, "Array", {"as": "points"})
            for x, y in waypoints:
                ET.SubElement(array, "mxPoint", {"x": svg.fmt(x), "y": svg.fmt(y)})
        return attrs["id"]

    def write(self, path: pathlib.Path) -> None:
        ET.indent(self.mxfile, space="  ")
        ET.ElementTree(self.mxfile).write(path, encoding="utf-8", xml_declaration=False)
        ET.parse(path)


def rect_style(fill: str, *, stroke: str = svg.BLACK, dashed: bool = False) -> str:
    parts = [
        "rounded=0",
        "whiteSpace=wrap",
        "html=1",
        "shadow=0",
        f"fillColor={fill}",
    ]
    if stroke == "none":
        parts.extend(["strokeColor=none", "strokeWidth=0"])
    else:
        parts.extend([f"strokeColor={stroke}", "strokeWidth=1"])
    if dashed:
        parts.extend(["dashed=1", "dashPattern=8 8"])
    return ";".join(parts) + ";"


def label_style(
    *,
    font_size: int = int(svg.size_to_px(svg.BODY_SIZE)),
    font_color: str = svg.BLACK,
    align: str = "left",
    vertical_align: str = "top",
    font_family: str = "Ubuntu Sans",
    font_source: str | None = FONT_SOURCE,
) -> str:
    font_source_part = f";fontSource={font_source}" if font_source else ""
    return (
        f"rounded=0;whiteSpace=wrap;html=1;align={align};verticalAlign={vertical_align};"
        "spacing=0;spacingTop=0;spacingBottom=0;spacingLeft=0;spacingRight=0;"
        "fillColor=none;strokeColor=none;strokeWidth=0;shadow=0;"
        f"fontFamily={font_family}{font_source_part};fontSize={font_size};fontColor={font_color};"
    )


def ellipse_style(fill: str) -> str:
    return (
        "ellipse;whiteSpace=wrap;html=1;aspect=fixed;"
        f"fillColor={fill};strokeColor={svg.BLACK};strokeWidth=1;shadow=0;"
    )


def image_style(image_uri: str) -> str:
    return (
        "shape=image;html=1;aspect=fixed;imageAspect=0;verticalLabelPosition=middle;"
        "verticalAlign=middle;strokeColor=none;fillColor=none;imageBackground=none;"
        "imageBorder=0;image="
        + image_uri
        + ";"
    )


def edge_style(
    color: str,
    *,
    dashed: bool = False,
    start_arrow: bool = False,
    end_arrow: bool = True,
    orthogonal: bool = True,
    exit_x: float | None = None,
    exit_y: float | None = None,
    entry_x: float | None = None,
    entry_y: float | None = None,
) -> str:
    parts = [
        "edgeStyle=orthogonalEdgeStyle" if orthogonal else "edgeStyle=none",
        "rounded=0",
        "orthogonalLoop=1",
        "jettySize=auto",
        "html=1",
        f"strokeColor={color}",
        "strokeWidth=1",
    ]
    if start_arrow:
        parts.extend(["startArrow=blockThin", "startFill=1", "startSize=8"])
    else:
        parts.extend(["startArrow=none", "startFill=0"])
    if end_arrow:
        parts.extend(["endArrow=blockThin", "endFill=1", "endSize=8"])
    else:
        parts.extend(["endArrow=none", "endFill=0"])
    if dashed:
        parts.extend(["dashed=1", "dashPattern=8 8"])
    if exit_x is not None and exit_y is not None:
        parts.extend([f"exitX={exit_x}", f"exitY={exit_y}", "exitDx=0", "exitDy=0"])
    if entry_x is not None and entry_y is not None:
        parts.extend([f"entryX={entry_x}", f"entryY={entry_y}", "entryDx=0", "entryDy=0"])
    return ";".join(parts) + ";"


def text_height(lines: list[dict[str, object]], *, pad_bottom: int = 0, min_height: int = 0) -> int:
    return svg.stack_required_height(lines, top_pad=0, bottom_pad=pad_bottom, min_height=min_height)


def rich_text(lines: list[dict[str, object]]) -> str:
    rendered: list[str] = []
    for spec in lines:
        content = html.escape(str(spec["content"]))
        inner = content
        if str(spec["weight"]) != "400":
            inner = f"<b>{inner}</b>"
        styles: list[str] = []
        size_px = int(round(svg.size_to_px(spec["size"])))
        if size_px != 16:
            styles.append(f"font-size:{size_px}px")
        fill = str(spec["fill"])
        if fill != svg.BLACK:
            styles.append(f"color:{fill}")
        if bool(spec["small_caps"]):
            styles.append("font-variant:small-caps")
            styles.append("letter-spacing:0.05em")
        if styles:
            inner = f'<span style="{";".join(styles)}">{inner}</span>'
        rendered.append(inner)
    return "<br>".join(rendered)


def add_image(
    builder: DrawioBuilder,
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    image_uri: str,
    parent: str = "1",
    connectable: bool = False,
    style_tokens: tuple[str, ...] | None = None,
) -> str:
    resolved_tokens = style_tokens or (("icon-image",) if abs(width - 48) < 1e-6 and abs(height - 48) < 1e-6 else ("image-generic",))
    return builder.add_vertex(
        x=x,
        y=y,
        width=width,
        height=height,
        style=image_style(image_uri),
        parent=parent,
        connectable=connectable,
        metadata=dg_tokens.CellMetadata(role="image", style_tokens=resolved_tokens),
    )


def add_label(
    builder: DrawioBuilder,
    *,
    x: float,
    y: float,
    width: float,
    lines: list[dict[str, object]],
    height: float | None = None,
    parent: str = "1",
    connectable: bool = False,
    align: str = "left",
    vertical_align: str = "top",
    font_family: str = "Ubuntu Sans",
    font_source: str | None = FONT_SOURCE,
    style_tokens: tuple[str, ...] | None = None,
) -> str:
    resolved_height = height if height is not None else text_height(lines)
    return builder.add_vertex(
        x=x,
        y=y,
        width=width,
        height=resolved_height,
        style=label_style(
            align=align,
            vertical_align=vertical_align,
            font_family=font_family,
            font_source=font_source,
        ),
        value=rich_text(lines),
        parent=parent,
        connectable=connectable,
        metadata=dg_tokens.CellMetadata(role="label", style_tokens=style_tokens or ("label-free",)),
    )


def add_box(
    builder: DrawioBuilder,
    *,
    x: float,
    y: float,
    width: float,
    height: float | None = None,
    fill: str,
    lines: list[dict[str, object]],
    icon_name: str | None = None,
    icon_fill: str | None = None,
    parent: str = "1",
    connectable: bool = True,
) -> str:
    resolved_height = max(height or 0, svg.lines_required_height(lines))
    box_token = box_style_token(fill)
    box_id = builder.add_vertex(
        x=x,
        y=y,
        width=width,
        height=resolved_height,
        style=rect_style(fill),
        parent=parent,
        connectable=connectable,
        metadata=dg_tokens.CellMetadata(role="box", style_tokens=(box_token,)),
    )
    text_width = svg.box_text_width(width, has_icon=icon_name is not None)
    add_label(
        builder,
        x=svg.INSET,
        y=svg.INSET,
        width=text_width,
        height=max(0, resolved_height - (svg.INSET * 2)),
        lines=lines,
        parent=box_id,
        style_tokens=("label-box",),
    )
    if icon_name:
        add_image(
            builder,
            x=width - svg.INSET - svg.ICON_SIZE,
            y=svg.INSET,
            width=svg.ICON_SIZE,
            height=svg.ICON_SIZE,
            image_uri=icon_uri(icon_name, icon_fill or svg.BLACK),
            parent=box_id,
            style_tokens=("icon-image",),
        )
    return box_id


def add_plain_rect(
    builder: DrawioBuilder,
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    fill: str,
    stroke: str = svg.BLACK,
    dashed: bool = False,
    parent: str = "1",
    connectable: bool = False,
    style_tokens: tuple[str, ...] | None = None,
) -> str:
    return builder.add_vertex(
        x=x,
        y=y,
        width=width,
        height=height,
        style=rect_style(fill, stroke=stroke, dashed=dashed),
        parent=parent,
        connectable=connectable,
        metadata=dg_tokens.CellMetadata(
            role="rect",
            style_tokens=style_tokens or (rect_style_token(fill, stroke=stroke, dashed=dashed, width=width, height=height),),
        ),
    )


def add_circle_marker(
    builder: DrawioBuilder,
    *,
    cx: float,
    cy: float,
    radius: float,
    fill: str,
    parent: str = "1",
) -> str:
    return builder.add_vertex(
        x=cx - radius,
        y=cy - radius,
        width=radius * 2,
        height=radius * 2,
        style=ellipse_style(fill),
        parent=parent,
        connectable=False,
        metadata=dg_tokens.CellMetadata(role="marker", style_tokens=("legend-marker",)),
    )


def add_matrix(builder: DrawioBuilder, *, x: float, y: float, label: str, connectable: bool = True) -> str:
    matrix = add_plain_rect(
        builder,
        x=x,
        y=y,
        width=svg.MATRIX_SIZE,
        height=svg.MATRIX_SIZE,
        fill=svg.GREY,
        connectable=connectable,
        style_tokens=("matrix-widget",),
    )
    add_plain_rect(builder, x=0, y=svg.MATRIX_HEADER_HEIGHT, width=svg.MATRIX_SIZE, height=1, fill=svg.BLACK, stroke="none", parent=matrix, style_tokens=("matrix-divider",))
    for divider_x in svg.MATRIX_COLUMN_DIVIDERS:
        add_plain_rect(
            builder,
            x=divider_x,
            y=svg.MATRIX_HEADER_HEIGHT,
            width=1,
            height=svg.MATRIX_SIZE - svg.MATRIX_HEADER_HEIGHT,
            fill=svg.BLACK,
            stroke="none",
            parent=matrix,
            style_tokens=("matrix-divider",),
        )
    for divider_y in svg.MATRIX_ROW_DIVIDERS:
        add_plain_rect(builder, x=0, y=divider_y, width=svg.MATRIX_SIZE, height=1, fill=svg.BLACK, stroke="none", parent=matrix, style_tokens=("matrix-divider",))
    add_label(
        builder,
        x=0,
        y=2,
        width=svg.MATRIX_SIZE,
        height=svg.MATRIX_HEADER_HEIGHT - 4,
        lines=[svg.make_line(label, size=svg.MATRIX_LABEL_SIZE, weight="700", line_step=12)],
        parent=matrix,
        align="center",
        vertical_align="middle",
        style_tokens=("label-matrix",),
    )
    return matrix


def add_request_cluster(builder: DrawioBuilder, *, x: float, y: float) -> None:
    for offset, name in ((0, "Document.svg"), (56, "Photography.svg"), (112, "Globe.svg")):
        add_image(builder, x=x + offset, y=y, width=48, height=48, image_uri=icon_uri(name), style_tokens=("request-cluster-icon",))


def add_command_bar(builder: DrawioBuilder, *, x: float, y: float, width: float, text_value: str) -> str:
    bar = builder.add_vertex(
        x=x,
        y=y,
        width=width,
        height=64,
        style=rect_style(svg.GREY),
        connectable=True,
        metadata=dg_tokens.CellMetadata(role="terminal-bar", style_tokens=("terminal-bar",)),
    )
    add_plain_rect(
        builder,
        x=0,
        y=svg.TERMINAL_CHROME_HEIGHT,
        width=width,
        height=1,
        fill=svg.BLACK,
        stroke="none",
        parent=bar,
        style_tokens=("terminal-separator",),
    )
    for cx in (20, 36, 52):
        builder.add_vertex(
            x=cx - svg.TERMINAL_DOT_RADIUS,
            y=(svg.TERMINAL_CHROME_HEIGHT / 2) - svg.TERMINAL_DOT_RADIUS,
            width=svg.TERMINAL_DOT_RADIUS * 2,
            height=svg.TERMINAL_DOT_RADIUS * 2,
            style=ellipse_style(svg.WHITE),
            parent=bar,
            connectable=False,
            metadata=dg_tokens.CellMetadata(role="marker", style_tokens=("terminal-dot",)),
        )
    add_label(
        builder,
        x=24,
        y=28,
        width=width - 32,
        height=28,
        lines=[svg.make_line(text_value)],
        parent=bar,
        font_family=svg.TERMINAL_FONT_FAMILY,
        font_source=None,
        style_tokens=("label-terminal",),
    )
    return bar


def export_memory_wall() -> None:
    builder = DrawioBuilder(name="Page-1", diagram_id="memory-wall", page_width=560, page_height=760)

    user = add_box(builder, x=96, y=24, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("User request")])
    add_request_cluster(builder, x=304, y=32)

    framework = add_box(
        builder,
        x=96,
        y=112,
        width=192,
        height=64,
        fill=svg.GREY,
        lines=[svg.make_line("App & model"), svg.make_line("framework")],
        icon_name="Package.svg",
    )
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
        source=user,
        target=framework,
        source_point=(192, 88),
        target_point=(192, 112),
    )

    missing = add_box(builder, x=96, y=200, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("Missing layer")])
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
        source=framework,
        target=missing,
        source_point=(192, 176),
        target_point=(192, 200),
    )
    builder.add_edge(
        style=edge_style(svg.BLACK, dashed=True, end_arrow=False, orthogonal=False),
        source_point=(96, 188),
        target_point=(288, 188),
    )
    note = add_label(
        builder,
        x=336,
        y=208,
        width=144,
        height=48,
        lines=[svg.make_line("No model-aware", fill=svg.HELPER), svg.make_line("orchestration!", fill=svg.HELPER)],
    )
    builder.add_edge(
        style=edge_style(svg.BLACK, exit_x=0, exit_y=0.5, entry_x=1, entry_y=0.5),
        source=note,
        target=missing,
        source_point=(336, 232),
        target_point=(288, 232),
    )

    operating = add_box(
        builder,
        x=96,
        y=288,
        width=192,
        height=64,
        fill=svg.GREY,
        lines=[svg.make_line("Operating"), svg.make_line("system")],
        icon_name="Server.svg",
    )
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
        source=missing,
        target=operating,
        source_point=(192, 264),
        target_point=(192, 288),
    )

    hardware = add_box(
        builder,
        x=96,
        y=376,
        width=192,
        height=64,
        fill=svg.GREY,
        lines=[svg.make_line("Hardware")],
        icon_name="Chip 1.svg",
    )
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
        source=operating,
        target=hardware,
        source_point=(192, 352),
        target_point=(192, 376),
    )

    silicon = add_box(
        builder,
        x=96,
        y=464,
        width=192,
        height=64,
        fill=svg.GREY,
        lines=[svg.make_line("Silicon")],
        icon_name="Chip 2.svg",
    )
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
        source=hardware,
        target=silicon,
        source_point=(192, 440),
        target_point=(192, 464),
    )

    memory_panel = add_image(builder, x=96, y=552, width=192, height=80, image_uri=memory_panel_uri(), connectable=True, style_tokens=("memory-panel",))
    add_label(builder, x=8, y=8, width=120, height=24, lines=[svg.make_line("Memory wall")], parent=memory_panel, style_tokens=("label-box",))
    add_image(builder, x=136, y=8, width=48, height=48, image_uri=icon_uri("Memory.svg"), parent=memory_panel)
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
        source=silicon,
        target=memory_panel,
        source_point=(192, 528),
        target_point=(192, 552),
    )

    builder.write(svg.DRAWIO_DIR / "memory-wall-onbrand.drawio")


def export_request_to_hardware_stack() -> None:
    builder = DrawioBuilder(name="Page-1", diagram_id="request-to-hardware", page_width=560, page_height=1320)

    x = 56
    panel_width = 408
    center_x = x + panel_width / 2

    user = add_box(builder, x=x + 108, y=24, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("User request")], icon_name="Cloud.svg")

    orchestration = add_box(builder, x=x, y=112, width=panel_width, height=200, fill=svg.GREY, lines=[svg.make_line("Orchestration layer", weight="700")], icon_name="Snap.svg")
    add_box(builder, x=8, y=56, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("Ollama")], parent=orchestration, connectable=False)
    add_box(builder, x=208, y=56, width=192, height=72, fill=svg.WHITE, lines=[svg.make_line("Lemonade"), svg.make_line("Server")], parent=orchestration, connectable=False)
    add_box(builder, x=8, y=128, width=392, height=64, fill=svg.WHITE, lines=[svg.make_line("vLLM")], parent=orchestration, connectable=False)

    runtime = add_box(builder, x=x, y=336, width=panel_width, height=272, fill=svg.WHITE, lines=[svg.make_line("Model runtime", weight="700")], icon_name="AI.svg")
    add_box(builder, x=8, y=56, width=192, height=64, fill=svg.GREY, lines=[svg.make_line("llama.cpp")], parent=runtime, connectable=False)
    add_box(builder, x=208, y=56, width=192, height=64, fill=svg.GREY, lines=[svg.make_line("OpenVINO")], parent=runtime, connectable=False)
    add_box(builder, x=8, y=128, width=192, height=64, fill=svg.GREY, lines=[svg.make_line("vLLM")], parent=runtime, connectable=False)
    add_box(builder, x=208, y=128, width=192, height=72, fill=svg.GREY, lines=[svg.make_line("TensorRT-"), svg.make_line("LLM")], parent=runtime, connectable=False)
    add_box(builder, x=8, y=200, width=392, height=64, fill=svg.GREY, lines=[svg.make_line("ONNX Runtime")], parent=runtime, connectable=False)

    kernel = add_box(builder, x=x, y=632, width=panel_width, height=200, fill=svg.GREY, lines=[svg.make_line("Compute kernel", weight="700")], icon_name="kernel.svg")
    add_box(builder, x=8, y=56, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("CUDA")], parent=kernel, connectable=False)
    add_box(builder, x=208, y=56, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("ROCm")], parent=kernel, connectable=False)
    add_box(builder, x=8, y=128, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("Metal")], parent=kernel, connectable=False)
    add_box(builder, x=208, y=128, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("oneDNN")], parent=kernel, connectable=False)

    driver = add_box(builder, x=x, y=856, width=panel_width, height=128, fill=svg.WHITE, lines=[svg.make_line("Driver", weight="700")], icon_name="Wrench 1.svg")
    add_box(builder, x=8, y=56, width=192, height=64, fill=svg.GREY, lines=[svg.make_line("CUDA")], parent=driver, connectable=False)
    add_box(builder, x=208, y=56, width=192, height=64, fill=svg.GREY, lines=[svg.make_line("ROCm")], parent=driver, connectable=False)

    hardware = add_box(builder, x=x, y=1008, width=panel_width, height=200, fill=svg.GREY, lines=[svg.make_line("Hardware", weight="700")], icon_name="Chip 1.svg")
    add_box(builder, x=8, y=56, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("CPU")], icon_name="CPU.svg", parent=hardware, connectable=False)
    add_box(builder, x=208, y=56, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("GPU")], icon_name="RAM.svg", parent=hardware, connectable=False)
    add_box(builder, x=8, y=128, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("NPU")], icon_name="Chip 2.svg", parent=hardware, connectable=False)
    add_box(builder, x=208, y=128, width=192, height=72, fill=svg.WHITE, lines=[svg.make_line("RAM &"), svg.make_line("VRAM")], icon_name="Memory.svg", parent=hardware, connectable=False)

    for source, target, start_y, target_y in (
        (user, orchestration, 88, 112),
        (orchestration, runtime, 312, 336),
        (runtime, kernel, 608, 632),
        (kernel, driver, 832, 856),
        (driver, hardware, 984, 1008),
    ):
        builder.add_edge(
            style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
            source=source,
            target=target,
            source_point=(center_x, start_y),
            target_point=(center_x, target_y),
        )

    builder.write(svg.DRAWIO_DIR / "request-to-hardware-stack-onbrand.drawio")


def export_inference_snaps() -> None:
    builder = DrawioBuilder(name="Page-1", diagram_id="inference-snaps", page_width=840, page_height=880)

    x = 72
    frame_width = 616
    pad_x = x
    pad_y = 296
    pad_width = frame_width
    pad_height = 296
    tile_gap = 8
    tile_width = 296
    hardware_y = 624
    hardware_width = 200
    hardware_x = [x, x + hardware_width + tile_gap, x + (hardware_width + tile_gap) * 2]
    hardware_centers = [hardware_x[0] + hardware_width / 2, hardware_x[1] + hardware_width / 2, hardware_x[2] + hardware_width / 2]

    header = add_box(builder, x=x, y=24, width=frame_width, height=64, fill=svg.WHITE, lines=[svg.make_line("Inference snaps", weight="700")], icon_name="Snap.svg")
    command = add_command_bar(builder, x=x, y=112, width=frame_width, text_value="$ snap install gemma3")
    add_plain_rect(builder, x=64, y=200, width=632, height=520, fill="none", dashed=True)
    snap = add_box(builder, x=x, y=216, width=frame_width, height=64, fill=svg.WHITE, lines=[svg.make_line("Inference snap", weight="700")], icon_name="Package.svg")

    pad = add_plain_rect(builder, x=pad_x, y=pad_y, width=pad_width, height=pad_height, fill=svg.GREY, stroke="none", connectable=True)
    row_y = [8, 80, 152, 224]
    add_box(builder, x=8, y=row_y[0], width=tile_width, height=64, fill=svg.WHITE, lines=[svg.make_line("Model")], icon_name="Network.svg", parent=pad, connectable=False)
    add_box(builder, x=8 + tile_width + tile_gap, y=row_y[0], width=tile_width, height=64, fill=svg.WHITE, lines=[svg.make_line("Workload"), svg.make_line("identity")], icon_name="User.svg", parent=pad, connectable=False)
    add_box(builder, x=8, y=row_y[1], width=tile_width, height=64, fill=svg.WHITE, lines=[svg.make_line("Runtime")], icon_name="Gauge.svg", parent=pad, connectable=False)
    add_box(builder, x=8 + tile_width + tile_gap, y=row_y[1], width=tile_width, height=64, fill=svg.WHITE, lines=[svg.make_line("Heterogeneous"), svg.make_line("hardware")], icon_name="Chip 1.svg", parent=pad, connectable=False)
    add_box(builder, x=8, y=row_y[2], width=tile_width, height=64, fill=svg.WHITE, lines=[svg.make_line("Dependencies")], icon_name="Wrench 1.svg", parent=pad, connectable=False)
    add_box(builder, x=8 + tile_width + tile_gap, y=row_y[2], width=tile_width, height=64, fill=svg.WHITE, lines=[svg.make_line("Reproducibility")], icon_name="Clipboard.svg", parent=pad, connectable=False)
    add_box(builder, x=8, y=row_y[3], width=tile_width, height=64, fill=svg.WHITE, lines=[svg.make_line("Hardware"), svg.make_line("config")], icon_name="CPU.svg", parent=pad, connectable=False)
    add_box(builder, x=8 + tile_width + tile_gap, y=row_y[3], width=tile_width, height=64, fill=svg.WHITE, lines=[svg.make_line("Operational"), svg.make_line("observability")], icon_name="Bar chart with check.svg", parent=pad, connectable=False)

    cpu = add_box(builder, x=hardware_x[0], y=hardware_y, width=hardware_width, height=64, fill=svg.WHITE, lines=[svg.make_line("CPU")], icon_name="CPU.svg")
    gpu = add_box(builder, x=hardware_x[1], y=hardware_y, width=hardware_width, height=64, fill=svg.GREY, lines=[svg.make_line("GPU")], icon_name="RAM.svg")
    npu = add_box(builder, x=hardware_x[2], y=hardware_y, width=hardware_width, height=64, fill=svg.WHITE, lines=[svg.make_line("NPU")], icon_name="Chip 2.svg")

    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
        source=command,
        target=snap,
        source_point=(380, 176),
        target_point=(380, 216),
    )
    for target, center in ((cpu, hardware_centers[0]), (gpu, hardware_centers[1]), (npu, hardware_centers[2])):
        builder.add_edge(
            style=edge_style(svg.ORANGE, exit_x=(center - pad_x) / pad_width, exit_y=1, entry_x=0.5, entry_y=0),
            source=pad,
            target=target,
            source_point=(center, pad_y + pad_height),
            target_point=(center, hardware_y),
        )

    builder.write(svg.DRAWIO_DIR / "inference-snaps-onbrand.drawio")


def export_inference_snaps_dense() -> None:
    builder = DrawioBuilder(name="Page-1", diagram_id="inference-snaps-dense", page_width=760, page_height=800)

    x = 60
    frame_width = 640
    inner_pad = svg.INSET
    tile_gap = svg.GRID_GUTTER
    row_gap = svg.GRID_GUTTER
    tile_width = 300
    hardware_gap = svg.GRID_GUTTER
    hardware_width = svg.BLOCK_WIDTH
    content_left = x + inner_pad
    right_x = content_left + tile_width + tile_gap
    hardware_x = [
        content_left,
        content_left + hardware_width + hardware_gap,
        content_left + (hardware_width + hardware_gap) * 2,
    ]
    hardware_centers = [left + hardware_width / 2 for left in hardware_x]

    tile_rows = [
        (
            [svg.make_line("Model")],
            "Network.svg",
            [svg.make_line("Workload"), svg.make_line("identity")],
            "User.svg",
        ),
        (
            [svg.make_line("Runtime")],
            "Gauge.svg",
            [svg.make_line("Heterogeneous"), svg.make_line("hardware")],
            "Chip 1.svg",
        ),
        (
            [svg.make_line("Dependencies")],
            "Wrench 1.svg",
            [svg.make_line("Reproducibility")],
            "Clipboard.svg",
        ),
        (
            [svg.make_line("Hardware"), svg.make_line("config")],
            "CPU.svg",
            [svg.make_line("Operational"), svg.make_line("observability")],
            "Bar chart with check.svg",
        ),
    ]

    header = add_box(
        builder,
        x=x,
        y=24,
        width=frame_width,
        height=64,
        fill=svg.WHITE,
        lines=[svg.make_line("Inference snaps", weight="700")],
        icon_name="Snap.svg",
    )
    command = add_command_bar(builder, x=x, y=112, width=frame_width, text_value="$ snap install gemma3")
    snap = add_box(
        builder,
        x=x,
        y=216,
        width=frame_width,
        height=64,
        fill=svg.WHITE,
        lines=[svg.make_line("Inference snap", weight="700")],
        icon_name="Package.svg",
    )

    current_y = inner_pad
    pad_row_positions: list[float] = []
    for left_lines, _left_icon, right_lines, _right_icon in tile_rows:
        pad_row_positions.append(current_y)
        current_y += max(svg.lines_required_height(left_lines), svg.lines_required_height(right_lines)) + row_gap
    pad_height = int(current_y - row_gap + inner_pad)
    pad_y = 304
    hardware_y = pad_y + pad_height + row_gap
    dashed_height = (hardware_y + 64 + 16) - 200

    add_plain_rect(builder, x=x - 8, y=200, width=frame_width + 16, height=dashed_height, fill="none", dashed=True)
    pad = add_plain_rect(builder, x=x, y=pad_y, width=frame_width, height=pad_height, fill=svg.GREY, stroke="none", connectable=True)

    for row_y, (left_lines, left_icon, right_lines, right_icon) in zip(pad_row_positions, tile_rows):
        add_box(builder, x=inner_pad, y=row_y, width=tile_width, fill=svg.WHITE, lines=left_lines, icon_name=left_icon, parent=pad, connectable=False)
        add_box(builder, x=inner_pad + tile_width + tile_gap, y=row_y, width=tile_width, fill=svg.WHITE, lines=right_lines, icon_name=right_icon, parent=pad, connectable=False)

    cpu = add_box(builder, x=hardware_x[0], y=hardware_y, width=hardware_width, fill=svg.WHITE, lines=[svg.make_line("CPU")], icon_name="CPU.svg")
    gpu = add_box(builder, x=hardware_x[1], y=hardware_y, width=hardware_width, fill=svg.GREY, lines=[svg.make_line("GPU")], icon_name="RAM.svg")
    npu = add_box(builder, x=hardware_x[2], y=hardware_y, width=hardware_width, fill=svg.WHITE, lines=[svg.make_line("NPU")], icon_name="Chip 2.svg")

    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
        source=command,
        target=snap,
        source_point=(x + frame_width / 2, 176),
        target_point=(x + frame_width / 2, 216),
    )
    for target, center in ((cpu, hardware_centers[0]), (gpu, hardware_centers[1]), (npu, hardware_centers[2])):
        builder.add_edge(
            style=edge_style(svg.ORANGE, exit_x=(center - x) / frame_width, exit_y=1, entry_x=0.5, entry_y=0),
            source=pad,
            target=target,
            source_point=(center, pad_y + pad_height),
            target_point=(center, hardware_y),
        )

    builder.write(svg.DRAWIO_DIR / "inference-snaps-dense-onbrand.drawio")


def export_rise_of_inference() -> None:
    builder = DrawioBuilder(name="Page-1", diagram_id="rise-inference", page_width=980, page_height=860)

    add_box(builder, x=32, y=32, width=848, height=64, fill=svg.WHITE, lines=[svg.make_line("The rise of the inference economy", weight="700")], icon_name="Cloud.svg")
    training = add_box(builder, x=32, y=120, width=408, height=64, fill=svg.GREY, lines=[svg.make_line("Training", weight="700")], icon_name="AI.svg")
    inference = add_box(builder, x=472, y=120, width=408, height=64, fill=svg.BLACK, lines=[svg.make_line("Inference", weight="700", fill=svg.WHITE)], icon_name="CPU.svg", icon_fill=svg.WHITE)
    costly = add_box(builder, x=32, y=208, width=408, height=64, fill=svg.WHITE, lines=[svg.make_line("Costly & episodic"), svg.make_line("High investment", fill=svg.HELPER)], icon_name="Finance.svg")
    constant = add_box(builder, x=472, y=208, width=408, height=64, fill=svg.WHITE, lines=[svg.make_line("Constant & demand-driven"), svg.make_line("Ongoing expense", fill=svg.HELPER)], icon_name="Server.svg")
    add_box(builder, x=32, y=320, width=408, height=64, fill=svg.GREY, lines=[svg.make_line("Always-on compute", weight="700")], icon_name="Globe.svg")
    add_box(builder, x=472, y=320, width=408, height=64, fill=svg.GREY, lines=[svg.make_line("Revenue impact", weight="700")], icon_name="Financial data.svg")
    add_box(builder, x=32, y=416, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("Data centers")], icon_name="Server.svg")
    add_box(builder, x=248, y=416, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("Edge devices")], icon_name="Mobile.svg")
    add_box(builder, x=32, y=504, width=408, height=64, fill=svg.WHITE, lines=[svg.make_line("Local AI")], icon_name="AI.svg")
    add_box(builder, x=472, y=416, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("Latency down")], icon_name="Gauge.svg")
    add_box(builder, x=688, y=416, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("Tokens/sec up")], icon_name="Scale up.svg")
    add_box(builder, x=472, y=504, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("Efficiency up")], icon_name="Line chart with check.svg")
    add_box(builder, x=688, y=504, width=192, height=72, fill=svg.WHITE, lines=[svg.make_line("Optimization"), svg.make_line("& scale")], icon_name="Line chart with commerce.svg")
    summary = add_box(builder, x=32, y=608, width=848, height=64, fill=svg.GREY, lines=[svg.make_line("From training focused to inference focused", weight="700")])
    final = add_box(builder, x=32, y=696, width=848, height=64, fill=svg.WHITE, lines=[svg.make_line("Performance & cost efficiency", weight="700")])

    builder.add_edge(style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0), source=training, target=costly, source_point=(236, 184), target_point=(236, 208))
    builder.add_edge(style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0), source=inference, target=constant, source_point=(676, 184), target_point=(676, 208))
    builder.add_edge(style=edge_style(svg.ORANGE, exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5), source=costly, target=constant, source_point=(440, 240), target_point=(472, 240))
    builder.add_edge(style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0), source=summary, target=final, source_point=(456, 672), target_point=(456, 696))

    builder.write(svg.DRAWIO_DIR / "rise-of-inference-economy-onbrand.drawio")


def export_gpu_waiting() -> None:
    builder = DrawioBuilder(name="Page-1", diagram_id="gpu-waiting", page_width=840, page_height=480)

    scheduler = add_box(
        builder,
        x=392,
        y=32,
        width=320,
        height=80,
        fill=svg.WHITE,
        lines=[svg.make_line("Scheduler", weight="700"), svg.make_line("AI inference"), svg.make_line("request")],
        icon_name="Desktop monitor.svg",
    )
    add_image(builder, x=304, y=96, width=48, height=48, image_uri=icon_uri("Document.svg"))
    add_image(builder, x=120, y=152, width=48, height=48, image_uri=icon_uri("Gauge.svg"))
    gpu = add_box(builder, x=40, y=232, width=192, height=64, fill=svg.GREY, lines=[svg.make_line("GPU", weight="700")], icon_name="CPU.svg")
    add_label(builder, x=288, y=164, width=160, lines=[svg.make_line("Queued request", fill=svg.HELPER)])
    add_label(builder, x=40, y=320, width=160, lines=[svg.make_line("Waiting...", weight="700")])

    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
        source=gpu,
        target=scheduler,
        source_point=(232, 264),
        target_point=(392, 68),
        waypoints=[(304, 264), (304, 68)],
    )

    builder.write(svg.DRAWIO_DIR / "gpu-waiting-scheduler-onbrand.drawio")


def export_diagram_intake_workflow() -> None:
    builder = DrawioBuilder(name="Page-1", diagram_id="diagram-intake-workflow", page_width=840, page_height=720)

    frame_x = 72
    frame_y = 24
    frame_width = 608
    frame_height = 176
    center_x = frame_x + frame_width / 2

    input_frame = add_plain_rect(
        builder,
        x=frame_x,
        y=frame_y,
        width=frame_width,
        height=frame_height,
        fill="none",
        dashed=True,
        connectable=True,
        style_tokens=("group-frame",),
    )
    add_label(
        builder,
        x=8,
        y=8,
        width=280,
        lines=[svg.make_line("Rough initial diagram sources", weight="700")],
        parent=input_frame,
    )
    add_box(
        builder,
        x=8,
        y=48,
        width=192,
        height=64,
        fill=svg.WHITE,
        lines=[svg.make_line("ChatGPT-generated"), svg.make_line("diagrams")],
        icon_name="AI.svg",
        parent=input_frame,
        connectable=False,
    )
    add_box(
        builder,
        x=208,
        y=48,
        width=392,
        height=72,
        fill=svg.GREY,
        lines=[svg.make_line("? Additional rough"), svg.make_line("source formats"), svg.make_line("from PMs")],
        parent=input_frame,
        connectable=False,
    )
    add_label(
        builder,
        x=8,
        y=136,
        width=592,
        lines=[svg.make_line("Ask PMs: which rough formats reach the brand team before on-brand redraw?", fill=svg.HELPER)],
        parent=input_frame,
    )

    workflow = add_box(
        builder,
        x=frame_x,
        y=224,
        width=frame_width,
        height=72,
        fill=svg.WHITE,
        lines=[svg.make_line("Agentic workflow", weight="700"), svg.make_line("in this repo"), svg.make_line("playbook + generators", fill=svg.HELPER)],
        icon_name="Screen with code.svg",
    )
    compare = add_box(
        builder,
        x=frame_x,
        y=320,
        width=frame_width,
        height=64,
        fill=svg.GREY,
        lines=[svg.make_line("Compare mode", weight="700"), svg.make_line("HTML before / agent / refined", fill=svg.HELPER)],
        icon_name="Document with Magnifying glass.svg",
    )
    polish = add_box(
        builder,
        x=frame_x,
        y=408,
        width=frame_width,
        height=72,
        fill=svg.WHITE,
        lines=[svg.make_line("Designer polish", weight="700"), svg.make_line("manual pass in generated"), svg.make_line("draw.io", fill=svg.HELPER)],
        icon_name="Design.svg",
    )
    final = add_box(
        builder,
        x=frame_x,
        y=504,
        width=frame_width,
        height=64,
        fill=svg.BLACK,
        lines=[svg.make_line("Final SVGs", weight="700", fill=svg.WHITE), svg.make_line("on-brand deliverables", fill=svg.WHITE)],
        icon_name="Storage image.svg",
        icon_fill=svg.WHITE,
    )

    for source, target, source_y, target_y in (
        (input_frame, workflow, frame_y + frame_height, 224),
        (workflow, compare, 296, 320),
        (compare, polish, 384, 408),
        (polish, final, 480, 504),
    ):
        builder.add_edge(
            style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
            source=source,
            target=target,
            source_point=(center_x, source_y),
            target_point=(center_x, target_y),
        )

    builder.write(svg.DRAWIO_DIR / "diagram-intake-workflow-onbrand.drawio")


def export_diagram_language_workflow() -> None:
    builder = DrawioBuilder(name="Page-1", diagram_id="diagram-language-workflow", page_width=840, page_height=816)

    frame_x = 72
    frame_y = 24
    frame_width = 656
    frame_height = 184
    center_x = frame_x + frame_width / 2

    input_frame = add_plain_rect(
        builder,
        x=frame_x,
        y=frame_y,
        width=frame_width,
        height=frame_height,
        fill="none",
        dashed=True,
        connectable=True,
        style_tokens=("group-frame",),
    )
    add_label(
        builder,
        x=8,
        y=8,
        width=320,
        lines=[svg.make_line("Inputs and canonical context", weight="700")],
        parent=input_frame,
    )
    add_box(
        builder,
        x=24,
        y=48,
        width=192,
        height=64,
        fill=svg.WHITE,
        lines=[svg.make_line("Rough source"), svg.make_line("diagram")],
        icon_name="Document.svg",
        parent=input_frame,
        connectable=False,
    )
    add_box(
        builder,
        x=232,
        y=48,
        width=192,
        height=64,
        fill=svg.GREY,
        lines=[svg.make_line("Local refs"), svg.make_line("+ outputs")],
        icon_name="Document with Magnifying glass.svg",
        parent=input_frame,
        connectable=False,
    )
    add_box(
        builder,
        x=440,
        y=48,
        width=192,
        height=64,
        fill=svg.BLACK,
        lines=[svg.make_line("DIAGRAM.md", weight="700", fill=svg.WHITE), svg.make_line("canonical spec", fill=svg.WHITE)],
        icon_name="Book with Magnifying glass.svg",
        icon_fill=svg.WHITE,
        parent=input_frame,
        connectable=False,
    )
    add_label(
        builder,
        x=8,
        y=136,
        width=640,
        lines=[svg.make_line("Next: ingest typography, spacing, and grid specs into this spec layer.", fill=svg.HELPER)],
        parent=input_frame,
    )

    redraw = add_box(
        builder,
        x=frame_x,
        y=232,
        width=frame_width,
        height=64,
        fill=svg.BLACK,
        lines=[svg.make_line("Diagram redraw", weight="700", fill=svg.WHITE), svg.make_line("skill", fill=svg.WHITE)],
        icon_name="Wrench 1.svg",
        icon_fill=svg.WHITE,
    )
    generators = add_box(
        builder,
        x=frame_x,
        y=320,
        width=frame_width,
        height=72,
        fill=svg.WHITE,
        lines=[svg.make_line("Repo generators", weight="700"), svg.make_line("shared tokens + library", fill=svg.HELPER)],
        icon_name="Screen with code.svg",
    )
    validate = add_box(
        builder,
        x=frame_x,
        y=416,
        width=frame_width,
        height=64,
        fill=svg.BLACK,
        lines=[svg.make_line("Build + validate", weight="700", fill=svg.WHITE), svg.make_line("skill", fill=svg.WHITE)],
        icon_name="Rosette with check.svg",
        icon_fill=svg.WHITE,
    )
    compare = add_box(
        builder,
        x=frame_x,
        y=504,
        width=frame_width,
        height=64,
        fill=svg.GREY,
        lines=[svg.make_line("Compare + review lane", weight="700"), svg.make_line("before / agent / refined", fill=svg.HELPER)],
        icon_name="Document with Magnifying glass.svg",
    )
    review = add_box(
        builder,
        x=frame_x,
        y=592,
        width=frame_width,
        height=64,
        fill=svg.BLACK,
        lines=[svg.make_line("Protected draw.io", weight="700", fill=svg.WHITE), svg.make_line("review skill", fill=svg.WHITE)],
        icon_name="Design.svg",
        icon_fill=svg.WHITE,
    )
    outputs = add_box(
        builder,
        x=frame_x,
        y=680,
        width=frame_width,
        height=72,
        fill=svg.WHITE,
        lines=[svg.make_line("Editable draw.io +", weight="700"), svg.make_line("SVG outputs"), svg.make_line("ready for token ingest", fill=svg.HELPER)],
        icon_name="Storage image.svg",
    )

    for source, target, source_y, target_y in (
        (input_frame, redraw, frame_y + frame_height, 232),
        (redraw, generators, 296, 320),
        (generators, validate, 392, 416),
        (validate, compare, 480, 504),
        (compare, review, 568, 592),
        (review, outputs, 656, 680),
    ):
        builder.add_edge(
            style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
            source=source,
            target=target,
            source_point=(center_x, source_y),
            target_point=(center_x, target_y),
        )

    builder.write(svg.DRAWIO_DIR / "diagram-language-workflow-onbrand.drawio")


def export_logic_data_vram() -> None:
    builder = DrawioBuilder(name="Page-1", diagram_id="logic-data-vram", page_width=980, page_height=860)

    left_panel = add_plain_rect(builder, x=32, y=32, width=408, height=360, fill=svg.WHITE)
    add_label(builder, x=8, y=8, width=240, lines=[svg.make_line("Logic + data conflict", weight="700")], parent=left_panel)
    add_box(builder, x=8, y=144, width=192, height=64, fill=svg.GREY, lines=[svg.make_line("CPU", weight="700")], icon_name="CPU.svg", parent=left_panel, connectable=False)
    add_box(builder, x=216, y=72, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("Logic", weight="700")], parent=left_panel, connectable=False)
    add_box(builder, x=216, y=160, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("Logic", weight="700")], parent=left_panel, connectable=False)
    add_box(builder, x=216, y=248, width=192, height=64, fill=svg.GREY, lines=[svg.make_line("Memory", weight="700")], icon_name="Memory.svg", parent=left_panel, connectable=False)
    add_label(builder, x=8, y=240, width=176, lines=[svg.make_line("Logic with optional", fill=svg.HELPER), svg.make_line("optional data.", fill=svg.HELPER)], parent=left_panel)
    add_label(builder, x=216, y=336, width=184, lines=[svg.make_line("Optional data can stay", fill=svg.HELPER), svg.make_line("separate.", fill=svg.HELPER)], parent=left_panel)

    right_panel = add_plain_rect(builder, x=472, y=32, width=408, height=360, fill=svg.WHITE)
    add_label(builder, x=8, y=8, width=184, lines=[svg.make_line("AI inference", weight="700")], parent=right_panel)
    right_logic = add_box(builder, x=8, y=72, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("Logic", weight="700")], icon_name="AI.svg", parent=right_panel)
    right_data = add_box(builder, x=8, y=160, width=192, height=64, fill=svg.GREY, lines=[svg.make_line("Data", weight="700")], icon_name="Data.svg", parent=right_panel)
    right_cpu = add_box(builder, x=8, y=248, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("CPU", weight="700")], icon_name="CPU.svg", parent=right_panel)
    right_data_2 = add_box(builder, x=216, y=120, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("Data", weight="700")], icon_name="Data.svg", parent=right_panel)
    right_memory = add_box(builder, x=216, y=280, width=192, height=64, fill=svg.GREY, lines=[svg.make_line("Memory", weight="700")], icon_name="Memory.svg", parent=right_panel)
    add_label(builder, x=8, y=336, width=160, lines=[svg.make_line("Logic inseparable", fill=svg.HELPER), svg.make_line("from data", fill=svg.HELPER)], parent=right_panel)

    lower_panel = add_plain_rect(builder, x=32, y=424, width=848, height=328, fill=svg.WHITE)
    add_label(builder, x=8, y=8, width=220, lines=[svg.make_line("VRAM fragmentation", weight="700")], parent=lower_panel)

    frag = add_plain_rect(builder, x=8, y=80, width=392, height=208, fill=svg.GREY, parent=lower_panel, connectable=True)
    add_label(builder, x=8, y=8, width=180, lines=[svg.make_line("Fragmented layout", weight="700")], parent=frag)
    add_image(builder, x=336, y=8, width=48, height=48, image_uri=icon_uri("RAM.svg"), parent=frag)
    add_box(builder, x=8, y=56, width=376, height=32, fill=svg.WHITE, lines=[svg.make_line("10 GB", weight="700")], parent=frag, connectable=False)
    add_box(builder, x=8, y=96, width=376, height=32, fill=svg.WHITE, lines=[svg.make_line("6 GB context cache", weight="700")], parent=frag, connectable=False)
    add_plain_rect(builder, x=8, y=136, width=72, height=32, fill=svg.WHITE, parent=frag)
    add_plain_rect(builder, x=88, y=136, width=56, height=32, fill=svg.GREY, parent=frag)
    add_plain_rect(builder, x=152, y=136, width=88, height=32, fill=svg.WHITE, parent=frag)
    add_plain_rect(builder, x=248, y=136, width=40, height=32, fill=svg.GREY, parent=frag)
    add_plain_rect(builder, x=296, y=136, width=88, height=32, fill=svg.WHITE, parent=frag)
    add_label(builder, x=8, y=176, width=240, lines=[svg.make_line("Fragmented allocations leave gaps.", fill=svg.HELPER)], parent=frag)

    packed = add_plain_rect(builder, x=448, y=80, width=392, height=208, fill=svg.GREY, parent=lower_panel, connectable=True)
    add_label(builder, x=8, y=8, width=180, lines=[svg.make_line("Packed layout", weight="700")], parent=packed)
    add_image(builder, x=336, y=8, width=48, height=48, image_uri=icon_uri("Memory.svg"), parent=packed)
    add_box(builder, x=8, y=56, width=376, height=32, fill=svg.WHITE, lines=[svg.make_line("24 GB GPU memory", weight="700")], parent=packed, connectable=False)
    add_box(builder, x=8, y=96, width=70, height=32, fill=svg.WHITE, lines=[svg.make_line("9 GB", weight="700")], parent=packed, connectable=False)
    add_box(builder, x=86, y=96, width=110, height=32, fill=svg.GREY, lines=[svg.make_line("Alloc", weight="700")], parent=packed, connectable=False)
    add_plain_rect(builder, x=204, y=96, width=180, height=32, fill=svg.WHITE, parent=packed)
    add_plain_rect(builder, x=8, y=136, width=220, height=32, fill=svg.GREY, parent=packed)
    add_box(builder, x=236, y=136, width=148, height=32, fill=svg.WHITE, lines=[svg.make_line("8 GB model", weight="700")], parent=packed, connectable=False)
    add_label(builder, x=8, y=176, width=120, lines=[svg.make_line("860 B free", fill=svg.HELPER)], parent=packed)

    add_image(builder, x=432, y=596, width=48, height=48, image_uri=icon_uri("Fragmentation.svg"))

    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
        source=right_logic,
        target=right_data_2,
        source_point=(672, 136),
        target_point=(688, 184),
        waypoints=[(680, 136), (680, 184)],
    )
    builder.add_edge(style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0), source=right_data, target=right_cpu, source_point=(576, 256), target_point=(576, 280))
    builder.add_edge(style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0), source=right_data_2, target=right_memory, source_point=(784, 216), target_point=(784, 312))
    offset_y = (616 - 504) / 208
    builder.add_edge(style=edge_style(svg.ORANGE, exit_x=1, exit_y=offset_y, entry_x=0, entry_y=offset_y), source=frag, target=packed, source_point=(432, 616), target_point=(480, 616))

    builder.write(svg.DRAWIO_DIR / "logic-data-vram-onbrand.drawio")


def export_attention_qkv() -> None:
    builder = DrawioBuilder(name="Page-1", diagram_id="attention-qkv", page_width=1840, page_height=1200)

    left_x = 48
    right_x = 912
    top_y = 48
    lower_y = 600

    add_label(builder, x=left_x, y=top_y, width=520, lines=[svg.make_line('The query (Q): the "question"', weight="700")])
    query_matrix = add_matrix(builder, x=144, y=96, label="Q")
    query_box = add_box(builder, x=48, y=184, width=240, height=64, fill=svg.GREY, lines=[svg.make_line("Ubuntu:")])
    add_label(builder, x=312, y=192, width=320, lines=[svg.make_line("I am a noun at the start of a", fill=svg.HELPER), svg.make_line("sentence followed by a colon.", fill=svg.HELPER)])
    add_label(builder, x=48, y=280, width=560, lines=[svg.make_line("I am a noun at the start of a sentence followed", fill=svg.HELPER), svg.make_line("by a colon. I am likely a subject being defined.", fill=svg.HELPER), svg.make_line("What in this sentence explains what I am?", fill=svg.HELPER)])
    builder.add_edge(style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0), source=query_matrix, target=query_box, source_point=(168, 144), target_point=(168, 184))

    add_label(builder, x=right_x, y=top_y, width=600, lines=[svg.make_line('The keys (K): the "advertisements"', weight="700")])
    keys_matrix = add_matrix(builder, x=1296, y=96, label="K")
    linux_key = add_box(builder, x=912, y=184, width=192, height=64, fill=svg.BLACK, lines=[svg.make_line("Linux", fill=svg.WHITE)], icon_fill=svg.WHITE)
    for_key = add_box(builder, x=1120, y=184, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("for")])
    human_key = add_box(builder, x=1328, y=184, width=192, height=64, fill=svg.GREY, lines=[svg.make_line("human")])
    beings_key = add_box(builder, x=1536, y=184, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("beings")])
    add_label(builder, x=912, y=280, width=176, lines=[svg.make_line("I am a technical", fill=svg.HELPER), svg.make_line("OS kernel", fill=svg.HELPER), svg.make_line("category.", fill=svg.HELPER)])
    add_label(builder, x=1120, y=280, width=176, lines=[svg.make_line("I am a preposition", fill=svg.HELPER), svg.make_line("indicating a target", fill=svg.HELPER), svg.make_line("audience.", fill=svg.HELPER)])
    add_label(builder, x=1328, y=280, width=176, lines=[svg.make_line("I am the adjective", fill=svg.HELPER), svg.make_line("that narrows the", fill=svg.HELPER), svg.make_line("species or type.", fill=svg.HELPER)])
    add_label(builder, x=1536, y=280, width=176, lines=[svg.make_line("I am the plural noun,", fill=svg.HELPER), svg.make_line("the object of the", fill=svg.HELPER), svg.make_line("audience.", fill=svg.HELPER)])
    for target, target_point, waypoint in (
        (linux_key, (1008, 184), (1008, 160)),
        (for_key, (1216, 184), (1216, 160)),
        (human_key, (1424, 184), (1424, 160)),
        (beings_key, (1632, 184), (1632, 160)),
    ):
        builder.add_edge(
            style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
            source=keys_matrix,
            target=target,
            source_point=(1320, 144),
            target_point=target_point,
            waypoints=[(1320, 160), waypoint],
        )

    add_label(builder, x=left_x, y=lower_y, width=620, lines=[svg.make_line('The match (QK^T): the "relevance check"', weight="700")])
    match_matrix = add_matrix(builder, x=432, y=648, label="QK")
    linux_match = add_box(builder, x=48, y=744, width=192, height=64, fill=svg.BLACK, lines=[svg.make_line("Linux", fill=svg.WHITE)], icon_fill=svg.WHITE)
    for_match = add_box(builder, x=256, y=744, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("for")])
    human_match = add_box(builder, x=464, y=744, width=192, height=64, fill=svg.GREY, lines=[svg.make_line("human")])
    beings_match = add_box(builder, x=672, y=744, width=192, height=64, fill=svg.WHITE, lines=[svg.make_line("beings")])
    add_label(builder, x=48, y=840, width=176, lines=[svg.make_line("Best semantic match:", fill=svg.HELPER), svg.make_line("the likely subject", fill=svg.HELPER), svg.make_line("being defined.", fill=svg.HELPER)])
    add_label(builder, x=256, y=840, width=176, lines=[svg.make_line("Relevant as context,", fill=svg.HELPER), svg.make_line("but not the thing", fill=svg.HELPER), svg.make_line("being defined.", fill=svg.HELPER)])
    add_label(builder, x=464, y=840, width=176, lines=[svg.make_line("Useful modifier,", fill=svg.HELPER), svg.make_line("but not stronger than", fill=svg.HELPER), svg.make_line("the main noun.", fill=svg.HELPER)])
    add_label(builder, x=672, y=840, width=176, lines=[svg.make_line("Part of the phrase,", fill=svg.HELPER), svg.make_line("yet less direct than", fill=svg.HELPER), svg.make_line("the kernel word.", fill=svg.HELPER)])
    for target, target_point, waypoint in (
        (linux_match, (144, 744), (144, 720)),
        (for_match, (352, 744), (352, 720)),
        (human_match, (560, 744), (560, 720)),
        (beings_match, (768, 744), (768, 720)),
    ):
        builder.add_edge(
            style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
            source=match_matrix,
            target=target,
            source_point=(456, 696),
            target_point=target_point,
            waypoints=[(456, 720), waypoint],
        )

    legend_y = 1008
    for cx, label, fill in ((80, "Low", svg.WHITE), (212, "Medium", svg.GREY), (388, "High", svg.BLACK)):
        add_circle_marker(builder, cx=cx, cy=legend_y, radius=12, fill=fill)
        add_label(builder, x=cx + 20, y=legend_y - 8, width=96, lines=[svg.make_line(label, fill=svg.HELPER)])

    add_label(builder, x=right_x, y=lower_y, width=620, lines=[svg.make_line('The value (V): the "knowledge transfer"', weight="700")])
    value_q = add_matrix(builder, x=912, y=648, label="Q")
    value_k = add_matrix(builder, x=1136, y=648, label="K")
    ubuntu_value = add_box(builder, x=912, y=744, width=192, height=64, fill=svg.GREY, lines=[svg.make_line("Ubuntu:")])
    linux_value = add_box(builder, x=1136, y=744, width=192, height=64, fill=svg.BLACK, lines=[svg.make_line("Linux", fill=svg.WHITE)], icon_fill=svg.WHITE)
    add_label(builder, x=1360, y=752, width=320, lines=[svg.make_line('Strongest meaning comes from "Linux",', fill=svg.HELPER), svg.make_line('with extra audience context from', fill=svg.HELPER), svg.make_line('"human beings".', fill=svg.HELPER)])
    value_transfer = add_box(builder, x=960, y=848, width=336, height=64, fill=svg.GREY, lines=[svg.make_line("Value transfer (V)", weight="700")])
    add_label(builder, x=912, y=944, width=520, lines=[svg.make_line('Now that the model knows "Linux" is the most relevant', fill=svg.HELPER), svg.make_line('word, it takes the value step to transfer the actual', fill=svg.HELPER), svg.make_line('semantic meaning of "Linux" and "human beings" into', fill=svg.HELPER), svg.make_line('the representation of "Ubuntu".', fill=svg.HELPER)])
    builder.add_edge(style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0), source=value_q, target=ubuntu_value, source_point=(936, 696), target_point=(1008, 744))
    builder.add_edge(style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0), source=value_k, target=linux_value, source_point=(1160, 696), target_point=(1232, 744))
    builder.add_edge(style=edge_style(svg.ORANGE, exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5), source=ubuntu_value, target=linux_value, source_point=(1104, 776), target_point=(1136, 776))
    builder.add_edge(style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0), source=linux_value, target=value_transfer, source_point=(1232, 808), target_point=(1232, 848))

    builder.write(svg.DRAWIO_DIR / "attention-qkv-onbrand.drawio")


def main() -> None:
    svg.DRAWIO_DIR.mkdir(parents=True, exist_ok=True)
    export_memory_wall()
    export_request_to_hardware_stack()
    export_inference_snaps()
    export_inference_snaps_dense()
    export_rise_of_inference()
    export_gpu_waiting()
    export_diagram_intake_workflow()
    export_diagram_language_workflow()
    export_logic_data_vram()
    export_attention_qkv()


if __name__ == "__main__":
    main()
