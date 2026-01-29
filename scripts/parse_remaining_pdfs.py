#!/usr/bin/env python3
"""
Parse remaining PDFs one at a time, appending to existing results.
"""

import json
import re
import gc
from datetime import datetime
from pathlib import Path
import subprocess

KB_DIR = Path.home() / 'clawd' / 'shorttrack-knowledge-base'
PDF_DIR = KB_DIR / 'raw_data' / 'uss_pdfs'
OUTPUT = KB_DIR / 'processed_data' / 'uss_all_results.json'

def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract text from PDF using pdfminer."""
    try:
        from pdfminer.high_level import extract_text
        text = extract_text(str(pdf_path))
        return text
    except Exception as e:
        print(f"  Error extracting {pdf_path.name}: {e}")
        return ""

def parse_competition_date(filename: str, text: str) -> str:
    """Extract date from filename or text."""
    # Try filename first
    match = re.search(r'(\d{4})[_-](\d{2})[_-](\d{2})', filename)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    
    # Try text
    patterns = [
        r'(\w+ \d{1,2},? \d{4})',
        r'(\d{1,2}/\d{1,2}/\d{4})',
    ]
    for p in patterns:
        match = re.search(p, text[:2000])
        if match:
            try:
                for fmt in ['%B %d, %Y', '%B %d %Y', '%m/%d/%Y']:
                    try:
                        dt = datetime.strptime(match.group(1), fmt)
                        return dt.strftime('%Y-%m-%d')
                    except:
                        continue
            except:
                pass
    
    # Extract year from filename
    year_match = re.search(r'20(\d{2})', filename)
    if year_match:
        return f"20{year_match.group(1)}-01-01"
    
    return None

def parse_results_from_text(text: str, competition: str, date: str) -> list:
    """Parse race results from text."""
    results = []
    
    # Find result blocks
    lines = text.split('\n')
    current_distance = None
    current_category = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Detect distance
        dist_match = re.search(r'\b(\d{3,4})\s*[mM]', line)
        if dist_match and len(line) < 50:
            current_distance = f"{dist_match.group(1)}m"
        
        # Detect category
        cat_patterns = [
            (r'JUNIOR\s+([A-G])', 'Junior'),
            (r'SENIOR\s+(MEN|WOMEN)', 'Senior'),
            (r'MASTERS?\s+(\d+)', 'Masters'),
            (r'(MEN|WOMEN|BOYS?|GIRLS?)', None),
        ]
        for pat, prefix in cat_patterns:
            m = re.search(pat, line, re.IGNORECASE)
            if m and len(line) < 80:
                if prefix:
                    current_category = f"{prefix} {m.group(1)}"
                else:
                    current_category = m.group(1).title()
                break
        
        # Parse result line: rank, name, time
        # Pattern: number, name (possibly with spaces), time
        result_match = re.match(
            r'^(\d{1,3})\s+([A-Za-z][A-Za-z\'\-\.\s]+?)\s+(\d{1,2}:\d{2}\.\d{2,3}|\d{2}\.\d{2,3})\s*$',
            line
        )
        if result_match and current_distance:
            rank = int(result_match.group(1))
            name = result_match.group(2).strip()
            time = result_match.group(3)
            
            # Clean up name
            name = re.sub(r'\s+', ' ', name)
            name = re.sub(r'\*+$', '', name)
            
            if len(name) > 3 and rank <= 200:
                results.append({
                    'rank': rank,
                    'skater': name,
                    'time': time,
                    'distance': current_distance,
                    'category': current_category or 'Unknown',
                    'competition': competition,
                    'date': date
                })
    
    return results

def get_competition_name(filename: str) -> str:
    """Clean up competition name from filename."""
    name = filename.replace('.pdf', '')
    # Remove date prefix
    name = re.sub(r'^\d{4}[_-]\d{2}[_-]\d{2}[_-]?', '', name)
    # Convert underscores to spaces
    name = name.replace('_', ' ').replace('-', ' ')
    # Clean up
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def main():
    # Load existing results
    print("Loading existing results...")
    with open(OUTPUT) as f:
        data = json.load(f)
    
    existing_comps = {c['name'].lower() for c in data.get('competitions', [])}
    print(f"Existing competitions: {len(existing_comps)}")
    
    # Find unprocessed PDFs
    all_pdfs = sorted(PDF_DIR.glob('*.pdf'))
    unprocessed = []
    for pdf in all_pdfs:
        comp_name = get_competition_name(pdf.name).lower()
        # Check if already processed (fuzzy match)
        if not any(comp_name[:20] in ec or ec[:20] in comp_name for ec in existing_comps):
            unprocessed.append(pdf)
    
    print(f"Unprocessed PDFs: {len(unprocessed)}")
    
    if not unprocessed:
        print("All PDFs already processed!")
        return
    
    # Process each PDF
    new_results = []
    new_comps = []
    
    for i, pdf in enumerate(unprocessed):
        comp_name = get_competition_name(pdf.name)
        print(f"[{i+1}/{len(unprocessed)}] {comp_name}...")
        
        text = extract_text_from_pdf(pdf)
        if not text:
            continue
        
        date = parse_competition_date(pdf.name, text)
        results = parse_results_from_text(text, comp_name, date)
        
        if results:
            new_results.extend(results)
            new_comps.append({
                'name': comp_name,
                'date': date,
                'result_count': len(results)
            })
            print(f"  -> {len(results)} results")
        else:
            print(f"  -> No results parsed")
        
        # Free memory
        del text
        gc.collect()
    
    # Merge with existing
    print(f"\nMerging {len(new_results)} new results...")
    data['results'].extend(new_results)
    data['competitions'].extend(new_comps)
    data['total_results'] = len(data['results'])
    data['total_competitions'] = len(data['competitions'])
    data['scraped_at'] = datetime.now().isoformat()
    
    # Save
    print(f"Saving to {OUTPUT}...")
    with open(OUTPUT, 'w') as f:
        json.dump(data, f)
    
    print(f"Done! Total: {data['total_results']} results, {data['total_competitions']} competitions")

if __name__ == '__main__':
    main()
