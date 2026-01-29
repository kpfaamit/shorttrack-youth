#!/usr/bin/env python3
"""Parse all downloaded USS PDFs without re-downloading."""

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional
import pdfplumber

PDF_DIR = Path.home() / 'clawd' / 'shorttrack-knowledge-base' / 'raw_data' / 'uss_pdfs'
OUTPUT_PATH = Path(__file__).parent.parent / 'data' / 'uss_all_results.json'

def parse_time_to_seconds(time_str: str) -> Optional[float]:
    if not time_str:
        return None
    time_str = time_str.strip()
    if ':' in time_str:
        parts = time_str.split(':')
        try:
            mins = int(parts[0])
            secs = float(parts[1])
            return mins * 60 + secs
        except:
            return None
    try:
        return float(time_str)
    except:
        return None

def parse_pdf(pdf_path: Path) -> list[dict]:
    """Parse a USS results PDF."""
    results = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    header = [str(c).lower() if c else '' for c in table[0]]
                    
                    # Find column indices
                    rank_col = next((i for i, h in enumerate(header) if 'rank' in h or 'place' in h or h == '#'), None)
                    name_col = next((i for i, h in enumerate(header) if 'name' in h or 'skater' in h), None)
                    time_col = next((i for i, h in enumerate(header) if 'time' in h or 'result' in h), None)
                    
                    if name_col is None:
                        continue
                    
                    for row in table[1:]:
                        if not row or len(row) <= name_col:
                            continue
                        name = row[name_col]
                        if not name or not isinstance(name, str):
                            continue
                        name = name.strip()
                        if not name or len(name) < 2:
                            continue
                        # Skip header-like rows
                        if name.lower() in ['name', 'skater', 'athlete']:
                            continue
                        
                        result = {'skater': name}
                        
                        if rank_col is not None and len(row) > rank_col and row[rank_col]:
                            try:
                                result['rank'] = int(re.sub(r'[^\d]', '', str(row[rank_col])))
                            except:
                                pass
                        
                        if time_col is not None and len(row) > time_col and row[time_col]:
                            result['time'] = str(row[time_col]).strip()
                        
                        results.append(result)
    except Exception as e:
        print(f"  Error parsing {pdf_path.name}: {e}", file=sys.stderr)
    
    return results

def main():
    print(f"Parsing PDFs from {PDF_DIR}")
    
    pdf_files = sorted(PDF_DIR.glob("*.pdf"))
    print(f"Found {len(pdf_files)} PDFs")
    
    all_results = []
    competitions = []
    
    for i, pdf_path in enumerate(pdf_files):
        name = pdf_path.stem.replace('_', ' ')
        
        # Extract date from filename if present
        date_match = re.search(r'(\d{4})[-_]?(\d{2})[-_]?(\d{2})?', name)
        date = None
        if date_match:
            year = date_match.group(1)
            month = date_match.group(2) if date_match.group(2) else '01'
            day = date_match.group(3) if date_match.group(3) else '01'
            date = f"{year}-{month}-{day}"
        
        # Determine season
        season = None
        year_match = re.search(r'20(\d{2})', name)
        if year_match:
            year = int('20' + year_match.group(1))
            # Season runs Sep-Aug
            season = f"{year-1}-{year}" if 'jan' in name.lower() or 'feb' in name.lower() or 'mar' in name.lower() else f"{year}-{year+1}"
        
        results = parse_pdf(pdf_path)
        
        # Add metadata to results
        for r in results:
            r['competition'] = name
            if date:
                r['date'] = date
            if season:
                r['season'] = season
        
        all_results.extend(results)
        
        if results:
            competitions.append({
                'name': name,
                'date': date,
                'season': season,
                'result_count': len(results)
            })
        
        print(f"  [{i+1}/{len(pdf_files)}] {name[:40]}: {len(results)} results")
        sys.stdout.flush()
    
    # Build output
    seasons = sorted(set(c['season'] for c in competitions if c['season']))
    output = {
        'source': 'US Speed Skating PDF archives',
        'scraped_at': datetime.now().strftime('%Y-%m-%d'),
        'seasons': seasons,
        'total_results': len(all_results),
        'total_competitions': len(competitions),
        'competitions': competitions,
        'results': all_results
    }
    
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\nWrote {OUTPUT_PATH}")
    print(f"  {len(all_results)} total results")
    print(f"  {len(competitions)} competitions")
    print(f"  Seasons: {', '.join(seasons)}")

if __name__ == '__main__':
    main()
