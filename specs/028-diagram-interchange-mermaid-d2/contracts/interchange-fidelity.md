# Interchange fidelity matrix

Normative reference for spec **028**. Status column reflects **v1 today** (022 export only); target column is **028 complete**.

Legend:

- **Y** — preserved
- **N** — dropped silently today (bug — fix in 028 phase 0)
- **W** — dropped with `*_UNSUPPORTED_*` warning
- **—** — not applicable

## Frame node fields (`AuthorFrameNode`)

| Field | Export Mermaid | Export D2 | Import Mermaid (target) | Import D2 (target) |
|-------|----------------|-----------|---------------------------|---------------------|
| `id` | Y | Y | Y | Y |
| `children` / nesting | Y (subgraph) | Y (block) | Y | Y |
| `label[]` | Y (`<br/>`) | Y (quoted `\n`) | Y | Y |
| `heading` | W (container) | Y (block header) | — | Y |
| `icon` / `iconFill` | W | W | — | W |
| `direction`, `gap`, padding* | W | W | — | — |
| sizing / width / height* | W | W | — | — |
| `align`, `justify`, `wrap` | W | W | — | — |
| `level`, `variant`, `role` | W | W | — | — |
| `position`, `x`, `y` | W | W | — | — |
| `fill`, `border` | W | W | — | — |
| `use` (template) | — (expanded at compile) | — | — | — |

## Arrow fields (`AuthorArrow`)

| Field | Export Mermaid | Export D2 | Import Mermaid (target) | Import D2 (target) |
|-------|----------------|-----------|---------------------------|---------------------|
| `source` / `target` | Y (base id) | Y (dot path) | Y | Y |
| Anchor-qualified refs | W | W | — | W |
| `label[]` | W (ignored) | Y | W | Y |
| `style`, `color` | N → **W** (028) | N → **W** (028) | — | — |
| `labelGap` | N → **W** (028) | N → **W** (028) | — | — |
| `waypoints` | W | W | — | — |
| Missing frame ref | N → **W** (028) | N → **W** (028) | W | W |

## Document / meta

| Field | Export Mermaid | Export D2 | Import (target) |
|-------|----------------|-----------|-------------------|
| `title` | — | — | Y (YAML top-level) |
| `meta.layout_engine` (elk) | — | Y (coarse `vars`) | W |
| `meta.elk` tuning | — | N | — |
| `defaults` / templates | — | — | — (compile-time only) |

## Synthetic AST transforms (both directions)

| Transform | Export | Import (target) |
|-----------|--------|-----------------|
| Omit `page` wrapper when it only groups children | Y | Re-insert `page` wrapper |
| Flatten sibling export roots | Y | Nest under `page` |

## Warning code namespaces

| Prefix | Meaning |
|--------|---------|
| `MERMAID_UNSUPPORTED_*` | Export loss |
| `D2_UNSUPPORTED_*` | Export loss |
| `MERMAID_MISSING_*` | Export invalid ref |
| `D2_MISSING_*` | Export invalid ref |
| `IMPORT_MERMAID_UNSUPPORTED_*` | Import skip |
| `IMPORT_D2_UNSUPPORTED_*` | Import skip |
