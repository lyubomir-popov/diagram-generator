"""
Export AWS High Level Design diagram to draw.io format.

Full content transfer from complex-tests/1.jpg including:
- Complete legend with all 11 AWS icon types
- Service panels with internal structure
- Transit Gateway hub with annotations
- VPC accounts with subnet columns
- OUs with environment tiles
- All connection annotations
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

import diagram_shared as svg
import drawio_style_tokens as dg_tokens
from export_drawio_batch import (
    DrawioBuilder,
    add_box,
    add_label,
    add_plain_rect,
    add_image,
    edge_style,
    icon_uri,
    rect_style,
)


def add_legend_item(
    builder: DrawioBuilder,
    *,
    x: float,
    y: float,
    label: str,
    icon_name: str | None = None,
    parent: str = "1",
) -> None:
    """Add a legend item with icon and label."""
    if icon_name:
        add_image(
            builder,
            x=x,
            y=y,
            width=20,
            height=20,
            image_uri=icon_uri(icon_name),
            parent=parent,
        )
    add_label(
        builder,
        x=x + 24,
        y=y + 2,
        width=100,
        height=16,
        lines=[svg.make_line(label, size="11")],
        parent=parent,
    )


def add_subnet_column(
    builder: DrawioBuilder,
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    label: str,
    fill: str,
    parent: str = "1",
) -> str:
    """Add a subnet column with header."""
    col = add_plain_rect(
        builder,
        x=x,
        y=y,
        width=width,
        height=height,
        fill=fill,
        parent=parent,
    )
    add_label(
        builder,
        x=2,
        y=2,
        width=width - 4,
        height=14,
        lines=[svg.make_line(label, size="8", weight="700")],
        parent=col,
        align="center",
    )
    return col


def add_vpc_account_panel(
    builder: DrawioBuilder,
    *,
    x: float,
    y: float,
    name: str,
    parent: str = "1",
) -> str:
    """Add a VPC account panel with subnet columns."""
    width = 220
    height = 100
    
    panel = add_plain_rect(
        builder,
        x=x,
        y=y,
        width=width,
        height=height,
        fill=svg.WHITE,
        parent=parent,
    )
    
    # Title row
    add_label(
        builder,
        x=4,
        y=4,
        width=width - 48,
        height=16,
        lines=[svg.make_line(name, size="10", weight="700")],
        parent=panel,
    )
    
    # Systems Manager icon (top right)
    add_image(
        builder,
        x=width - 28,
        y=4,
        width=24,
        height=24,
        image_uri=icon_uri("Operations.svg"),  # closest to Systems Manager
        parent=panel,
    )
    
    # IGW label (left side)
    add_label(
        builder,
        x=4,
        y=24,
        width=20,
        height=12,
        lines=[svg.make_line("IGW", size="8")],
        parent=panel,
    )
    
    # Subnet columns
    col_width = 32
    col_height = 56
    col_y = 36
    col_start_x = 28
    col_gap = 2
    
    subnet_cols = [
        ("public", svg.WHITE),
        ("private", svg.WHITE),
        ("non-live", svg.GREY),
        ("live-data", svg.GREY),
        ("data", svg.GREY),
        ("TGW", svg.WHITE),
    ]
    
    for i, (label, fill) in enumerate(subnet_cols):
        add_subnet_column(
            builder,
            x=col_start_x + i * (col_width + col_gap),
            y=col_y,
            width=col_width,
            height=col_height,
            label=label,
            fill=fill,
            parent=panel,
        )
    
    # Certificate Authority icon (bottom)
    add_image(
        builder,
        x=width // 2 - 12,
        y=height - 20,
        width=16,
        height=16,
        image_uri=icon_uri("Key.svg"),  # CA icon
        parent=panel,
    )
    
    return panel


def add_ou_panel(
    builder: DrawioBuilder,
    *,
    x: float,
    y: float,
    name: str,
    environments: list[str],
    has_ram: bool = False,
    has_ssh: bool = False,
    parent: str = "1",
) -> str:
    """Add an OU panel with environment tiles."""
    env_count = len(environments)
    tile_width = 56
    tile_gap = 4
    width = max(120, tile_width * env_count + tile_gap * (env_count - 1) + 16)
    height = 72 + (16 if has_ram or has_ssh else 0)
    
    panel = add_plain_rect(
        builder,
        x=x,
        y=y,
        width=width,
        height=height,
        fill=svg.WHITE,
        parent=parent,
    )
    
    # OU icon (folder-like)
    add_image(
        builder,
        x=4,
        y=4,
        width=20,
        height=20,
        image_uri=icon_uri("Document management.svg"),
        parent=panel,
    )
    
    # OU name
    add_label(
        builder,
        x=28,
        y=6,
        width=width - 32,
        height=16,
        lines=[svg.make_line(name, size="11", weight="700")],
        parent=panel,
    )
    
    # Environment tiles
    tile_y = 28
    for i, env in enumerate(environments):
        tile = add_plain_rect(
            builder,
            x=8 + i * (tile_width + tile_gap),
            y=tile_y,
            width=tile_width,
            height=32,
            fill=svg.GREY,
            parent=panel,
        )
        add_label(
            builder,
            x=2,
            y=8,
            width=tile_width - 4,
            height=16,
            lines=[svg.make_line(env, size="9")],
            parent=tile,
            align="center",
        )
    
    # RAM/SSH labels if present
    label_y = 64
    if has_ram:
        add_label(
            builder,
            x=8,
            y=label_y,
            width=40,
            height=12,
            lines=[svg.make_line("RAM", size="9", fill=svg.HELPER)],
            parent=panel,
        )
    if has_ssh:
        add_label(
            builder,
            x=52,
            y=label_y,
            width=40,
            height=12,
            lines=[svg.make_line("SSH", size="9", fill=svg.HELPER)],
            parent=panel,
        )
    
    return panel


def add_service_panel(
    builder: DrawioBuilder,
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    name: str,
    icon_name: str | None = None,
    fill: str = svg.WHITE,
    parent: str = "1",
) -> str:
    """Add a service panel container."""
    panel = add_plain_rect(
        builder,
        x=x,
        y=y,
        width=width,
        height=height,
        fill=fill,
        parent=parent,
    )
    
    # AWS account icon (top left)
    add_image(
        builder,
        x=4,
        y=4,
        width=24,
        height=24,
        image_uri=icon_uri("Cloud.svg"),
        parent=panel,
    )
    
    # Title
    add_label(
        builder,
        x=32,
        y=8,
        width=width - 40,
        height=20,
        lines=[svg.make_line(name, weight="700")],
        parent=panel,
    )
    
    if icon_name:
        add_image(
            builder,
            x=width - 32,
            y=4,
            width=24,
            height=24,
            image_uri=icon_uri(icon_name),
            parent=panel,
        )
    
    return panel


def export_aws_hld() -> None:
    """Export the AWS High Level Design diagram with full content."""
    page_width = 1600
    page_height = 1000
    
    builder = DrawioBuilder(
        name="AWS-HLD",
        diagram_id="aws-hld",
        page_width=page_width,
        page_height=page_height,
    )
    
    # === LEGEND / KEY ===
    legend_x = 16
    legend_y = 16
    legend_width = 140
    legend_height = 380
    
    legend = add_plain_rect(
        builder,
        x=legend_x,
        y=legend_y,
        width=legend_width,
        height=legend_height,
        fill=svg.WHITE,
        dashed=True,
    )
    
    add_label(
        builder,
        x=8,
        y=4,
        width=legend_width - 16,
        height=20,
        lines=[svg.make_line("Key:", weight="700", size="14")],
        parent=legend,
    )
    
    # Legend items - actual AWS service names from image
    legend_items = [
        ("Transit Gateway", "Gateway.svg"),
        ("AWS account", "Cloud.svg"),
        ("Route Table", "Document.svg"),
        ("OU", "Document management.svg"),
        ("VPN", "Lock.svg"),
        ("Private Link", "Integration.svg"),
        ("Route 53", "Globe.svg"),
        ("Systems Manager", "Operations.svg"),
        ("Subnet", "Network.svg"),
        ("NAT", "Gateway.svg"),
        ("Certificate Authority", "Key.svg"),
    ]
    
    item_y = 28
    for label, icon in legend_items:
        add_legend_item(
            builder,
            x=8,
            y=item_y,
            label=label,
            icon_name=icon,
            parent=legend,
        )
        item_y += 30
    
    # === TITLE: AWS Organisations ===
    title_x = page_width // 2 - 80
    add_image(
        builder,
        x=title_x,
        y=16,
        width=32,
        height=32,
        image_uri=icon_uri("Cloud.svg"),
    )
    add_label(
        builder,
        x=title_x + 40,
        y=20,
        width=160,
        height=24,
        lines=[svg.make_line("AWS Organisations", weight="700")],
    )
    
    # === TOP SERVICE PANELS ROW ===
    panels_y = 64
    panel_height = 120
    panel_gap = 12
    panels_start_x = 180
    
    # Modernisation
    mod_width = 160
    modernisation = add_service_panel(
        builder,
        x=panels_start_x,
        y=panels_y,
        width=mod_width,
        height=panel_height,
        name="Modernisation",
        fill=svg.GREY,
    )
    
    # Core (wider, contains Logging + Network Services)
    core_x = panels_start_x + mod_width + panel_gap
    core_width = 400
    core = add_service_panel(
        builder,
        x=core_x,
        y=panels_y,
        width=core_width,
        height=panel_height,
        name="Core",
        fill=svg.WHITE,
    )
    
    # Logging sub-panel inside Core
    add_box(
        builder,
        x=8,
        y=36,
        width=180,
        height=72,
        fill=svg.GREY,
        lines=[svg.make_line("Logging")],
        icon_name="Document.svg",
        parent=core,
        connectable=False,
    )
    
    # Network Services sub-panel inside Core
    net_svc = add_plain_rect(
        builder,
        x=196,
        y=36,
        width=196,
        height=72,
        fill=svg.GREY,
        parent=core,
    )
    add_label(
        builder,
        x=4,
        y=4,
        width=140,
        height=16,
        lines=[svg.make_line("Network Services", weight="700", size="12")],
        parent=net_svc,
    )
    # VPC box
    add_plain_rect(builder, x=8, y=24, width=56, height=20, fill=svg.WHITE, parent=net_svc)
    add_label(builder, x=12, y=26, width=48, height=16, lines=[svg.make_line("VPC", size="10")], parent=net_svc)
    # NAT gateway
    add_label(builder, x=72, y=28, width=60, height=12, lines=[svg.make_line("NAT gateway", size="8")], parent=net_svc)
    # inspect
    add_plain_rect(builder, x=8, y=48, width=56, height=20, fill=svg.WHITE, parent=net_svc)
    add_label(builder, x=12, y=50, width=48, height=16, lines=[svg.make_line("inspect", size="10")], parent=net_svc)
    
    # Security
    security_x = core_x + core_width + panel_gap
    security_width = 160
    security = add_service_panel(
        builder,
        x=security_x,
        y=panels_y,
        width=security_width,
        height=panel_height,
        name="Security",
        icon_name="Security.svg",
        fill=svg.GREY,
    )
    
    # Shared-services
    shared_x = security_x + security_width + panel_gap
    shared_width = 180
    shared = add_service_panel(
        builder,
        x=shared_x,
        y=panels_y,
        width=shared_width,
        height=panel_height,
        name="Shared-services",
        icon_name="Cloud support.svg",
        fill=svg.GREY,
    )
    
    # === TRANSIT GATEWAY HUB ===
    hub_y = panels_y + panel_height + 40
    hub_x = page_width // 2 - 96
    
    hub = add_box(
        builder,
        x=hub_x,
        y=hub_y,
        width=192,
        height=64,
        fill=svg.WHITE,
        lines=[svg.make_line("Transit Gateway")],
        icon_name="Gateway.svg",
    )
    
    # live/non-live RT annotation
    add_label(
        builder,
        x=hub_x + 200,
        y=hub_y + 8,
        width=100,
        height=16,
        lines=[svg.make_line("live/non-live RT", size="10", fill=svg.HELPER)],
    )
    
    # CA icon and label below hub
    add_image(
        builder,
        x=hub_x + 72,
        y=hub_y + 72,
        width=24,
        height=24,
        image_uri=icon_uri("Key.svg"),
    )
    add_label(
        builder,
        x=hub_x + 100,
        y=hub_y + 76,
        width=120,
        height=16,
        lines=[svg.make_line("Certificate Authority", size="10")],
    )
    
    # VPN attachment annotation
    add_label(
        builder,
        x=hub_x - 160,
        y=hub_y + 24,
        width=150,
        height=32,
        lines=[
            svg.make_line("VPN attachments are", size="9", fill=svg.HELPER),
            svg.make_line("associated with external", size="9", fill=svg.HELPER),
            svg.make_line("route table", size="9", fill=svg.HELPER),
        ],
    )
    
    # === VPC_ACCOUNTS SECTION ===
    vpc_section_y = hub_y + 120
    vpc_section_x = 180
    vpc_section_width = 960
    vpc_section_height = 140
    
    vpc_section = add_plain_rect(
        builder,
        x=vpc_section_x,
        y=vpc_section_y,
        width=vpc_section_width,
        height=vpc_section_height,
        fill=svg.GREY,
        dashed=True,
    )
    
    add_label(
        builder,
        x=8,
        y=4,
        width=120,
        height=20,
        lines=[svg.make_line("VPC_Accounts", weight="700", size="12")],
        parent=vpc_section,
    )
    
    # VPC account panels
    vpc_names = [
        "core-vpc-production",
        "core-vpc-preproduction",
        "core-vpc-test",
        "core-vpc-development",
    ]
    
    vpc_panel_width = 220
    vpc_gap = 12
    vpc_start_x = 12
    
    for i, name in enumerate(vpc_names):
        add_vpc_account_panel(
            builder,
            x=vpc_start_x + i * (vpc_panel_width + vpc_gap),
            y=28,
            name=name,
            parent=vpc_section,
        )
    
    # core-vpc-sandbox (separate, to the right)
    sandbox_x = vpc_section_x + vpc_section_width + 24
    sandbox = add_vpc_account_panel(
        builder,
        x=sandbox_x,
        y=vpc_section_y + 28,
        name="core-vpc-sandbox",
    )
    
    # Customer Gateway label
    add_label(
        builder,
        x=sandbox_x + 40,
        y=vpc_section_y + 136,
        width=120,
        height=16,
        lines=[svg.make_line("Customer Gateway", size="10")],
    )
    
    # vpc attachment annotation
    add_label(
        builder,
        x=vpc_section_x + vpc_section_width + 4,
        y=vpc_section_y + 4,
        width=80,
        height=16,
        lines=[svg.make_line("vpc attachment", size="9", fill=svg.HELPER)],
    )
    
    # === ORGANIZATIONAL UNITS ===
    ou_y = vpc_section_y + vpc_section_height + 32
    ou_gap = 16
    
    ous = [
        ("OU: MaatDB", ["production", "development"], True, False),
        ("OU: Nomis", ["production", "preproduction", "test"], False, True),
        ("OU: Oasys", ["production", "test"], False, False),
        ("OU: CCR", ["production", "development"], True, True),
    ]
    
    ou_x = 180
    for name, envs, has_ram, has_ssh in ous:
        ou_panel = add_ou_panel(
            builder,
            x=ou_x,
            y=ou_y,
            name=name,
            environments=envs,
            has_ram=has_ram,
            has_ssh=has_ssh,
        )
        # Calculate width for next position
        tile_width = 56
        tile_gap = 4
        env_count = len(envs)
        panel_width = max(120, tile_width * env_count + tile_gap * (env_count - 1) + 16)
        ou_x += panel_width + ou_gap
    
    # === CONNECTORS ===
    # Services to Transit Gateway
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.25, entry_y=0),
        source=modernisation,
        target=hub,
    )
    
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
        source=core,
        target=hub,
    )
    
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.75, entry_y=0),
        source=security,
        target=hub,
    )
    
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=1, entry_y=0.5),
        source=shared,
        target=hub,
    )
    
    # Hub to VPC section
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
        source=hub,
        target=vpc_section,
    )
    
    # VPC section to sandbox (dashed for VPN)
    builder.add_edge(
        style=edge_style(svg.ORANGE, dashed=True, exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
        source=vpc_section,
        target=sandbox,
    )
    
    # Write output
    output_path = svg.DRAWIO_DIR / "aws-hld-onbrand.drawio"
    builder.write(output_path)
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    export_aws_hld()
