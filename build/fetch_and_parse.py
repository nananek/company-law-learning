#!/usr/bin/env python3
"""
Fetch Company Act (会社法) from e-Laws API and parse into JSON files
for the 会社法条文マップ frontend.
"""

import json
import os
import re
import sys
from pathlib import Path

import requests
from lxml import etree

API_URL = "https://laws.e-gov.go.jp/api/1/lawdata/417AC0000000086"
OUTPUT_DIR = Path(__file__).parent.parent / "docs" / "data"

# Part color mapping
PART_COLORS = {
    1: "#3B82F6",  # blue
    2: "#10B981",  # green
    3: "#14B8A6",  # teal
    4: "#F59E0B",  # orange
    5: "#8B5CF6",  # purple
    6: "#EC4899",  # pink
    7: "#6B7280",  # gray
    8: "#EF4444",  # red
}


def fetch_law_xml() -> bytes:
    """Fetch the full Company Act XML from e-Laws API."""
    print("Fetching Company Act from e-Laws API...")
    resp = requests.get(API_URL, timeout=120)
    resp.raise_for_status()
    print(f"  Received {len(resp.content)} bytes")
    return resp.content


def get_text(elem, strip=True):
    """Extract all text content from an XML element recursively."""
    if elem is None:
        return ""
    text = etree.tostring(elem, method="text", encoding="unicode")
    if strip:
        text = text.strip()
    return text


def parse_sentence(elem):
    """Parse a Sentence element, extracting text."""
    if elem is None:
        return ""
    return get_text(elem)


def parse_items(parent, ns):
    """Parse Item (号) elements under a parent."""
    items = []
    for item in parent.findall("Item", ns):
        item_title = get_text(item.find("ItemTitle", ns))
        item_sentence = ""
        item_sent_elem = item.find("ItemSentence", ns)
        if item_sent_elem is not None:
            parts = []
            for sent in item_sent_elem.findall("Sentence", ns):
                parts.append(get_text(sent))
            for col in item_sent_elem.findall("Column", ns):
                for sent in col.findall("Sentence", ns):
                    parts.append(get_text(sent))
            item_sentence = "".join(parts)

        subitems = []
        for si in item.findall("Subitem1", ns):
            si_title = get_text(si.find("Subitem1Title", ns))
            si_sent_elem = si.find("Subitem1Sentence", ns)
            si_text = ""
            if si_sent_elem is not None:
                parts = []
                for sent in si_sent_elem.findall("Sentence", ns):
                    parts.append(get_text(sent))
                si_text = "".join(parts)
            subitems.append({"title": si_title, "text": si_text})

        items.append({
            "title": item_title,
            "text": item_sentence,
            "subitems": subitems if subitems else None,
        })
    return items


def parse_paragraphs(article, ns):
    """Parse Paragraph (項) elements in an Article."""
    paragraphs = []
    for para in article.findall("Paragraph", ns):
        para_num_elem = para.find("ParagraphNum", ns)
        para_num = get_text(para_num_elem) if para_num_elem is not None else ""

        para_sent_elem = para.find("ParagraphSentence", ns)
        para_text = ""
        if para_sent_elem is not None:
            parts = []
            for sent in para_sent_elem.findall("Sentence", ns):
                parts.append(get_text(sent))
            para_text = "".join(parts)

        items = parse_items(para, ns)

        paragraphs.append({
            "num": para_num,
            "text": para_text,
            "items": items if items else None,
        })
    return paragraphs


def parse_article(article, ns):
    """Parse a single Article (条) element."""
    article_num = article.get("Num", "")
    title = get_text(article.find("ArticleTitle", ns))
    caption_elem = article.find("ArticleCaption", ns)
    caption = get_text(caption_elem) if caption_elem is not None else ""
    paragraphs = parse_paragraphs(article, ns)

    return {
        "num": article_num,
        "title": title,
        "caption": caption,
        "paragraphs": paragraphs,
    }


def count_articles(elem, ns):
    """Count total Article elements under an element."""
    return len(elem.findall(".//Article", ns))


def extract_article_range(elem, ns):
    """Extract first and last article numbers under an element."""
    articles = elem.findall(".//Article", ns)
    if not articles:
        return ""
    first = articles[0].get("Num", "")
    last = articles[-1].get("Num", "")
    first_disp = format_article_num(first)
    last_disp = format_article_num(last)
    if first == last:
        return f"{first_disp}条"
    return f"{first_disp}条-{last_disp}条"


def format_article_num(num_str):
    """Format article number: '38_3_2' -> '38の3の2'."""
    if not num_str:
        return ""
    return num_str.replace("_", "の")


def make_id(*parts):
    """Create a hierarchical ID from parts."""
    return "-".join(str(p) for p in parts if p)


def process_hierarchy(elem, ns, level_tags, id_prefix, part_idx=None):
    """
    Recursively process the hierarchy: Part > Chapter > Section > Subsection > Division.
    Returns (hierarchy_node, articles_list).
    """
    # Define the hierarchy levels
    levels = [
        ("Part", "PartTitle"),
        ("Chapter", "ChapterTitle"),
        ("Section", "SectionTitle"),
        ("Subsection", "SubsectionTitle"),
        ("Division", "DivisionTitle"),
    ]

    hierarchy_children = []
    all_articles = []

    # Try each level that might be a direct child
    for tag, title_tag in levels:
        children = elem.findall(tag, ns)
        if not children:
            continue

        for idx, child in enumerate(children, 1):
            child_num = child.get("Num", str(idx))
            title_elem = child.find(title_tag, ns)
            title = get_text(title_elem) if title_elem is not None else ""

            # Extract short name (remove 第X編/章/節 prefix)
            name_short = re.sub(r'^第[一二三四五六七八九十百千]+[編章節款目]\s*', '', title)

            child_id = make_id(id_prefix, tag.lower() + child_num)

            # Determine part index for coloring
            current_part_idx = part_idx
            if tag == "Part":
                current_part_idx = idx

            # Recurse
            child_node, child_articles = process_hierarchy(
                child, ns, levels, child_id, current_part_idx
            )

            article_count = count_articles(child, ns)
            article_range = extract_article_range(child, ns)

            node = {
                "id": child_id,
                "name": title,
                "nameShort": name_short,
                "articleRange": article_range,
                "articleCount": article_count,
                "color": PART_COLORS.get(current_part_idx, "#6B7280"),
                "children": child_node["children"] if child_node["children"] else None,
            }
            hierarchy_children.append(node)
            all_articles.extend(child_articles)

    # Process direct Article children (leaf level)
    direct_articles = elem.findall("Article", ns)
    for article in direct_articles:
        parsed = parse_article(article, ns)
        all_articles.append({
            "sectionId": id_prefix,
            **parsed,
        })

    return {"children": hierarchy_children}, all_articles


def build_data(xml_bytes):
    """Parse the XML and build all JSON data structures."""
    root = etree.fromstring(xml_bytes)

    # The e-Laws API v1 wraps data; find the actual law body
    # Structure: DataRoot > ApplData > LawFullText > Law > LawBody
    ns = {}  # e-Laws XML typically has no namespace

    # Try to find LawBody
    law_body = root.find(".//LawBody")
    if law_body is None:
        # Try with common paths
        for path in [".//LawFullText/Law/LawBody", ".//Law/LawBody"]:
            law_body = root.find(path)
            if law_body is not None:
                break

    if law_body is None:
        print("ERROR: Could not find LawBody in XML")
        print("Root tag:", root.tag)
        for child in root:
            print("  Child:", child.tag)
            for gc in child:
                print("    Grandchild:", gc.tag)
        sys.exit(1)

    # Get law title
    law_title_elem = law_body.find("LawTitle")
    law_title = get_text(law_title_elem) if law_title_elem is not None else "会社法"

    # Get MainProvision
    main_provision = law_body.find("MainProvision")
    if main_provision is None:
        print("ERROR: Could not find MainProvision")
        sys.exit(1)

    print(f"Parsing: {law_title}")

    # Process hierarchy
    result, all_articles = process_hierarchy(main_provision, ns, [], "root")

    # Build hierarchy.json
    hierarchy = {
        "name": law_title,
        "nameShort": "会社法",
        "articleCount": len(all_articles),
        "children": result["children"],
    }

    # Group articles by sectionId for article files
    articles_by_section = {}
    for art in all_articles:
        sid = art["sectionId"]
        if sid not in articles_by_section:
            articles_by_section[sid] = []
        articles_by_section[sid].append(art)

    # Build search index
    search_index = []
    for art in all_articles:
        # Build path from sectionId
        text_preview = ""
        if art["paragraphs"]:
            text_preview = art["paragraphs"][0].get("text", "")[:100]

        search_index.append({
            "num": art["num"],
            "title": art["title"],
            "caption": art.get("caption", ""),
            "sectionId": art["sectionId"],
            "text": text_preview,
        })

    return hierarchy, articles_by_section, search_index


def group_articles_for_files(articles_by_section, hierarchy):
    """
    Group articles into reasonable file chunks.
    We create one file per leaf section in the hierarchy.
    """
    files = {}

    def collect_leaf_sections(node, parent_id=""):
        """Find all leaf sections (sections with no children or with direct articles)."""
        node_id = node.get("id", "root")
        children = node.get("children")

        if not children:
            # This is a leaf section - articles are here
            if node_id in articles_by_section:
                files[node_id] = articles_by_section[node_id]
            return

        # Check if any articles are directly under this node
        if node_id in articles_by_section:
            files[node_id] = articles_by_section[node_id]

        for child in children:
            collect_leaf_sections(child, node_id)

    # Also need to handle the "root" level articles
    if "root" in articles_by_section:
        files["root"] = articles_by_section["root"]

    for child in hierarchy.get("children", []):
        collect_leaf_sections(child)

    return files


def write_outputs(hierarchy, articles_by_section, search_index):
    """Write all JSON output files."""
    # Ensure output dirs
    (OUTPUT_DIR / "articles").mkdir(parents=True, exist_ok=True)

    # Write hierarchy.json
    h_path = OUTPUT_DIR / "hierarchy.json"
    with open(h_path, "w", encoding="utf-8") as f:
        json.dump(hierarchy, f, ensure_ascii=False, indent=None)
    print(f"  Written: {h_path} ({h_path.stat().st_size / 1024:.1f} KB)")

    # Write article files
    article_files = group_articles_for_files(articles_by_section, hierarchy)
    total_articles = 0
    for section_id, articles in article_files.items():
        # Clean up articles (remove sectionId from each)
        cleaned = []
        for art in articles:
            a = {k: v for k, v in art.items() if k != "sectionId"}
            cleaned.append(a)
        total_articles += len(cleaned)

        fname = section_id.replace("/", "-") + ".json"
        fpath = OUTPUT_DIR / "articles" / fname
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump({"sectionId": section_id, "articles": cleaned},
                      f, ensure_ascii=False, indent=None)

    print(f"  Written: {len(article_files)} article files ({total_articles} articles total)")

    # Write search index
    si_path = OUTPUT_DIR / "search-index.json"
    with open(si_path, "w", encoding="utf-8") as f:
        json.dump(search_index, f, ensure_ascii=False, indent=None)
    print(f"  Written: {si_path} ({si_path.stat().st_size / 1024:.1f} KB)")

    # Write metadata
    meta_path = OUTPUT_DIR / "metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({
            "lawId": "417AC0000000086",
            "lawNum": "平成十七年法律第八十六号",
            "lawName": "会社法",
            "totalArticles": total_articles,
            "generatedAt": __import__("datetime").datetime.now().isoformat(),
        }, f, ensure_ascii=False, indent=2)
    print(f"  Written: {meta_path}")


def main():
    xml_bytes = fetch_law_xml()

    # Save raw XML for reference
    raw_dir = Path(__file__).parent / "raw"
    raw_dir.mkdir(exist_ok=True)
    raw_path = raw_dir / "kaishaho.xml"
    with open(raw_path, "wb") as f:
        f.write(xml_bytes)
    print(f"  Saved raw XML: {raw_path}")

    hierarchy, articles_by_section, search_index = build_data(xml_bytes)
    print(f"\nParsed structure:")
    print(f"  Total articles in search index: {len(search_index)}")
    print(f"  Article sections: {len(articles_by_section)}")
    if hierarchy.get("children"):
        for child in hierarchy["children"]:
            name = child.get("name", "")
            count = child.get("articleCount", 0)
            print(f"    {name}: {count} articles")

    print("\nWriting output files...")
    write_outputs(hierarchy, articles_by_section, search_index)
    print("\nDone!")


if __name__ == "__main__":
    main()
