---
name: level-assignment
description: "Assign correct frame levels in YAML when nesting > 0. Use when creating or modifying a frame YAML that contains containers (items with children). Ensures siblings share the same visual class."
argument-hint: "Path to the frame YAML file, or describe the nesting structure"
---

# Level assignment

## When to use

- Creating a new frame YAML with containers (any item that has `children:`).
- Modifying an existing frame YAML where nesting depth changes (adding/removing children).
- Reviewing a diagram where siblings have inconsistent levels.
- Any time `level:` values need to be set or corrected.

## The rule

Level assignment follows from the **deepest nesting among siblings**, not from each item's own children. The engine requires explicit `level:` fields in YAML – it never guesses levels from structure. This procedure tells you how to choose the right value.

### Algorithm

1. **Start with all items as leaves (level 1).** Items without `children:` and without `level:` are leaves by default.

2. **1-level nesting → promote all siblings to panel (level 2).** When any item at a given depth has `children:`, promote **all siblings at that depth** to `level: 2` – including those without children. A childless panel is a grey card; that's fine.

3. **2-level nesting → promote all siblings to section (level 3).** When any item at a given depth contains a panel that itself contains `children:` (2-level nesting from that item's perspective), promote **all siblings at that depth** to `level: 3` – including those that only wrap leaves directly or have no children at all.

### Key insight

Siblings never mix classes. If one item needs to be a section, **all** its siblings are sections. If one item needs to be a panel, **all** its siblings are panels.

## Procedure

1. **Map the nesting.** For each depth in the tree, find the maximum nesting depth among siblings.

2. **Assign levels bottom-up.**
   - Deepest items with no children: level 1 (leaf). No `level:` needed in YAML; it's the default.
   - Their parent's depth: if any sibling at this depth has children, all siblings get `level: 2`.
   - Grandparent's depth: if any sibling at this depth contains a level-2 panel with children, all siblings get `level: 3`.

3. **Set `level:` explicitly** on every headed container in the YAML. Leaves don't need an explicit level.

4. **Verify sibling consistency.** Scan each group of siblings. Every sibling at the same depth must have the same level.

5. **Check hierarchy rules.**
   - No section (3) inside a section (3).
   - No panel (2) inside a panel (2).
   - Annotations (`variant: annotation`), separators (`role: separator`),
     and highlights (`variant: highlight`) are exempt from level rules.
   - Layout wrappers (headingless containers with no `heading:` field)
     get level 0 automatically and don't count as a tier.
   - If you violate the nesting rules, `resolve_styles()` in
     `scripts/frame_loader.py` auto-downgrades at render time: a panel
     inside a panel becomes a leaf, a section inside a section becomes
     a panel. This is a safety net, not a feature – set levels
     correctly in YAML.

## Styling contract

Levels determine visual treatment automatically through `resolve_styles()`
in `scripts/frame_loader.py`. See `docs/frame-classes.md` for the
complete class table and rendering rules. Do **not** use inline styling
in YAML.

### Inline style ban

- **No `weight:` in label lines.** Use `heading:` for bold text on a frame.
- **No `fill:` in label lines.** Use `style: muted` for grey annotation text.
- **No `size:` in label lines.** Font sizes are determined by the class system.

### Heading field

Use `heading:` on the frame for bold heading text:

```yaml
# Container with heading (gets synthetic __heading child)
- id: my_panel
  level: 2
  heading: "Panel title"
  children:
    - id: child1
      label: [Content]

# Non-container with heading (heading prepended as bold first line)
- id: my_leaf
  heading: "Leaf title"
  label:
    - Body text below the heading
```

## Example

Planning, Implementation, and Delivery are siblings. Implementation wraps "Dev team" (a panel wrapping leaves) – that's 2-level nesting. Therefore **all three** are sections (`level: 3`), even though Planning and Delivery only contain leaves directly.

```yaml
children:
  - id: planning
    level: 3           # section – sibling has 2-level nesting
    heading: Planning
    children:
      - id: p_task1
        label: [Define scope]
      - id: p_task2
        label: [Set timeline]

  - id: implementation
    level: 3           # section – has 2-level nesting
    heading: Implementation
    children:
      - id: devteam
        level: 2       # panel – has children
        heading: Dev team
        children:
          - id: dev1
            label: [Frontend]
          - id: dev2
            label: [Backend]

  - id: delivery
    level: 3           # section – sibling has 2-level nesting
    heading: Delivery
    children:
      - id: d_task1
        label: [Deploy]
```

## Validation

After assigning levels:

1. Run `python -m pytest test_frame_loader.py test_layout_v3.py -q` from `scripts/`.
2. Open the diagram in the preview server and verify:
   - Sections have ALL-CAPS headings with black borders.
   - Panels have bold headings with grey fill.
   - Leaves have regular-weight headings with black borders.
   - No sibling group mixes classes.
3. Check that the override count in the editor sidebar shows "No overrides" (or only intentional sizing overrides, not stale ones).
