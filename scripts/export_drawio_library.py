from __future__ import annotations

import json
from pathlib import Path
import xml.etree.ElementTree as ET

import diagram_shared as svg
import export_drawio_batch as drawio


LIBRARY_DIR = svg.ROOT / "assets" / "drawio"
LIBRARY_PATH = LIBRARY_DIR / "diagram-generator-primitives.mxlibrary"


def make_entry(title: str, width: int, height: int, build_fn) -> dict[str, object]:
    diagram_id = title.lower().replace(" ", "-")
    builder = drawio.DrawioBuilder(
        name=title,
        diagram_id=diagram_id,
        page_width=width + 16,
        page_height=height + 16,
    )
    build_fn(builder)
    return {
        "title": title,
        "w": width,
        "h": height,
        "xml": ET.tostring(builder.model, encoding="unicode"),
    }


def build_default_box(builder: drawio.DrawioBuilder) -> None:
    drawio.add_box(
        builder,
        x=8,
        y=8,
        width=192,
        height=64,
        fill=svg.WHITE,
        lines=[svg.make_line("Default box")],
        icon_name="Package.svg",
    )


def build_accent_box(builder: drawio.DrawioBuilder) -> None:
    drawio.add_box(
        builder,
        x=8,
        y=8,
        width=192,
        height=64,
        fill=svg.GREY,
        lines=[svg.make_line("Accent box")],
        icon_name="Chip 1.svg",
    )


def build_highlight_box(builder: drawio.DrawioBuilder) -> None:
    drawio.add_box(
        builder,
        x=8,
        y=8,
        width=192,
        height=64,
        fill=svg.BLACK,
        lines=[svg.make_line("Highlight box", fill=svg.WHITE)],
        icon_name="Cloud.svg",
        icon_fill=svg.WHITE,
    )


def build_helper_note(builder: drawio.DrawioBuilder) -> None:
    drawio.add_label(
        builder,
        x=8,
        y=8,
        width=256,
        height=48,
        lines=[
            svg.make_line("Helper note", fill=svg.HELPER),
            svg.make_line("Plain explanatory copy", fill=svg.HELPER),
        ],
    )


def build_orange_connector(builder: drawio.DrawioBuilder) -> None:
    builder.add_edge(
        style=drawio.edge_style(svg.ORANGE, orthogonal=False),
        source_point=(16, 24),
        target_point=(184, 24),
    )


def build_terminal_bar(builder: drawio.DrawioBuilder) -> None:
    drawio.add_command_bar(builder, x=8, y=8, width=408, text_value="$ snap install gemma3")


def build_matrix_widget(builder: drawio.DrawioBuilder) -> None:
    drawio.add_matrix(builder, x=8, y=8, label="Q")


def build_memory_wall_panel(builder: drawio.DrawioBuilder) -> None:
    panel = drawio.add_image(
        builder,
        x=8,
        y=8,
        width=192,
        height=80,
        image_uri=drawio.memory_panel_uri(),
        connectable=True,
        style_tokens=("memory-panel",),
    )
    drawio.add_label(
        builder,
        x=8,
        y=8,
        width=120,
        height=24,
        lines=[svg.make_line("Memory wall")],
        parent=panel,
        style_tokens=("label-box",),
    )
    drawio.add_image(
        builder,
        x=136,
        y=8,
        width=48,
        height=48,
        image_uri=drawio.icon_uri("Memory.svg"),
        parent=panel,
    )


def build_grouped_panel(builder: drawio.DrawioBuilder) -> None:
    panel = drawio.add_plain_rect(
        builder,
        x=8,
        y=8,
        width=408,
        height=144,
        fill=svg.GREY,
        stroke="none",
        connectable=True,
        style_tokens=("group-panel-accent",),
    )
    drawio.add_label(
        builder,
        x=8,
        y=8,
        width=192,
        height=24,
        lines=[svg.make_line("Grouped panel", weight="700")],
        parent=panel,
    )
    drawio.add_box(
        builder,
        x=8,
        y=56,
        width=192,
        height=64,
        fill=svg.WHITE,
        lines=[svg.make_line("Panel tile A")],
        parent=panel,
        connectable=False,
    )
    drawio.add_box(
        builder,
        x=208,
        y=56,
        width=192,
        height=64,
        fill=svg.WHITE,
        lines=[svg.make_line("Panel tile B")],
        parent=panel,
        connectable=False,
    )


def build_dashed_panel(builder: drawio.DrawioBuilder) -> None:
    panel = drawio.add_plain_rect(
        builder,
        x=8,
        y=8,
        width=408,
        height=200,
        fill="none",
        dashed=True,
        connectable=True,
        style_tokens=("group-panel-dashed",),
    )
    drawio.add_label(
        builder,
        x=8,
        y=8,
        width=224,
        height=24,
        lines=[svg.make_line("Dashed grouped panel", weight="700")],
        parent=panel,
    )
    drawio.add_box(
        builder,
        x=8,
        y=56,
        width=392,
        height=64,
        fill=svg.WHITE,
        lines=[svg.make_line("Stacked tile one")],
        parent=panel,
        connectable=False,
    )
    drawio.add_box(
        builder,
        x=8,
        y=128,
        width=392,
        height=64,
        fill=svg.GREY,
        lines=[svg.make_line("Stacked tile two")],
        parent=panel,
        connectable=False,
    )


def export_library() -> Path:
    entries = [
        make_entry("Default box", 208, 80, build_default_box),
        make_entry("Accent box", 208, 80, build_accent_box),
        make_entry("Highlight box", 208, 80, build_highlight_box),
        make_entry("Helper note", 272, 64, build_helper_note),
        make_entry("Orange connector", 208, 48, build_orange_connector),
        make_entry("Terminal command bar", 424, 80, build_terminal_bar),
        make_entry("Matrix widget", 64, 64, build_matrix_widget),
        make_entry("Memory wall panel", 208, 96, build_memory_wall_panel),
        make_entry("Grouped panel", 424, 160, build_grouped_panel),
        make_entry("Dashed grouped panel", 424, 216, build_dashed_panel),
    ]

    LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
    root = ET.Element("mxlibrary")
    root.text = json.dumps(entries, separators=(",", ":"))
    ET.ElementTree(root).write(LIBRARY_PATH, encoding="utf-8", xml_declaration=False)

    parsed = ET.parse(LIBRARY_PATH)
    json.loads(parsed.getroot().text or "[]")
    return LIBRARY_PATH


def main() -> None:
    export_library()


if __name__ == "__main__":
    main()