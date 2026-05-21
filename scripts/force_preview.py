from __future__ import annotations

import hashlib
import json
import pathlib
from dataclasses import dataclass, field
from typing import Any

from force_layout import (
    ForceCenter,
    ForceCollideRect,
    ForceLink,
    ForceLinkForce,
    ForceManyBody,
    ForceNode,
    ForceSimulation,
    snap_to_grid,
)


FORCE_DIR = pathlib.Path(__file__).resolve().parent / "diagrams" / "force"
FORCE_OVERRIDES_DIR = pathlib.Path(__file__).resolve().parent.parent / "diagrams" / "2.output" / "overrides" / "force"
STYLE_UNSET = object()
FORCE_BOX_STYLES: dict[str, dict[str, str]] = {
    "default": {"fill": "#FFFFFF", "text_fill": "#000000"},
    "accent": {"fill": "#F3F3F3", "text_fill": "#000000"},
    "highlight": {"fill": "#000000", "text_fill": "#FFFFFF"},
}


@dataclass
class ForcePreviewState:
    slug: str
    spec: dict[str, Any]
    simulation: ForceSimulation
    node_index_by_id: dict[str, int]
    node_base_styles: dict[str, str | None]
    node_style_overrides: dict[str, str] = field(default_factory=dict)
    tick_count: int = 0
    render_overrides: dict[str, float] = field(default_factory=dict)


def list_force_examples() -> list[str]:
    if not FORCE_DIR.is_dir():
        return []
    return sorted(path.stem for path in FORCE_DIR.glob("*.json"))


def load_force_spec(slug: str) -> dict[str, Any]:
    path = FORCE_DIR / f"{slug}.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _force_definition_hash(slug: str) -> str:
    path = FORCE_DIR / f"{slug}.json"
    if not path.exists():
        return ""
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def load_force_overrides(slug: str) -> dict[str, Any]:
    path = FORCE_OVERRIDES_DIR / f"{slug}.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {"format_version": 1, "definition_hash": "", "nodes": {}}


def _canvas(spec: dict[str, Any]) -> dict[str, int]:
    canvas = spec.get("canvas", {})
    return {
        "width": int(canvas.get("width", 1280)),
        "height": int(canvas.get("height", 720)),
    }


def _simulation_config(spec: dict[str, Any]) -> dict[str, Any]:
    return spec.get("simulation", {})


def _clamp_coordinate(value: float, half_size: float, extent: float) -> float:
    minimum = half_size
    maximum = extent - half_size
    if maximum < minimum:
        return extent / 2
    return max(minimum, min(maximum, value))


def _clamp_node_to_canvas(node: ForceNode, canvas: dict[str, int]) -> None:
    half_width = node.width / 2
    half_height = node.height / 2

    if node.fx is not None:
        node.fx = _clamp_coordinate(float(node.fx), half_width, canvas["width"])
        node.x = node.fx
        node.vx = 0.0
    else:
        clamped_x = _clamp_coordinate(node.x, half_width, canvas["width"])
        if clamped_x != node.x:
            node.x = clamped_x
            node.vx = 0.0

    if node.fy is not None:
        node.fy = _clamp_coordinate(float(node.fy), half_height, canvas["height"])
        node.y = node.fy
        node.vy = 0.0
    else:
        clamped_y = _clamp_coordinate(node.y, half_height, canvas["height"])
        if clamped_y != node.y:
            node.y = clamped_y
            node.vy = 0.0


def _clamp_state_nodes(state: ForcePreviewState) -> None:
    canvas = _canvas(state.spec)
    for node in state.simulation.nodes:
        _clamp_node_to_canvas(node, canvas)


def restart_force_animation(state: ForcePreviewState) -> None:
    sim_cfg = _simulation_config(state.spec)
    state.tick_count = 0
    state.simulation.alpha = float(sim_cfg.get("alpha", 1.0))
    for node in state.simulation.nodes:
        node.vx = 0.0
        node.vy = 0.0
        if node.fx is not None:
            node.x = float(node.fx)
        if node.fy is not None:
            node.y = float(node.fy)
    _clamp_state_nodes(state)


def _normalize_style_name(value: Any) -> str | None:
    if value is None:
        return None
    style_name = str(value).strip().lower()
    return style_name if style_name in FORCE_BOX_STYLES else None


def _infer_base_style(node_spec: dict[str, Any]) -> str | None:
    explicit = _normalize_style_name(node_spec.get("style"))
    if explicit:
        return explicit

    if "fill" not in node_spec and "text_fill" not in node_spec:
        return "default"

    fill = str(node_spec.get("fill", "")).upper()
    text_fill = str(node_spec.get("text_fill", "")).upper()
    for style_name, preset in FORCE_BOX_STYLES.items():
        if fill == preset["fill"].upper() and (not text_fill or text_fill == preset["text_fill"].upper()):
            return style_name
    return None


def _resolved_style(state: ForcePreviewState, node_id: str) -> tuple[str | None, str | None]:
    override = state.node_style_overrides.get(node_id)
    base_style = state.node_base_styles.get(node_id)
    return (override if override is not None else base_style), override


def _apply_force_node_update(
    state: ForcePreviewState,
    node_id: str,
    *,
    pinned: bool | None = None,
    x: float | None = None,
    y: float | None = None,
    style: object = STYLE_UNSET,
    reheat: bool = True,
) -> None:
    index = state.node_index_by_id.get(node_id)
    if index is None:
        raise KeyError(node_id)

    node = state.simulation.nodes[index]
    node_changed = False

    if x is not None:
        node.x = float(x)
        node.vx = 0.0
        if node.fx is not None and pinned is None:
            node.fx = node.x
        node_changed = True

    if y is not None:
        node.y = float(y)
        node.vy = 0.0
        if node.fy is not None and pinned is None:
            node.fy = node.y
        node_changed = True

    if pinned is not None:
        if pinned:
            node.fx = float(node.x)
            node.fy = float(node.y)
        else:
            node.fx = None
            node.fy = None
        node_changed = True

    if style is not STYLE_UNSET:
        if style in (None, ""):
            state.node_style_overrides.pop(node_id, None)
        else:
            style_name = _normalize_style_name(style)
            if style_name is None:
                raise ValueError(f"Unknown style: {style}")
            state.node_style_overrides[node_id] = style_name

    _clamp_state_nodes(state)
    if node_changed and reheat:
        restart_force_animation(state)


def apply_force_overrides(state: ForcePreviewState, data: dict[str, Any]) -> None:
    for node_id, payload in data.get("nodes", {}).items():
        _apply_force_node_update(
            state,
            node_id,
            pinned=(bool(payload["pinned"]) if "pinned" in payload else None),
            x=(float(payload["x"]) if "x" in payload and payload["x"] is not None else None),
            y=(float(payload["y"]) if "y" in payload and payload["y"] is not None else None),
            style=(payload["style"] if "style" in payload else STYLE_UNSET),
            reheat=False,
        )


def reset_force_state(state: ForcePreviewState) -> ForcePreviewState:
    reset_state = create_force_state(state.slug)
    apply_force_overrides(reset_state, serialize_force_overrides(state))
    restart_force_animation(reset_state)
    return reset_state


def serialize_force_overrides(state: ForcePreviewState) -> dict[str, Any]:
    node_payloads: dict[str, dict[str, Any]] = {}
    for node_spec, node in zip(state.spec.get("nodes", []), state.simulation.nodes):
        node_id = node.component_id
        payload: dict[str, Any] = {}
        spec_pinned = node_spec.get("fx") is not None or node_spec.get("fy") is not None
        current_pinned = node.fx is not None or node.fy is not None

        spec_x = float(node_spec.get("fx", node_spec.get("x", node.x)))
        spec_y = float(node_spec.get("fy", node_spec.get("y", node.y)))

        if current_pinned:
            if (not spec_pinned) or abs(node.x - spec_x) > 1e-6 or abs(node.y - spec_y) > 1e-6:
                payload["x"] = node.x
                payload["y"] = node.y
                payload["pinned"] = True
        elif spec_pinned:
            payload["pinned"] = False

        style_override = state.node_style_overrides.get(node_id)
        if style_override is not None:
            payload["style"] = style_override

        if payload:
            node_payloads[node_id] = payload

    return {
        "format_version": 1,
        "definition_hash": _force_definition_hash(state.slug),
        "nodes": node_payloads,
    }


def save_force_overrides(state: ForcePreviewState) -> None:
    FORCE_OVERRIDES_DIR.mkdir(parents=True, exist_ok=True)
    path = FORCE_OVERRIDES_DIR / f"{state.slug}.json"
    path.write_text(json.dumps(serialize_force_overrides(state), indent=2) + "\n", encoding="utf-8")


def _get_simulation_params(state: ForcePreviewState) -> dict[str, Any]:
    """Extract current simulation parameter values for the UI."""
    sim = state.simulation
    params: dict[str, Any] = {
        "velocity_decay": sim.velocity_decay,
        "alpha_min": sim.alpha_min,
        "alpha_decay": sim.alpha_decay,
    }
    charge = sim._forces.get("charge")
    if charge is not None:
        try:
            params["charge_strength"] = float(charge._strength_fn(None, 0, []))
        except Exception:
            pass
    collide = sim._forces.get("collide")
    if collide is not None:
        params["collision_padding"] = float(collide._padding)
    link = sim._forces.get("link")
    if link is not None:
        try:
            params["link_distance"] = float(link._distance_fn(None, 0, []))
        except Exception:
            pass
        try:
            strength_fn = link._strength_fn or link._default_strength
            params["link_strength"] = float(strength_fn(None, 0, []))
        except Exception:
            pass
    return params


def update_simulation_params(state: ForcePreviewState, params: dict[str, Any]) -> dict[str, Any]:
    """Update live simulation parameters and return a fresh snapshot."""
    sim = state.simulation

    if "velocity_decay" in params:
        sim.velocity_decay = float(params["velocity_decay"])

    if "alpha_min" in params:
        sim.alpha_min = float(params["alpha_min"])

    if "alpha_decay" in params:
        sim.alpha_decay = float(params["alpha_decay"])

    if "charge_strength" in params:
        charge = sim._forces.get("charge")
        if charge is not None:
            charge.strength(float(params["charge_strength"]))

    if "collision_padding" in params:
        collide = sim._forces.get("collide")
        if collide is not None:
            collide._padding = float(params["collision_padding"])

    if "link_distance" in params:
        link = sim._forces.get("link")
        if link is not None:
            link.distance(float(params["link_distance"]))

    if "link_strength" in params:
        link = sim._forces.get("link")
        if link is not None:
            link.strength(float(params["link_strength"]))

    # Reheat simulation so changes take effect
    sim.alpha = max(sim.alpha, 0.3)

    # Render overrides (not simulation params, but exposed via same API)
    for key in ("curve_handle_ratio", "curve_handle_min", "curve_handle_max"):
        if key in params:
            state.render_overrides[key] = float(params[key])

    return get_force_snapshot(state)


def create_force_state(slug: str) -> ForcePreviewState:
    spec = load_force_spec(slug)
    canvas = _canvas(spec)
    sim_cfg = _simulation_config(spec)

    nodes: list[ForceNode] = []
    node_index_by_id: dict[str, int] = {}
    node_base_styles: dict[str, str | None] = {}
    for index, node_spec in enumerate(spec.get("nodes", [])):
        node_id = node_spec["id"]
        nodes.append(
            ForceNode(
                index=index,
                x=float(node_spec.get("x", float("nan"))),
                y=float(node_spec.get("y", float("nan"))),
                fx=(None if node_spec.get("fx") is None else float(node_spec["fx"])),
                fy=(None if node_spec.get("fy") is None else float(node_spec["fy"])),
                width=float(node_spec.get("width", 192)),
                height=float(node_spec.get("height", 64)),
                component_id=node_id,
            )
        )
        node_index_by_id[node_id] = index
        node_base_styles[node_id] = _infer_base_style(node_spec)

    simulation = ForceSimulation(nodes)
    simulation.alpha = float(sim_cfg.get("alpha", 1.0))
    if "alpha_min" in sim_cfg:
        simulation.alpha_min = float(sim_cfg["alpha_min"])
    if "alpha_decay" in sim_cfg:
        simulation.alpha_decay = float(sim_cfg["alpha_decay"])
    if "alpha_target" in sim_cfg:
        simulation.alpha_target = float(sim_cfg["alpha_target"])
    if "velocity_decay" in sim_cfg:
        simulation.velocity_decay = float(sim_cfg["velocity_decay"])

    center = sim_cfg.get("center", [canvas["width"] / 2, canvas["height"] / 2])
    simulation.force("center", ForceCenter(float(center[0]), float(center[1])))
    simulation.force("charge", ForceManyBody().strength(float(sim_cfg.get("charge_strength", -220))))

    collide = ForceCollideRect(padding=float(sim_cfg.get("collision_padding", 12)))
    if "collision_iterations" in sim_cfg:
        collide.iterations(int(sim_cfg["collision_iterations"]))
    simulation.force("collide", collide)

    links = [
        ForceLink(index=index, source=link_spec["source"], target=link_spec["target"])
        for index, link_spec in enumerate(spec.get("links", []))
    ]
    if links:
        link_force = ForceLinkForce(links)
        link_force.id(lambda node, i, ns: node.component_id)
        link_force.distance(float(sim_cfg.get("link_distance", 120)))
        if "link_iterations" in sim_cfg:
            link_force.iterations(int(sim_cfg["link_iterations"]))
        if "link_strength" in sim_cfg:
            link_force.strength(float(sim_cfg["link_strength"]))
        simulation.force("link", link_force)

    state = ForcePreviewState(
        slug=slug,
        spec=spec,
        simulation=simulation,
        node_index_by_id=node_index_by_id,
        node_base_styles=node_base_styles,
    )
    _clamp_state_nodes(state)
    apply_force_overrides(state, load_force_overrides(slug))
    _clamp_state_nodes(state)
    return state


def get_force_snapshot(state: ForcePreviewState, *, snap: bool = False) -> dict[str, Any]:
    spec = state.spec
    canvas = _canvas(spec)
    sim_cfg = _simulation_config(spec)
    render_cfg = spec.get("render", {})
    node_payloads: list[dict[str, Any]] = []

    _clamp_state_nodes(state)

    for node_spec, node in zip(spec.get("nodes", []), state.simulation.nodes):
        if snap:
            x = _clamp_coordinate(snap_to_grid(node.x), node.width / 2, canvas["width"])
            y = _clamp_coordinate(snap_to_grid(node.y), node.height / 2, canvas["height"])
        else:
            x = node.x
            y = node.y
        style_name, style_override = _resolved_style(state, node.component_id)
        if style_name is not None:
            style_preset = FORCE_BOX_STYLES[style_name]
            fill = style_preset["fill"]
            text_fill = style_preset["text_fill"]
        else:
            fill = node_spec.get("fill", "#FFFFFF")
            text_fill = node_spec.get("text_fill", "#000000")
        node_payloads.append(
            {
                "id": node.component_id,
                "label": node_spec.get("label", [node.component_id]),
                "x": x,
                "y": y,
                "width": node.width,
                "height": node.height,
                "fx": node.fx,
                "fy": node.fy,
                "style": style_name,
                "style_override": style_override,
                "base_style": state.node_base_styles.get(node.component_id),
                "shape": node_spec.get("shape", "box"),
                "fill": fill,
                "stroke": node_spec.get("stroke", "#000000"),
                "stroke_width": float(node_spec.get("stroke_width", 1)),
                "text_fill": text_fill,
            }
        )

    link_payloads: list[dict[str, Any]] = []
    for link_spec in spec.get("links", []):
        link_payloads.append(
            {
                "source": link_spec["source"],
                "target": link_spec["target"],
                "stroke": link_spec.get("stroke", "#E95420"),
                "stroke_width": float(link_spec.get("stroke_width", 1)),
                "render": link_spec.get("render", {}),
            }
        )

    max_iterations = int(sim_cfg.get("max_iterations", 300))
    return {
        "slug": state.slug,
        "title": spec.get("title", state.slug),
        "reference_image": spec.get("reference_image"),
        "canvas": canvas,
        "render": {
            "curve_handle_ratio": float(state.render_overrides.get("curve_handle_ratio", render_cfg.get("curve_handle_ratio", 0.35))),
            "curve_handle_min": float(state.render_overrides.get("curve_handle_min", render_cfg.get("curve_handle_min", 24))),
            "curve_handle_max": float(state.render_overrides.get("curve_handle_max", render_cfg.get("curve_handle_max", 72))),
        },
        "simulation": {
            "alpha": state.simulation.alpha,
            "alpha_min": state.simulation.alpha_min,
            "tick_count": state.tick_count,
            "ticks_per_frame": int(sim_cfg.get("ticks_per_frame", 4)),
            "max_iterations": max_iterations,
            "settled": state.simulation.alpha < state.simulation.alpha_min or state.tick_count >= max_iterations,
            "params": _get_simulation_params(state),
        },
        "nodes": node_payloads,
        "links": link_payloads,
    }


def tick_force_state(state: ForcePreviewState, iterations: int | None = None) -> dict[str, Any]:
    sim_cfg = _simulation_config(state.spec)
    steps = int(iterations if iterations is not None else sim_cfg.get("ticks_per_frame", 4))
    steps = max(1, steps)
    max_iterations = int(sim_cfg.get("max_iterations", 300))
    remaining = max(0, max_iterations - state.tick_count)
    if remaining == 0 or state.simulation.alpha < state.simulation.alpha_min:
        return get_force_snapshot(state)

    actual_steps = min(steps, remaining)
    state.simulation.tick(actual_steps)
    state.tick_count += actual_steps
    return get_force_snapshot(state)


def export_force_snapshot(state: ForcePreviewState) -> dict[str, Any]:
    return get_force_snapshot(state, snap=True)


def update_force_node(
    state: ForcePreviewState,
    node_id: str,
    *,
    pinned: bool | None = None,
    x: float | None = None,
    y: float | None = None,
    style: object = STYLE_UNSET,
) -> dict[str, Any]:
    _apply_force_node_update(state, node_id, pinned=pinned, x=x, y=y, style=style, reheat=True)

    return get_force_snapshot(state)