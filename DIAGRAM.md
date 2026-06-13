# Diagram rules

Short visual contract for the current TS renderer.

Runtime authority:

- `packages/layout-engine/src/tokens.ts`
- `packages/layout-engine/src/frame-classes.ts`
- `packages/layout-engine/src/svg-render.ts`

## Core values

- 8px grid
- 24px structural gutter
- 18px text with 24px line step
- 192px default box width
- 48px icon
- 64px minimum height for bordered leaves

## Box anatomy

- Text: top-left, left-aligned
- Icon: top-right, `48x48`
- No centered labels
- No icon-above-text variants

## Frame classes

| Class | Fill | Border | Text |
|------|------|--------|------|
| Leaf | transparent | black 1px | black |
| Panel | `#F3F3F3` | `#F3F3F3` 1px | black |
| Section | transparent | black 1px | black |
| Annotation | transparent | none | `#666666` |
| Highlight | black | black 1px | white |

Hierarchy is by weight, not extra token families:

- section/panel headings: `700`
- leaf/body/annotation: `400`

## Arrows

- Orange `#E95420` only
- 1px shaft with filled head
- Orthogonal routing
- Keep arrows out of box fills and box borders

## Authoring

- Author diagrams in `scripts/diagrams/frames/*.yaml`
- Keep styling semantic: `level`, `variant`, structure, spacing
- Do not encode renderer behavior in ad hoc prose or token catalogs

## Verify

```bash
npm --prefix packages/layout-engine test
npm run preview
```

Default: tests + preview URL. **Do not take Playwright or browser screenshots unless the user explicitly asks.** If they ask, crop to the diagram region (not full viewport).
