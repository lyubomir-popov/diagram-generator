from __future__ import annotations

import argparse
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DRAWIO_DIR = ROOT / "diagrams" / "2.output" / "draw.io"
REVIEW_DIR = DRAWIO_DIR / "review"
CHECKPOINTS_DIR = DRAWIO_DIR / "checkpoints"


@dataclass(frozen=True)
class WorkflowPaths:
    source: Path
    relative: Path
    review: Path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Prepare, promote, or discard protected review copies for draw.io files.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    prepare = subparsers.add_parser("prepare", help="Create or refresh a review copy for a draw.io file.")
    prepare.add_argument("source", help="Path to the protected draw.io file, relative to the repo root or absolute.")
    prepare.add_argument("--overwrite-review", action="store_true", help="Replace an existing review copy instead of failing.")
    prepare.add_argument("--dry-run", action="store_true", help="Show planned file operations without writing files.")

    promote = subparsers.add_parser("promote", help="Checkpoint the original file and replace it with the review copy.")
    promote.add_argument("source", help="Path to the protected draw.io file, relative to the repo root or absolute.")
    promote.add_argument("--keep-review", action="store_true", help="Keep the review copy after promotion.")
    promote.add_argument("--dry-run", action="store_true", help="Show planned file operations without writing files.")

    discard = subparsers.add_parser("discard", help="Delete the review copy for a draw.io file.")
    discard.add_argument("source", help="Path to the protected draw.io file, relative to the repo root or absolute.")
    discard.add_argument("--dry-run", action="store_true", help="Show planned file operations without writing files.")

    return parser


def resolve_paths(source_arg: str) -> WorkflowPaths:
    raw_path = Path(source_arg)
    candidate = raw_path if raw_path.is_absolute() else (ROOT / raw_path)
    candidate = candidate.resolve(strict=False)

    try:
        relative = candidate.relative_to(REVIEW_DIR.resolve())
        source = DRAWIO_DIR / relative
    except ValueError:
        try:
            relative = candidate.relative_to(DRAWIO_DIR.resolve())
        except ValueError as exc:
            raise SystemExit(f"Source must live under {DRAWIO_DIR}") from exc
        if relative.parts and relative.parts[0] in {"review", "checkpoints"}:
            raise SystemExit("Pass the protected source file, not a file inside review/ or checkpoints/.")
        source = DRAWIO_DIR / relative

    if not source.exists():
        raise SystemExit(f"Source file does not exist: {source}")
    if source.is_dir():
        raise SystemExit(f"Source path is a directory, expected a .drawio file: {source}")
    if source.suffix.lower() != ".drawio":
        raise SystemExit(f"Source file must be a .drawio file: {source}")

    return WorkflowPaths(source=source, relative=relative, review=REVIEW_DIR / relative)


def print_step(action: str, path: Path) -> None:
    print(f"{action}: {path}")


def prepare_review_copy(paths: WorkflowPaths, *, overwrite_review: bool, dry_run: bool) -> int:
    if paths.review.exists() and not overwrite_review:
        raise SystemExit(
            f"Review copy already exists: {paths.review}\n"
            "Use --overwrite-review to replace it."
        )

    print_step("Source", paths.source)
    print_step("Review copy", paths.review)

    if dry_run:
        return 0

    paths.review.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(paths.source, paths.review)
    return 0


def promote_review_copy(paths: WorkflowPaths, *, keep_review: bool, dry_run: bool) -> int:
    if not paths.review.exists():
        raise SystemExit(
            f"Review copy does not exist: {paths.review}\n"
            "Run the prepare command first."
        )

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    checkpoint = CHECKPOINTS_DIR / timestamp / paths.relative

    print_step("Review copy", paths.review)
    print_step("Checkpoint", checkpoint)
    print_step("Promote to", paths.source)
    if not keep_review:
        print_step("Remove review copy", paths.review)

    if dry_run:
        return 0

    checkpoint.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(paths.source, checkpoint)
    shutil.copy2(paths.review, paths.source)
    if not keep_review:
        paths.review.unlink()
    return 0


def discard_review_copy(paths: WorkflowPaths, *, dry_run: bool) -> int:
    if not paths.review.exists():
        raise SystemExit(f"Review copy does not exist: {paths.review}")

    print_step("Discard review copy", paths.review)

    if dry_run:
        return 0

    paths.review.unlink()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    paths = resolve_paths(args.source)

    if args.command == "prepare":
        return prepare_review_copy(paths, overwrite_review=args.overwrite_review, dry_run=args.dry_run)
    if args.command == "promote":
        return promote_review_copy(paths, keep_review=args.keep_review, dry_run=args.dry_run)
    if args.command == "discard":
        return discard_review_copy(paths, dry_run=args.dry_run)

    raise SystemExit(f"Unknown command: {args.command}")


if __name__ == "__main__":
    sys.exit(main())