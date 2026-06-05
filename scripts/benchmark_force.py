#!/usr/bin/env python3
"""Benchmark the TypeScript force runtime via the layout-engine Node entrypoint.

Run: python scripts/benchmark_force.py [--ticks 300] [--sizes 10,50,100]
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
BENCHMARK_SCRIPT = ROOT / "packages" / "layout-engine" / "scripts" / "benchmark-force.mjs"


def main() -> int:
    node = shutil.which("node")
    if node is None:
        print("force benchmark unavailable: Node.js is required to run the TypeScript force runtime benchmark.")
        return 1
    if not BENCHMARK_SCRIPT.is_file():
        print(f"force benchmark unavailable: missing {BENCHMARK_SCRIPT}")
        return 1

    proc = subprocess.run(
        [node, str(BENCHMARK_SCRIPT), *sys.argv[1:]],
        cwd=str(ROOT),
    )
    return int(proc.returncode)


if __name__ == "__main__":
    raise SystemExit(main())
