"""AWS high level design – cloud infrastructure topology.

Declarative definition using the diagram model.

Grid derivation (5 columns):
  Cols 0, 3, 4 grow to 208 from single-span panels (192 + 2 × INSET).
  Cols 1, 2 stay 192 (only multi-span Core or standard boxes).
  Total = 208 + 192 + 192 + 208 + 208 = 1008, + 4 × 32 = 1136.

VPC_Accounts (col_span=5):
  Cell = 1136, content = 1136 − 16 = 1120.
  5 sub-panels + 4 × 32 → sp_outer = (1120 − 128) / 5 ≈ 200.
  sp col_width = 200 − 16 = 184. → set 180 for safety margin.

Core (col_span=2):
  Cell = 192 + 192 + 32 = 416, content = 416 − 16 = 400.
  2 sub-panels + 32 → sp_outer = (400 − 32) / 2 = 184.
  sp col_width = 184 − 16 = 168.

OUs wrapper (borderless, col_span=5):
  Cell = 1136, content = 1136 (pad=0).
  4 sub-panels + 3 × 32 → sp_outer = (1136 − 96) / 4 = 260.
  sp col_width = 260 − 16 = 244. → set 240 for safety.
"""

from __future__ import annotations

from diagram_model import (
    Annotation,
    Arrow,
    Border,
    Box,
    Diagram,
    Fill,
    Line,
    Panel,
)
from diagram_shared import HELPER as HELPER_COLOR


def _body(text: str, **kw) -> Line:
    return Line(text, **kw)


def _heading(text: str) -> Line:
    return Line(text, weight="700")


def _helper(text: str) -> Line:
    return Line(text, fill=HELPER_COLOR)


aws_hld = Diagram(
    title="AWS high level design",
    arrangement=Diagram.Arrangement.GRID,
    cols=5,
    # col_gap and row_gap default to GRID_GUTTER (32)
    outer_margin=32,
    components=[
        # ── Row 0: title ──
        Box(
            id="title",
            label=[
                _heading("AWS Organisations"),
                _body("High Level Design"),
            ],
            icon="Cloud.svg",
            col=0, row=0, col_span=5,
        ),

        # ── Row 1: service account panels ──
        Panel(
            id="modernisation",
            heading=_heading("Modernisation"),
            icon="Cloud.svg",
            fill=Fill.GREY,
            cols=1,
            row_gap=8,
            col=0, row=1,
            children=[
                Box(label=[_body("LZ")]),
            ],
        ),

        # Core spans 2 columns; contains Logging + Network Services.
        # Cell = 192 + 192 + 32 = 416. Content = 416 − 16 = 400.
        # Two sub-panels + 32px gap → sp_outer = (400 − 32) / 2 = 184.
        # Sub-panel col_width = 184 − 16 = 168.
        Panel(
            id="core",
            heading=_heading("Core"),
            icon="Cloud.svg",
            fill=Fill.WHITE,
            col_gap=32,
            col=1, row=1, col_span=2,
            children=[
                Panel(
                    id="logging",
                    heading=_heading("Logging"),
                    icon="Document.svg",
                    fill=Fill.GREY,
                    cols=1,
                    col_width=168,
                    row_gap=8,
                    children=[
                        Box(label=[
                            _body("Subnets: public,"),
                            _body("non-live, live-data"),
                        ], row=0),
                        Box(label=[_body("TGW")], row=1),
                    ],
                ),
                Panel(
                    id="network_svc",
                    heading=_heading("Network Services"),
                    icon="Networking.svg",
                    fill=Fill.GREY,
                    cols=1,
                    col_width=168,
                    row_gap=8,
                    children=[
                        Box(label=[_body("VPC")], icon="Network.svg", row=0),
                        Box(label=[_body("NAT gateway")], icon="Gateway.svg", row=1),
                    ],
                ),
            ],
        ),

        Panel(
            id="security",
            heading=_heading("Security"),
            icon="Security.svg",
            fill=Fill.GREY,
            cols=1,
            row_gap=8,
            col=3, row=1,
            children=[
                Box(label=[
                    _body("Subnets: public,"),
                    _body("non-live, live-data"),
                ], row=0),
                Box(label=[_body("TGW")], row=1),
            ],
        ),

        Panel(
            id="shared_svc",
            heading=_heading("Shared-services"),
            icon="Cloud support.svg",
            fill=Fill.GREY,
            cols=1,
            row_gap=8,
            col=4, row=1,
            children=[
                Box(label=[
                    _body("Subnets: public,"),
                    _body("non-live, live-data"),
                ], row=0),
                Box(label=[_body("TGW")], row=1),
            ],
        ),

        # Arrows: service panels → Transit Gateway
        Arrow(source="modernisation.bottom", target="tgw.top"),
        Arrow(source="core.bottom", target="tgw.top"),
        Arrow(source="security.bottom", target="tgw.top"),
        Arrow(source="shared_svc.bottom", target="tgw.top"),

        # ── Row 2: Transit Gateway hub area ──
        Annotation(
            id="vpn_note",
            lines=[
                _helper("VPN attachments are"),
                _helper("associated with"),
                _helper("external route table"),
            ],
            col=0, row=2,
        ),

        Box(
            id="ca",
            label=[_body("Certificate"), _body("Authority")],
            icon="Key.svg",
            col=1, row=2,
        ),

        Box(
            id="tgw",
            label=[_body("Transit Gateway"), _body("live/non-live RT")],
            icon="Gateway.svg",
            col=2, row=2,
        ),

        Annotation(
            lines=[_helper("vpc attachment")],
            col=3, row=2,
        ),

        Box(
            id="customer_gw",
            label=[_body("Customer"), _body("Gateway")],
            icon="Gateway.svg",
            col=4, row=2,
        ),

        # TGW connections
        Arrow(source="tgw.left", target="ca.right"),
        Arrow(source="tgw.right", target="customer_gw.left"),
        Arrow(source="tgw.bottom", target="vpc_accounts.top"),

        # ── Row 3: VPC accounts (dashed wrapper) ──
        # Cell = 1136. Content = 1136 − 16 = 1120.
        # 5 sub-panels + 4 × 32 → sp_outer = (1120 − 128) / 5 ≈ 198 → 196.
        # col_width = 196 − 16 = 180.
        Panel(
            id="vpc_accounts",
            heading=_heading("VPC_Accounts"),
            icon="Document management.svg",
            border=Border.DASHED,
            fill=Fill.WHITE,
            col_width=180,
            col_gap=32,
            col=0, row=3, col_span=5,
            children=[
                Panel(
                    id="vpc_prod",
                    heading=_heading("core-vpc-production"),
                    fill=Fill.GREY,
                    cols=1,
                    col_width=180,
                    row_gap=8,
                    children=[
                        Box(label=[_body("VPC per"), _body("business unit")], row=0),
                        Box(label=[_body("IGW")], icon="Globe.svg", row=1),
                    ],
                ),
                Panel(
                    id="vpc_preprod",
                    heading=_heading("core-vpc-preprod"),
                    fill=Fill.GREY,
                    cols=1,
                    col_width=180,
                    row_gap=8,
                    children=[
                        Box(label=[_body("VPC per"), _body("business unit")]),
                    ],
                ),
                Panel(
                    id="vpc_test",
                    heading=_heading("core-vpc-test"),
                    fill=Fill.GREY,
                    cols=1,
                    col_width=180,
                    row_gap=8,
                    children=[
                        Box(label=[_body("VPC per"), _body("business unit")]),
                    ],
                ),
                Panel(
                    id="vpc_dev",
                    heading=_heading("core-vpc-dev"),
                    fill=Fill.GREY,
                    cols=1,
                    col_width=180,
                    row_gap=8,
                    children=[
                        Box(label=[_body("VPC per"), _body("business unit")]),
                    ],
                ),
                Panel(
                    id="vpc_sandbox",
                    heading=_heading("core-vpc-sandbox"),
                    fill=Fill.GREY,
                    cols=1,
                    col_width=180,
                    row_gap=8,
                    children=[
                        Box(label=[_body("VPC per"), _body("business unit")]),
                    ],
                ),
            ],
        ),

        # VPC → OU arrows
        Arrow(source="vpc_prod.bottom", target="ou_maatdb.top"),
        Arrow(source="vpc_preprod.bottom", target="ou_nomis.top"),
        Arrow(source="vpc_test.bottom", target="ou_oasys.top"),
        Arrow(source="vpc_dev.bottom", target="ou_ccr.top"),

        # ── Row 4: organisational units (borderless wrapper) ──
        # 4 sub-panels matching VPC col_width=180 for vertical alignment.
        Panel(
            id="ous_wrapper",
            border=Border.NONE,
            fill=Fill.WHITE,
            col_gap=32,
            col=0, row=4, col_span=5,
            children=[
                Panel(
                    id="ou_maatdb",
                    heading=_heading("OU: MaatDB"),
                    icon="Document management.svg",
                    fill=Fill.WHITE,
                    cols=1,
                    col_width=180,
                    row_gap=8,
                    children=[
                        Box(label=[_body("production")], fill=Fill.GREY, row=0),
                        Box(label=[_body("development")], fill=Fill.GREY, row=1),
                    ],
                ),
                Panel(
                    id="ou_nomis",
                    heading=_heading("OU: Nomis"),
                    icon="Document management.svg",
                    fill=Fill.WHITE,
                    cols=1,
                    col_width=180,
                    row_gap=8,
                    children=[
                        Box(label=[_body("production")], fill=Fill.GREY, row=0),
                        Box(label=[_body("preproduction")], fill=Fill.GREY, row=1),
                        Box(label=[_body("test")], fill=Fill.GREY, row=2),
                    ],
                ),
                Panel(
                    id="ou_oasys",
                    heading=_heading("OU: Oasys"),
                    icon="Document management.svg",
                    fill=Fill.WHITE,
                    cols=1,
                    col_width=180,
                    row_gap=8,
                    children=[
                        Box(label=[_body("production")], fill=Fill.GREY, row=0),
                        Box(label=[_body("test")], fill=Fill.GREY, row=1),
                    ],
                ),
                Panel(
                    id="ou_ccr",
                    heading=_heading("OU: CCR"),
                    icon="Document management.svg",
                    fill=Fill.WHITE,
                    cols=1,
                    col_width=180,
                    row_gap=8,
                    children=[
                        Box(label=[_body("production")], fill=Fill.GREY, row=0),
                        Box(label=[_body("development")], fill=Fill.GREY, row=1),
                    ],
                ),
            ],
        ),

        # ── Row 5: Key (horizontal legend) ──
        Annotation(
            lines=[
                _helper("Key: Transit Gateway · AWS account · Route Table ·"),
                _helper("OU · VPN · Private Link · Route 53 ·"),
                _helper("Systems Manager · Subnet · NAT · Certificate Authority"),
            ],
            col=0, row=5, col_span=5,
        ),
    ],
)
