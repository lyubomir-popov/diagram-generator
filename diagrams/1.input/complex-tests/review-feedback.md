# Complex Tests Review Feedback

Date: 2026-04-22

Scope:

- Input review targets:
  - `1.jpg` -> AWS HLD source sketch
  - `2.jpg` -> Layer 3 IP/MPLS source sketch
- Generated outputs reviewed:
  - `diagrams/2.output/draw.io/aws-hld-onbrand.drawio`
  - `diagrams/2.output/draw.io/layer3-mpls-onbrand.drawio`
- Generator scripts reviewed:
  - `scripts/export_aws_hld.py`
  - `scripts/export_layer3_mpls.py`

This review focuses on two failure modes that make the stress test inconclusive:

1. many source nodes are present visually in the output but are left unconnected
2. several output connections and labels do not match the source topology or source text

## Diagram 1: AWS HLD

### Main problems

1. The output collapses the topology to a handful of container-level edges.
   - The generated diagram only wires top-level blocks such as `Modernisation`, `Core`, `Security`, `Shared-services`, `Transit Gateway`, `VPC_Accounts`, and `core-vpc-sandbox`.
   - The source sketch shows connectivity to specific internal nodes such as TGW cells, route tables, VPC attachments, Customer Gateway, and lower OU-adjacent nodes.

2. Internal node structure is flattened or replaced with approximations.
   - `Modernisation` in the source appears to include an internal landing-zone style node, but the output only renders the outer service container.
   - `Core` should preserve the internal structure of `Logging` and `Network Services`, including the visible sub-elements and their edge targets.
   - The VPC account panels in the output use abstract subnet columns instead of the visible business-unit VPC tiles and attachment structure from the source.

3. Many labels are present as annotations only, not as connected nodes.
   - `live/non-live RT`
   - `VPN attachments are associated with external route table`
   - `vpc attachment`
   - `Customer Gateway`
   These appear in the output as loose text instead of being tied to the connection geometry shown in the source.

4. The output uses stand-in icon choices and partial structure where the source expects specific semantics.
   - `Systems Manager`, `Route Table`, `Certificate Authority`, and related nodes need to remain semantically exact.
   - If an exact local icon is unavailable, the node should remain correctly labeled and wired rather than being simplified into a decorative label.

### Nodes and paths that need explicit reconstruction

1. Internal TGW-facing nodes inside `Logging`, `Network Services`, `Security`, and `Shared-services`.
2. The route-table relationships around the Transit Gateway.
3. The VPN path to the external route-table area.
4. The `vpc attachment` path from the main VPC accounts group to `core-vpc-sandbox`.
5. The `Customer Gateway` node and its attachment path.
6. The lower OU/RAM/SSH flows so they are represented as actual nodes and edges, not just labels.

### Generator issues to fix

1. `scripts/export_aws_hld.py` currently returns only outer container IDs for major composites.
   - `add_service_panel()` returns only the outer panel.
   - `add_vpc_account_panel()` returns only the outer panel.
   - `add_ou_panel()` returns only the outer panel.
   This prevents edge construction to the actual internal nodes that the source uses.

2. The connector section only builds six high-level edges.
   - The edge section currently wires only service containers -> `hub`, `hub` -> `vpc_section`, and `vpc_section` -> `sandbox`.
   - This is not enough to reproduce the visible topology.

### AWS HLD fix list

1. Refactor the helper builders to return structured IDs for internal nodes, not just outer panel IDs.
2. Rebuild `Modernisation` with its internal node(s) instead of an empty container.
3. Rebuild `Core`, `Security`, and `Shared-services` around the actual source-visible edge targets.
4. Replace the abstract VPC account columns with the actual visible account/tile structure from the source.
5. Convert loose labels such as `Customer Gateway` and `vpc attachment` into real nodes and attached edges where the source shows them.
6. Reconstruct the full TGW and route-table connectivity based on the source, not on simplified container-to-container flow.

## Diagram 2: Layer 3 IP/MPLS

### Main problems

1. The output collapses a device-level network into zone-to-zone and cloud-to-zone container edges.
   - The source sketch is a network topology with specific devices and per-device links.
   - The output instead connects `Bell` and `AT&T` cloud containers to a `Core Hub`, then connects that hub to four zone containers.

2. Most visible devices are not connected at all.
   - Router and switch icons inside the zones are placed visually but receive no device-level links.
   - Server racks on the left and right are rendered as isolated labels/icons with no rack-to-zone or rack-to-device connectivity.

3. A large amount of node content was invented or normalized instead of transcribed.
   - Synthetic names such as `RTR-BE-01`, `SW-NW3-01`, `RTR-NW3-03`, and similar were introduced.
   - Several IP ranges and hostnames in the output are placeholders or normalized values rather than faithful source transfer.
   - Bottom metadata such as drawing/change dates and owner text was invented rather than copied from the source.

4. Link classes and labels are applied to approximate paths, not the source paths.
   - `OC-12`, `T1`, and `T3` labels are present, but they are attached to simplified container edges rather than the specific device-to-device lines visible in the source.
   - The source also distinguishes different line classes visually; the output flattens those semantics.

### Nodes and paths that need explicit reconstruction

1. The specific carrier-side routers inside `Bell` and `AT&T`.
2. The router-to-core links and their exact `OC-12` attachment points.
3. The specific routers/switches within each of the four zones.
4. The inter-device connections inside and between zones.
5. The rack-side connections from the peripheral server/rack nodes into the network.
6. The bottom metadata copied exactly from the source.

### Generator issues to fix

1. `scripts/export_layer3_mpls.py` returns only outer composite IDs.
   - `add_cloud_provider()` returns only the cloud container ID.
   - `add_zone()` returns only the zone container ID.
   - The rack creation loops do not retain per-rack IDs for later edge creation.

2. The connector phase only builds ten high-level edges.
   - cloud -> hub
   - hub -> zone containers
   - zone container -> zone container
   This is far below what the source topology requires.

3. The device inventory is not source-faithful.
   - Hostnames, IPs, and metadata need to be read from the source image and transferred exactly.
   - If a label cannot be read confidently, the generator should stop and ask rather than inventing values.

### Layer 3 IP/MPLS fix list

1. Refactor cloud, zone, and rack helpers to return structured IDs for all internal devices.
2. Rebuild the topology as device-to-device edges, not container-to-container edges.
3. Replace invented device names, IPs, and metadata with exact source transcription.
4. Attach `OC-12`, `T1`, and `T3` labels to the correct reconstructed paths.
5. Add the missing rack access links and any other peripheral device links shown in the source.
6. Preserve the visual distinctions between link classes if the source uses them to encode network meaning.

## Cross-cutting root causes

1. The generators optimize for visual resemblance instead of source-faithful topology.
2. Composite builders return only outer container IDs, which makes proper edge reconstruction impossible.
3. The implementation invents unread content instead of either transcribing exactly or asking for clarification.
4. The current outputs should be treated as rough placeholders, not valid stress-test passes.

## Recommended next pass

1. Transcribe every visible label and device identifier from each source image into a working inventory.
2. Refactor the builders so they expose internal node IDs.
3. Rebuild both diagrams from the edge map outward:
   - first define nodes
   - then define exact source-derived edges
   - then place annotations on the corresponding paths
4. If any source label or endpoint remains unreadable after zoomed inspection, stop and ask instead of normalizing it.