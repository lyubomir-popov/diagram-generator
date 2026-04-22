from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable
import xml.etree.ElementTree as ET


PROVENANCE_VALUE = "diagram-generator"
GENERATED_TAG = "dg-generated"
ROLE_TAG_PREFIX = "dg-role-"
TOKEN_TAG_PREFIX = "dg-token-"

SOURCE_ATTR = "data-dg-source"
ROLE_ATTR = "data-dg-role"
STYLE_TOKENS_ATTR = "data-dg-style-tokens"


@dataclass(frozen=True)
class CellMetadata:
    role: str
    style_tokens: tuple[str, ...] = ()
    extra_tags: tuple[str, ...] = ()


def normalize_tokens(tokens: Iterable[str] | None) -> tuple[str, ...]:
    if not tokens:
        return ()

    ordered: list[str] = []
    seen: set[str] = set()
    for token in tokens:
        normalized = token.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(normalized)
    return tuple(ordered)


def metadata_attrs(metadata: CellMetadata | None) -> dict[str, str]:
    if metadata is None:
        return {}

    style_tokens = normalize_tokens(metadata.style_tokens)
    tags = [GENERATED_TAG, f"{ROLE_TAG_PREFIX}{metadata.role}"]
    tags.extend(f"{TOKEN_TAG_PREFIX}{token}" for token in style_tokens)
    tags.extend(tag.strip() for tag in metadata.extra_tags if tag.strip())

    attrs = {
        SOURCE_ATTR: PROVENANCE_VALUE,
        ROLE_ATTR: metadata.role,
        "tags": " ".join(tags),
    }
    if style_tokens:
        attrs[STYLE_TOKENS_ATTR] = ",".join(style_tokens)
    return attrs


def cell_tags(cell: ET.Element) -> set[str]:
    return {tag for tag in cell.get("tags", "").split() if tag}


def is_generated_cell(cell: ET.Element) -> bool:
    return cell.get(SOURCE_ATTR) == PROVENANCE_VALUE or GENERATED_TAG in cell_tags(cell)


def cell_role(cell: ET.Element) -> str | None:
    role = cell.get(ROLE_ATTR)
    if role:
        return role

    for tag in cell_tags(cell):
        if tag.startswith(ROLE_TAG_PREFIX):
            return tag[len(ROLE_TAG_PREFIX):]
    return None


def cell_style_tokens(cell: ET.Element) -> tuple[str, ...]:
    explicit = cell.get(STYLE_TOKENS_ATTR, "")
    if explicit:
        return normalize_tokens(part.strip() for part in explicit.split(","))

    parsed = [tag[len(TOKEN_TAG_PREFIX):] for tag in cell_tags(cell) if tag.startswith(TOKEN_TAG_PREFIX)]
    return normalize_tokens(parsed)


def cell_matches(
    cell: ET.Element,
    *,
    generated_only: bool = True,
    roles: set[str] | None = None,
    tokens: set[str] | None = None,
) -> bool:
    if generated_only and not is_generated_cell(cell):
        return False

    if roles:
        role = cell_role(cell)
        if role not in roles:
            return False

    if tokens and not set(cell_style_tokens(cell)).intersection(tokens):
        return False

    return True


def style_items(style: str) -> list[tuple[str, str]]:
    items: list[tuple[str, str]] = []
    for segment in style.split(";"):
        stripped = segment.strip()
        if not stripped:
            continue
        if "=" in stripped:
            key, value = stripped.split("=", 1)
        else:
            key, value = stripped, ""
        items.append((key, value))
    return items


def style_lookup(style: str) -> dict[str, str]:
    return {key: value for key, value in style_items(style)}


def update_style(
    style: str,
    *,
    set_props: dict[str, str] | None = None,
    unset_props: Iterable[str] | None = None,
) -> str:
    items = style_items(style)
    unset = {key for key in (unset_props or []) if key}

    filtered: list[tuple[str, str]] = [(key, value) for key, value in items if key not in unset]
    index = {key: idx for idx, (key, _) in enumerate(filtered)}

    for key, value in (set_props or {}).items():
        if key in index:
            filtered[index[key]] = (key, value)
        else:
            index[key] = len(filtered)
            filtered.append((key, value))

    if not filtered:
        return ""
    return ";".join(f"{key}={value}" if value else key for key, value in filtered) + ";"