# Adversarial Audit — 2026-05-27

Two independent adversarial reviews (Claude Opus 4.6, GPT-5.4) audited the v3 engine.
Both independently converged on the same core issues, ordered by severity.

## HIGH — Structural

### H1. Layout mutates the input Frame tree

`col_span` rewrites `width` and `sizing_w` on the Frame. FILL/HUG coercion rewrites parent sizing permanently. Root width save/mutate/restore is fragile (exception between save and restore corrupts Frame).

**Fix:** Keep derived values in layout-only fields (e.g. `_resolved_w`, `_placed_w`) and stop mutating semantic fields on Frame. Or deep-copy the Frame tree before layout.

### H2. Style resolution duplicated across loader and renderer

Loader defaults fill to WHITE. Renderer overrides containers to GREY/no-stroke in `_render_frame`. These two copies disagree. If you explicitly set container fill in YAML, the renderer may override it.

**Fix:** One shared style resolver. Renderer only renders resolved style fields.

### H3. Heading-as-synthetic-child is structural patchwork

`__heading` / `__body` rewrite changes tree topology silently. `wrap`, `sizing_w`, `sizing_h`, `fill_weight` aren't copied to `__body`. User-declared `direction: horizontal` becomes `vertical` silently.

**Fix:** Engine should handle headings natively (reserve space before distributing to children), or the synthetic rewrite must copy ALL layout-affecting fields.

### H4. Overlay semantics contradict rendering

Model says "bounding rect around members." Renderer does "full canvas width band." Test only checks existence, not geometry.

**Fix:** Compute from member bounds (the correct behavior). Full-width band can be opt-in via a mode field on Overlay.

### H5. Leaf measurement vs rendering padding mismatch

Measurement uses hard-coded INSET. Rendering uses per-side padding + a borderless 1px compensation hack (3 sides only — bottom missing).

**Fix:** Leaf measurement should use `frame.padding_*` fields, same as rendering.

## MEDIUM — Code quality

### M1. `_lines_to_dicts()` duplicated in layout_v3.py and diagram_layout.py

Two copies with different implementations: v3 uses stale `hasattr()` guards, diagram_layout delegates to `make_line()`.

**Fix:** Delete v3 copy. Import from `diagram_layout.py` or promote to `diagram_shared.py`.

### M2. `ARROW_CLEARANCE` defined in 3 places (8, 8, 12)

`design_tokens.py`: 8, `diagram_shared.py`: 8, `layout_v3.py`: 12. Classic patch — v3 needed bigger clearance so someone added a local override.

**Fix:** One value in one place. If v3 needs 12, update the canonical value.

### M3. `padding: 0` treated as falsy

`root.padding_top or root.padding or 0` treats explicit 0 as false and falls through. Explicit zero padding is a valid intent.

**Fix:** Use `if root.padding_top is not None` instead of truthiness.

### M4. Silent fallbacks hide YAML mistakes

Bad `sizing`, `direction`, `align`, `justify`, `position` values silently fall through to defaults. Bad `variant` names silently do nothing.

**Fix:** Warn on unknown enum values, consistent with existing meta validation.

### M5. Preview server JSON contract stale

Omits `justify`, `col_span`, overlays. Emits dead `heading` field. Frame-tree endpoint doesn't reflect current Python model.

**Fix:** Define explicit frame-tree schema. Serialize all layout-affecting fields. Add snapshot test.

### M6. `estimate_line_width` duplicated across diagram_shared.py and text_metrics.py

Same function in two places. `diagram_shared.py` duplicates font loading, measure functions, and constants from `design_tokens.py` and `text_metrics.py`.

**Fix:** `diagram_shared.py` should re-export from `design_tokens` and `text_metrics`.

## MEDIUM — Mermaid testcase accuracy

### T1. complex-testcase.yaml is a hybrid of two drawio files

- `complex-testcase.drawio`: NO "Build spike", edges: define→implement, measure→review
- `complex-routing-usecase.drawio`: HAS "Build spike", edges: define→implement, measure→review (routed around spike)
- YAML invents `measure→spike→review` which exists in neither source

**Fix:** Create two separate YAMLs matching the two sources exactly. Or pick one as canonical and reproduce it faithfully.

### T2. Label text altered from source

Inserted commas in label arrays (e.g. `[Define ingress, pipeline]`) that don't exist in the source drawio values (`"Define ingress pipeline"`).

**Fix:** These commas are YAML line-break syntax, not content — they're correct for multi-line rendering. Document this convention.

## TEST GAPS

1. No arrow routing unit tests (core routing logic)
2. No constrained re-measurement tests
3. No idempotency test (calling layout twice on same Frame)
4. No negative parser tests for invalid enum values
5. Overlay test checks existence only, not geometry
6. No preview JSON contract/snapshot test
7. No provenance test tying YAML fixtures to source drawio files
