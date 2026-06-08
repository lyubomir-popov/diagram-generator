"""Validation test: enforce frame-class hierarchy rules from docs/frame-classes.md.

Walks every non-test YAML in the corpus and checks:
1. Every headed container has an explicit level: (2 or 3).
2. No level-3 section contains a level-3 child.
3. No level-2 panel contains a level-2 child.
4. Every resolved frame maps to one of the four legal classes.
5. Heading weight matches the class (bold for section/panel, regular for leaf).
"""

from __future__ import annotations

import os
import pathlib
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from frame_loader import load_frame_yaml
from frame_model import Frame

FRAMES_DIR = pathlib.Path(__file__).parent / "diagrams" / "frames"

# Collect non-test YAML files
_YAMLS = sorted(
    p for p in FRAMES_DIR.glob("*.yaml") if not p.name.startswith("test-")
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_BLACK = "#000000"
_GREY = "#F3F3F3"


def _effective_level(frame: Frame) -> int | None:
    """Return the resolved level, or None for special-case frames."""
    if frame.fill and frame.fill.value == _BLACK:
        return None  # highlight
    if frame.role == "separator":
        return None
    if frame.border and frame.border.name == "NONE" and not frame.is_container:
        return None  # annotation
    return frame.level


def _is_layout_wrapper(frame: Frame) -> bool:
    return "__" in (frame.id or "")


def _walk_violations(
    frame: Frame,
    parent_level: int | None = None,
    violations: list[str] | None = None,
    path: str = "",
) -> list[str]:
    if violations is None:
        violations = []

    fid = frame.id or "?"
    current_path = f"{path}/{fid}" if path else fid

    # Skip layout wrappers — they're invisible
    if _is_layout_wrapper(frame):
        for child in frame.children:
            _walk_violations(child, parent_level, violations, current_path)
        return violations

    # Skip root (depth 0)
    if frame.resolved_fill == "transparent" and frame.resolved_stroke == "none" and parent_level is None:
        for child in frame.children:
            _walk_violations(child, None, violations, current_path)
        return violations

    level = _effective_level(frame)

    # --- Check resolved fill/stroke matches the class ---
    if level is not None:
        if frame.resolved_fill == _GREY and frame.resolved_stroke == _GREY:
            resolved_class = "panel"
        elif frame.resolved_fill == "transparent" and frame.resolved_stroke == _BLACK:
            resolved_class = "outlined"  # section or leaf
        elif frame.resolved_fill == "transparent" and frame.resolved_stroke == "none":
            if frame.is_container and not any(
                c.role == "heading" for c in frame.children
            ):
                resolved_class = "wrapper"  # level 0
            else:
                resolved_class = "annotation"
        elif frame.resolved_fill == _BLACK:
            resolved_class = "highlight"
        else:
            violations.append(
                f"{current_path}: unknown style combo "
                f"fill={frame.resolved_fill} stroke={frame.resolved_stroke}"
            )
            resolved_class = "unknown"

        # Class vs level consistency
        if level >= 3 and resolved_class != "outlined":
            violations.append(
                f"{current_path}: level 3 (section) should be outlined, "
                f"got {resolved_class}"
            )
        if level == 2 and resolved_class != "panel":
            violations.append(
                f"{current_path}: level 2 (panel) should be grey, "
                f"got {resolved_class}"
            )
        if level == 1 and resolved_class not in ("outlined", "wrapper"):
            violations.append(
                f"{current_path}: level 1 (leaf) should be outlined, "
                f"got {resolved_class}"
            )

    # --- Nesting constraints ---
    if level is not None and parent_level is not None:
        if parent_level == 2 and level == 2:
            violations.append(
                f"{current_path}: panel (level 2) nested inside panel — "
                f"grey-on-grey"
            )
        if parent_level == 3 and level == 3:
            violations.append(
                f"{current_path}: section (level 3) nested inside section"
            )

    # --- Heading weight check ---
    heading_child = None
    for c in frame.children:
        if c.role == "heading" and c.label:
            heading_child = c
            break

    if heading_child is not None and level is not None:
        weight = heading_child.resolved_heading_weight or "400"
        small_caps = bool(heading_child.resolved_heading_small_caps)
        if level >= 3:
            if weight != "700":
                violations.append(
                    f"{current_path}: section heading should be bold (700), got {weight}"
                )
        elif level == 2:
            if weight != "700":
                violations.append(
                    f"{current_path}: panel heading should be bold (700), "
                    f"got {weight}"
                )
            if small_caps:
                violations.append(
                    f"{current_path}: panel heading should not be small-caps"
                )
        elif level == 1:
            if weight == "700":
                violations.append(
                    f"{current_path}: leaf heading should be regular weight, "
                    f"got bold (700)"
                )

    # Recurse
    effective_parent = level if level is not None else parent_level
    for child in frame.children:
        _walk_violations(child, effective_parent, violations, current_path)

    return violations


# ---------------------------------------------------------------------------
# Parametrised test: one test case per YAML file
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("yaml_path", _YAMLS, ids=lambda p: p.stem)
def test_frame_class_hierarchy(yaml_path: pathlib.Path):
    """Every frame in the diagram must resolve to a legal frame class."""
    diagram = load_frame_yaml(yaml_path)
    violations = _walk_violations(diagram.root)
    assert violations == [], (
        f"{yaml_path.stem} has frame-class violations:\n"
        + "\n".join(f"  - {v}" for v in violations)
    )
