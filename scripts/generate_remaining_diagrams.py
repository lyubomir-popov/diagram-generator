from __future__ import annotations

import html
import pathlib
from diagram_shared import (
    ARROW_HEAD_HALF_WIDTH,
    ARROW_HEAD_LENGTH,
    ASCENT_RATIO,
    BLACK,
    BLOCK_WIDTH,
    BODY_SIZE,
    DESCENT_RATIO,
    GREY,
    HELPER,
    ICON_SIZE,
    INSET,
    MATRIX_COLUMN_DIVIDERS,
    MATRIX_HEADER_HEIGHT,
    MATRIX_LABEL_SIZE,
    MATRIX_ROW_DIVIDERS,
    MATRIX_SIZE,
    ORANGE,
    SVG_DIR,
    TERMINAL_CHROME_HEIGHT,
    TERMINAL_DOT_RADIUS,
    TERMINAL_FONT_FAMILY,
    TITLE_SIZE,
    WHITE,
    centered_band_text_top,
    fmt,
    line_top_to_baseline,
    lines_required_height,
    load_icon,
    make_line,
    size_to_px,
)


def svg_open(width: int, height: int) -> list[str]:
    return [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" xml:space="preserve">',
        f'  <rect width="{width}" height="{height}" fill="{WHITE}" />',
    ]


def rect(
    x: float,
    y: float,
    width: float,
    height: float,
    *,
    fill: str = WHITE,
    stroke: str = BLACK,
    dasharray: str | None = None,
) -> str:
    dash_attr = f' stroke-dasharray="{dasharray}"' if dasharray else ""
    return (
        f'  <rect x="{fmt(x)}" y="{fmt(y)}" width="{fmt(width)}" height="{fmt(height)}" '
        f'fill="{fill}" stroke="{stroke}" stroke-width="1" stroke-miterlimit="10"{dash_attr} />'
    )


def line(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    *,
    stroke: str = BLACK,
    dasharray: str | None = None,
) -> str:
    dash_attr = f' stroke-dasharray="{dasharray}"' if dasharray else ""
    return (
        f'  <line x1="{fmt(x1)}" y1="{fmt(y1)}" x2="{fmt(x2)}" y2="{fmt(y2)}" '
        f'fill="none" stroke="{stroke}" stroke-width="1" stroke-miterlimit="10"{dash_attr} />'
    )


def polygon(points: list[tuple[float, float]], fill: str = BLACK) -> str:
    return (
        f'  <polygon points="{" ".join(f"{fmt(x)},{fmt(y)}" for x, y in points)}" '
        f'fill="{fill}" />'
    )


def circle(cx: float, cy: float, radius: float, *, fill: str, stroke: str = BLACK) -> str:
    return (
        f'  <circle cx="{fmt(cx)}" cy="{fmt(cy)}" r="{fmt(radius)}" fill="{fill}" '
        f'stroke="{stroke}" stroke-width="1" stroke-miterlimit="10" />'
    )


def polyline_arrow(points: list[tuple[float, float]], color: str = ORANGE) -> str:
    if len(points) < 2:
        raise ValueError("polyline_arrow requires at least two points")

    shaft_points = list(points)
    tip_x, tip_y = shaft_points[-1]
    prev_x, prev_y = shaft_points[-2]
    dx = tip_x - prev_x
    dy = tip_y - prev_y

    if dx == 0 and dy == 0:
        raise ValueError("Arrow tip cannot duplicate previous point")

    if dx == 0:
        direction = 1 if dy > 0 else -1
        base_point = (tip_x, tip_y - direction * ARROW_HEAD_LENGTH)
        head = [
            (tip_x - ARROW_HEAD_HALF_WIDTH, base_point[1]),
            (tip_x, tip_y),
            (tip_x + ARROW_HEAD_HALF_WIDTH, base_point[1]),
        ]
    elif dy == 0:
        direction = 1 if dx > 0 else -1
        base_point = (tip_x - direction * ARROW_HEAD_LENGTH, tip_y)
        head = [
            (base_point[0], tip_y - ARROW_HEAD_HALF_WIDTH),
            (tip_x, tip_y),
            (base_point[0], tip_y + ARROW_HEAD_HALF_WIDTH),
        ]
    else:
        raise ValueError("Only orthogonal arrow segments are supported")

    shaft_points[-1] = base_point
    parts: list[str] = []
    for index in range(len(shaft_points) - 1):
        x1, y1 = shaft_points[index]
        x2, y2 = shaft_points[index + 1]
        parts.append(line(x1, y1, x2, y2, stroke=color))
    parts.append(polygon(head, fill=color))
    return "\n".join(parts)


def jagged_box(x: float, y: float, width: float, height: float, fill: str = GREY) -> str:
    step = 8
    half = 4
    points: list[tuple[float, float]] = []
    for index in range(int(width // step) + 1):
        px = x + index * step
        if px > x + width:
            px = x + width
        points.append((px, y if index % 2 == 0 else y - half))
    points.append((x + width, y + height))
    for index in range(int(width // step), -1, -1):
        px = x + index * step
        if px > x + width:
            px = x + width
        points.append((px, y + height if index % 2 == 0 else y + height + half))
    d = ["M"]
    first_x, first_y = points[0]
    d.append(f"{fmt(first_x)} {fmt(first_y)}")
    for px, py in points[1:]:
        d.append(f"L {fmt(px)} {fmt(py)}")
    d.append("Z")
    return (
        f'  <path d="{" ".join(d)}" fill="{fill}" stroke="{BLACK}" '
        'stroke-width="1" stroke-miterlimit="10" />'
    )


def text_block(x: float, y: float, lines: list[dict[str, object]]) -> str:
    if not lines:
        return ""
    parts = ['  <text font-family="Ubuntu Sans">']
    current_top = y
    for spec in lines:
        content = html.escape(str(spec["content"]))
        size = str(spec["size"])
        weight = str(spec["weight"])
        fill = str(spec["fill"])
        small_caps = bool(spec["small_caps"])
        small_caps_attrs = ''
        if small_caps:
            small_caps_attrs = ' font-variant-caps="all-small-caps" letter-spacing="0.05em"'
        parts.append(
            f'    <tspan x="{fmt(x)}" y="{fmt(line_top_to_baseline(current_top, size))}" font-size="{size}" '
            f'font-weight="{weight}" fill="{fill}"{small_caps_attrs}>{content}</tspan>'
        )
        current_top += int(spec["line_step"])
    parts.append("  </text>")
    return "\n".join(parts)


def icon_group(x: float, y: float, icon_name: str, fill: str = BLACK) -> str:
    return f'  <g transform="translate({fmt(x)} {fmt(y)})">\n{load_icon(icon_name, fill)}\n  </g>'


def box(
    x: float,
    y: float,
    width: float,
    fill: str,
    text_lines: list[dict[str, object]],
    *,
    icon_name: str | None = None,
    text_fill: str = BLACK,
    icon_fill: str | None = None,
    height: int | None = None,
) -> str:
    resolved_height = max(height or 0, lines_required_height(text_lines))
    resolved_lines = []
    for line_spec in text_lines:
        merged = dict(line_spec)
        merged.setdefault("fill", text_fill)
        resolved_lines.append(merged)
    parts = [rect(x, y, width, resolved_height, fill=fill)]
    parts.append(text_block(x + INSET, y + INSET, resolved_lines))
    if icon_name:
        parts.append(
            icon_group(
                x + width - INSET - ICON_SIZE,
                y + INSET,
                icon_name,
                fill=icon_fill or text_fill,
            )
        )
    return "\n".join(parts)


def vertical_arrow(center_x: float, start_y: float, tip_y: float, color: str = ORANGE) -> str:
    return polyline_arrow([(center_x, start_y), (center_x, tip_y)], color=color)


def horizontal_arrow(start_x: float, center_y: float, tip_x: float, color: str = ORANGE) -> str:
    return polyline_arrow([(start_x, center_y), (tip_x, center_y)], color=color)


def orthogonal_arrow_to_right(
    start_x: float,
    start_y: float,
    bend_x: float,
    bend_y: float,
    tip_x: float,
    color: str = ORANGE,
) -> str:
    return polyline_arrow(
        [
            (start_x, start_y),
            (bend_x, start_y),
            (bend_x, bend_y),
            (tip_x, bend_y),
        ],
        color=color,
    )


def orthogonal_arrow_down(
    start_x: float,
    start_y: float,
    route_y: float,
    end_x: float,
    tip_y: float,
    color: str = ORANGE,
) -> str:
    return polyline_arrow(
        [
            (start_x, start_y),
            (start_x, route_y),
            (end_x, route_y),
            (end_x, tip_y),
        ],
        color=color,
    )


def matrix_group(x: float, y: float, label: str) -> str:
    label_top = y + centered_band_text_top(MATRIX_HEADER_HEIGHT, MATRIX_LABEL_SIZE)
    return "\n".join(
        [
            rect(x, y, MATRIX_SIZE, MATRIX_SIZE, fill=GREY),
            line(x, y + MATRIX_HEADER_HEIGHT, x + MATRIX_SIZE, y + MATRIX_HEADER_HEIGHT),
            *(line(x + divider_x, y + MATRIX_HEADER_HEIGHT, x + divider_x, y + MATRIX_SIZE) for divider_x in MATRIX_COLUMN_DIVIDERS),
            *(line(x, y + divider_y, x + MATRIX_SIZE, y + divider_y) for divider_y in MATRIX_ROW_DIVIDERS),
            f'  <text x="{fmt(x + MATRIX_SIZE / 2)}" y="{fmt(line_top_to_baseline(label_top, MATRIX_LABEL_SIZE))}" text-anchor="middle" '
            f'font-family="Ubuntu Sans" font-size="{MATRIX_LABEL_SIZE}" font-weight="700" fill="{BLACK}">{html.escape(label)}</text>',
        ]
    )


def command_bar(x: float, y: float, width: float, text_value: str) -> str:
    parts = [rect(x, y, width, 64, fill=GREY)]
    parts.append(line(x, y + TERMINAL_CHROME_HEIGHT, x + width, y + TERMINAL_CHROME_HEIGHT))
    for center_x in (20, 36, 52):
        parts.append(circle(center_x + x, y + TERMINAL_CHROME_HEIGHT / 2, TERMINAL_DOT_RADIUS, fill=WHITE))
    parts.append(
        f'  <text x="{fmt(x + 24)}" y="{fmt(line_top_to_baseline(y + 28, BODY_SIZE))}" '
        f'font-family="{TERMINAL_FONT_FAMILY}" font-size="{BODY_SIZE}" font-weight="400" fill="{BLACK}">{html.escape(text_value)}</text>'
    )
    return "\n".join(parts)


def request_cluster(x: float, y: float) -> str:
    return "\n".join(
        [
            icon_group(x, y, "Document.svg"),
            icon_group(x + 56, y, "Photography.svg"),
            icon_group(x + 112, y, "Globe.svg"),
        ]
    )


def panel_box(
    x: float,
    y: float,
    width: float,
    height: float,
    title: str,
    *,
    fill: str,
    icon_name: str | None = None,
) -> str:
    return box(
        x,
        y,
        width,
        fill,
        [make_line(title, weight="700")],
        icon_name=icon_name,
        height=height,
    )


def write_svg(path: pathlib.Path, parts: list[str]) -> None:
    path.write_text("\n".join(parts + ["</svg>", ""]), encoding="utf-8")


def build_memory_wall() -> None:
    width = 496
    height = 656
    parts = svg_open(width, height)
    background: list[str] = []
    foreground: list[str] = []

    x = 96
    center_x = x + 96

    background.append(vertical_arrow(center_x, 88, 112))
    background.append(vertical_arrow(center_x, 176, 200))
    background.append(vertical_arrow(center_x, 264, 288))
    background.append(vertical_arrow(center_x, 352, 376))
    background.append(vertical_arrow(center_x, 440, 464))
    background.append(vertical_arrow(center_x, 528, 552))
    background.append(line(x, 188, x + 192, 188, dasharray="12 8"))
    background.append(horizontal_arrow(328, 232, 288, color=BLACK))

    foreground.append(box(x, 24, 192, WHITE, [make_line("User request")]))
    foreground.append(request_cluster(304, 32))
    foreground.append(
        box(
            x,
            112,
            192,
            GREY,
            [make_line("App & model"), make_line("framework")],
            icon_name="Package.svg",
            height=64,
        )
    )
    foreground.append(box(x, 200, 192, WHITE, [make_line("Missing layer")], height=64))
    foreground.append(
        text_block(
            336,
            216,
            [make_line("No model-aware", fill=HELPER), make_line("orchestration!", fill=HELPER)],
        )
    )
    foreground.append(
        box(
            x,
            288,
            192,
            GREY,
            [make_line("Operating"), make_line("system")],
            icon_name="Server.svg",
        )
    )
    foreground.append(
        box(
            x,
            376,
            192,
            GREY,
            [make_line("Hardware")],
            icon_name="Chip 1.svg",
        )
    )
    foreground.append(
        box(
            x,
            464,
            192,
            GREY,
            [make_line("Silicon")],
            icon_name="Chip 2.svg",
        )
    )
    foreground.append(jagged_box(x, 560, 192, 64, GREY))
    foreground.append(text_block(x + INSET, 568, [make_line("Memory wall", fill=BLACK)]))
    foreground.append(icon_group(x + 192 - INSET - ICON_SIZE, 568, "Memory.svg"))

    parts.extend(background)
    parts.extend(foreground)
    write_svg(SVG_DIR / "memory-wall-onbrand.svg", parts)


def build_request_to_hardware_stack() -> None:
    width = 520
    height = 1232
    parts = svg_open(width, height)
    background: list[str] = []
    foreground: list[str] = []

    x = 56
    panel_width = 408
    center_x = x + panel_width / 2

    background.extend(
        [
            vertical_arrow(center_x, 88, 112),
            vertical_arrow(center_x, 312, 336),
            vertical_arrow(center_x, 608, 632),
            vertical_arrow(center_x, 832, 856),
            vertical_arrow(center_x, 984, 1008),
        ]
    )

    foreground.append(box(x + 108, 24, 192, WHITE, [make_line("User request")], icon_name="Cloud.svg"))

    foreground.append(panel_box(x, 112, panel_width, 200, "Orchestration layer", fill=GREY, icon_name="Snap.svg"))
    foreground.append(box(x + 8, 168, 192, WHITE, [make_line("Ollama")]))
    foreground.append(box(x + 208, 168, 192, WHITE, [make_line("Lemonade"), make_line("Server")], height=72))
    foreground.append(box(x + 8, 240, 392, WHITE, [make_line("vLLM")]))

    foreground.append(panel_box(x, 336, panel_width, 272, "Model runtime", fill=WHITE, icon_name="AI.svg"))
    foreground.append(box(x + 8, 392, 192, GREY, [make_line("llama.cpp")]))
    foreground.append(box(x + 208, 392, 192, GREY, [make_line("OpenVINO")]))
    foreground.append(box(x + 8, 464, 192, GREY, [make_line("vLLM")]))
    foreground.append(box(x + 208, 464, 192, GREY, [make_line("TensorRT-"), make_line("LLM")], height=72))
    foreground.append(box(x + 8, 536, 392, GREY, [make_line("ONNX Runtime")]))

    foreground.append(panel_box(x, 632, panel_width, 200, "Compute kernel", fill=GREY, icon_name="kernel.svg"))
    foreground.append(box(x + 8, 688, 192, WHITE, [make_line("CUDA")]))
    foreground.append(box(x + 208, 688, 192, WHITE, [make_line("ROCm")]))
    foreground.append(box(x + 8, 760, 192, WHITE, [make_line("Metal")]))
    foreground.append(box(x + 208, 760, 192, WHITE, [make_line("oneDNN")]))

    foreground.append(panel_box(x, 856, panel_width, 128, "Driver", fill=WHITE, icon_name="Wrench 1.svg"))
    foreground.append(box(x + 8, 912, 192, GREY, [make_line("CUDA")]))
    foreground.append(box(x + 208, 912, 192, GREY, [make_line("ROCm")]))

    foreground.append(panel_box(x, 1008, panel_width, 200, "Hardware", fill=GREY, icon_name="Chip 1.svg"))
    foreground.append(box(x + 8, 1064, 192, WHITE, [make_line("CPU")], icon_name="CPU.svg"))
    foreground.append(box(x + 208, 1064, 192, WHITE, [make_line("GPU")], icon_name="RAM.svg"))
    foreground.append(box(x + 8, 1136, 192, WHITE, [make_line("NPU")], icon_name="Chip 2.svg"))
    foreground.append(
        box(
            x + 208,
            1136,
            192,
            WHITE,
            [make_line("RAM &"), make_line("VRAM")],
            icon_name="Memory.svg",
            height=72,
        )
    )

    parts.extend(background)
    parts.extend(foreground)
    write_svg(SVG_DIR / "request-to-hardware-stack-onbrand.svg", parts)


def build_inference_snaps() -> None:
    width = 760
    height = 792
    parts = svg_open(width, height)
    background: list[str] = []
    foreground: list[str] = []

    x = 72
    frame_width = 616
    pad_x = x
    pad_y = 296
    pad_width = frame_width
    pad_height = 296
    tile_gap = 8
    tile_width = 296
    left_x = pad_x + 8
    right_x = left_x + tile_width + tile_gap
    rows = [304, 376, 448, 520]
    hardware_y = 624
    hardware_width = 200
    hardware_x = [x, x + hardware_width + tile_gap, x + (hardware_width + tile_gap) * 2]
    hardware_centers = [hardware_x[0] + hardware_width / 2, hardware_x[1] + hardware_width / 2, hardware_x[2] + hardware_width / 2]

    background.append(vertical_arrow(x + frame_width / 2, 176, 216))
    background.append(vertical_arrow(hardware_centers[0], pad_y + pad_height, hardware_y))
    background.append(vertical_arrow(hardware_centers[1], pad_y + pad_height, hardware_y))
    background.append(vertical_arrow(hardware_centers[2], pad_y + pad_height, hardware_y))

    foreground.append(
        box(
            x,
            24,
            frame_width,
            WHITE,
            [make_line("Inference snaps", weight="700")],
            icon_name="Snap.svg",
            height=64,
        )
    )
    foreground.append(command_bar(x, 112, frame_width, "$ snap install gemma3"))
    foreground.append(rect(x - 8, 200, frame_width + 16, 520, fill="none", stroke=BLACK, dasharray="8 8"))
    foreground.append(box(x, 216, frame_width, WHITE, [make_line("Inference snap", weight="700")], icon_name="Package.svg"))
    foreground.append(f'  <rect x="{pad_x}" y="{pad_y}" width="{pad_width}" height="{pad_height}" fill="{GREY}" />')

    foreground.append(box(left_x, rows[0], tile_width, WHITE, [make_line("Model")], icon_name="Network.svg", height=64))
    foreground.append(box(right_x, rows[0], tile_width, WHITE, [make_line("Workload"), make_line("identity")], icon_name="User.svg", height=64))
    foreground.append(box(left_x, rows[1], tile_width, WHITE, [make_line("Runtime")], icon_name="Gauge.svg", height=64))
    foreground.append(box(right_x, rows[1], tile_width, WHITE, [make_line("Heterogeneous"), make_line("hardware")], icon_name="Chip 1.svg", height=64))
    foreground.append(box(left_x, rows[2], tile_width, WHITE, [make_line("Dependencies")], icon_name="Wrench 1.svg"))
    foreground.append(box(right_x, rows[2], tile_width, WHITE, [make_line("Reproducibility")], icon_name="Clipboard.svg", height=64))
    foreground.append(box(left_x, rows[3], tile_width, WHITE, [make_line("Hardware"), make_line("config")], icon_name="CPU.svg", height=64))
    foreground.append(box(right_x, rows[3], tile_width, WHITE, [make_line("Operational"), make_line("observability")], icon_name="Bar chart with check.svg", height=64))

    foreground.append(box(hardware_x[0], hardware_y, hardware_width, WHITE, [make_line("CPU")], icon_name="CPU.svg", height=64))
    foreground.append(box(hardware_x[1], hardware_y, hardware_width, GREY, [make_line("GPU")], icon_name="RAM.svg", height=64))
    foreground.append(box(hardware_x[2], hardware_y, hardware_width, WHITE, [make_line("NPU")], icon_name="Chip 2.svg", height=64))

    parts.extend(background)
    parts.extend(foreground)
    write_svg(SVG_DIR / "inference-snaps-onbrand.svg", parts)


def build_gpu_waiting() -> None:
    width = 760
    height = 408
    parts = svg_open(width, height)
    background: list[str] = []
    foreground: list[str] = []

    background.append(orthogonal_arrow_to_right(232, 264, 304, 68, 392))

    foreground.append(
        box(
            392,
            32,
            320,
            WHITE,
            [make_line("Scheduler", weight="700"), make_line("AI inference"), make_line("request")],
            icon_name="Desktop monitor.svg",
        )
    )
    foreground.append(icon_group(304, 96, "Document.svg"))
    foreground.append(icon_group(120, 152, "Gauge.svg"))
    foreground.append(box(40, 232, 192, GREY, [make_line("GPU", weight="700")], icon_name="CPU.svg"))
    foreground.append(text_block(288, 164, [make_line("Queued request", fill=HELPER)]))
    foreground.append(text_block(40, 320, [make_line("Waiting...", weight="700", fill=BLACK)]))

    parts.extend(background)
    parts.extend(foreground)
    write_svg(SVG_DIR / "gpu-waiting-scheduler-onbrand.svg", parts)


def build_diagram_intake_workflow() -> None:
    width = 752
    height = 632
    parts = svg_open(width, height)
    background: list[str] = []
    foreground: list[str] = []

    x = 72
    frame_y = 24
    frame_width = 608
    frame_height = 176
    center_x = x + frame_width / 2

    background.extend(
        [
            vertical_arrow(center_x, frame_y + frame_height, 224),
            vertical_arrow(center_x, 296, 320),
            vertical_arrow(center_x, 384, 408),
            vertical_arrow(center_x, 480, 504),
        ]
    )

    foreground.append(rect(x, frame_y, frame_width, frame_height, fill="none", stroke=BLACK, dasharray="8 8"))
    foreground.append(text_block(x + 8, frame_y + 8, [make_line("Rough initial diagram sources", weight="700")]))
    foreground.append(box(x + 8, frame_y + 48, 192, WHITE, [make_line("ChatGPT-generated"), make_line("diagrams")], icon_name="AI.svg", height=64))
    foreground.append(
        box(
            x + 208,
            frame_y + 48,
            392,
            GREY,
            [make_line("? Additional rough"), make_line("source formats"), make_line("from PMs")],
            height=72,
        )
    )
    foreground.append(
        text_block(
            x + 8,
            frame_y + 136,
            [make_line("Ask PMs: which rough formats reach the brand team before on-brand redraw?", fill=HELPER)],
        )
    )
    foreground.append(
        box(
            x,
            224,
            frame_width,
            WHITE,
            [make_line("Agentic workflow", weight="700"), make_line("in this repo"), make_line("playbook + generators", fill=HELPER)],
            icon_name="Screen with code.svg",
            height=72,
        )
    )
    foreground.append(
        box(
            x,
            320,
            frame_width,
            GREY,
            [make_line("Compare mode", weight="700"), make_line("HTML before / agent / refined", fill=HELPER)],
            icon_name="Document with Magnifying glass.svg",
            height=64,
        )
    )
    foreground.append(
        box(
            x,
            408,
            frame_width,
            WHITE,
            [make_line("Designer polish", weight="700"), make_line("manual pass in generated"), make_line("draw.io", fill=HELPER)],
            icon_name="Design.svg",
            height=72,
        )
    )
    foreground.append(
        box(
            x,
            504,
            frame_width,
            BLACK,
            [make_line("Final SVGs", weight="700", fill=WHITE), make_line("on-brand deliverables", fill=WHITE)],
            icon_name="Storage image.svg",
            text_fill=WHITE,
            icon_fill=WHITE,
            height=64,
        )
    )

    parts.extend(background)
    parts.extend(foreground)
    write_svg(SVG_DIR / "diagram-intake-workflow-onbrand.svg", parts)


def build_rise_of_inference_economy() -> None:
    width = 912
    height = 792
    parts = svg_open(width, height)
    background: list[str] = []
    foreground: list[str] = []

    background.extend(
        [
            vertical_arrow(236, 184, 208),
            vertical_arrow(676, 184, 208),
            horizontal_arrow(440, 240, 472),
            vertical_arrow(456, 672, 696),
        ]
    )

    foreground.append(
        box(
            32,
            32,
            848,
            WHITE,
            [make_line("The rise of the inference economy", weight="700")],
            icon_name="Cloud.svg",
            height=64,
        )
    )

    foreground.append(box(32, 120, 408, GREY, [make_line("Training", weight="700")], icon_name="AI.svg"))
    foreground.append(
        box(
            472,
            120,
            408,
            BLACK,
            [make_line("Inference", weight="700", fill=WHITE)],
            icon_name="CPU.svg",
            text_fill=WHITE,
            icon_fill=WHITE,
        )
    )
    foreground.append(
        box(
            32,
            208,
            408,
            WHITE,
            [make_line("Costly & episodic"), make_line("High investment", fill=HELPER)],
            icon_name="Finance.svg",
        )
    )
    foreground.append(
        box(
            472,
            208,
            408,
            WHITE,
            [make_line("Constant & demand-driven"), make_line("Ongoing expense", fill=HELPER)],
            icon_name="Server.svg",
        )
    )

    foreground.append(box(32, 320, 408, GREY, [make_line("Always-on compute", weight="700")], icon_name="Globe.svg"))
    foreground.append(box(472, 320, 408, GREY, [make_line("Revenue impact", weight="700")], icon_name="Financial data.svg"))
    foreground.append(box(32, 416, 192, WHITE, [make_line("Data centers")], icon_name="Server.svg"))
    foreground.append(box(248, 416, 192, WHITE, [make_line("Edge devices")], icon_name="Mobile.svg"))
    foreground.append(box(32, 504, 408, WHITE, [make_line("Local AI")], icon_name="AI.svg"))
    foreground.append(box(472, 416, 192, WHITE, [make_line("Latency down")], icon_name="Gauge.svg"))
    foreground.append(box(688, 416, 192, WHITE, [make_line("Tokens/sec up")], icon_name="Scale up.svg"))
    foreground.append(box(472, 504, 192, WHITE, [make_line("Efficiency up")], icon_name="Line chart with check.svg"))
    foreground.append(box(688, 504, 192, WHITE, [make_line("Optimization"), make_line("& scale")], icon_name="Line chart with commerce.svg", height=72))

    foreground.append(box(32, 608, 848, GREY, [make_line("From training focused to inference focused", weight="700")]))
    foreground.append(box(32, 696, 848, WHITE, [make_line("Performance & cost efficiency", weight="700")]))

    parts.extend(background)
    parts.extend(foreground)
    write_svg(SVG_DIR / "rise-of-inference-economy-onbrand.svg", parts)


def build_logic_data_vram() -> None:
    width = 912
    height = 784
    parts = svg_open(width, height)
    background: list[str] = []
    foreground: list[str] = []

    background.extend(
        [
            polyline_arrow([(672, 136), (680, 136), (680, 184), (688, 184)]),
            vertical_arrow(576, 256, 280),
            vertical_arrow(784, 216, 312),
            horizontal_arrow(432, 616, 480),
        ]
    )

    foreground.append(rect(32, 32, 408, 360))
    foreground.append(text_block(40, 40, [make_line("Logic + data conflict", weight="700")]))
    foreground.append(box(40, 176, 192, GREY, [make_line("CPU", weight="700")], icon_name="CPU.svg"))
    foreground.append(box(248, 104, 192, WHITE, [make_line("Logic", weight="700")]))
    foreground.append(box(248, 192, 192, WHITE, [make_line("Logic", weight="700")]))
    foreground.append(box(248, 280, 192, GREY, [make_line("Memory", weight="700")], icon_name="Memory.svg"))
    foreground.append(text_block(40, 272, [make_line("Logic with optional", fill=HELPER), make_line("optional data.", fill=HELPER)]))
    foreground.append(text_block(248, 368, [make_line("Optional data can stay", fill=HELPER), make_line("separate.", fill=HELPER)]))

    foreground.append(rect(472, 32, 408, 360))
    foreground.append(text_block(480, 40, [make_line("AI inference", weight="700")]))
    foreground.append(box(480, 104, 192, WHITE, [make_line("Logic", weight="700")], icon_name="AI.svg"))
    foreground.append(box(480, 192, 192, GREY, [make_line("Data", weight="700")], icon_name="Data.svg"))
    foreground.append(box(480, 280, 192, WHITE, [make_line("CPU", weight="700")], icon_name="CPU.svg"))
    foreground.append(box(688, 152, 192, WHITE, [make_line("Data", weight="700")], icon_name="Data.svg"))
    foreground.append(box(688, 312, 192, GREY, [make_line("Memory", weight="700")], icon_name="Memory.svg"))
    foreground.append(text_block(480, 368, [make_line("Logic inseparable", fill=HELPER), make_line("from data", fill=HELPER)]))

    foreground.append(rect(32, 424, 848, 328))
    foreground.append(text_block(40, 432, [make_line("VRAM fragmentation", weight="700")]))
    foreground.append(rect(40, 504, 392, 208, fill=GREY))
    foreground.append(text_block(48, 512, [make_line("Fragmented layout", weight="700")]))
    foreground.append(icon_group(376, 512, "RAM.svg"))
    foreground.append(rect(48, 560, 376, 32))
    foreground.append(text_block(56, 566, [make_line("10 GB", weight="700")]))
    foreground.append(rect(48, 600, 376, 32))
    foreground.append(text_block(56, 606, [make_line("6 GB context cache", weight="700")]))
    foreground.append(rect(48, 640, 72, 32))
    foreground.append(rect(128, 640, 56, 32, fill=GREY))
    foreground.append(rect(192, 640, 88, 32))
    foreground.append(rect(288, 640, 40, 32, fill=GREY))
    foreground.append(rect(336, 640, 88, 32))
    foreground.append(text_block(48, 680, [make_line("Fragmented allocations leave gaps.", fill=HELPER)]))

    foreground.append(rect(480, 504, 392, 208, fill=GREY))
    foreground.append(text_block(488, 512, [make_line("Packed layout", weight="700")]))
    foreground.append(icon_group(816, 512, "Memory.svg"))
    foreground.append(rect(488, 560, 376, 32))
    foreground.append(text_block(496, 566, [make_line("24 GB GPU memory", weight="700")]))
    foreground.append(rect(488, 600, 70, 32))
    foreground.append(text_block(496, 606, [make_line("9 GB", weight="700")]))
    foreground.append(rect(566, 600, 110, 32, fill=GREY))
    foreground.append(text_block(574, 606, [make_line("Alloc", weight="700")]))
    foreground.append(rect(684, 600, 180, 32))
    foreground.append(rect(488, 640, 220, 32, fill=GREY))
    foreground.append(rect(716, 640, 148, 32))
    foreground.append(text_block(724, 646, [make_line("8 GB model", weight="700")]))
    foreground.append(text_block(488, 680, [make_line("860 B free", fill=HELPER)]))
    foreground.append(icon_group(432, 596, "Fragmentation.svg"))

    parts.extend(background)
    parts.extend(foreground)
    write_svg(SVG_DIR / "logic-data-vram-onbrand.svg", parts)


def build_attention_qkv() -> None:
    width = 1776
    height = 1112
    parts = svg_open(width, height)
    background: list[str] = []
    foreground: list[str] = []

    left_x = 48
    right_x = 912
    top_y = 48
    lower_y = 600

    # Query panel
    foreground.append(text_block(left_x, top_y, [make_line('The query (Q): the "question"', weight="700")]))
    foreground.append(matrix_group(144, 96, "Q"))
    background.append(vertical_arrow(168, 144, 184))
    foreground.append(box(left_x, 184, 240, GREY, [make_line("Ubuntu:")]))
    foreground.append(
        text_block(
            312,
            192,
            [
                make_line("I am a noun at the start of a", fill=HELPER),
                make_line("sentence followed by a colon.", fill=HELPER),
            ],
        )
    )
    foreground.append(
        text_block(
            left_x,
            280,
            [
                make_line("I am a noun at the start of a sentence followed", fill=HELPER),
                make_line("by a colon. I am likely a subject being defined.", fill=HELPER),
                make_line("What in this sentence explains what I am?", fill=HELPER),
            ],
        )
    )

    # Keys panel
    foreground.append(text_block(right_x, top_y, [make_line('The keys (K): the "advertisements"', weight="700")]))
    foreground.append(matrix_group(1296, 96, "K"))
    background.append(line(1320, 144, 1320, 160, stroke=ORANGE))
    background.append(line(1008, 160, 1632, 160, stroke=ORANGE))
    for center_x in (1008, 1216, 1424, 1632):
        background.append(vertical_arrow(center_x, 160, 184))
    foreground.append(box(912, 184, 192, BLACK, [make_line("Linux", fill=WHITE)], text_fill=WHITE))
    foreground.append(box(1120, 184, 192, WHITE, [make_line("for")]))
    foreground.append(box(1328, 184, 192, GREY, [make_line("human")]))
    foreground.append(box(1536, 184, 192, WHITE, [make_line("beings")]))
    foreground.append(
        text_block(
            912,
            280,
            [
                make_line("I am a technical", fill=HELPER),
                make_line("OS kernel", fill=HELPER),
                make_line("category.", fill=HELPER),
            ],
        )
    )
    foreground.append(
        text_block(
            1120,
            280,
            [
                make_line("I am a preposition", fill=HELPER),
                make_line("indicating a target", fill=HELPER),
                make_line("audience.", fill=HELPER),
            ],
        )
    )
    foreground.append(
        text_block(
            1328,
            280,
            [
                make_line("I am the adjective", fill=HELPER),
                make_line("that narrows the", fill=HELPER),
                make_line("species or type.", fill=HELPER),
            ],
        )
    )
    foreground.append(
        text_block(
            1536,
            280,
            [
                make_line("I am the plural noun,", fill=HELPER),
                make_line("the object of the", fill=HELPER),
                make_line("audience.", fill=HELPER),
            ],
        )
    )

    # Match panel
    foreground.append(text_block(left_x, lower_y, [make_line('The match (QK^T): the "relevance check"', weight="700")]))
    foreground.append(matrix_group(432, 648, "QK"))
    background.append(line(456, 696, 456, 720, stroke=ORANGE))
    background.append(line(144, 720, 768, 720, stroke=ORANGE))
    for center_x in (144, 352, 560, 768):
        background.append(vertical_arrow(center_x, 720, 744))
    foreground.append(box(48, 744, 192, BLACK, [make_line("Linux", fill=WHITE)], text_fill=WHITE))
    foreground.append(box(256, 744, 192, WHITE, [make_line("for")]))
    foreground.append(box(464, 744, 192, GREY, [make_line("human")]))
    foreground.append(box(672, 744, 192, WHITE, [make_line("beings")]))
    foreground.append(
        text_block(
            48,
            840,
            [
                make_line("Best semantic match:", fill=HELPER),
                make_line("the likely subject", fill=HELPER),
                make_line("being defined.", fill=HELPER),
            ],
        )
    )
    foreground.append(
        text_block(
            256,
            840,
            [
                make_line("Relevant as context,", fill=HELPER),
                make_line("but not the thing", fill=HELPER),
                make_line("being defined.", fill=HELPER),
            ],
        )
    )
    foreground.append(
        text_block(
            464,
            840,
            [
                make_line("Useful modifier,", fill=HELPER),
                make_line("but not stronger than", fill=HELPER),
                make_line("the main noun.", fill=HELPER),
            ],
        )
    )
    foreground.append(
        text_block(
            672,
            840,
            [
                make_line("Part of the phrase,", fill=HELPER),
                make_line("yet less direct than", fill=HELPER),
                make_line("the kernel word.", fill=HELPER),
            ],
        )
    )
    legend_y = 1008
    legend_items = [
        (80, "Low", WHITE),
        (212, "Medium", GREY),
        (388, "High", BLACK),
    ]
    for cx, label, fill in legend_items:
        foreground.append(circle(cx, legend_y, 12, fill=fill))
        foreground.append(text_block(cx + 20, legend_y - 8, [make_line(label, fill=HELPER)]))

    # Value panel
    foreground.append(text_block(right_x, lower_y, [make_line('The value (V): the "knowledge transfer"', weight="700")]))
    foreground.append(matrix_group(912, 648, "Q"))
    foreground.append(matrix_group(1136, 648, "K"))
    background.append(vertical_arrow(936, 696, 744))
    background.append(vertical_arrow(1160, 696, 744))
    foreground.append(box(912, 744, 192, GREY, [make_line("Ubuntu:")]))
    foreground.append(box(1136, 744, 192, BLACK, [make_line("Linux", fill=WHITE)], text_fill=WHITE))
    background.append(horizontal_arrow(1104, 776, 1136))
    foreground.append(
        text_block(
            1360,
            752,
            [
                make_line('Strongest meaning comes from "Linux",', fill=HELPER),
                make_line('with extra audience context from', fill=HELPER),
                make_line('"human beings".', fill=HELPER),
            ],
        )
    )
    background.append(vertical_arrow(1232, 808, 848))
    foreground.append(box(960, 848, 336, GREY, [make_line("Value transfer (V)", weight="700")]))
    foreground.append(
        text_block(
            912,
            944,
            [
                make_line('Now that the model knows "Linux" is the most relevant', fill=HELPER),
                make_line('word, it takes the value step to transfer the actual', fill=HELPER),
                make_line('semantic meaning of "Linux" and "human beings" into', fill=HELPER),
                make_line('the representation of "Ubuntu".', fill=HELPER),
            ],
        )
    )

    parts.extend(background)
    parts.extend(foreground)
    write_svg(SVG_DIR / "attention-qkv-onbrand.svg", parts)


def main() -> None:
    SVG_DIR.mkdir(parents=True, exist_ok=True)
    build_attention_qkv()
    build_memory_wall()
    build_request_to_hardware_stack()
    build_inference_snaps()
    build_rise_of_inference_economy()
    build_gpu_waiting()
    build_diagram_intake_workflow()
    build_logic_data_vram()


if __name__ == "__main__":
    main()
