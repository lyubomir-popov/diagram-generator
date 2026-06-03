from __future__ import annotations

import pathlib
from typing import Any

import yaml


# Canonical YAML projection for editor style names.
# This is a persistence helper derived from docs/frame-classes.md and the
# shared resolver semantics, not an independent visual authority.
STYLE_SEMANTICS: dict[str, dict[str, Any]] = {
    "default": {"level": 1, "fill": "white", "border": "solid"},
    "parent": {"level": 2, "fill": "grey", "border": "solid"},
    "section": {"level": 3, "fill": "white", "border": "solid"},
    "annotation": {"level": None, "fill": "white", "border": "none"},
    "highlight": {"level": None, "fill": "black", "border": "none"},
}

SUPPORTED_FRAME_KEYS = {
    "direction",
    "gap",
    "padding",
    "padding_top",
    "padding_right",
    "padding_bottom",
    "padding_left",
    "sizing",
    "sizing_w",
    "sizing_h",
    "fill_weight",
    "align",
    "wrap",
    "width",
    "height",
    "min_width",
    "max_width",
    "max_width_chars",
    "min_height",
    "max_height",
    "fill",
    "border",
    "level",
    "position",
    "x",
    "y",
    "children_order",
    "text",
    "style",
}

UNSUPPORTED_FRAME_KEYS = {"dx", "dy", "dw", "dh", "waypoints"}
SUPPORTED_GRID_KEYS = {"cols", "col_gap", "row_gap", "outer_margin"}
IGNORED_GRID_KEYS = {"link_to_root"}
UNSUPPORTED_GRID_KEYS = {"rows", "slack_absorption"}

_LOWER_KEYS = {"direction", "sizing", "sizing_w", "sizing_h", "fill", "border", "position"}
_INT_KEYS = {
    "gap",
    "padding",
    "padding_top",
    "padding_right",
    "padding_bottom",
    "padding_left",
    "width",
    "height",
    "min_width",
    "max_width",
    "max_width_chars",
    "min_height",
    "max_height",
    "level",
    "x",
    "y",
}


def _normalise_style_name(style_name: Any) -> str | None:
    if not isinstance(style_name, str):
        return None
    style_name = style_name.strip()
    if not style_name:
        return None
    return style_name


def _style_semantics(style_name: Any) -> dict[str, Any] | None:
    canonical = _normalise_style_name(style_name)
    if canonical is None:
        return None
    semantic = STYLE_SEMANTICS.get(canonical)
    if semantic is None:
        return None
    result = dict(semantic)
    result["style"] = canonical
    return result


def _coerce_int(value: Any, field_name: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError) as exc:  # pragma: no cover - defensive
        raise ValueError(f"{field_name} must be an integer") from exc


def _coerce_float(value: Any, field_name: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:  # pragma: no cover - defensive
        raise ValueError(f"{field_name} must be numeric") from exc


def _yaml_align(value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError("align must be a string")
    return value.strip().lower().replace("_", "-")


def _yaml_text_scalar(existing: Any, text: str) -> Any:
    if isinstance(existing, dict):
        updated = dict(existing)
        updated["text"] = text
        return updated
    return text


def _update_text_fields(frame_data: dict[str, Any], text_override: Any) -> None:
    if not isinstance(text_override, dict):
        raise ValueError("text override must be an object")
    if "heading" in text_override:
        heading = text_override["heading"]
        if heading is None or heading == "":
            frame_data.pop("heading", None)
        elif not isinstance(heading, str):
            raise ValueError("text.heading must be a string")
        else:
            frame_data["heading"] = _yaml_text_scalar(frame_data.get("heading"), heading)
    if "label" in text_override:
        label = text_override["label"]
        if not isinstance(label, list) or any(not isinstance(line, str) for line in label):
            raise ValueError("text.label must be a list of strings")
        existing = frame_data.get("label")
        existing_lines = existing if isinstance(existing, list) else [existing] if existing is not None else []
        frame_data["label"] = [
            _yaml_text_scalar(existing_lines[index] if index < len(existing_lines) else None, line)
            for index, line in enumerate(label)
        ]


def _reorder_children(frame_data: dict[str, Any], child_order: Any, frame_id: str) -> None:
    if not isinstance(child_order, list) or any(not isinstance(item, str) for item in child_order):
        raise ValueError("children_order must be a list of child ids")
    children = frame_data.get("children")
    if not isinstance(children, list):
        raise ValueError(f"{frame_id} has no children to reorder")
    child_map = {
        child.get("id"): child
        for child in children
        if isinstance(child, dict) and isinstance(child.get("id"), str)
    }
    missing = [child_id for child_id in child_order if child_id not in child_map]
    if missing:
        raise ValueError(f"{frame_id} children_order references unknown child ids: {', '.join(missing)}")
    reordered = [child_map[child_id] for child_id in child_order]
    remaining = [
        child for child in children
        if not isinstance(child, dict) or child.get("id") not in child_map or child.get("id") not in child_order
    ]
    frame_data["children"] = reordered + remaining


def _apply_grid_overrides(document: dict[str, Any], grid_overrides: Any) -> None:
    if not isinstance(grid_overrides, dict):
        raise ValueError("grid_overrides must be an object")
    grid = document.get("grid")
    if not isinstance(grid, dict):
        grid = {}
        document["grid"] = grid

    for key in UNSUPPORTED_GRID_KEYS:
        if key in grid_overrides and grid_overrides.get(key) not in (None, True):
            raise ValueError(f"{key} is not persistable in frame YAML")
    if "link_to_root" in grid_overrides and grid_overrides.get("link_to_root") not in (None, True):
        raise ValueError("link_to_root=false is not persistable in frame YAML")

    margin_keys = ["margin_top", "margin_right", "margin_bottom", "margin_left"]
    margin_values = [grid_overrides.get(key) for key in margin_keys if key in grid_overrides]
    if margin_values:
        numeric_margins = [_coerce_int(value, "grid_overrides.margin") for value in margin_values]
        if len(set(numeric_margins)) != 1:
            raise ValueError("per-side grid margins are not persistable in frame YAML; values must be uniform")
        grid["outer_margin"] = numeric_margins[0]

    for key in grid_overrides:
        if key in SUPPORTED_GRID_KEYS:
            grid[key] = _coerce_int(grid_overrides[key], f"grid_overrides.{key}")
        elif key not in IGNORED_GRID_KEYS and key not in margin_keys and key not in UNSUPPORTED_GRID_KEYS:
            raise ValueError(f"Unknown grid_overrides key: {key}")


def _apply_style_fields(frame_data: dict[str, Any], style_name: Any) -> None:
    frame_data.pop("style", None)
    semantic = _style_semantics(style_name)
    if semantic is None:
        frame_data.pop("level", None)
        frame_data.pop("fill", None)
        frame_data.pop("border", None)
        return
    if semantic["level"] is None:
        frame_data.pop("level", None)
    else:
        frame_data["level"] = semantic["level"]
    frame_data["fill"] = semantic["fill"]
    frame_data["border"] = semantic["border"]


def _apply_direct_field(frame_data: dict[str, Any], key: str, value: Any) -> None:
    if key == "align":
        frame_data[key] = _yaml_align(value)
        return
    if key == "fill_weight":
        coerced = _coerce_float(value, key)
        frame_data[key] = int(coerced) if coerced.is_integer() else coerced
        return
    if key == "wrap":
        frame_data[key] = bool(value)
        return
    if key in _LOWER_KEYS:
        if not isinstance(value, str):
            raise ValueError(f"{key} must be a string")
        frame_data[key] = value.strip().lower()
        return
    if key in _INT_KEYS:
        frame_data[key] = _coerce_int(value, key)
        return
    raise ValueError(f"Unsupported canonical field: {key}")


def _find_frame_data(frame_data: dict[str, Any], frame_id: str) -> dict[str, Any] | None:
    if frame_data.get("id") == frame_id:
        return frame_data
    children = frame_data.get("children", [])
    if not isinstance(children, list):
        return None
    for child in children:
        if not isinstance(child, dict):
            continue
        found = _find_frame_data(child, frame_id)
        if found is not None:
            return found
    return None


def _apply_frame_override(frame_data: dict[str, Any], override: Any, frame_id: str) -> None:
    if not isinstance(override, dict):
        raise ValueError(f"Override for {frame_id} must be an object")

    unsupported = sorted(key for key in override if key in UNSUPPORTED_FRAME_KEYS)
    if unsupported:
        raise ValueError(
            f"{frame_id} includes non-canonical transient keys that cannot be saved to YAML: {', '.join(unsupported)}"
        )

    style_name = override.get("style")
    if "style" in override:
        _apply_style_fields(frame_data, style_name)

    for key, value in override.items():
        if key not in SUPPORTED_FRAME_KEYS and key not in UNSUPPORTED_FRAME_KEYS:
            raise ValueError(f"Unknown override key for {frame_id}: {key}")
        if key == "style":
            continue
        if key == "children_order":
            _reorder_children(frame_data, value, frame_id)
            continue
        if key == "text":
            _update_text_fields(frame_data, value)
            continue
        if key == "sizing":
            _apply_direct_field(frame_data, "sizing_w", value)
            _apply_direct_field(frame_data, "sizing_h", value)
            frame_data.pop("sizing", None)
            continue
        if key == "padding":
            _apply_direct_field(frame_data, key, value)
            for per_side in ("padding_top", "padding_right", "padding_bottom", "padding_left"):
                frame_data.pop(per_side, None)
            continue
        if key in {"level", "fill", "border"} and "style" in override:
            # Style mapping already wrote the canonical YAML values.
            continue
        if key in {
            "direction",
            "gap",
            "padding_top",
            "padding_right",
            "padding_bottom",
            "padding_left",
            "sizing_w",
            "sizing_h",
            "fill_weight",
            "align",
            "wrap",
            "width",
            "height",
            "min_width",
            "max_width",
    "max_width_chars",
            "min_height",
            "max_height",
            "fill",
            "border",
            "level",
            "position",
            "x",
            "y",
        }:
            _apply_direct_field(frame_data, key, value)


def persist_override_payload_to_yaml(
    frame_path: pathlib.Path,
    payload: dict[str, Any],
) -> None:
    if not isinstance(payload, dict):
        raise ValueError("Expected JSON object")

    overrides = payload.get("overrides", {})
    if not isinstance(overrides, dict):
        raise ValueError("overrides must be an object")
    grid_overrides = payload.get("grid_overrides")
    has_grid_overrides = "grid_overrides" in payload and isinstance(grid_overrides, dict) and len(grid_overrides) > 0
    if not overrides and not has_grid_overrides:
        return

    document = yaml.safe_load(frame_path.read_text(encoding="utf-8"))
    if not isinstance(document, dict):
        raise ValueError(f"{frame_path}: expected top-level mapping")
    if document.get("engine") != "v3":
        raise ValueError(f"{frame_path}: not a native frame YAML (missing engine: v3)")

    root_data = document.get("root")
    if not isinstance(root_data, dict):
        raise ValueError(f"{frame_path}: root must be a mapping")

    if "grid_overrides" in payload:
        _apply_grid_overrides(document, payload.get("grid_overrides"))

    for frame_id, override in overrides.items():
        if not isinstance(frame_id, str):
            raise ValueError("override ids must be strings")
        target = _find_frame_data(root_data, frame_id)
        if target is None:
            raise ValueError(f"Unknown component id in overrides: {frame_id}")
        _apply_frame_override(target, override, frame_id)

    dumped = yaml.safe_dump(document, sort_keys=False, allow_unicode=True, width=1000)
    frame_path.write_text(dumped, encoding="utf-8")
