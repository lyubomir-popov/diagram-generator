# Data Model: Diagram audit

**Feature**: 004-diagram-audit | **Date**: 2026-05-29

## Entities

### Frame YAML override (the thing being removed)

A redundant override is any explicit `fill:` or `border:` property in a frame YAML node that matches what `resolve_styles()` would compute from the node's structural role (level) and variant.

| Field | Type | Redundancy condition |
|-------|------|---------------------|
| `border: none` | string | Node is L0 (root/wrapper) |
| `border: solid` | string | Node is L2 (panel + heading, leaf descendants) |
| `border: none` | string | Node is interior layout wrapper (effectively L0) |
| `fill: grey` / `fill: "#F3F3F3"` | string | Node is L2 |
| `fill: transparent` | string | Node is L0 or L1 |

### File inventory

| File | Effort | Redundancies | Notes |
|------|--------|-------------|-------|
| complex-routing-usecase | Light | root `border: none` | |
| complex-testcase | Light | root `border: none` | |
| simple-testcase | Light | root `border: none` | |
| android-container-vs-vm | Medium | root border + interior overrides | |
| android-custom-to-cloud | Medium | root border + interior overrides | |
| example-deployment-pipeline | Medium | root border + interior overrides | |
| example-platform-architecture | Medium | root border + interior overrides | |
| example-stacked-blocks | Medium | root border + interior overrides | |
| maas-vendor-support | Medium | root border + interior overrides | |
| support-engineering-flow | Medium | root border + interior overrides | |
| android-graphics-stack | Heavy | many border/fill overrides | |
| android-security-comparison | Heavy | many border/fill overrides | |
| aws-hld | Heavy | many border/fill overrides | |
| diagram-intake-workflow | Heavy | many border/fill overrides | |
| diagram-language-workflow | Heavy | many border/fill overrides | |
| gpu-waiting-scheduler | Heavy | many border/fill overrides | |
| lightning-talk-engine | Heavy | many border/fill overrides | |
| lt-a4-generator | Heavy | many border/fill overrides | |
| lt-diagram-generator | Heavy | missing L2 border (engine handles it) | |
| lt-summit-identity | Heavy | many border/fill overrides | |
| maas-architecture | Heavy | many border/fill overrides | |
| maas-machine-lifecycle | Heavy | many border/fill overrides | |
| request-to-hardware-stack | Heavy | 20+ `border: none` instances | Most overrides of any file |
| rise-of-inference-economy | Heavy | many border/fill overrides | |

### Validation rules

1. **Visual identity**: Rendered SVG output must be identical before and after cleanup for each file.
2. **Test suite**: All 235 tests must pass after every batch.
3. **No engine changes**: Only YAML files are modified. No Python source changes.
4. **Preserve intentional overrides**: `variant:` declarations and overrides that produce effects different from level defaults must be kept.

### State transitions

Each file moves through:
```
unaudited → cleaned → verified → committed
```

- **unaudited**: Original state with potential redundant overrides
- **cleaned**: Redundant overrides removed
- **verified**: Test suite passes + browser verification confirms visual identity
- **committed**: Included in a batch commit
