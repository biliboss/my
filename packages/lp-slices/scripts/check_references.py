#!/usr/bin/env python3
"""Verify the frozen ICM source ledger shipped by the public page."""

import json
from pathlib import Path

# O catálogo saiu de `apps/lp_my/src/data/` em 22/08, quando as quatro landings
# separadas viraram as rotas de `apps/lp`. Este check veio junto: um número que
# ninguém verifica é um número que a próxima edição do JSON derruba em silêncio.
DATA = Path(__file__).resolve().parents[1] / "src/data"
links = json.loads((DATA / "icm-links.json").read_text())
bibliography = json.loads((DATA / "icm-bibliography.json").read_text())

paper_links = [link for link in links if link["origin"] == "paper"]
discovered_videos = [
    link for link in links
    if link["origin"] == "discovery" and link["category"] == "video"
]

assert len(paper_links) == 150, f"expected 150 unique paper hrefs, found {len(paper_links)}"
assert len(bibliography) == 54, f"expected 54 bibliography entries, found {len(bibliography)}"
assert len(discovered_videos) == 5, f"expected 5 discovered videos, found {len(discovered_videos)}"
assert all(link.get("safe") is False for link in links if link["url"].startswith(("javascript:", "data:")))
print(f"{len(paper_links)} paper links · {len(bibliography)} references · {len(discovered_videos)} videos")
