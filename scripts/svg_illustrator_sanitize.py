from __future__ import annotations

import argparse
import copy
import pathlib
import re
import sys
import xml.etree.ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
ET.register_namespace("", SVG_NS)


def qname(tag: str) -> str:
    return f"{{{SVG_NS}}}{tag}"


def local_name(tag: str) -> str:
    return tag.split("}", 1)[-1]


def parse_float(value: str | None, default: float = 0.0) -> float:
    if value is None:
        return default
    value = value.strip()
    if not value:
        return default
    match = re.match(r"^-?\d+(?:\.\d+)?", value)
    if not match:
        return default
    return float(match.group(0))


def fmt_num(value: float) -> str:
    if abs(value - round(value)) < 1e-6:
        return str(int(round(value)))
    return f"{value:.4f}".rstrip("0").rstrip(".")


def parse_viewbox(value: str | None) -> tuple[float, float, float, float]:
    if not value:
        return (0.0, 0.0, 1.0, 1.0)
    parts = re.split(r"[,\s]+", value.strip())
    if len(parts) != 4:
        return (0.0, 0.0, 1.0, 1.0)
    try:
        return tuple(float(part) for part in parts)  # type: ignore[return-value]
    except ValueError:
        return (0.0, 0.0, 1.0, 1.0)


def deep_replace_current_color(node: ET.Element, color: str) -> None:
    for element in node.iter():
        for attr_name, attr_value in list(element.attrib.items()):
            if attr_value == "currentColor":
                element.set(attr_name, color)


def remove_font_face(root: ET.Element) -> int:
    changed = 0
    for style in root.iter(qname("style")):
        text = style.text or ""
        updated = re.sub(r"@font-face\s*\{.*?\}", "", text, flags=re.S)
        updated = updated.replace(
            "'Ubuntu Sans Variable', 'Ubuntu Sans', sans-serif",
            "'Ubuntu Sans'",
        )
        updated = updated.replace(
            '"Ubuntu Sans Variable", "Ubuntu Sans", sans-serif',
            '"Ubuntu Sans"',
        )
        updated = updated.replace(
            "'Ubuntu Sans', sans-serif",
            "'Ubuntu Sans'",
        )
        updated = updated.replace(
            '"Ubuntu Sans", sans-serif',
            '"Ubuntu Sans"',
        )
        updated = re.sub(r"font-weight:\s*600\b", "font-weight: 700", updated)
        updated = re.sub(r"\n\s*\n+", "\n\n", updated)
        if updated != text:
            style.text = updated
            changed += 1
    return changed


def expand_use_elements(root: ET.Element) -> int:
    parent_map = {child: parent for parent in root.iter() for child in parent}
    symbol_map = {
        symbol.get("id"): symbol
        for symbol in root.iter(qname("symbol"))
        if symbol.get("id")
    }
    expanded = 0

    for use in list(root.iter(qname("use"))):
        href = use.get("href") or use.get(f"{{{XLINK_NS}}}href")
        if not href or not href.startswith("#"):
            continue

        target = symbol_map.get(href[1:])
        if target is None:
            continue

        min_x, min_y, vb_width, vb_height = parse_viewbox(target.get("viewBox"))
        width = parse_float(use.get("width"), vb_width or 1.0)
        height = parse_float(use.get("height"), vb_height or 1.0)
        x = parse_float(use.get("x"))
        y = parse_float(use.get("y"))
        scale_x = width / (vb_width or 1.0)
        scale_y = height / (vb_height or 1.0)

        new_group = ET.Element(qname("g"))

        for attr_name, attr_value in use.attrib.items():
            if attr_name in {"href", f"{{{XLINK_NS}}}href", "x", "y", "width", "height"}:
                continue
            new_group.set(attr_name, attr_value)

        transforms: list[str] = []
        existing_transform = use.get("transform")
        if existing_transform:
            transforms.append(existing_transform)
        transforms.append(
            f"translate({fmt_num(x)},{fmt_num(y)}) scale({fmt_num(scale_x)},{fmt_num(scale_y)})"
        )
        if min_x or min_y:
            transforms.append(f"translate({fmt_num(-min_x)},{fmt_num(-min_y)})")
        new_group.set("transform", " ".join(transforms))

        color = use.get("color")
        if color:
            new_group.set("color", color)

        for child in list(target):
            cloned = copy.deepcopy(child)
            if color:
                deep_replace_current_color(cloned, color)
            new_group.append(cloned)

        parent = parent_map.get(use)
        if parent is None:
            continue

        children = list(parent)
        insert_at = children.index(use)
        parent.insert(insert_at, new_group)
        parent.remove(use)
        expanded += 1

    if expanded:
        defs_parent_map = {child: parent for parent in root.iter() for child in parent}
        for symbol in list(root.iter(qname("symbol"))):
            parent = defs_parent_map.get(symbol)
            if parent is not None:
                parent.remove(symbol)
    return expanded


def collect_hazards(root: ET.Element) -> list[str]:
    hazards: list[str] = []

    for style in root.iter(qname("style")):
        text = style.text or ""
        if "@font-face" in text:
            hazards.append("@font-face")
        if "url(" in text:
            hazards.append("style url(...)")

    for element in root.iter():
        name = local_name(element.tag)
        if name == "use":
            hazards.append("<use>")
        if name == "symbol":
            hazards.append("<symbol>")
        if name == "image":
            href = element.get("href") or element.get(f"{{{XLINK_NS}}}href") or ""
            if href and not href.startswith("data:"):
                hazards.append("<image href>")
        for attr_name, attr_value in element.attrib.items():
            if attr_name in {"marker-start", "marker-mid", "marker-end"}:
                hazards.append(attr_name)
            if "url(" in attr_value:
                hazards.append(f"{attr_name}=url(...)")

    deduped: list[str] = []
    seen: set[str] = set()
    for hazard in hazards:
        if hazard not in seen:
            deduped.append(hazard)
            seen.add(hazard)
    return deduped


def normalize_css_value(value: str) -> str:
    value = value.strip()
    rem_match = re.fullmatch(r"(-?\d+(?:\.\d+)?)rem", value)
    if rem_match:
        px = float(rem_match.group(1)) * 16.0
        return f"{fmt_num(px)}px"
    return value


def parse_class_rules(root: ET.Element) -> dict[str, dict[str, str]]:
    rules: dict[str, dict[str, str]] = {}
    text_props = {
        "font-size",
        "font-weight",
        "fill",
        "font-variant-caps",
        "letter-spacing",
        "dominant-baseline",
    }
    for style in root.iter(qname("style")):
        text = style.text or ""
        for class_name, body in re.findall(r"\.([A-Za-z0-9_-]+)\s*\{([^}]*)\}", text, flags=re.S):
            props: dict[str, str] = {}
            for declaration in body.split(";"):
                if ":" not in declaration:
                    continue
                prop, raw_value = declaration.split(":", 1)
                prop = prop.strip()
                if prop not in text_props:
                    continue
                props[prop] = normalize_css_value(raw_value)
            if props:
                rules[class_name] = props
    return rules


def inline_text_styles(root: ET.Element) -> int:
    changed = 0
    class_rules = parse_class_rules(root)
    for tag in (qname("text"), qname("tspan")):
        for node in root.iter(tag):
            if node.get("font-family") != "Ubuntu Sans":
                node.set("font-family", "Ubuntu Sans")
                changed += 1
            for class_name in node.get("class", "").split():
                for attr_name, attr_value in class_rules.get(class_name, {}).items():
                    if node.get(attr_name) != attr_value:
                        node.set(attr_name, attr_value)
                        changed += 1
    return changed


def process_file(path: pathlib.Path, write: bool) -> tuple[bool, list[str]]:
    tree = ET.parse(path)
    root = tree.getroot()

    remove_font_face(root)
    inline_text_styles(root)
    expand_use_elements(root)
    hazards = collect_hazards(root)

    if write:
        ET.indent(tree, space="  ")
        tree.write(path, encoding="utf-8", xml_declaration=False)

    return (len(hazards) == 0, hazards)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Expand internal SVG symbol use and remove external font references for Illustrator-friendly output."
    )
    parser.add_argument("paths", nargs="+", help="SVG files to inspect or sanitize")
    parser.add_argument("--write", action="store_true", help="Write sanitized SVGs in place")
    args = parser.parse_args()

    exit_code = 0
    for raw_path in args.paths:
        path = pathlib.Path(raw_path)
        ok, hazards = process_file(path, write=args.write)
        status = "OK" if ok else "HAZARDS"
        print(f"{status} {path}")
        for hazard in hazards:
            print(f"  - {hazard}")
        if not ok:
            exit_code = 1

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
