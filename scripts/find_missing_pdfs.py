#!/usr/bin/env python3
"""
Find missing USS PDFs by matching STL competition names.
"""

import json
import re
import subprocess
from pathlib import Path
from collections import defaultdict

DATA_DIR = Path(__file__).parent.parent / "public" / "data"
PDF_DIR = Path.home() / 'clawd' / 'shorttrack-knowledge-base' / 'raw_data' / 'uss_pdfs'

def normalize_name(name: str) -> str:
    """Normalize competition name for matching."""
    name = name.lower()
    # Remove dates
    name = re.sub(r'\d{2}\.\d{2}\.\s*-\s*\d{2}\.\d{2}\.\d{4},?\s*', '', name)
    name = re.sub(r'\d{4}-\d{2}-\d{2}', '', name)
    # Remove common suffixes
    name = re.sub(r',?\s*(usa|wi|il|ny|ma|ut|ct)$', '', name, flags=re.IGNORECASE)
    # Normalize whitespace
    name = ' '.join(name.split())
    return name

def extract_keywords(name: str) -> set:
    """Extract key words from competition name."""
    name = normalize_name(name)
    # Key identifiers
    keywords = set()
    
    patterns = [
        (r'great lakes', 'great_lakes'),
        (r'buffalo', 'buffalo'),
        (r'chicago|silver skate', 'silver_skates'),
        (r'bay\s*state', 'baystate'),
        (r'heartland', 'heartland'),
        (r'nest', 'nest'),
        (r'saratoga', 'saratoga'),
        (r'park ridge', 'park_ridge'),
        (r'franklin park|barrel buster', 'barrel_buster'),
        (r'land of lincoln', 'land_of_lincoln'),
        (r'presidential', 'presidential'),
        (r'gateway', 'gateway'),
        (r'age group|agn', 'age_group'),
        (r'junior', 'junior'),
        (r'championship', 'championship'),
        (r'desert classic', 'desert'),
        (r'badger', 'badger'),
        (r'ohio', 'ohio'),
        (r'masa|middle atlantic', 'masa'),
    ]
    
    for pattern, keyword in patterns:
        if re.search(pattern, name, re.IGNORECASE):
            keywords.add(keyword)
    
    # Extract year
    year_match = re.search(r'20(\d{2})', name)
    if year_match:
        keywords.add(f"20{year_match.group(1)}")
    
    return keywords

def main():
    print("Loading STL data...")
    with open(DATA_DIR / "skaters.json") as f:
        skaters = json.load(f)
    
    # Get all US competition names from STL
    stl_comps = set()
    for s in skaters:
        if s.get('nationality') == 'USA':
            for e in s.get('events', []):
                name = e.get('name', '')
                if any(x in name.lower() for x in ['usa', 'milwaukee', 'buffalo', 'chicago', 'walpole', 'salt lake', 'park ridge']):
                    stl_comps.add(name)
    
    print(f"Found {len(stl_comps)} US competitions in STL data")
    
    # Get existing PDFs
    existing_pdfs = set()
    for pdf in PDF_DIR.glob("*.pdf"):
        keywords = extract_keywords(pdf.stem)
        existing_pdfs.add(frozenset(keywords))
    
    print(f"Found {len(list(PDF_DIR.glob('*.pdf')))} existing PDFs")
    
    # Find potentially missing competitions
    print("\n=== Potentially missing competitions ===")
    missing = []
    for comp in sorted(stl_comps):
        keywords = extract_keywords(comp)
        if not keywords:
            continue
        
        # Check if we have a matching PDF
        found = False
        for existing in existing_pdfs:
            # Match if most keywords overlap
            overlap = len(keywords & existing)
            if overlap >= 2 or (len(keywords) == 1 and keywords <= existing):
                found = True
                break
        
        if not found and keywords:
            missing.append((comp, keywords))
            print(f"  Missing: {comp}")
            print(f"    Keywords: {keywords}")
    
    print(f"\n{len(missing)} potentially missing competitions")
    
    # Scrape USS website for matching PDFs
    print("\n=== Scraping USS website ===")
    result = subprocess.run(
        ['curl', '-s', 'https://www.usspeedskating.org/results'],
        capture_output=True, text=True, timeout=60
    )
    html = result.stdout
    
    # Extract PDF links with names
    pattern = r'href="(https://assets\.contentstack\.io/[^"]+\.pdf)"[^>]*>([^<]+)</a>'
    matches = re.findall(pattern, html, re.IGNORECASE)
    
    print(f"Found {len(matches)} PDFs on USS website")
    
    # Match missing competitions to USS PDFs
    print("\n=== Matched PDFs to download ===")
    to_download = []
    for comp, comp_keywords in missing:
        for url, pdf_name in matches:
            pdf_keywords = extract_keywords(pdf_name)
            overlap = comp_keywords & pdf_keywords
            if len(overlap) >= 2:
                print(f"  {comp}")
                print(f"    -> {pdf_name}")
                print(f"    URL: {url}")
                to_download.append((url, pdf_name, comp))
                break
    
    print(f"\n{len(to_download)} PDFs to download")
    
    if to_download:
        print("\nTo download these PDFs, run:")
        for url, name, _ in to_download[:10]:
            safe_name = re.sub(r'[<>:"/\\|?*]', '_', name)[:80]
            print(f"  curl -o '{safe_name}.pdf' '{url}'")

if __name__ == '__main__':
    main()
