# Specs

## Purpose

List the external sources, reference assets, and sibling repos that govern this repo.

If a sketch, reference export, or explicitly linked local asset governs a diagram, treat that source as the highest-priority visual truth and list it here.

Use this file to answer two questions quickly:

1. What source material governs diagram behavior or workflow here?
2. Which sibling repos are references versus sources of truth?

## Active specs (spec-kit)

| Spec | Path | Status | Summary |
|------|------|--------|---------|
| 011 Figma autolayout fidelity | `specs/011-figma-autolayout-fidelity/` | Complete | Default `max_width_chars: 66` on text frames; HUG wraps at HarfBuzz-derived measure and hugs longest line. TS-only measure; Python YAML passthrough. |
| 012 TS SVG renderer | `specs/012-ts-svg-renderer-retire-python/` | Complete | TS-only SVG (preview + batch); `diagram_render_svg.py` removed; golden harness (6 slugs); arrow editing + doc close-out (`a6822da`). |
| 014 Preview TS export hardening | `specs/014-preview-server-ts-export-hardening/` | Complete | Bounded Node pool: cache, concurrency, coalescing, timeout handling. Python SVG fallback removed by spec 012 T060a. |
| 015 Preview stability + nav | `specs/015-preview-stability-and-nav-triage/` | Complete | Diagram picker change handler in editor-base (force mode); port auto-kill opt-in; bind error message. |
| 013 TS preview API | `specs/013-ts-preview-api-retire-python-layout/` | Complete | TS frame-tree/grid/component-tree from YAML via `preview_ts_layout.py`. |
| 016 Adversarial review follow-up | `specs/016-adversarial-review-followup/` | Complete | `DG_FRAMES_DIR` in Node CLIs; layout pool coalescing; force.js picker dedup. |
| 017 Preview frame delete | `specs/017-preview-frame-delete/` | Complete | Delete/Backspace + tree context menu; `removed_ids` YAML persistence; undo restores frame tree. |
| 018 PNG export | `specs/018-png-export/` | Draft | Preview **Save PNG** + slug batch CLI; rasterize TS SVG via Playwright; `diagrams/2.output/v3/png/`. |
| 019 Preview inspector cleanup | `specs/019-preview-inspector-cleanup/` | Complete | Removed redundant Selection summary fields; id in Auto-layout heading. |
| 022 Diagram authoring AST | `specs/022-diagram-authoring-ast/` | Complete (v1) | TS diagram compiler: frame-tree AST, arrow/defaults sugar, validation, lowering through `loadFrameYaml`, Mermaid + D2 export CLIs, migration utility. Import/round-trip → spec 028. |
| 028 Diagram interchange (Mermaid & D2) | `specs/028-diagram-interchange-mermaid-d2/` | Draft | Bidirectional interchange: import parsers, fidelity matrix, export hardening, round-trip CLIs; builds on 022 adapters. |
| 029 Force preview shell convergence | `specs/029-force-preview-shell-convergence/` | Draft | Bounded follow-up to the force save-button regression: converge shell-side save / dirty semantics with specs 025 / 026, add focused save-button coverage, and explicitly freeze the composer-safe boundary so this does not become an open-ended force controller rewrite. |
| 023 Force-layout restoration | `specs/023-force-layout-restoration/` | Complete | TS-owned force runtime restored and closed out for the three canonical demos, including drag/pin/unpin/export/save behavior, focused route/save/export coverage, and a TypeScript runtime benchmark path. |
| 024 ELK interactive node alignment | `specs/024-elk-interactive-node-alignment/` | Draft | Native ELK constraints for nudge-to-align; graph-level options stay in `meta.elk`, per-node constraints live in `meta.elk_nodes`, and implementation must land through the spec 025 engine contract plus the spec 026 ELK controller slice. |
| 025 Multi-engine preview architecture | `specs/025-multi-engine-preview-architecture/` | Complete | Preview-engine manifest/capability contract is landed: manifest-owned script bootstrap, canonical save responses from `/api/overrides`, TS-owned engine metadata, runtime identity, and documented onboarding for future engines so additional engines stop accumulating in `editor.js`. |
| 026 Preview shell decomposition + TS migration | `specs/026-preview-shell-decomposition-ts-migration/` | Complete | Shell modules extracted (`save-client.js`, `elk-controller.js`, `editor-state.js` + TS `preview-shell/`); `editor.js` shrunk; runtime vs shell boundaries documented in `boundaries.md`. |
| 027 Preview browser test API | `specs/027-preview-browser-test-api/` | Draft | Retire post–spec 026 `window.*` shims by migrating Playwright to `__DG_TEST_preview` and removing legacy globals from `editor.js`. |
| — | `specs/ADVERSARIAL_REVIEW_PROMPT.md` | Template | Copy-paste prompt for post-session adversarial reviews. |
| 005 Autolayout hardening | `specs/005-autolayout-hardening/` | Complete | Semantic mutation, style ownership, heading/body synthesis, and padding-contract hardening all validated; WS5 closeout completed on the retained 11-slug corpus. |
| 008 Repo coherence rewrite | `specs/008-repo-coherence-rewrite/` | Complete | Doc and workflow consolidation landed; resolved-style snapshot, YAML-authoritative persistence, and Python-surface contraction are all closed. |

## Source docs and reference assets

Rows marked ⚠ reference assets excluded by `.gitignore`. Run the build or obtain them from the team.

| Source | Path | Role |
|--------|------|------|
| Stakeholder how-to | `docs/stakeholder-guide.md` | Copy YAML → preview → save → export SVG (non-engineering) |
| Workflow rules | `.github/copilot-instructions.md` | Canonical workflow and diagram-rule source for this repo |
| Diagram language spec | `DIAGRAM.md` | Canonical diagram tokens, prose rules, and output constraints (Layer 3 — Style) |
| Current state | `STATUS.md` | Cold-start orientation and resume guidance |
| Starter block reference | `diagrams/0.reference/sample.svg` | Canonical single-block geometry and arrow treatment |
| Visual preview of starter block | `diagrams/0.reference/sample.png` | Clearer `3x` raster preview of the same canonical block |
| Reusable style copy source | `diagrams/0.reference/onbrand-svg-starter.svg` | Canonical inset rhythm, box proportions, and literal arrow geometry |
| Tracked draw.io library | `assets/drawio/diagram-generator-primitives.mxlibrary` | Repo-owned reusable library for canonical draw.io primitives |
| Secondary layout reference ⚠ | `diagrams/0.reference/_BRND-3284.drawio.svg` | Connector and broader layout reference |
| Current canonical implementation ⚠ | `diagrams/2.output/svg/memory-wall-onbrand.svg` | Palette, icon placement, side-icon cluster, and scale checkpoint |

## Design compass — canonical specs (living documents)

These three specs are the upstream mathematical foundation for the diagram system's typography, spacing, and grid rules. They currently describe three tiers (applications, documentation, editorial). Diagrams will become a **4th tier** described by each spec — a dense, constrained visual domain with its own scale selections, spacing conventions, and grid presets derived from the same foundations.

The specs are living documents maintained in the sibling `canonical-spacing-spec` repo. Changes to them may affect DIAGRAM.md tokens and renderer behavior. Treat them as the design compass for any typography, spacing, or grid decision in this system.

| Spec | Path | Governs |
|------|------|---------|
| Type scale | `../canonical-spacing-spec/specs/type scale/draft.md` | Modular scale formula, per-tier heading hierarchies, weight pairing, line height selection, baseline grid alignment. Diagram tier will select its own subset of the scale. |
| Spacing | `../canonical-spacing-spec/specs/spacing/draft.md` | Vertical spacing architecture (element-owned vs container-owned), baseline grid and nudge tokens, intra-component padding. Diagram tier will define its own spacing mode and density. |
| Grid | `../canonical-spacing-spec/specs/grid/draft.md` | Column counts, gutter widths, outer margins, bisection rule, nested grid alignment. Diagram tier will define its own grid presets (column counts, baseline unit enforcement). |

**How they flow into this repo:** DIAGRAM.md imports tokens from these specs and adapts them for diagram use (e.g., selecting 18px body from the modular scale, 8px baseline unit from the spacing architecture, 24px gutter from the grid spec). When the upstream specs change, DIAGRAM.md and `diagram_shared.py` must be reviewed and updated to stay aligned.

## External tool references

| Source | Path | Role |
|--------|------|------|
| draw.io scratchpad and custom libraries | `https://www.drawio.com/doc/faq/scratchpad` | Governs how reusable manual components are captured, edited, and exported as library XML |
| draw.io shape styles | `https://www.drawio.com/doc/faq/shape-styles` | Governs style strings, copy and paste style, default styles, and direct style editing |
| draw.io text styles | `https://www.drawio.com/doc/faq/text-styles.html` | Governs text spacing fields such as top, left, bottom, and right padding inside shapes |
| draw.io connector styles | `https://www.drawio.com/doc/faq/connector-styles` | Governs connector defaults, manual style editing, and reusable edge behavior |
| draw.io custom shapes | `https://www.drawio.com/doc/faq/custom-shapes` | Governs custom stencils, inherited styling, and explicit connection points for reusable special shapes |
| draw.io diagram source editing | `https://www.drawio.com/doc/faq/diagram-source-edit` | Governs direct XML editing, source-level merge workflows, and safe save modes |

## Related repos

| Repo | Relationship | Notes |
|------|--------------|-------|
| `design-foundry` | **Eventual home** | This repo's TS layout engine (`packages/layout-engine/`) will port there as `@design-foundry/operator-autolayout`. See `../design-foundry/PIVOT.md` for the full cross-repo plan. |
| `baseline-foundry` | Read-only reference | Upstream BF contract reference; sibling checkout needed only when refreshing vendored preview-shell snapshot under `assets/baseline-foundry/` |
| `canonical-spacing-spec` | Design compass (living upstream) | Upstream source for type scale, spacing, and grid specs governing DIAGRAM.md tokens. Diagrams will become a 4th tier. |
| `diagram-generator-planning` | **Project home + ontology** | Owns the broader Canonical diagram project (Jira DE-941), corpus audit, taxonomy (11 families), Coda pages (9), and Streams A–D. This repo is Stream E (constrained editor). Taxonomy metadata feeds `meta:` blocks in frame YAML. |
| `design.md` | Read-only format reference | Structure reference for the plain-text `DIAGRAM.md` spec |

## Notes

- Local reference assets in this repo are the primary source of truth for diagram visuals.
- `DIAGRAM.md` is the Layer 3 (Style) authority, importing tokens from the canonical type scale, spacing, and grid specs. See "Design compass" section for paths and the 4th-tier direction.
- draw.io libraries improve reuse for future insertions but do not live-update shapes already placed in diagrams; repo-wide style changes still require a batch XML update strategy.
- `scripts/export_drawio_library.py` regenerates the tracked draw.io library, `scripts/drawio_style_presets.py` defines the canonical shared draw.io style-field presets, and `scripts/drawio_style_sync.py` is the batch rewrite path for applying those presets or other token-targeted draw.io style changes.
- Sibling repos can inform workflow or style, but they do not outrank an explicitly referenced local sketch or reference asset.
- Keep this file focused on governing references and repo relationships, not active tasks or handoff notes.