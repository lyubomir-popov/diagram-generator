"""Hard-fail guard: preview/served HTML must use Baseline Foundry, not hand-rolled CSS."""
from __future__ import annotations

import os
import pathlib
import re
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))
ALLOWLIST_FILE = ROOT / "scripts" / "preview_html_allowlist.txt"
BF_LINK = re.compile(r"%BF_STYLES%|/preview/bf-os\.css")
INLINE_STYLE = re.compile(r"<style\b", re.IGNORECASE)


def _allowlisted_prefixes() -> list[pathlib.Path]:
    if not ALLOWLIST_FILE.exists():
        return []
    prefixes: list[pathlib.Path] = []
    for line in ALLOWLIST_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        prefixes.append(ROOT / line.replace("/", pathlib.os.sep))
    return prefixes


def _is_allowlisted(path: pathlib.Path, prefixes: list[pathlib.Path]) -> bool:
    for prefix in prefixes:
        try:
            path.relative_to(prefix)
            return True
        except ValueError:
            continue
    return False


def _iter_html_files(base: pathlib.Path) -> list[pathlib.Path]:
    out: list[pathlib.Path] = []
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if d != "node_modules"]
        for name in filenames:
            if name.endswith(".html"):
                out.append(pathlib.Path(dirpath) / name)
    return sorted(out)


def _html_files_to_audit() -> list[pathlib.Path]:
    bases = [ROOT / "scripts" / "preview", ROOT / "packages"]
    out: list[pathlib.Path] = []
    for base in bases:
        if base.exists():
            out.extend(_iter_html_files(base))
    return out


def _audit_html(path: pathlib.Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    rel = path.relative_to(ROOT).as_posix()
    errors: list[str] = []
    if INLINE_STYLE.search(text):
        errors.append(f"{rel}: inline <style> blocks are forbidden — use Baseline Foundry + editor.css")
    if not BF_LINK.search(text):
        errors.append(
            f"{rel}: missing Baseline Foundry link (%BF_STYLES% template slot or /preview/bf-os.css)"
        )
    return errors


def test_baseline_foundry_assets_present() -> None:
    css = ROOT / "assets" / "baseline-foundry" / "os" / "styles.css"
    fonts = ROOT / "assets" / "baseline-foundry" / "fonts"
    assert css.is_file(), f"missing vendored BF stylesheet: {css.relative_to(ROOT)}"
    assert fonts.is_dir(), f"missing vendored BF fonts dir: {fonts.relative_to(ROOT)}"


def test_preview_shell_html_uses_baseline_foundry() -> None:
    prefixes = _allowlisted_prefixes()
    violations: list[str] = []
    for html_path in _html_files_to_audit():
        if _is_allowlisted(html_path, prefixes):
            continue
        violations.extend(_audit_html(html_path))
    assert not violations, "HTML Baseline Foundry contract violations:\n" + "\n".join(violations)


def test_no_handrolled_html_under_packages() -> None:
    pkg_root = ROOT / "packages"
    pkg_html = _iter_html_files(pkg_root) if pkg_root.exists() else []
    assert not pkg_html, (
        "Hand-rolled HTML under packages/ is forbidden (found: "
        + ", ".join(p.relative_to(ROOT).as_posix() for p in pkg_html)
        + "). Use scripts/preview_server.py + Frame YAML."
    )


def test_preview_server_requires_bf_at_startup() -> None:
    import preview_server

    assert hasattr(preview_server, "_require_bf_preview_assets")
    preview_server._require_bf_preview_assets()