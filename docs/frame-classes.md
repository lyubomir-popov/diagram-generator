# Frame classes

This is the testable spec for frame visual treatment. Every rendered
frame must resolve to exactly one of these classes. If a diagram
contains styling that doesn't match one of these four, it fails
acceptance.

## The four classes

| Class | Level | Heading | Fill | Border | Text | Contains |
|-------|-------|---------|------|--------|------|----------|
| **Section** | 3 | small-caps, bold | transparent | black 1px | black | panels, leaves |
| **Panel** | 2 | bold | `#F3F3F3` | `#F3F3F3` 1px | black | leaves |
| **Leaf** | 1 | regular weight | transparent | black 1px | black | nothing |
| **Annotation** | — | — | transparent | none | `#666666` | nothing |

Plus two special cases that are not user-authored:

| Class | Trigger | Fill | Border | Text |
|-------|---------|------|--------|------|
| **Highlight** | `variant: highlight` | `#000000` | `#000000` 1px | white |
| **Separator** | `role: separator` | transparent | none | — |

## Hierarchy rules

- A **section** (level 3) may contain panels (level 2) and leaves
  (level 1). It must not contain another section.
- A **panel** (level 2) may contain leaves (level 1). It must not
  contain another panel (grey-on-grey has no visible boundary).
- A **leaf** (level 1) has no headed children.
- An **annotation** has `variant: annotation` or `border: none` and is
  a borderless text label with lighter grey text. It may appear at any
  depth.
- Layout wrappers (headingless containers, `__body`/`__heading`
  synthetics) are invisible and do not count as a tier.

## YAML mapping

The YAML author sets `level:` explicitly on every headed container:

```yaml
- id: my_section
  level: 3
  heading: "Section heading"     # renders small-caps, bold
  children:
    - id: my_panel
      level: 2
      heading: "Panel heading"   # renders bold
      children:
        - id: my_leaf
          label: [Leaf text]     # renders regular weight
```

Leaves with headings use regular-weight text (not bold). Set `level: 1`
explicitly when a leaf has a heading and you want to be explicit, but
level 1 is the default for any frame without `level:`.

## Validation contract

A diagram is valid if and only if:

1. Every headed container has an explicit `level:` (2 or 3).
2. No level-3 section contains a level-3 child.
3. No level-2 panel contains a level-2 child.
4. Every resolved frame maps to exactly one class from the table above.
5. No frame uses styling that doesn't match its class (e.g. bold
   heading on a leaf, grey fill without level 2, missing border on a
   panel).
