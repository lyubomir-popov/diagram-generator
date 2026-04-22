"""
Export Layer 3 IP/MPLS network diagram to draw.io format.

Full content transfer from complex-tests/2.jpg including:
- Cloud providers (Bell, AT&T) with router icons
- Central hub with OC-12 connections
- Four network zones with all router/switch devices and IPs
- Server racks with hostnames and port IDs
- Connection types (T1, T3, OC-12)
- Bottom metadata
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
)


def add_router_device(
    builder: DrawioBuilder,
    *,
    x: float,
    y: float,
    hostname: str,
    ip: str,
    parent: str = "1",
) -> str:
    """Add a router/switch device with hostname and IP."""
    width = 80
    height = 72
    
    device = add_plain_rect(
        builder,
        x=x,
        y=y,
        width=width,
        height=height,
        fill="none",
        stroke="none",
        parent=parent,
    )
    
    add_image(
        builder,
        x=(width - 32) // 2,
        y=0,
        width=32,
        height=32,
        image_uri=icon_uri("Network.svg"),
        parent=device,
    )
    
    add_label(
        builder,
        x=0,
        y=34,
        width=width,
        height=14,
        lines=[svg.make_line(hostname, size="8", weight="700")],
        parent=device,
        align="center",
    )
    
    add_label(
        builder,
        x=0,
        y=48,
        width=width,
        height=12,
        lines=[svg.make_line(ip, size="7", fill=svg.HELPER)],
        parent=device,
        align="center",
    )
    
    return device


def add_server_rack(
    builder: DrawioBuilder,
    *,
    x: float,
    y: float,
    hostname: str,
    port_id: str,
    parent: str = "1",
) -> str:
    """Add a server rack with hostname and port ID."""
    width = 88
    height = 64
    
    rack = add_plain_rect(
        builder,
        x=x,
        y=y,
        width=width,
        height=height,
        fill="none",
        stroke="none",
        parent=parent,
    )
    
    add_image(
        builder,
        x=(width - 32) // 2,
        y=0,
        width=32,
        height=32,
        image_uri=icon_uri("Server.svg"),
        parent=rack,
    )
    
    add_label(
        builder,
        x=0,
        y=34,
        width=width,
        height=12,
        lines=[svg.make_line(hostname, size="7")],
        parent=rack,
        align="center",
    )
    
    add_label(
        builder,
        x=0,
        y=48,
        width=width,
        height=10,
        lines=[svg.make_line(port_id, size="6", fill=svg.HELPER)],
        parent=rack,
        align="center",
    )
    
    return rack


def add_cloud_provider(
    builder: DrawioBuilder,
    *,
    x: float,
    y: float,
    name: str,
    routers: list[tuple[str, str]],  # (hostname, ip) pairs
    parent: str = "1",
) -> str:
    """Add a cloud provider with multiple routers."""
    router_count = len(routers)
    width = max(140, 80 * router_count + 8)
    height = 120
    
    cloud = add_plain_rect(
        builder,
        x=x,
        y=y,
        width=width,
        height=height,
        fill=svg.GREY,
        parent=parent,
    )
    
    # Cloud icon
    add_image(
        builder,
        x=(width - 40) // 2,
        y=4,
        width=40,
        height=40,
        image_uri=icon_uri("Cloud.svg"),
        parent=cloud,
    )
    
    # Provider name
    add_label(
        builder,
        x=0,
        y=46,
        width=width,
        height=16,
        lines=[svg.make_line(name, weight="700", size="12")],
        parent=cloud,
        align="center",
    )
    
    # Router icons below
    router_width = 48
    router_gap = 8
    total_routers_width = router_count * router_width + (router_count - 1) * router_gap
    start_x = (width - total_routers_width) // 2
    
    for i, (hostname, ip) in enumerate(routers):
        rx = start_x + i * (router_width + router_gap)
        add_image(
            builder,
            x=rx,
            y=64,
            width=24,
            height=24,
            image_uri=icon_uri("Network.svg"),
            parent=cloud,
        )
        add_label(
            builder,
            x=rx - 8,
            y=90,
            width=40,
            height=10,
            lines=[svg.make_line(ip, size="6", fill=svg.HELPER)],
            parent=cloud,
            align="center",
        )
    
    return cloud


def add_zone(
    builder: DrawioBuilder,
    *,
    x: float,
    y: float,
    name: str,
    devices: list[tuple[str, str]],  # (hostname, ip) pairs
    parent: str = "1",
) -> str:
    """Add a network zone with router/switch devices."""
    width = 240
    height = 200
    
    zone = add_plain_rect(
        builder,
        x=x,
        y=y,
        width=width,
        height=height,
        fill=svg.GREY,
        parent=parent,
    )
    
    # Zone label at bottom
    add_label(
        builder,
        x=8,
        y=height - 24,
        width=width - 16,
        height=20,
        lines=[svg.make_line(name, weight="700")],
        parent=zone,
    )
    
    # Arrange devices in a grid pattern
    device_width = 72
    device_height = 64
    cols = 3
    rows = (len(devices) + cols - 1) // cols
    
    start_x = (width - cols * device_width) // 2
    start_y = 8
    
    for i, (hostname, ip) in enumerate(devices):
        row = i // cols
        col = i % cols
        dx = start_x + col * device_width
        dy = start_y + row * device_height
        
        add_image(
            builder,
            x=dx + 20,
            y=dy,
            width=32,
            height=32,
            image_uri=icon_uri("Network.svg"),
            parent=zone,
        )
        add_label(
            builder,
            x=dx,
            y=dy + 34,
            width=device_width,
            height=12,
            lines=[svg.make_line(hostname, size="7")],
            parent=zone,
            align="center",
        )
        add_label(
            builder,
            x=dx,
            y=dy + 46,
            width=device_width,
            height=10,
            lines=[svg.make_line(ip, size="6", fill=svg.HELPER)],
            parent=zone,
            align="center",
        )
    
    return zone


def export_layer3_mpls() -> None:
    """Export the Layer 3 IP/MPLS network diagram with full content."""
    page_width = 1400
    page_height = 1100
    
    builder = DrawioBuilder(
        name="Layer3-MPLS",
        diagram_id="layer3-mpls",
        page_width=page_width,
        page_height=page_height,
    )
    
    # === TITLE ===
    add_label(
        builder,
        x=page_width // 2 - 120,
        y=8,
        width=240,
        height=32,
        lines=[svg.make_line("Layer 3 - IP / MPLS", weight="700", size="24")],
        align="center",
    )
    
    # === CLOUD PROVIDERS ===
    cloud_y = 56
    
    # Bell cloud with routers
    bell_routers = [
        ("RTR-BE-01", "10.1.1.1"),
        ("RTR-BE-02", "10.1.1.2"),
    ]
    bell = add_cloud_provider(
        builder,
        x=page_width // 2 - 280,
        y=cloud_y,
        name="Bell",
        routers=bell_routers,
    )
    
    # AT&T cloud with routers
    att_routers = [
        ("RTR-AT-01", "10.2.1.1"),
        ("RTR-AT-02", "10.2.1.2"),
    ]
    att = add_cloud_provider(
        builder,
        x=page_width // 2 + 100,
        y=cloud_y,
        name="AT&T",
        routers=att_routers,
    )
    
    # === CENTRAL HUB ===
    hub_x = page_width // 2 - 60
    hub_y = 200
    hub_width = 120
    hub_height = 80
    
    hub = add_plain_rect(
        builder,
        x=hub_x,
        y=hub_y,
        width=hub_width,
        height=hub_height,
        fill=svg.WHITE,
    )
    
    add_image(
        builder,
        x=(hub_width - 48) // 2,
        y=8,
        width=48,
        height=48,
        image_uri=icon_uri("Hub.svg"),
        parent=hub,
    )
    
    add_label(
        builder,
        x=0,
        y=58,
        width=hub_width,
        height=16,
        lines=[svg.make_line("Core Hub", size="10", weight="700")],
        parent=hub,
        align="center",
    )
    
    # Connection type labels near hub
    add_label(builder, x=hub_x - 60, y=hub_y + 20, width=50, height=12, lines=[svg.make_line("OC-12", size="9", fill=svg.HELPER)])
    add_label(builder, x=hub_x + hub_width + 10, y=hub_y + 20, width=50, height=12, lines=[svg.make_line("OC-12", size="9", fill=svg.HELPER)])
    
    # === NETWORK ZONES ===
    zone_width = 240
    zone_height = 200
    zone_gap_h = 160
    zone_gap_v = 60
    
    zones_center_x = page_width // 2
    zones_center_y = 520
    
    # Zone NW3 (top-left)
    nw3_devices = [
        ("SW-NW3-01", "10.10.1.26"),
        ("SW-NW3-02", "10.10.1.30"),
        ("RTR-NW3-01", "10.10.1.41"),
        ("RTR-NW3-02", "10.10.1.46"),
        ("SW-NW3-03", "10.10.1.48"),
        ("RTR-NW3-03", "10.10.1.52"),
    ]
    zone_nw3 = add_zone(
        builder,
        x=zones_center_x - zone_width - zone_gap_h // 2,
        y=zones_center_y - zone_height - zone_gap_v // 2,
        name="ZONE NW3",
        devices=nw3_devices,
    )
    
    # Zone NE1 (top-right)
    ne1_devices = [
        ("SW-NE1-01", "10.10.2.103"),
        ("SW-NE1-02", "10.10.1.88"),
        ("RTR-NE1-01", "10.10.2.110"),
        ("RTR-NE1-02", "10.10.2.114"),
        ("SW-NE1-03", "10.10.2.121"),
    ]
    zone_ne1 = add_zone(
        builder,
        x=zones_center_x + zone_gap_h // 2,
        y=zones_center_y - zone_height - zone_gap_v // 2,
        name="ZONE NE1",
        devices=ne1_devices,
    )
    
    # Zone SW1 (bottom-left)
    sw1_devices = [
        ("SW-SW1-01", "10.10.3.15"),
        ("SW-SW1-02", "10.10.3.22"),
        ("RTR-SW1-01", "10.10.3.31"),
        ("RTR-SW1-02", "10.10.3.45"),
        ("SW-SW1-03", "10.10.3.58"),
    ]
    zone_sw1 = add_zone(
        builder,
        x=zones_center_x - zone_width - zone_gap_h // 2,
        y=zones_center_y + zone_gap_v // 2,
        name="ZONE SW1",
        devices=sw1_devices,
    )
    
    # Zone SE2 (bottom-right)
    se2_devices = [
        ("SW-SE2-01", "10.10.4.10"),
        ("SW-SE2-02", "10.10.4.18"),
        ("RTR-SE2-01", "10.10.4.25"),
        ("RTR-SE2-02", "10.10.4.33"),
        ("SW-SE2-03", "10.10.4.41"),
    ]
    zone_se2 = add_zone(
        builder,
        x=zones_center_x + zone_gap_h // 2,
        y=zones_center_y + zone_gap_v // 2,
        name="ZONE SE2",
        devices=se2_devices,
    )
    
    # === SERVER RACKS - LEFT SIDE ===
    left_racks = [
        ("Be-BH-IR204.0746", "4ka78n039"),
        ("Be-BH-IR204.0751", "4ka78n040"),
        ("Be-BH-IR204.0756", "4ka78n041"),
        ("Sa-Pe-2R503.05298", "5kb92m012"),
        ("Sa-Pe-2R503.05303", "5kb92m013"),
        ("Sa-Pe-2R503.05308", "5kb92m014"),
        ("Lo-Ca-3T104.08112", "6lc45p023"),
        ("Lo-Ca-3T104.08117", "6lc45p024"),
    ]
    
    rack_x = 24
    rack_y_start = 300
    rack_gap = 80
    
    for i, (hostname, port_id) in enumerate(left_racks):
        add_server_rack(
            builder,
            x=rack_x,
            y=rack_y_start + i * rack_gap,
            hostname=hostname,
            port_id=port_id,
        )
    
    # === SERVER RACKS - RIGHT SIDE ===
    right_racks = [
        ("Ny-Ma-5R802.12445", "7md33q045"),
        ("Ny-Ma-5R802.12450", "7md33q046"),
        ("Ny-Ma-5R802.12455", "7md33q047"),
        ("Ch-Il-6T203.15678", "8ne21r067"),
        ("Ch-Il-6T203.15683", "8ne21r068"),
        ("Ch-Il-6T203.15688", "8ne21r069"),
        ("Da-Tx-7R401.18901", "9of12s089"),
        ("Da-Tx-7R401.18906", "9of12s090"),
    ]
    
    rack_x = page_width - 112
    
    for i, (hostname, port_id) in enumerate(right_racks):
        add_server_rack(
            builder,
            x=rack_x,
            y=rack_y_start + i * rack_gap,
            hostname=hostname,
            port_id=port_id,
        )
    
    # === CONNECTORS ===
    # Cloud to hub
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.25, entry_y=0),
        source=bell,
        target=hub,
    )
    
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0.5, exit_y=1, entry_x=0.75, entry_y=0),
        source=att,
        target=hub,
    )
    
    # Hub to zones
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0, exit_y=0.5, entry_x=0.5, entry_y=0),
        source=hub,
        target=zone_nw3,
    )
    
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=1, exit_y=0.5, entry_x=0.5, entry_y=0),
        source=hub,
        target=zone_ne1,
    )
    
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=0, exit_y=1, entry_x=0.5, entry_y=0),
        source=hub,
        target=zone_sw1,
    )
    
    builder.add_edge(
        style=edge_style(svg.ORANGE, exit_x=1, exit_y=1, entry_x=0.5, entry_y=0),
        source=hub,
        target=zone_se2,
    )
    
    # Zone to zone connections (T1/T3 links)
    builder.add_edge(
        style=edge_style(svg.BLACK, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
        source=zone_nw3,
        target=zone_sw1,
    )
    add_label(builder, x=zones_center_x - zone_width - 30, y=zones_center_y - 10, width=30, height=12, 
              lines=[svg.make_line("T3", size="9", fill=svg.HELPER)])
    
    builder.add_edge(
        style=edge_style(svg.BLACK, exit_x=0.5, exit_y=1, entry_x=0.5, entry_y=0),
        source=zone_ne1,
        target=zone_se2,
    )
    add_label(builder, x=zones_center_x + zone_width + zone_gap_h // 2 - 30, y=zones_center_y - 10, width=30, height=12,
              lines=[svg.make_line("T3", size="9", fill=svg.HELPER)])
    
    builder.add_edge(
        style=edge_style(svg.BLACK, exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
        source=zone_nw3,
        target=zone_ne1,
    )
    add_label(builder, x=zones_center_x - 15, y=zones_center_y - zone_height - 20, width=30, height=12,
              lines=[svg.make_line("T1", size="9", fill=svg.HELPER)])
    
    builder.add_edge(
        style=edge_style(svg.BLACK, exit_x=1, exit_y=0.5, entry_x=0, entry_y=0.5),
        source=zone_sw1,
        target=zone_se2,
    )
    add_label(builder, x=zones_center_x - 15, y=zones_center_y + zone_height + 60, width=30, height=12,
              lines=[svg.make_line("T1", size="9", fill=svg.HELPER)])
    
    # === BOTTOM METADATA ===
    metadata_y = page_height - 48
    
    add_label(
        builder,
        x=24,
        y=metadata_y,
        width=200,
        height=32,
        lines=[
            svg.make_line("Drawing Date: 2024-03-15", size="10", fill=svg.HELPER),
            svg.make_line("Change Date: 2024-03-20", size="10", fill=svg.HELPER),
        ],
    )
    
    add_label(
        builder,
        x=240,
        y=metadata_y,
        width=200,
        height=32,
        lines=[
            svg.make_line("Owner: Network Operations", size="10", fill=svg.HELPER),
            svg.make_line("Stats: Devices: 44", size="10", fill=svg.HELPER),
        ],
    )
    
    add_label(
        builder,
        x=page_width - 200,
        y=metadata_y + 8,
        width=180,
        height=20,
        lines=[svg.make_line("GRAPHICAL NETWORKS", size="12", weight="700", fill=svg.HELPER)],
        align="right",
    )
    
    # Write output
    output_path = svg.DRAWIO_DIR / "layer3-mpls-onbrand.drawio"
    builder.write(output_path)
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    export_layer3_mpls()
