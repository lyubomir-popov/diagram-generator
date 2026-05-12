"""Declarative redraw for the controller agent architecture sketch."""

from __future__ import annotations

from diagram_model import Annotation, Arrow, Box, BoxStyle, Diagram, Fill, Line


HELPER = "#666666"


def _body(text: str, **kw) -> Line:
    return Line(text, **kw)


def _heading(text: str, fill: str = "#000000") -> Line:
    return Line(text, weight="700", fill=fill)


def _helper(text: str) -> Line:
    return Line(text, fill=HELPER)


controller_agent_architecture = Diagram(
    title="Controller agent architecture",
    arrangement=Diagram.Arrangement.GRID,
    cols=6,
    col_width=192,
    row_height=64,
    col_gap=24,
    row_gap=24,
    outer_margin=24,
    components=[
        Annotation(
            id="host_scope",
            lines=[
                _helper("Your computer"),
                _helper("Multipass VM"),
                _helper("Machine (Kubernetes node, not managed by Juju)"),
            ],
            col=0,
            row=0,
            col_span=3,
        ),
        Box(
            id="cloud_provider",
            label=[_body("Cloud Provider")],
            fill=Fill.GREY,
            col=4,
            row=0,
        ),
        Annotation(
            id="resource_note",
            lines=[
                _helper("Manages resources"),
                _helper("(compute, storage,"),
                _helper("networking) from"),
            ],
            col=5,
            row=1,
        ),
        Annotation(
            id="controller_unit_scope",
            lines=[
                _helper("Controller unit (Kubernetes pod)"),
                _helper("Charm container 1"),
            ],
            col=0,
            row=2,
            col_span=3,
        ),
        Annotation(
            id="workload_scope",
            lines=[
                _helper("Controller model (Kubernetes namespace)"),
                _helper("Workload container 1"),
            ],
            col=3,
            row=2,
            col_span=1,
        ),
        Annotation(
            id="database_scope",
            lines=[_helper("Database container")],
            col=5,
            row=6,
        ),
        Annotation(
            id="api_unit_note",
            lines=[_helper("Makes API"), _helper("calls to")],
            col=3,
            row=4,
        ),
        Box(
            id="pebble_charm",
            label=[_body("Pebble - charm")],
            fill=Fill.GREY,
            col=0,
            row=3,
        ),
        Box(
            id="unit_agent",
            label=[_heading("Unit Agent")],
            fill=Fill.WHITE,
            col=1,
            row=3,
        ),
        Box(
            id="charm",
            label=[_body("Charm")],
            fill=Fill.GREY,
            col=2,
            row=3,
        ),
        Box(
            id="pebble_workload",
            label=[_body("Pebble - workload")],
            fill=Fill.GREY,
            col=3,
            row=3,
            col_span=1,
        ),
        Annotation(
            id="progress_note",
            lines=[
                _helper("Progresses"),
                _helper("the unit's"),
                _helper("state by"),
                _helper("executing"),
            ],
            col=1,
            row=4,
        ),
        Annotation(
            id="reads_note",
            lines=[_helper("Reads from"), _helper("and writes to")],
            col=5,
            row=4,
        ),
        Box(
            id="model_agent",
            label=[
                _body("Model Agent"),
                _helper("one for each model"),
                _helper("on the controller"),
            ],
            fill=Fill.WHITE,
            col=3,
            row=5,
        ),
        Box(
            id="controller_agent",
            label=[_heading("Controller Agent", fill="#FFFFFF")],
            style=BoxStyle.HIGHLIGHT,
            col=4,
            row=5,
        ),
        Box(
            id="database",
            label=[_body("Database")],
            fill=Fill.GREY,
            col=5,
            row=5,
        ),
        Annotation(
            id="modeloperator_scope",
            lines=[_helper("Modeloperator (Kubernetes pod)")],
            col=0,
            row=7,
            col_span=3,
        ),
        Annotation(
            id="api_modeloperator_note",
            lines=[_helper("Makes API"), _helper("calls to")],
            col=2,
            row=7,
        ),
        Box(
            id="additional_model_functionality",
            label=[_body("Additional model"), _body("functionality")],
            fill=Fill.WHITE,
            col=3,
            row=7,
        ),
        Annotation(
            id="api_client_note",
            lines=[_helper("Makes API"), _helper("calls to")],
            col=2,
            row=9,
        ),
        Box(
            id="client",
            label=[_body("Client")],
            fill=Fill.WHITE,
            col=2,
            row=10,
        ),
        Annotation(
            id="charmhub_note",
            lines=[_helper("Manages charms from")],
            col=3,
            row=11,
        ),
        Box(
            id="charmhub",
            label=[_body("Charmhub")],
            fill=Fill.GREY,
            col=4,
            row=11,
        ),
        Annotation(
            id="external_scope",
            lines=[_helper("Someone else's computer")],
            col=4,
            row=12,
        ),
        Arrow(source="pebble_charm.right", target="unit_agent.left"),
        Arrow(source="unit_agent.right", target="charm.left"),
        Arrow(source="charm.right", target="pebble_workload.left"),
        Arrow(source="pebble_workload.bottom", target="controller_agent.top"),
        Arrow(source="model_agent.right", target="controller_agent.left"),
        Arrow(source="controller_agent.right", target="database.left"),
        Arrow(source="additional_model_functionality.top", target="controller_agent.bottom"),
        Arrow(source="client.right", target="controller_agent.left"),
        Arrow(source="controller_agent.top", target="cloud_provider.bottom"),
        Arrow(source="controller_agent.bottom", target="charmhub.top"),
    ],
)
