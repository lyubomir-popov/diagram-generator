# Implementation Plan: Figma autolayout fidelity

**Branch**: `feat/011-figma-autolayout-fidelity` | **Spec**: [spec.md](spec.md)

## Summary

Implement Figma-faithful HUG measurement for text: default `max_width_chars: 66` on all text-bearing frames, wrap at HarfBuzz-derived pixel width, hug longest wrapped line. TS-only implementation.

## Technical context

**Primary code**: `packages/layout-engine/src/text-layout.ts`, `layout.ts`, `frame-model.ts`  
**Preview wiring**: `layout-bridge.js`, `editor.js`  
**Passthrough only**: `frame_loader.py`, `frame_model.py`, `preview_server.py`, `frame_yaml_persistence.py` (serialize/parse, no measure logic)

**Testing**:
```bash
npm --prefix packages/layout-engine test
```

## Measure priority (text wrap width, inner)

1. Parent-resolved width (`constrainedW` from remeasure)
2. Explicit `width`
3. Explicit `max_width` (px, inner = max_width − padding − icon)
4. `max_width_chars` (default 66 for text frames) → px via HarfBuzz
5. `BLOCK_WIDTH` — **empty non-text boxes only**

## HUG width after wrap

`width = roundUpToGrid(padL + padR + iconCol + max(wrapped line widths))`

## Deliverables

- [x] Spec 011 documents
- [ ] `text-layout.ts` module
- [ ] `leafNaturalSize` refactor
- [ ] Inspector pre-population
- [ ] Agent docs + STATUS pointer
- [ ] Adversarial review
