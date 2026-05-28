# Diagram Generator Constitution

## Core Principles

### I. Anti-patch protocol (NON-NEGOTIABLE)
Every change must be classified before coding: contract change, configuration, bug, feature, or one-off. No special-casing for individual diagrams. If a fix touches a layer that doesn't own the concept, it's a patch – stop and redirect. The five-question patch smell test must pass before implementation.

### II. Layer ownership
Each concept has exactly one owning layer. Frame YAML owns structure. frame_loader.py owns parsing and defaults. layout_v3.py owns measurement and placement. The renderer only converts engine decisions to markup – it never invents layout facts. The preview layer only relays engine results to the browser.

### III. DIAGRAM.md is the visual contract
All visual rules – colours, typography, spacing, box anatomy, arrow routing, component types – live in DIAGRAM.md. Code implements DIAGRAM.md; DIAGRAM.md is not reverse-engineered from code. When code and DIAGRAM.md disagree, DIAGRAM.md wins and code must be fixed.

### IV. Test before ship
Run ALL existing diagrams through the engine after any change, not just the triggering one. If any regresses, the change is wrong – revert and redesign. One feature at a time; do not stack unverified changes.

### V. Sensible defaults, explicit overrides
The engine must produce correct output from minimal YAML. Leaf boxes get solid borders, white fill, regular text. Containers get no border, grey fill, bold heading. Variants (highlight, annotation) overlay on top. Authors should rarely need to specify fill or border manually.

### VI. Stable public interfaces
Keep public function signatures of packages/layout-engine/ stable. Breaking changes are allowed but must be recorded in HISTORY.md. These are the de-facto interface for eventual porting to design-foundry.

### VII. No format lock-in
Do not introduce persisted format identifiers that embed the package or repo name. Use short stable acronyms (e.g. `dg`) decoupled from naming so future renames are cheap.

### VIII. Semantic YAML, no visual properties
Frame YAML is a semantic document, not a stylesheet. Authors declare structure and intent (`level: 1`, `variant: highlight`, `type: zone`), never raw visual values (no `fill:`, no hex colours, no dash patterns, no stroke widths). Level designations work like army ranks – an agreed role, not a computed property. The style resolver maps levels, variants, and borders to visual treatments defined in DIAGRAM.md. Any YAML must be re-renderable years later under a different visual theme without editing the YAML.

## Technology Stack

- **Language**: Python 3.11+ (engine, loader, renderer, tests)
- **Layout model**: HUG/FILL/FIXED sizing, 9-point alignment, two-pass measure/place
- **Output**: SVG (static export), HTML preview server at localhost:8100
- **Tests**: pytest, parity tests against TypeScript layout engine
- **Frame format**: YAML with recursive Frame tree

## Development Workflow

- Classify every request through the anti-patch protocol
- Run `python -m pytest test_frame_loader.py test_autolayout.py test_layout_v3.py test_parity.py -q` after changes
- Browser-verify affected diagrams at `http://127.0.0.1:8100/view/v3:<slug>`
- Render all diagrams to confirm no regressions
- Feature branches use `feat/<number>-<slug>` naming

## Governance

The constitution supersedes implementation convenience. DIAGRAM.md supersedes the constitution for visual rules. Source sketches and reference assets supersede DIAGRAM.md. Amendments require documentation in HISTORY.md.

**Version**: 1.1.0 | **Ratified**: 2026-05-28 | **Last Amended**: 2026-05-28
