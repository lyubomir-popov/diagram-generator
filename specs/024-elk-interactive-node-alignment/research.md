# Research: ELK interactive node alignment

## Question

Can the repo's current `elkjs` path honor interactive layered constraints strongly enough to support author nudges without any preview-side SVG translation hacks?

## Guardrails

- YAML remains the canonical source of truth.
- Graph-level ELK options stay in `meta.elk`.
- Per-node interactive constraints live only in `meta.elk_nodes`.
- Preview integration must route through the spec 025 engine contract and the spec 026 ELK controller boundary.
- No new Python layout authority is allowed.

## Findings from ELK docs

- Interactive layered behavior depends on graph-level strategy options such as:
  - `elk.layered.layering.strategy = INTERACTIVE`
  - `elk.layered.crossingMinimization.strategy = INTERACTIVE`
  - `elk.layered.cycleBreaking.strategy = INTERACTIVE`
- Per-node options relevant to this feature include:
  - `elk.layered.layering.layerChoiceConstraint`
  - `elk.layered.crossingMinimization.positionChoiceConstraint`
- These node options should be persisted with their full ELK option ids as keys. Do not invent a repo-local shorthand vocabulary.

## Open spike questions

1. Does the repo's current `elkjs` version visibly change output when the above per-node options are set?
2. Does `elkjs` require prior ordering or coordinate hints in addition to the documented constraints?
3. Which minimal fixture proves the effect without relying on preview DOM behavior?
4. If `elkjs` ignores the options, is there an upstream gap or a graph-builder omission in our current package?

## Decision

Implementation remains blocked until an automated fixture proves that `elkjs` changes layered output because of the persisted per-node constraints. If that proof does not exist, stop and record the upstream or package gap. Do not ship a shell-side transform workaround.