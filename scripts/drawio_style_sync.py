from __future__ import annotations

import argparse
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

import diagram_shared as shared
import drawio_style_tokens as dg_tokens


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Batch rewrite tokenized draw.io style fields across generated diagrams.",
    )
    parser.add_argument(
        "paths",
        nargs="*",
        help="Draw.io files or directories. Defaults to diagrams/2.output/draw.io/.",
    )
    parser.add_argument(
        "--token",
        action="append",
        default=[],
        help="Match only cells with this draw.io style token. Repeatable.",
    )
    parser.add_argument(
        "--role",
        action="append",
        default=[],
        help="Match only cells with this draw.io role. Repeatable.",
    )
    parser.add_argument(
        "--set",
        dest="set_props",
        action="append",
        default=[],
        metavar="KEY=VALUE",
        help="Set or replace a draw.io style field on matching cells. Repeatable.",
    )
    parser.add_argument(
        "--unset",
        dest="unset_props",
        action="append",
        default=[],
        metavar="KEY",
        help="Remove a draw.io style field from matching cells. Repeatable.",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write changes back to disk. Without this flag the script runs in dry-run mode.",
    )
    parser.add_argument(
        "--include-review",
        action="store_true",
        help="Include files under diagrams/2.output/draw.io/review/.",
    )
    parser.add_argument(
        "--include-checkpoints",
        action="store_true",
        help="Include files under diagrams/2.output/draw.io/checkpoints/.",
    )
    parser.add_argument(
        "--include-untagged",
        action="store_true",
        help="Allow matches outside generator-tagged cells.",
    )
    return parser


def parse_set_props(raw_items: list[str]) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for item in raw_items:
        if "=" not in item:
            raise SystemExit(f"Invalid --set value '{item}'. Use KEY=VALUE.")
        key, value = item.split("=", 1)
        normalized_key = key.strip()
        if not normalized_key:
            raise SystemExit(f"Invalid --set value '{item}'. Style keys cannot be empty.")
        parsed[normalized_key] = value
    return parsed


def resolve_targets(
    raw_paths: list[str],
    *,
    include_review: bool,
    include_checkpoints: bool,
) -> list[Path]:
    candidates = [shared.DRAWIO_DIR] if not raw_paths else [Path(raw_path) for raw_path in raw_paths]
    resolved: list[Path] = []

    for candidate in candidates:
        path = candidate if candidate.is_absolute() else (shared.ROOT / candidate)
        if path.is_dir():
            for file_path in sorted(path.rglob("*.drawio")):
                if should_skip(file_path, include_review=include_review, include_checkpoints=include_checkpoints):
                    continue
                resolved.append(file_path)
            continue

        if not path.exists():
            raise SystemExit(f"Path does not exist: {path}")
        if path.suffix.lower() != ".drawio":
            raise SystemExit(f"Expected a .drawio file: {path}")
        if should_skip(path, include_review=include_review, include_checkpoints=include_checkpoints):
            continue
        resolved.append(path)

    unique_paths = sorted(dict.fromkeys(file_path.resolve() for file_path in resolved))
    if not unique_paths:
        raise SystemExit("No matching .drawio files found.")
    return unique_paths


def should_skip(path: Path, *, include_review: bool, include_checkpoints: bool) -> bool:
    normalized_parts = {part.lower() for part in path.parts}
    if not include_review and "review" in normalized_parts:
        return True
    if not include_checkpoints and "checkpoints" in normalized_parts:
        return True
    return False


def rewrite_file(
    path: Path,
    *,
    roles: set[str],
    tokens: set[str],
    generated_only: bool,
    set_props: dict[str, str],
    unset_props: set[str],
    write_changes: bool,
) -> tuple[int, int]:
    tree = ET.parse(path)
    root = tree.getroot()

    matched = 0
    changed = 0
    for cell in root.iter("mxCell"):
        style = cell.get("style")
        if style is None:
            continue
        if not dg_tokens.cell_matches(
            cell,
            generated_only=generated_only,
            roles=roles or None,
            tokens=tokens or None,
        ):
            continue

        matched += 1
        updated_style = dg_tokens.update_style(style, set_props=set_props, unset_props=unset_props)
        if updated_style == style:
            continue

        cell.set("style", updated_style)
        changed += 1

    if changed and write_changes:
        ET.indent(tree, space="  ")
        tree.write(path, encoding="utf-8", xml_declaration=False)
        ET.parse(path)

    return matched, changed


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    set_props = parse_set_props(args.set_props)
    unset_props = {item.strip() for item in args.unset_props if item.strip()}
    if not set_props and not unset_props:
        raise SystemExit("Nothing to do. Provide at least one --set or --unset operation.")

    roles = {item.strip() for item in args.role if item.strip()}
    tokens = {item.strip() for item in args.token if item.strip()}
    targets = resolve_targets(
        args.paths,
        include_review=args.include_review,
        include_checkpoints=args.include_checkpoints,
    )

    total_matched = 0
    total_changed = 0
    mode_label = "write" if args.write else "dry-run"
    for path in targets:
        matched, changed = rewrite_file(
            path,
            roles=roles,
            tokens=tokens,
            generated_only=not args.include_untagged,
            set_props=set_props,
            unset_props=unset_props,
            write_changes=args.write,
        )
        total_matched += matched
        total_changed += changed
        if matched or changed:
            print(f"[{mode_label}] {path}: matched {matched}, changed {changed}")

    print(f"[{mode_label}] total matched {total_matched}, total changed {total_changed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())