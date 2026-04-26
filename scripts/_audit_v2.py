"""Quick SVG audit: compare v1 vs v2 element counts for all diagrams."""
import re
from pathlib import Path

SVG_DIR = Path("../diagrams/2.output/svg")

SLUGS = [
    "attention-qkv",
    "gpu-waiting-scheduler",
    "inference-snaps",
    "logic-data-vram",
    "memory-wall",
    "request-to-hardware-stack",
    "rise-of-inference-economy",
]


def audit(slug: str) -> None:
    v1 = (SVG_DIR / f"{slug}-onbrand.svg").read_text(encoding="utf-8")
    v2 = (SVG_DIR / f"{slug}-onbrand-v2.svg").read_text(encoding="utf-8")

    vb1 = re.search(r'viewBox="([^"]+)"', v1)
    vb2 = re.search(r'viewBox="([^"]+)"', v2)

    o1 = len(re.findall(r"<line[^>]*E95420", v1)) + len(re.findall(r"<polygon[^>]*E95420", v1))
    o2 = len(re.findall(r"<line[^>]*E95420", v2)) + len(re.findall(r"<polygon[^>]*E95420", v2))

    t1 = [t.strip() for t in re.findall(r">([^<]+)</tspan>", v1) if t.strip()]
    t2 = [t.strip() for t in re.findall(r">([^<]+)</tspan>", v2) if t.strip()]

    r1 = len(re.findall(r"<rect ", v1))
    r2 = len(re.findall(r"<rect ", v2))

    img1 = len(re.findall(r"<image ", v1))
    img2 = len(re.findall(r"<image ", v2))

    wt1 = len(re.findall(r'fill="#FFFFFF"', v1))
    wt2 = len(re.findall(r'fill="#FFFFFF"', v2))

    dash1 = len(re.findall(r"stroke-dasharray", v1))
    dash2 = len(re.findall(r"stroke-dasharray", v2))

    missing = set(t1) - set(t2)
    extra = set(t2) - set(t1)

    issues = []
    if o2 < o1:
        issues.append(f"MISSING {o1 - o2} orange elements ({o1}→{o2})")
    if img2 < img1:
        issues.append(f"MISSING {img1 - img2} icons ({img1}→{img2})")
    if len(t2) < len(t1):
        issues.append(f"MISSING {len(t1) - len(t2)} text spans ({len(t1)}→{len(t2)})")
    if missing:
        issues.append(f"MISSING TEXT: {list(missing)[:5]}")
    if dash1 > 0 and dash2 == 0:
        issues.append("MISSING dashed lines")

    status = "OK" if not issues else "PROBLEMS"
    print(f"\n=== {slug} ({status}) ===")
    print(f"  ViewBox: v1={vb1.group(1) if vb1 else '?'}  v2={vb2.group(1) if vb2 else '?'}")
    print(f"  Orange: v1={o1} v2={o2}")
    print(f"  Rects: v1={r1} v2={r2}")
    print(f"  Icons: v1={img1} v2={img2}")
    print(f"  WhiteFill: v1={wt1} v2={wt2}")
    print(f"  Texts: v1={len(t1)} v2={len(t2)}")
    print(f"  DashedLines: v1={dash1} v2={dash2}")
    for iss in issues:
        print(f"  ⚠ {iss}")
    if extra:
        print(f"  + EXTRA TEXT: {list(extra)[:5]}")


for s in SLUGS:
    try:
        audit(s)
    except Exception as e:
        print(f"\n=== {s} (ERROR) ===")
        print(f"  {e}")
