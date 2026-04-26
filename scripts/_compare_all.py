"""Generate v1 vs v2 comparison screenshots for all diagrams."""
from pathlib import Path
from visual_compare import compare

svg_dir = Path("../diagrams/2.output/svg")
out_dir = Path("../diagrams/3.compare/visual-diff")
out_dir.mkdir(parents=True, exist_ok=True)

slugs = [
    "attention-qkv-onbrand",
    "gpu-waiting-scheduler-onbrand",
    "inference-snaps-onbrand",
    "logic-data-vram-onbrand",
    "memory-wall-onbrand",
    "request-to-hardware-stack-onbrand",
    "rise-of-inference-economy-onbrand",
]

for slug in slugs:
    v1 = svg_dir / f"{slug}.svg"
    v2 = svg_dir / f"{slug}-v2.svg"
    if v1.exists() and v2.exists():
        out = out_dir / f"{slug}-v1-vs-v2.png"
        print(f"Comparing {slug}...")
        try:
            r = compare(v1, v2, output=out, title=f"{slug}: v1 (left) vs v2 (right)")
            pct = r.get("diff_percent", "n/a")
            print(f"  diff={pct}%")
        except Exception as e:
            print(f"  ERROR: {e}")
    else:
        print(f"SKIP {slug}: v1={v1.exists()} v2={v2.exists()}")

print("Done")
