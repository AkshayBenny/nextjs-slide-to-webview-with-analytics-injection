#!/usr/bin/env python3
"""Extract simple shape-level PowerPoint click actions for HTML overlays.

Uses only Python's standard library. Text-run hyperlinks are left to PDF.js' native
PDF annotations because their clickable word rectangles are not shape-sized.
"""
from __future__ import annotations

import json
import os
import posixpath
import sys
import zipfile
import xml.etree.ElementTree as ET
from typing import Any

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"p": P_NS, "a": A_NS, "r": R_NS}
SHAPE_TAGS = {f"{{{P_NS}}}{name}" for name in ("sp", "pic", "graphicFrame", "cxnSp")}


def resolve_part(base_directory: str, target: str) -> str:
    if target.startswith("/"):
        return posixpath.normpath(target.lstrip("/"))
    return posixpath.normpath(posixpath.join(base_directory, target))


def parse_relationships(archive: zipfile.ZipFile, part_path: str) -> dict[str, dict[str, str]]:
    try:
        raw = archive.read(part_path)
    except KeyError:
        return {}
    root = ET.fromstring(raw)
    relationships: dict[str, dict[str, str]] = {}
    for rel in root.findall(f"{{{PKG_REL_NS}}}Relationship"):
        rel_id = rel.attrib.get("Id")
        if rel_id:
            relationships[rel_id] = dict(rel.attrib)
    return relationships


def shape_transform(shape: ET.Element) -> tuple[int, int, int, int] | None:
    local = shape.tag.rsplit("}", 1)[-1]
    if local == "graphicFrame":
        transform = shape.find("p:xfrm", NS)
    else:
        transform = shape.find("p:spPr/a:xfrm", NS)
    if transform is None:
        return None
    offset = transform.find("a:off", NS)
    extent = transform.find("a:ext", NS)
    if offset is None or extent is None:
        return None
    try:
        x = int(offset.attrib["x"])
        y = int(offset.attrib["y"])
        width = int(extent.attrib["cx"])
        height = int(extent.attrib["cy"])
    except (KeyError, ValueError):
        return None
    if width <= 0 or height <= 0:
        return None
    return x, y, width, height


def slide_link_target(
    click: ET.Element,
    relationship: dict[str, str] | None,
    current_slide: int,
    slide_count: int,
    slide_number_by_part: dict[str, int],
) -> tuple[str, str, bool] | None:
    """Return (href, kind, opens_new_tab)."""
    rel_id = click.attrib.get(f"{{{R_NS}}}id")
    action = click.attrib.get("action", "")

    if rel_id and relationship:
        target = relationship.get("Target", "")
        target_mode = relationship.get("TargetMode", "")
        rel_type = relationship.get("Type", "")

        if target_mode.lower() == "external":
            if target.startswith(("https://", "http://", "mailto:", "tel:")):
                return target, "external", True
            return None

        if rel_type.endswith("/slide"):
            target_part = resolve_part("ppt/slides", target)
            target_slide = slide_number_by_part.get(target_part)
            if target_slide:
                return f"#slide-{target_slide}", "internal", False

    # PowerPoint's built-in show-jump actions do not always carry a relationship id.
    lowered = action.lower()
    if "hlinkshowjump" in lowered:
        if "firstslide" in lowered:
            target_slide = 1
        elif "lastslide" in lowered:
            target_slide = slide_count
        elif "nextslide" in lowered:
            target_slide = min(slide_count, current_slide + 1)
        elif "previousslide" in lowered:
            target_slide = max(1, current_slide - 1)
        else:
            return None
        return f"#slide-{target_slide}", "internal", False

    return None


def main(pptx_path: str, output_path: str) -> None:
    links: list[dict[str, Any]] = []

    with zipfile.ZipFile(pptx_path, "r") as archive:
        presentation = ET.fromstring(archive.read("ppt/presentation.xml"))
        slide_size = presentation.find("p:sldSz", NS)
        if slide_size is None:
            raise ValueError("Presentation slide dimensions are missing")
        slide_width = int(slide_size.attrib["cx"])
        slide_height = int(slide_size.attrib["cy"])

        presentation_rels = parse_relationships(archive, "ppt/_rels/presentation.xml.rels")
        slide_ids = presentation.findall("p:sldIdLst/p:sldId", NS)
        slide_parts: list[str] = []
        for slide_id in slide_ids:
            rel_id = slide_id.attrib.get(f"{{{R_NS}}}id")
            rel = presentation_rels.get(rel_id or "")
            if not rel or not rel.get("Target"):
                continue
            slide_parts.append(resolve_part("ppt", rel["Target"]))

        slide_number_by_part = {part: index + 1 for index, part in enumerate(slide_parts)}
        slide_count = len(slide_parts)

        for slide_number, slide_part in enumerate(slide_parts, start=1):
            slide_xml = ET.fromstring(archive.read(slide_part))
            rels_path = posixpath.join(
                posixpath.dirname(slide_part),
                "_rels",
                posixpath.basename(slide_part) + ".rels",
            )
            slide_rels = parse_relationships(archive, rels_path)
            shape_tree = slide_xml.find(".//p:spTree", NS)
            if shape_tree is None:
                continue

            # Only direct children of spTree are handled. Group-shape child transforms
            # need nested coordinate transforms and are intentionally left to PDF.js.
            for shape in list(shape_tree):
                if shape.tag not in SHAPE_TAGS:
                    continue
                non_visual = shape.find(".//p:cNvPr", NS)
                if non_visual is None:
                    continue
                click = non_visual.find("a:hlinkClick", NS)
                if click is None:
                    continue

                transform = shape_transform(shape)
                if transform is None:
                    continue
                target = slide_link_target(
                    click,
                    slide_rels.get(click.attrib.get(f"{{{R_NS}}}id", "")),
                    slide_number,
                    slide_count,
                    slide_number_by_part,
                )
                if target is None:
                    continue

                href, kind, new_tab = target
                x, y, width, height = transform
                left = max(0.0, (x / slide_width) * 100.0)
                top = max(0.0, (y / slide_height) * 100.0)
                right = min(100.0, ((x + width) / slide_width) * 100.0)
                bottom = min(100.0, ((y + height) / slide_height) * 100.0)
                if right <= left or bottom <= top:
                    continue

                links.append({
                    "slideNumber": slide_number,
                    "left": round(left, 4),
                    "top": round(top, 4),
                    "width": round(right - left, 4),
                    "height": round(bottom - top, 4),
                    "href": href,
                    "kind": kind,
                    "newTab": new_tab,
                    "label": non_visual.attrib.get("name", "Open link"),
                })

    temp_path = output_path + ".tmp"
    with open(temp_path, "w", encoding="utf-8") as output:
        json.dump(links, output, ensure_ascii=False)
    os.replace(temp_path, output_path)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: extract_pptx_links.py input.pptx output.json")
    main(sys.argv[1], sys.argv[2])
