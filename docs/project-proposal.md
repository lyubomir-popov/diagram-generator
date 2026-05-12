# Diagram Generator — project proposal

**Status:** Draft for stakeholder review
**Date:** 2026-05-12
**Author:** Lyubomir Popov / Design Engineering
**Cycle:** Next planning cycle

---

## Problem statement

Canonical produces hundreds of technical diagrams across docs, whitepapers, blog posts, field engineering decks, and partner materials. Today these are created ad hoc by individual contributors using whatever tool is at hand — Excalidraw, Google Slides screenshots, Mermaid, PowerPoint, or freehand draw.io, Lucid — with no shared style system, no reusable components, and no brand enforcement. The result is visible inconsistency: mismatched typography, arbitrary color palettes, non-standard connector styles, and diagrams that cannot be updated without redrawing from scratch.

This costs the organisation in three ways:

1. **Time.** Every new diagram is a cold start. Authors re-derive spacing, color, and layout rules from memory or by eyeballing existing outputs.
2. **Quality.** Without guardrails, diagrams drift from brand standards. Review cycles catch some issues; most ship unchecked.
3. **Maintainability.** Diagrams are trapped in their original tool and author. When content changes, the diagram is often abandoned rather than updated because nobody can find the source or replicate the style.

## Why now

A working prototype already exists. The `diagram-generator` repo has a declarative diagram model, a dual SVG/draw.io renderer, an interactive preview editor with brand-constrained editing, and a validated corpus of 16+ production-quality diagrams. The foundation is proven — this proposal is about productionising it for cross-team use.

## Target audience

### Primary users

| Audience | Current tools | Pain points |
|----------|--------------|-------------|
| **Tech authors** (docs, tutorials, whitepapers) | Excalidraw, Google Drawings, Inkscape | No shared style library, manual brand alignment, diagrams trapped in personal tool accounts |
| **Field engineering** (customer decks, solution architectures, partner materials) | draw.io, PowerPoint, Google Slides | Rebuilds the same architecture patterns repeatedly, no reusable blocks, inconsistent output quality |

### Secondary users

| Audience | Relationship |
|----------|-------------|
| **Marketing / brand** | Consumers and reviewers — benefit from consistent output without needing to create diagrams themselves |
| **Product management** | Diagram requesters — benefit from self-serve creation once the constrained editor matures |
| **Web / docs engineering** | Integration — may embed generated diagrams or consume the SVG output pipeline |

### User research needed

- [ ] Survey of current diagram production: tools used, time spent per diagram, frequency of updates, pain points
- [ ] Inventory of diagram types across docs, field engineering, and marketing (the Excalidraw dump referenced in planning)
- [ ] Interviews with 3–5 heavy diagram producers to validate assumptions and prioritise features

## What exists today

The prototype is functional and internally validated:

| Capability | Status |
|------------|--------|
| Declarative diagram model (Python dataclasses) | ✅ Production-ready |
| SVG renderer (editable, Illustrator-safe) | ✅ Production-ready |
| draw.io renderer (native XML, fully editable) | ✅ Production-ready |
| Interactive preview editor (selection, move, resize, text editing, undo/redo) | ✅ Working prototype |
| Brand-constrained palette (fills, connectors, typography) | ✅ Enforced at model level |
| Local icon library (48×48, Ubuntu icon set) | ✅ 40+ icons |
| Arrow obstacle avoidance and crossing validation | ✅ Build-time enforcement |
| Baseline grid alignment | ✅ Build-time validation |
| draw.io reusable component library | ✅ Auto-generated from corpus |
| 3-way visual comparison tooling | ✅ Automated |
| Design language spec integration | ✅ Mapped to canonical spacing/typography specs |

## Scope

### Guiding principle: 80/20

Get 80% of diagram needs covered for 80% of users. The system should handle the common patterns — architecture stacks, pipeline flows, component relationships, grouped panels — and do them well. Exotic one-off visualisations (data-driven charts, custom illustrations, animated explainers) are explicitly out of scope for the constrained system.

### In scope — the constrained path

These are the outputs the system produces with full brand enforcement:

**Input formats:**
- Rough sketches (photo/scan/screenshot)
- Excalidraw exports
- Existing draw.io files (import and restyle)
- Text descriptions / structured definitions (Python today, YAML/JSON planned)
- Mermaid diagrams (future parser)

**Output formats:**
- Editable SVG (Illustrator-safe, live text)
- draw.io native XML (fully editable in draw.io desktop/web)
- PNG export (from SVG, for embedding)
- PDF (single-diagram, for print/whitepapers)

**Diagram types (current corpus):**
- Vertical and horizontal architecture stacks
- Pipeline / workflow flows
- Grouped component panels with nested children
- Matrix / grid layouts
- Fan-in / fan-out connector patterns
- Annotated explainer diagrams

**Style system:**
- Ubuntu Sans typography at defined tiers
- Constrained colour palette (black, white, `#F3F3F3` grey, `#E95420` orange for connectors only)
- 8px baseline grid
- Canonical box proportions (192px wide, 64px+ tall, 48px icons)
- Reusable component library (boxes, panels, bars, terminals, arrows, annotations)

### Out of scope — the guardrails-off path (the other 20%)

For diagrams that cannot be expressed within the constrained system:

| Need | Recommended tool | Guardrails provided |
|------|-----------------|-------------------|
| Custom illustration / artistic diagrams | Penpot, Figma | Brand colour palette reference, typography guidelines |
| Data-driven charts and graphs | Mermaid, D3, charting libraries | Palette tokens, font-family guidance |
| Complex network topologies | draw.io with Canonical library | draw.io style library + connector defaults + guidelines doc |
| Animated / interactive diagrams | Custom HTML/SVG | Design tokens export, spacing/grid reference |
| Highly bespoke one-offs | Designer handoff | Reference exemplars + brand review checklist |

**The key deliverable for the 20%:** A draw.io component library, a Penpot component library, and a short visual guidelines document that gives authors enough brand rails to produce acceptable results manually. This is the floor — even the unconstrained path should not be a blank canvas.

## Phased rollout

### Phase 0 — Validate and package (current → end of cycle)

**Goal:** Confirm the prototype handles real intake volume and package it for first adopters.

- [ ] Complete the Excalidraw dump audit: categorise every existing diagram by type, complexity, and which could be expressed in the current model
- [ ] Run 5–10 real diagram requests through the pipeline end-to-end and measure time-to-output vs. the author's original method
- [ ] Package the CLI build as a simple `pip install` or single-script entry point
- [ ] Write a 2-page quickstart guide with the 3 most common diagram patterns
- [ ] Fix the remaining prototype defects (GridSpec dead code, diagonal arrowhead, spatial containment parenting)

**Exit criteria:** 10 real diagrams produced, quickstart guide written, build runs clean on a fresh clone.

### Phase 1 — Pilot with tech authors (1 cycle)

**Goal:** First external users producing real diagrams with the system.

- [ ] Onboard 2–3 tech authors with hands-on walkthrough
- [ ] Provide the draw.io component library for authors who prefer draw.io-native editing
- [ ] Stand up a shared diagram request queue (GitHub Issues or lightweight form)
- [ ] Collect structured feedback: time-to-output, style satisfaction, missing diagram types, missing icons
- [ ] Expand the icon library based on pilot needs (disciplined: additions go through style review)
- [ ] Add YAML/JSON diagram definitions so authors can define diagrams without writing Python

**Exit criteria:** 3+ authors self-serving diagrams, feedback collected, icon library covers pilot needs.

### Phase 2 — Expand to field engineering (1 cycle)

**Goal:** Field engineers producing customer-facing diagrams with consistent quality.

- [ ] Onboard field engineering team with template library for common solution architecture patterns
- [ ] Create 5–10 reusable diagram templates for the most common field engineering patterns
- [ ] Publish the draw.io component library to Confluence or internal wiki
- [ ] Publish Penpot component library for teams using Penpot
- [ ] Write the visual guidelines doc for the guardrails-off path
- [ ] Build the "out of guardrails" review checklist

**Exit criteria:** Field engineering using the system for customer-facing materials, guidelines doc published.

### Phase 3 — Self-serve and scale (1–2 cycles)

**Goal:** Any Canonical contributor can produce an on-brand diagram without specialised help.

- [ ] Interactive web editor (the preview server, matured) available as an internal tool
- [ ] Diagram definitions in YAML/JSON with a web form or wizard for non-technical users
- [ ] Integration with docs build pipeline (auto-generate diagrams from definitions in docs repos)
- [ ] Style token sync: when the brand system changes, batch-update all tracked diagrams
- [ ] Mermaid-to-diagram parser for authors who already think in Mermaid
- [ ] Sketch-to-diagram AI intake: upload a rough sketch, get a draft diagram definition

**Exit criteria:** Self-serve tool available, docs pipeline integration working, 50+ diagrams in the system.

## Stakeholders

| Person | Role | Involvement |
|--------|------|-------------|
| **Cedric** | Product management | Scope approval, priority within product roadmap, resource allocation |
| **Diana** | Product management | Cross-team alignment, docs strategy integration |
| **Ege** | Project management | Sprint planning, milestone tracking, cross-team coordination |
| **Dmitri** | Project management | Technical project oversight, integration dependencies |
| **Lyubomir** | Design engineering | Technical lead, prototype maintainer, style system owner |
| **Tech authors (TBD)** | Pilot users | Requirements, feedback, validation |
| **Field engineering lead (TBD)** | Pilot users | Requirements, field-specific patterns |
| **Brand/design (TBD)** | Reviewer | Style governance, palette/icon approval |

### Governance model

Style system changes need a lightweight approval path:

- **Icon additions:** Style review (one approver) — does the icon match the existing set in weight, detail level, and grid alignment?
- **Colour palette expansion:** Brand review — any new fill or connector colour needs explicit brand sign-off
- **Typography tier changes:** Spec-governed — changes flow from the canonical spacing/typography specs
- **New component types:** Technical review — does the new component compose with existing primitives?

## Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Adoption resistance ("I already use Excalidraw") | Low usage | Phase 1 pilots with authors who feel the pain; measure time savings; don't force migration |
| Style inventory grows undisciplined | Brand drift | Governance model above; palette and icon changes require review |
| Prototype complexity deters contributors | Slow adoption | YAML/JSON definitions in Phase 1; web editor in Phase 3 |
| Single maintainer (bus factor = 1) | Sustainability risk | Document everything; keep the model simple; Phase 1 creates co-owners |
| draw.io format instability | Breaking changes | Pin draw.io XML schema version; test against draw.io desktop releases |
| Icon library gaps | Authors can't find what they need | Track icon requests; batch expand quarterly; allow graceful icon omission |

## Success metrics

| Metric | Target (Phase 1) | Target (Phase 3) |
|--------|-----------------|-----------------|
| Diagrams produced through the system | 10+ | 50+ |
| Active users | 3–5 | 15+ |
| Median time-to-output (new diagram) | < 30 min | < 15 min |
| Median time-to-update (existing diagram) | < 10 min | < 5 min |
| Brand compliance rate (spot check) | 90% | 98% |
| Icon library coverage (% of requests met) | 70% | 90% |

## Technical dependencies

| Dependency | Status | Risk |
|-----------|--------|------|
| Python 3.10+ | Available | None |
| Playwright (for comparison tooling) | Optional | None — comparison is a dev tool, not user-facing |
| Baseline Foundry (editor shell) | Active development | Low — vendored fallback exists |
| Canonical spacing/typography specs | Stable drafts | Low — diagram tier is mapped and independent |
| draw.io desktop/web | External | Medium — format changes are possible; mitigated by XML schema pinning |
| Ubuntu Sans font files | Tracked in repo | None |

## What this replaces

This is not a migration from an existing tool. There is no current standard. This proposal creates the first shared diagram production system at Canonical. Authors keep their preferred tools for the 20% that falls outside the constrained path — but the 80% gets a fast, consistent, brand-safe default.

## Open questions

1. **Hosting model for the web editor** — Internal tool on a shared server, or a static build authors run locally?
2. **Docs pipeline integration depth** — Should diagram definitions live inside docs repos (co-located with content) or in a central diagram repo with cross-repo references?
3. **Penpot vs. draw.io priority** — Which unconstrained-path library ships first? Depends on which tool has more active users.
4. **AI intake ambition** — How much investment in sketch-to-diagram AI? Could range from "nice demo" to "core workflow" depending on quality.
5. **Cross-brand applicability** — Could this serve other Canonical brands beyond Ubuntu, or is it Ubuntu-only?

## Appendix: style inventory

The current style system is intentionally minimal. Expansion should be disciplined — each addition must justify itself against the existing primitives.

### Current palette

| Token | Value | Use |
|-------|-------|-----|
| `ink` | `#000000` | Text, box borders |
| `surface-default` | `#FFFFFF` | Default box fill |
| `surface-accent` | `#F3F3F3` | Panel/group fill |
| `connector` | `#E95420` | Arrows and arrowheads only |
| `emphasis-surface` | `#000000` | At most one highlight box |
| `emphasis-text` | `#FFFFFF` | Text inside emphasis box |
| `text-helper` | `#666666` | Annotations, secondary labels |

### Current typography

| Tier | Size / Weight / Leading |
|------|------------------------|
| Body | 18px / 400 / 24px |
| Body strong | 18px / 600 / 24px |
| Heading | 18px / 600 / 24px |
| Title | 24px / 500–600 / 32px |
| Helper | 14px / 400 / 20px |
| Small caps | 14px / 600 / 20px, 0.05em tracking |

### Current component library

Box, Panel, Bar, Terminal, Arrow, Annotation, JaggedPanel, IconCluster, Matrix, Separator

### Expansion candidates (to be validated in Phase 1)

- Additional accent fills (e.g. a second neutral for three-level grouping)
- Dashed/dotted box borders for "optional" or "future" semantics
- Callout / tooltip component
- Decision diamond (for flowcharts)
- Swimlane / column layout primitive
- Status indicators (checkmark, warning, error icons)
- Cloud / external-service shape
