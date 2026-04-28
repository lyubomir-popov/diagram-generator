"""Example: deployment pipeline – simple vertical flow.

A generic CI/CD pipeline flow for demonstration purposes.
Shows the basic Box + Arrow pattern with a vertical arrangement.
"""

from __future__ import annotations

from diagram_model import (
    Arrow,
    Box,
    Diagram,
    Fill,
    Line,
)


def _body(text: str, **kw) -> Line:
    return Line(text, **kw)


example_deployment_pipeline = Diagram(
    title="Deployment pipeline",
    arrangement=Diagram.Arrangement.GRID,
    cols=1,
    col_width=192,
    row_height=64,
    col_gap=32,
    row_gap=32,
    outer_margin=32,
    components=[
        Box(id="commit", label=[_body("Developer"), _body("commit")],
            icon="Laptop with code.svg", col=0, row=0),

        Box(id="build", label=[_body("Build &"), _body("lint")],
            fill=Fill.GREY, icon="Package.svg", col=0, row=1),

        Box(id="test", label=[_body("Automated"), _body("tests")],
            fill=Fill.GREY, icon="Rosette with check.svg", col=0, row=2),

        Box(id="staging", label=[_body("Staging"), _body("environment")],
            fill=Fill.GREY, icon="Cloud.svg", col=0, row=3),

        Box(id="approval", label=[_body("Manual"), _body("approval")],
            icon="User management.svg", col=0, row=4),

        Box(id="production", label=[_body("Production"), _body("deploy")],
            fill=Fill.BLACK, icon="Server.svg", col=0, row=5),

        Arrow(source="commit.bottom", target="build.top"),
        Arrow(source="build.bottom", target="test.top"),
        Arrow(source="test.bottom", target="staging.top"),
        Arrow(source="staging.bottom", target="approval.top"),
        Arrow(source="approval.bottom", target="production.top"),
    ],
)
