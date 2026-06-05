# Data model: ELK interactive node alignment

## Canonical YAML shape

```yaml
meta:
  layout_engine: elk-layered
  elk:
    elk.layered.layering.strategy: INTERACTIVE
    elk.layered.crossingMinimization.strategy: INTERACTIVE
    elk.layered.cycleBreaking.strategy: INTERACTIVE
  elk_nodes:
    some_leaf_id:
      elk.layered.layering.layerChoiceConstraint: "2"
      elk.layered.crossingMinimization.positionChoiceConstraint: "1"
```

## Ownership rules

- `meta.elk` is the graph-level ELK option map.
- `meta.elk_nodes` is the only canonical per-node interactive-constraint map.
- Keys inside each `meta.elk_nodes.<nodeId>` object must be full ELK option ids.
- Values are stored as strings in YAML so they round-trip through the existing persistence conventions.
- Empty per-node maps should be removed on save rather than preserved as empty objects.

## Derived runtime DTO

The preview and export runtime may expose a derived DTO shaped like:

```ts
type ElkNodeConstraintMap = Record<string, Record<string, string>>;
```

That DTO is transport only. It must be emitted from and written back to the canonical YAML shape above.

## Save semantics

- Save responses must rehydrate from canonical persisted state.
- Partial saves must merge `meta.elk_nodes` without dropping unrelated node entries.
- Clearing a node's constraints removes only that node's keys, not unrelated graph-level `meta.elk` options.

## Graph-builder contract

- The ELK graph builder receives graph-level options from `meta.elk`.
- Per-node constraint maps from `meta.elk_nodes` are attached to the corresponding ELK node entries.
- Export, preview relayout, and saved reload all use the same graph-builder path.