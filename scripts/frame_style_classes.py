from __future__ import annotations

from dataclasses import dataclass

from diagram_shared import DEFAULT_FRAME_STROKE_WIDTH


@dataclass(frozen=True)
class FrameTextStyle:
    weight: str
    small_caps: bool
    letter_spacing: str | None = None


@dataclass(frozen=True)
class FrameClassDefinition:
    fill: str
    stroke: str
    stroke_width: int = DEFAULT_FRAME_STROKE_WIDTH
    text_fill: str | None = None
    icon_fill: str | None = None
    heading_text: FrameTextStyle | None = None
    leaf_lead_text: FrameTextStyle | None = None

FRAME_CLASS_DEFS: dict[str, FrameClassDefinition] = {
    "hidden": FrameClassDefinition(
        fill="transparent",
        stroke="none",
        stroke_width=0,
    ),
    "highlight": FrameClassDefinition(
        fill="#000000",
        stroke="#000000",
        text_fill="#FFFFFF",
        icon_fill="#FFFFFF",
    ),
    "annotation": FrameClassDefinition(
        fill="transparent",
        stroke="none",
        stroke_width=0,
        text_fill="#666666",
        icon_fill="#666666",
        heading_text=FrameTextStyle(weight="400", small_caps=False),
        leaf_lead_text=FrameTextStyle(weight="400", small_caps=False),
    ),
    "section": FrameClassDefinition(
        fill="transparent",
        stroke="#000000",
        stroke_width=DEFAULT_FRAME_STROKE_WIDTH,
        text_fill="#000000",
        icon_fill="#000000",
        heading_text=FrameTextStyle(weight="700", small_caps=False),
        leaf_lead_text=FrameTextStyle(weight="700", small_caps=False),
    ),
    "panel": FrameClassDefinition(
        fill="#F3F3F3",
        stroke="#F3F3F3",
        text_fill="#000000",
        icon_fill="#000000",
        heading_text=FrameTextStyle(weight="700", small_caps=False),
        leaf_lead_text=FrameTextStyle(weight="700", small_caps=False),
    ),
    "leaf": FrameClassDefinition(
        fill="transparent",
        stroke="#000000",
        text_fill="#000000",
        icon_fill="#000000",
        heading_text=FrameTextStyle(weight="400", small_caps=False),
        leaf_lead_text=FrameTextStyle(weight="400", small_caps=False),
    ),
}

def stroke_width_for_class(frame_class: FrameClassDefinition) -> int:
    """Stroke width from a frame-class definition (0 when the class has no visible stroke)."""
    if frame_class.stroke in ("none", "transparent"):
        return 0
    return frame_class.stroke_width


def effective_resolved_stroke_width(frame) -> int:
    """Effective border width after resolve_styles() — layout inset and SVG render."""
    from diagram_model import Border

    # If resolve_styles() has run, trust the resolved values.
    if frame.resolved_stroke is not None:
        stroke = frame.resolved_stroke
        if stroke in ("none", "transparent"):
            return 0
        if frame.resolved_stroke_width is not None and frame.resolved_stroke_width > 0:
            return int(frame.resolved_stroke_width)
        return DEFAULT_FRAME_STROKE_WIDTH
    # resolve_styles() hasn't run yet — fall back to the border field.
    return DEFAULT_FRAME_STROKE_WIDTH if frame.border in (Border.SOLID, Border.DASHED) else 0


def apply_frame_class(frame, frame_class: FrameClassDefinition) -> None:
    frame.resolved_fill = frame_class.fill
    frame.resolved_stroke = frame_class.stroke
    frame.resolved_stroke_width = stroke_width_for_class(frame_class)
    frame.resolved_text_fill = frame_class.text_fill
    frame.resolved_icon_fill = frame_class.icon_fill
    frame.resolved_heading_weight = frame_class.heading_text.weight if frame_class.heading_text else None
    frame.resolved_heading_small_caps = frame_class.heading_text.small_caps if frame_class.heading_text else None
    frame.resolved_heading_letter_spacing = frame_class.heading_text.letter_spacing if frame_class.heading_text else None
    frame.resolved_leaf_lead_weight = frame_class.leaf_lead_text.weight if frame_class.leaf_lead_text else None
    frame.resolved_leaf_lead_small_caps = frame_class.leaf_lead_text.small_caps if frame_class.leaf_lead_text else None
    frame.resolved_leaf_lead_letter_spacing = frame_class.leaf_lead_text.letter_spacing if frame_class.leaf_lead_text else None

    for child in frame.children:
        if child.role != "heading":
            continue
        child.resolved_text_fill = frame_class.text_fill
        child.resolved_icon_fill = frame_class.icon_fill
        if frame_class.heading_text:
            child.resolved_heading_weight = frame_class.heading_text.weight
            child.resolved_heading_small_caps = frame_class.heading_text.small_caps
            child.resolved_heading_letter_spacing = frame_class.heading_text.letter_spacing


def apply_highlight_parent_contrast(frame) -> None:
    """Apply readable text/icon contrast for frames on a highlight parent."""
    text_fill = "#FFFFFF"
    icon_fill = "#FFFFFF"

    frame.resolved_text_fill = text_fill
    frame.resolved_icon_fill = icon_fill
    for child in frame.children:
        if child.role != "heading":
            continue
        child.resolved_text_fill = text_fill
        child.resolved_icon_fill = icon_fill
