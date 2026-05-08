from __future__ import annotations

from dataclasses import dataclass

import diagram_shared as shared


FONT_SOURCE = "https%3A%2F%2Ffonts.googleapis.com%2Fcss%3Ffamily%3DUbuntu%2BSans"


@dataclass(frozen=True)
class StylePreset:
    set_props: dict[str, str]
    description: str
    unset_props: tuple[str, ...] = ()


def style_string(props: dict[str, object]) -> str:
    if not props:
        return ""
    parts: list[str] = []
    for key, value in props.items():
        if value is None:
            continue
        if value == "":
            parts.append(key)
        else:
            parts.append(f"{key}={value}")
    return ";".join(parts) + (";" if parts else "")


def rect_style_props(fill: str, *, stroke: str = shared.BLACK, dashed: bool = False) -> dict[str, str]:
    props = {
        "rounded": "0",
        "whiteSpace": "wrap",
        "html": "1",
        "shadow": "0",
        "fillColor": fill,
    }
    if stroke == "none":
        props["strokeColor"] = "none"
        props["strokeWidth"] = "0"
    else:
        props["strokeColor"] = stroke
        props["strokeWidth"] = "1"
    if dashed:
        props["dashed"] = "1"
        props["dashPattern"] = "8 8"
    return props


def label_style_props(
    *,
    font_size: int = int(shared.size_to_px(shared.BODY_SIZE)),
    font_color: str = shared.BLACK,
    align: str = "left",
    vertical_align: str = "top",
    font_family: str = "Ubuntu Sans",
    font_source: str | None = FONT_SOURCE,
) -> dict[str, str]:
    props = {
        "rounded": "0",
        "whiteSpace": "wrap",
        "html": "1",
        "align": align,
        "verticalAlign": vertical_align,
        "spacing": "0",
        "spacingTop": "0",
        "spacingBottom": "0",
        "spacingLeft": "0",
        "spacingRight": "0",
        "fillColor": "none",
        "strokeColor": "none",
        "strokeWidth": "0",
        "shadow": "0",
        "fontFamily": font_family,
        "fontSize": str(font_size),
        "fontColor": font_color,
    }
    if font_source:
        props["fontSource"] = font_source
    return props


def image_style_props(image_uri: str | None = None) -> dict[str, str]:
    props = {
        "shape": "image",
        "html": "1",
        "aspect": "fixed",
        "imageAspect": "0",
        "verticalLabelPosition": "middle",
        "verticalAlign": "middle",
        "strokeColor": "none",
        "fillColor": "none",
        "imageBackground": "none",
        "imageBorder": "0",
    }
    if image_uri is not None:
        props["image"] = image_uri
    return props


def line_style_props(color: str, *, dashed: bool = False) -> dict[str, str]:
    props = {
        "shape": "line",
        "html": "1",
        "strokeColor": color,
        "strokeWidth": "1",
        "fillColor": "none",
        "rounded": "0",
    }
    if dashed:
        props["dashed"] = "1"
        props["dashPattern"] = "8 8"
    return props


def edge_style_props(
    color: str,
    *,
    dashed: bool = False,
    start_arrow: bool = False,
    end_arrow: bool = True,
    orthogonal: bool | None = True,
    exit_x: float | None = None,
    exit_y: float | None = None,
    entry_x: float | None = None,
    entry_y: float | None = None,
) -> dict[str, str]:
    props: dict[str, str] = {}
    if orthogonal is True:
        props["edgeStyle"] = "orthogonalEdgeStyle"
    elif orthogonal is False:
        props["edgeStyle"] = "none"
    props.update(
        {
            "rounded": "0",
            "orthogonalLoop": "1",
            "jettySize": "auto",
            "html": "1",
            "strokeColor": color,
            "strokeWidth": "1",
        }
    )
    if start_arrow:
        props["startArrow"] = "blockThin"
        props["startFill"] = "1"
        props["startSize"] = "8"
    else:
        props["startArrow"] = "none"
        props["startFill"] = "0"
    if end_arrow:
        props["endArrow"] = "blockThin"
        props["endFill"] = "1"
        props["endSize"] = "8"
    else:
        props["endArrow"] = "none"
        props["endFill"] = "0"
    if dashed:
        props["dashed"] = "1"
        props["dashPattern"] = "8 8"
    if exit_x is not None and exit_y is not None:
        props["exitX"] = str(exit_x)
        props["exitY"] = str(exit_y)
        props["exitDx"] = "0"
        props["exitDy"] = "0"
    if entry_x is not None and entry_y is not None:
        props["entryX"] = str(entry_x)
        props["entryY"] = str(entry_y)
        props["entryDx"] = "0"
        props["entryDy"] = "0"
    return props


def available_presets() -> dict[str, StylePreset]:
    body_font_size = int(shared.size_to_px(shared.BODY_SIZE))
    matrix_font_size = int(shared.size_to_px(shared.MATRIX_LABEL_SIZE))
    return {
        "box-default": StylePreset(rect_style_props(shared.WHITE), "Canonical white box frame."),
        "box-accent": StylePreset(rect_style_props(shared.GREY), "Canonical grey box frame."),
        "box-highlight": StylePreset(rect_style_props(shared.BLACK), "Canonical black highlight box frame."),
        "panel-default": StylePreset(rect_style_props(shared.WHITE), "Canonical white panel frame."),
        "panel-accent": StylePreset(rect_style_props(shared.GREY), "Canonical grey panel frame."),
        "panel-highlight": StylePreset(rect_style_props(shared.BLACK), "Canonical black panel frame."),
        "panel-outline": StylePreset(rect_style_props("none"), "Outline-only panel frame."),
        "panel-dashed": StylePreset(rect_style_props("none", dashed=True), "Dashed outline panel frame."),
        "group-frame": StylePreset(rect_style_props("none", dashed=True), "Dashed grouped frame."),
        "group-panel-accent": StylePreset(rect_style_props(shared.GREY, stroke="none"), "Grey grouped panel substrate."),
        "group-panel-dashed": StylePreset(rect_style_props("none", dashed=True), "Dashed grouped panel."),
        "divider-line": StylePreset(rect_style_props(shared.BLACK, stroke="none"), "Solid divider line emitted as a thin rect."),
        "matrix-widget": StylePreset(rect_style_props(shared.GREY), "Matrix widget body frame."),
        "matrix-divider": StylePreset(rect_style_props(shared.BLACK, stroke="none"), "Matrix internal divider line."),
        "terminal-bar": StylePreset(rect_style_props(shared.GREY), "Terminal command bar container."),
        "terminal-separator": StylePreset(rect_style_props(shared.BLACK, stroke="none"), "Terminal chrome separator line."),
        "label-free": StylePreset(label_style_props(font_size=body_font_size), "Free helper/body label style."),
        "label-box": StylePreset(label_style_props(font_size=body_font_size), "In-box label style."),
        "label-terminal": StylePreset(
            label_style_props(font_size=body_font_size, font_family=shared.TERMINAL_FONT_FAMILY, font_source=None),
            "Terminal monospace label style.",
            unset_props=("fontSource",),
        ),
        "label-matrix": StylePreset(
            label_style_props(font_size=matrix_font_size, align="center", vertical_align="middle"),
            "Centered matrix label style.",
        ),
        "image-generic": StylePreset(image_style_props(), "Generic image-cell framing without changing the image URI."),
        "icon-image": StylePreset(image_style_props(), "Canonical in-box icon image framing."),
        "request-cluster-icon": StylePreset(image_style_props(), "Canonical request-cluster icon framing."),
        "memory-panel": StylePreset(image_style_props(), "Canonical memory-panel image framing."),
        "memory-wall": StylePreset(image_style_props(), "Canonical declarative memory-wall image framing."),
        "separator-dashed": StylePreset(line_style_props(shared.BLACK, dashed=True), "Dashed separator line."),
        "dashed-separator": StylePreset(rect_style_props("none", dashed=True), "Dashed separator emitted as a thin rect."),
        "edge-orange": StylePreset(edge_style_props(shared.ORANGE, orthogonal=None), "Canonical orange connector styling without changing route mode."),
        "edge-neutral": StylePreset(edge_style_props(shared.BLACK, end_arrow=False, orthogonal=None), "Neutral connector styling without arrowheads."),
        "edge-dashed": StylePreset(edge_style_props(shared.BLACK, dashed=True, end_arrow=False, orthogonal=None), "Dashed neutral connector styling."),
        "edge-arrow": StylePreset(
            {
                "startArrow": "none",
                "startFill": "0",
                "endArrow": "blockThin",
                "endFill": "1",
                "endSize": "8",
            },
            "Arrowhead fields for connector cells.",
        ),
    }


def resolve_presets(names: list[str]) -> tuple[dict[str, str], set[str]]:
    presets = available_presets()
    set_props: dict[str, str] = {}
    unset_props: set[str] = set()
    for name in names:
        preset = presets.get(name)
        if preset is None:
            available = ", ".join(sorted(presets))
            raise SystemExit(f"Unknown style preset '{name}'. Available presets: {available}")
        set_props.update(preset.set_props)
        unset_props.update(preset.unset_props)
    unset_props.difference_update(set_props.keys())
    return set_props, unset_props
