# History

Completed work belongs here so `TODO.md` stays lean.

## Short-term

### 2026-04-21 — Draw.io library export and tokenized style sync

- Added `scripts/export_drawio_library.py` and the tracked `assets/drawio/diagram-generator-primitives.mxlibrary` export so the canonical reusable draw.io primitives now live in a versioned library file instead of only in generated diagrams.
- Added `scripts/drawio_style_tokens.py` and `scripts/drawio_style_sync.py`, and refactored `scripts/export_drawio_batch.py` so generated `mxCell` nodes now carry provenance and style-token metadata that batch tools can target safely.
- Updated `scripts/build_outputs.py` to generate the tracked draw.io library before rebuilding the draw.io and SVG batches, then rebuilt the batch and validated the new style-sync path with a dry run against `memory-wall-onbrand.drawio`.

### 2026-04-19 — Protected manual draw.io review-copy workflow

- Added `scripts/drawio_review_workflow.py` so manual draw.io changes can start from a review copy, then promote back only after checkpointing the original file.
- Updated `.github/copilot-instructions.md`, `STATUS.md`, and `TODO.md` so protected manual draw.io edits now follow a copy, review, checkpoint, and promote flow instead of first-pass in-place overwrite.

### 2026-04-19 — Draw.io manual-edit workflow investigation

- Investigated how draw.io scratchpad exports, custom libraries, default styles, custom stencils, connector and text style editing, and direct XML editing can support a safer mixed manual and programmatic workflow.
- Recorded the key architectural constraint that draw.io libraries are copy-based rather than live-linked, so future reusability needs both a library lane for new insertions and a tokenized batch-update lane for existing diagrams.
- Updated `STATUS.md`, `TODO.md`, `ROADMAP.md`, and `docs/specs.md` with a concrete plan for generated base files, manually polished working files, revert checkpoints, library-backed reuse, and style-sync tooling.

### 2026-04-19 — Session: centralized workflow migration

- Adopted the centralized root workflow set: `STATUS.md`, `TODO.md`, `ROADMAP.md`, `HISTORY.md`, `INBOX.md`, `AGENT-INBOX.md`, and `docs/specs.md` are now canonical in this repo.
- Migrated the older workflow content into the new root files and removed the obsolete parallel workflow files so the centralized layout is the only live path.
- Rewrote `.github/copilot-instructions.md`, `.github/agents/agent.md`, and `README.md` so session start, source precedence, inbox handling, and validation now match the centralized boilerplate while preserving the repo’s diagram-specific rules.

### 2026-04-15 — Output lane + input path cleanup

- [x] Split the final artifact lanes under `diagrams/2.output/` so SVG outputs now live in `diagrams/2.output/svg/` and editable draw.io files live in `diagrams/2.output/draw.io/`.
- [x] Moved the prototype block file out of the final-output lane into `diagrams/0.reference/prototypes/icon-box-48px-prototype.svg` so output folders contain only deliverable artifacts.
- [x] Renamed the source-sketch folder from `diagrams/1. input/` to `diagrams/1.input/` and updated the compare builder, docs, and ignore rules to match.
- [x] Rebuilt the output batch and compare pages after the folder cleanup so the generated artifacts match the new structure.

### 2026-04-15 — Draw.io-first build refactor

- [x] Added `scripts/diagram_shared.py` to hold the shared diagram tokens, icon loading, text metrics, and small helper primitives that both renderers need.
- [x] Removed the direct `export_drawio_batch.py` dependency on `generate_remaining_diagrams.py`, so the draw.io renderer no longer imports the SVG renderer for shared behavior.
- [x] Updated `scripts/generate_remaining_diagrams.py` to consume the shared primitives module instead of carrying a second copy of the same low-level constants and helpers.
- [x] Added `scripts/build_outputs.py` as the canonical batch entrypoint and made it generate draw.io first, then regenerate the matching SVG batch.
- [x] Revalidated the refactored build path by running the new unified batch build successfully.

### 2026-04-15 — Compare review workflow + helper polish pass

- [x] Added `scripts/build_compare_pages.py` so the current seven source images and seven `*-onbrand.svg` outputs can be reviewed side by side through generated local HTML pages and merged JPG compare sheets.
- [x] Fixed the compare-page path handling so local files whose paths contain spaces still render correctly outside the VS Code webview.
- [x] Moved the loose review screenshots out of `docs/` root and into `docs/inbox-assets/` so inbox references stay organized.
- [x] Updated the shared SVG and draw.io helpers so terminal command bars use Ubuntu Sans Mono plus a visible chrome strip, separator line, and window-control dots instead of reading like a plain label box.
- [x] Updated the shared SVG and draw.io matrix helpers so `Q` / `K` / `V` labels sit in an explicit header band above the grid, preventing the recurring label-on-divider collision.
- [x] Rebuilt the full SVG and draw.io batches and refreshed the merged compare JPG set after the helper changes.

### 2026-04-02 — Native draw.io export correction

- [x] Audited the local `diagrams/2.output/draw.io/BRND-3135*.drawio` reference files and confirmed that the editable examples use native `mxCell` rectangles, labels, groups, and edges rather than `shape=image` boxes.
- [x] Documented the resulting invariant in the canonical repo docs: text-bearing draw.io boxes and panels must stay native and editable; inline `data:image/svg+xml,...` cells are reserved for icons and special non-text ornaments only.
- [x] Rewrote `scripts/export_drawio_batch.py` around native editable draw.io primitives so the generated batch no longer bakes whole boxes and text panels into image cells.
- [x] Kept draw.io image cells only for embedded icons and special shapes such as the jagged memory-wall panel and the Q/K/V matrix mini-grids.
- [x] Updated `scripts/export_memory_wall_drawio.py` to delegate to the canonical batch exporter so the repo no longer has two divergent draw.io export paths.
- [x] Regenerated the full `diagrams/2.output/draw.io/*-onbrand.drawio` batch and locally XML-validated it after the exporter rewrite.
- [x] Tightened that invariant again after the attention editability check: Q/K/V matrix mini-grids are now also native draw.io geometry with editable text, so image cells are reserved strictly for icons and truly non-text special shapes.

### 2026-04-02 — Ascender-based spacing + draw.io batch export

- [x] Tightened the canonical geometry rules so the visible top of live text sits `8px` below the box edge using ascent-based baseline placement, instead of treating the text `y` value as the raw top inset.
- [x] Documented the remaining spacing invariants for cold starts: midpoint-to-midpoint box-edge connectors, consistent box-to-arrow gaps, `8px` padding around borderless grouping pads, and a requirement that text and icons stay clear of orange connector paths.
- [x] Updated `scripts/generate_remaining_diagrams.py` to derive box heights from live text metrics, keep repeated spacing on an `8px` grid, and route orange connectors so they touch the center of the destination side rather than stopping short.
- [x] Rebuilt and re-sanitized the current canonical SVG set so `memory-wall-onbrand.svg`, `request-to-hardware-stack-onbrand.svg`, `inference-snaps-onbrand.svg`, `rise-of-inference-economy-onbrand.svg`, `gpu-waiting-scheduler-onbrand.svg`, `logic-data-vram-onbrand.svg`, and `attention-qkv-onbrand.svg` all reflect the refreshed ascent-aware placement rules.
- [x] Added `scripts/export_drawio_batch.py` and generated native draw.io exports for the current output set under `diagrams/2.output/draw.io/`, using embedded `data:` SVG image cells for Illustrator-safe icon fidelity and native attached edges with `source` / `target` plus `entry` / `exit` anchors wherever the relationships are direct.
- [x] Forced the generated draw.io files toward light-mode rendering with `adaptiveColors="none"` and explicit color values so dark-theme import does not silently invert text and fills.

### 2026-04-02 — Starter-block migration refresh

- [x] Updated the canonical docs to capture the stricter starter-block system: top-left text at `x=8` / `y=8`, top-right `48px` icon artboards with the same inset, minimum `64px` box height, `72px` for three-line boxes, same-size `16px` `#666666` helper text, arrows drawn behind connected boxes, and a grid-first width discipline.
- [x] Rewrote `scripts/generate_remaining_diagrams.py` around those shared primitives so refreshed outputs come from the same generator instead of a mix of old compact geometry and pre-refresh sample-based spacing.
- [x] Refreshed `diagrams/2.output/svg/memory-wall-onbrand.svg`, `diagrams/2.output/svg/request-to-hardware-stack-onbrand.svg`, `diagrams/2.output/svg/inference-snaps-onbrand.svg`, `diagrams/2.output/svg/rise-of-inference-economy-onbrand.svg`, `diagrams/2.output/svg/gpu-waiting-scheduler-onbrand.svg`, and `diagrams/2.output/svg/logic-data-vram-onbrand.svg` to the updated starter-block system.
- [x] Rebuilt `diagrams/2.output/svg/attention-qkv-onbrand.svg` out of the earlier compact `9px` system and onto the refreshed `16px` grid, preserving the full query / keys / match / value content while keeping helper copy at body size.
- [x] Added the missing source labels back into `diagrams/2.output/svg/request-to-hardware-stack-onbrand.svg`, including the full compute-kernel set `CUDA`, `ROCm`, `Metal`, and `oneDNN`.
- [x] Re-sanitized and XML-validated the refreshed batch so the full main output set is again Illustrator-safe after the generator rewrite.

### 2026-04-01 — Sample-based system reset + memory wall rebuild

- [x] Rebuilt `diagrams/2.output/svg/memory-wall-onbrand.svg` from scratch around the user-provided `diagrams/0.reference/sample.svg` block system instead of continuing the older compact library.
- [x] Standardized the new canonical block around `192x64` boxes, literal `1px` orange line-plus-triangle arrows, live `16px` regular block text, and natural embedded `48x48` local icons.
- [x] Replaced `diagrams/0.reference/onbrand-svg-starter.svg` with a matching live-text sample-based starter so future redraws can copy the exact block and arrow geometry without introducing symbols or markers.
- [x] Updated the cold-start docs to make the sample-based system canonical for new work and to demote the earlier `144x26` / `128x26` / `9px` library to legacy-maintenance guidance.
- [x] Documented draw.io XML export as a plausible second output path that should be anchored to a real user-provided sample before implementation.
- [x] Tightened the canonical block rule so text is always top-left aligned and block height is derived from natural icon height plus `8px` padding on all sides, making the current canonical block `192x64`.
- [x] Added the remaining reusable clarifications from review: side icon clusters keep the same icon scale as the rest of the system, separators between stacked boxes should match box width and sit centered in the gap, and the `Memory wall` node retains jagged top and bottom edges as a semantic exception.
- [x] Compared the local `diagrams/2.output/draw.io/*.drawio` samples, implemented `scripts/export_memory_wall_drawio.py`, and generated `diagrams/2.output/draw.io/memory-wall-onbrand.drawio` as the first native draw.io export prototype with embedded `data:` SVG icons and a jagged memory-wall panel.
- [x] Refined the draw.io exporter so connected arrows are attached on both ends with `source` / `target` cell ids plus explicit `entry` / `exit` anchors, and forced light rendering with `adaptiveColors="none"` plus explicit text colors.
- [x] Tightened the cold-start typography and icon rules after auditing `request-to-hardware-stack-onbrand.svg`: prefer `16px` regular and bold before introducing another size and require an explicit icon-coverage pass across `assets/icons/` before treating a diagram as done. The brief intermediate idea of reserving `14px` for helper text was later superseded by the current `16px` and `24pt` rule captured below.
- [x] Clarified the scaled-up type system for current new work: `16px` is body text, `24pt` is the next size step when more hierarchy is needed, and `14px` is now documented as legacy from the pre-scale-up system rather than a current default.

### 2026-04-01 — Remaining sample-based batch completion

- [x] Recorded `diagrams/2.output/svg/request-to-hardware-stack-onbrand.svg` as the completed redraw of `diagrams/1.input/image 6.png`, making the scaled-up vertical-stack reference part of the tracked output set.
- [x] Rebuilt `diagrams/1.input/image.png` as the editable SVG `diagrams/2.output/svg/rise-of-inference-economy-onbrand.svg` using the scaled-up sample system, one `24pt` title step, `16px` body text, a single black emphasis box, and a fuller icon pass across the training, inference, compute, and revenue sections.
- [x] Rebuilt `diagrams/1.input/image 5.png` as the editable SVG `diagrams/2.output/svg/gpu-waiting-scheduler-onbrand.svg`, using the same `192x64` block system, a sparse orthogonal orange connector, and only the local icons that had clear semantic matches.
- [x] Added `scripts/generate_remaining_diagrams.py` so the final simple diagrams were generated from the same literal geometry, icon embedding, and `1px` line-plus-triangle arrow rules instead of being hand-drifted.
- [x] Sanitized and XML-validated the new batch outputs so the original six-input redraw queue is now complete on the SVG side.

### 2026-04-01 — Memory wall on-brand redraw

- [x] Rebuilt the hand-drawn Memory Wall diagram as an editable SVG.
- [x] Switched the file to Ubuntu Sans Variable and local SVG icon symbols.
- [x] Matched the draw.io reference more closely for compact box scale, black strokes, grey fills, and orange connectors.
- [x] Reworked the connector behavior so arrowheads touch the destination edges without the shaft visibly protruding through the head.
- [x] Converted the wall treatment into a double-jagged box with the label inside.

### 2026-04-01 — Cold-start workflow scaffold

- [x] Ported the original workflow scaffold into this repo: handoff, inbox, TODO, roadmap, history, and resume-agent structure.
- [x] Documented the current diagram redesign style system and process so additional diagrams can be handled without relying on prior chat context.

### 2026-04-01 — Path + type hierarchy refresh

- [x] Aligned the canonical docs with the `assets/` and `diagrams/` repo layout after the reorg.
- [x] Fixed the exemplar SVG's embedded font reference so `diagrams/2.output/svg/memory-wall-onbrand.svg` still resolves `assets/UbuntuSans[wdth,wght].ttf` correctly.
- [x] Added the optional larger typography ladder for deeper diagrams: `Body` (`1rem` and `400`), `D-Head` (`1rem` and `600`), `C-Head` (`1rem` and `600`, small-caps), `B-Head` (`1.5rem` and `400`), and `A-Head` (`1.5rem` and `600`), with guidance to use the smallest subset possible.

### 2026-04-01 — Logic/data + VRAM redraw

- [x] Rebuilt `diagrams/1.input/image 4.png` as the editable SVG `diagrams/2.output/svg/logic-data-vram-onbrand.svg`.
- [x] Collapsed the sketch into three clean on-brand panels: the logic and data conflict, AI inference, and VRAM fragmentation comparison.
- [x] Kept the redraw inside the repo palette and geometry rules by using compact titles, square-corner boxes, orange connectors, and a GPU-card treatment instead of preserving the hand-drawn shading.
- [x] Validated the finished SVG as well-formed XML.

### 2026-04-01 — Canonical rule clarification

- [x] Tightened the cold-start docs so the canonical style rules are explicit rather than implied.
- [x] Documented the strict text and icon layout rule: left-aligned text, flush-right icons, `8px` text inset, `144px` outer boxes, and `128px` nested boxes.
- [x] Replaced the overly broad heading ladder in the canonical docs with the intended draw.io-style type scale: `9px` regular, `9px` bold, `9px` bold small-caps, and optional `14px` regular or bold headings only when needed.
- [x] This clarification supersedes the older broader heading-ladder wording in the history log; `TODO.md`, `STATUS.md`, and `.github/copilot-instructions.md` are the canonical source of truth.
- [x] Documented the palette rule that orange is reserved for arrows, boxes default to white or `#F3F3F3`, and at most one black-filled box with white text is allowed.
- [x] Made `diagrams/2.output/svg/memory-wall-onbrand.svg` the explicit canonical implementation checkpoint for future cold starts.

### 2026-04-01 — Attention QKV redraw

- [x] Rebuilt `diagrams/1.input/image 3.png` as the editable SVG `diagrams/2.output/svg/attention-qkv-onbrand.svg`.
- [x] Translated the sketch into four clean panels for the query, keys, match, and value steps while keeping the wider composition compact.
- [x] Kept the redraw inside the stricter canonical rules: no orange boxes, strictly left-aligned text, white and `#F3F3F3` boxes, and a single black highlight box for the highest-relevance match.
- [x] Omitted icons entirely because no suitable local icon in `assets/icons/` matched the Q, K, and V matrix concept cleanly.
- [x] Tightened the layout so it now matches the memory-wall exemplar's exact `144x26` and `128x26` box scales, `8px` inset, `#666666` helper text, bottom-row legend, and orthogonal `90` degree arrow routing.
- [x] Refined the final spacing pass so legends use evenly spaced bottom-row markers, helper notes stay unboxed at `9px` and `#666666`, and orange arrows read box-to-box with larger heads and longer visible shafts.
- [x] Normalized the arrow treatment back to the memory-wall exemplar's smaller orange head proportions and extracted a reusable starter SVG for future diagrams to copy exact defs from.
- [x] Added explicit spacing constants to the reusable starter and the attention diagram: `8px` arrowheads, `16px` connected gaps without arrowheads, `24px` connected gaps with arrowheads, and `8px` gutters for repeated `128px` box rows.
- [x] Validated the finished SVG as well-formed XML.

### 2026-04-01 — Inference Snaps redraw

- [x] Rebuilt `diagrams/1.input/image 7.png` as the editable SVG `diagrams/2.output/svg/inference-snaps-onbrand.svg`.
- [x] Corrected the grouped layout to use full-width row bars instead of a centered composition, keeping the command bar, header row, and hardware row on the same panel-width grid.
- [x] Shifted the grouped reference to a stricter one-size typography pass for this case: all copy is `9px`, with regular and bold used for hierarchy instead of introducing extra sizes.
- [x] Refined the grey capability region into a borderless `#F3F3F3` substrate behind bordered child tiles so the semantic boxes, not the pad, carry the structure.
- [x] Kept the redraw on the canonical library system: `128x26` nested rows, `8px` text inset, `8px` row gutters, `8px` arrowheads, and `16` and `24` connector spacing.
- [x] Used only local icon motifs that mapped cleanly to the source concepts and kept all text left-aligned with flush-right icons.
- [x] Validated the finished SVG as well-formed XML.

### 2026-04-01 — Illustrator-safe SVG audit

- [x] Investigated why Illustrator dropped arrowheads, icons, and matrix glyphs from the finished SVGs.
- [x] Identified the main failure modes: file-path `@font-face` rules, internal `<symbol>` and `<use>` reuse, and linked `<image href="...">` embeds.
- [x] Added `scripts/svg_illustrator_sanitize.py` to strip external font links, expand internal symbol reuse into literal geometry, and flag remaining portability hazards.
- [x] Sanitized `diagrams/2.output/svg/attention-qkv-onbrand.svg`, `diagrams/2.output/svg/inference-snaps-onbrand.svg`, `diagrams/2.output/svg/logic-data-vram-onbrand.svg`, `diagrams/2.output/svg/memory-wall-onbrand.svg`, and `diagrams/0.reference/onbrand-svg-starter.svg` to remove symbol-based reuse.
- [x] Replaced the one remaining marker-based annotation arrow in `memory-wall-onbrand.svg` with literal line and path geometry.
- [x] Removed the linked `library-compare-canvas.svg` from the canonical workflow because it depended on external SVG image references and would always trigger relink behavior.
- [x] Tightened the text portability pass so the sanitizer now writes explicit `font-family`, `font-size`, `font-weight`, and `fill` onto each text node, and normalized bold text to `700`.
- [x] Brought `attention-qkv-onbrand.svg` fully back to the `9px` text system and increased `inference-snaps-onbrand.svg` in-box icons to the heavier `24px` default from the local `48x48` source icons.

### 2026-04-01 — Reference block refresh

- [x] Inspected the user-provided Illustrator export `diagrams/0.reference/sample.svg` and confirmed it is structurally clean on our side: no `<use>`, no `<symbol>`, no linked images, and no marker-based arrows.
- [x] Confirmed the sample arrow treatment comes through as literal line-plus-triangle geometry and is suitable as the new single-box building block reference.
- [x] Added the higher-resolution companion image `diagrams/0.reference/sample.png` as the clearer `3x` visual reference for that same block.

## Long-term