#!/usr/bin/env python3
"""Cross-validate US youth skaters against USS PDF results."""

import json
import pdfplumber
import re
from collections import defaultdict

# Load the athlete data
with open('/Users/garychen/clawd/us_junior_athletes_history.json', 'r') as f:
    data = json.load(f)

# Athletes to validate (excluding Sean Shuai and Isabella Chen - already done)
athletes_to_validate = [
    'julius_kazanecki',
    'olimpia_kazanecka', 
    'caleb_park',
    'justin_liu',
    'sofia_koons',
    'elizabeth_rhodehamel',
    'noah_troppe',
    'brandon_liao'
]

# Athlete name mapping for PDF matching
name_map = {
    'julius_kazanecki': ['KAZANECKI Julius', 'Julius KAZANECKI', 'KAZANECKI, Julius', 'J. KAZANECKI', 'Julius Kazanecki'],
    'olimpia_kazanecka': ['KAZANECKA Olimpia', 'Olimpia KAZANECKA', 'KAZANECKA, Olimpia', 'O. KAZANECKA', 'Olimpia Kazanecka'],
    'caleb_park': ['PARK Caleb', 'Caleb PARK', 'PARK, Caleb', 'C. PARK', 'Caleb Park'],
    'justin_liu': ['LIU Justin', 'Justin LIU', 'LIU, Justin', 'J. LIU', 'Justin Liu'],
    'sofia_koons': ['KOONS Sofia', 'Sofia KOONS', 'KOONS, Sofia', 'S. KOONS', 'Sofia Koons'],
    'elizabeth_rhodehamel': ['RHODEHAMEL Elizabeth', 'Elizabeth RHODEHAMEL', 'RHODEHAMEL, Elizabeth', 'E. RHODEHAMEL', 'Elizabeth Rhodehamel'],
    'noah_troppe': ['TROPPE Noah', 'Noah TROPPE', 'TROPPE, Noah', 'N. TROPPE', 'Noah Troppe'],
    'brandon_liao': ['LIAO Brandon', 'Brandon LIAO', 'LIAO, Brandon', 'B. LIAO', 'Brandon Liao'],
    'sean_shuai': ['SHUAI Sean', 'Sean SHUAI', 'SHUAI, Sean', 'S. SHUAI', 'Sean Shuai'],
    'isabella_chen': ['CHEN Isabella', 'Isabella CHEN', 'CHEN, Isabella', 'I. CHEN', 'Isabella Chen']
}

def extract_pdf_text(pdf_path):
    """Extract all text from PDF with page numbers."""
    text_by_page = {}
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text_by_page[i+1] = page.extract_text() or ""
    return text_by_page

def find_athlete_results_in_pdf(text_by_page, athlete_names):
    """Search for athlete names in PDF text."""
    results = []
    for page_num, text in text_by_page.items():
        for name in athlete_names:
            if name.lower() in text.lower():
                # Extract context around the name
                lines = text.split('\n')
                for i, line in enumerate(lines):
                    if name.lower() in line.lower():
                        context_start = max(0, i-2)
                        context_end = min(len(lines), i+3)
                        context = '\n'.join(lines[context_start:context_end])
                        results.append({
                            'page': page_num,
                            'name_found': name,
                            'line': line.strip(),
                            'context': context
                        })
    return results

def parse_result_line(line):
    """Try to extract rank, name, time from a result line."""
    # Common patterns in USS PDFs
    # Pattern: rank name time (e.g., "4 Sean SHUAI 41.267")
    patterns = [
        r'(\d+)\s+([A-Za-z]+\s+[A-Za-z]+)\s+(\d+[:.]\d+(?:\.\d+)?)',
        r'(\d+)\s+([A-Za-z]+,\s*[A-Za-z]+)\s+(\d+[:.]\d+(?:\.\d+)?)',
    ]
    for pattern in patterns:
        match = re.search(pattern, line)
        if match:
            return {
                'rank': int(match.group(1)),
                'name': match.group(2),
                'time': match.group(3)
            }
    return None

# Main extraction
pdf_path = '/Users/garychen/clawd/shorttrack-analytics/data/2024_US_ST_Championships.pdf'
print("Extracting text from 2024 US Short Track Championship PDF...")
pdf_text = extract_pdf_text(pdf_path)
print(f"Extracted {len(pdf_text)} pages")

# Full text for searching
full_text = '\n'.join(pdf_text.values())

# Find all athletes
validation_results = {}

print("\n" + "="*80)
print("CROSS-VALIDATION RESULTS: 2024 US Short Track Championship")
print("="*80)

for athlete_key in athletes_to_validate + ['sean_shuai', 'isabella_chen']:
    athlete_data = data['athletes'].get(athlete_key, {})
    athlete_name = athlete_data.get('name', athlete_key)
    names_to_search = name_map.get(athlete_key, [athlete_name])
    
    # Get JSON results for 2024 US Short Track Championship
    json_results = [r for r in athlete_data.get('results', []) 
                   if '2024 US Short Track Championship' in r.get('competition', '')]
    
    print(f"\n{'='*60}")
    print(f"Athlete: {athlete_name}")
    print(f"JSON Results for 2024 US ST Championship: {len(json_results)}")
    
    # Find in PDF
    pdf_matches = find_athlete_results_in_pdf(pdf_text, names_to_search)
    print(f"PDF Matches found: {len(pdf_matches)}")
    
    validation_results[athlete_key] = {
        'name': athlete_name,
        'json_results': json_results,
        'pdf_matches': pdf_matches,
        'matches': 0,
        'discrepancies': [],
        'competitions_validated': 1 if pdf_matches else 0
    }
    
    # Print JSON results
    if json_results:
        print("\nJSON Data:")
        for r in json_results:
            time_str = r.get('time', 'N/A')
            print(f"  - {r['distance']}: Rank {r.get('rank', 'N/A')}, Time: {time_str}")
    
    # Print PDF matches
    if pdf_matches:
        print("\nPDF Matches:")
        for match in pdf_matches[:10]:  # Limit output
            print(f"  Page {match['page']}: {match['line'][:100]}...")

# Save results summary
print("\n" + "="*80)
print("SUMMARY TABLE")
print("="*80)
print(f"{'Skater Name':<25} {'Comps':<8} {'Matches':<10} {'Discrepancies':<15} {'Notes'}")
print("-"*80)

summary = []
for athlete_key in ['sean_shuai', 'isabella_chen'] + athletes_to_validate:
    athlete_data = data['athletes'].get(athlete_key, {})
    athlete_name = athlete_data.get('name', athlete_key)
    vr = validation_results.get(athlete_key, {})
    
    json_count = len(vr.get('json_results', []))
    pdf_count = len(vr.get('pdf_matches', []))
    
    # Determine match status
    if pdf_count > 0 and json_count > 0:
        status = "FOUND"
        matches = min(json_count, pdf_count)
    elif pdf_count == 0 and json_count > 0:
        status = "NOT IN PDF"
        matches = 0
    else:
        status = "N/A"
        matches = 0
    
    comps = 1 if pdf_count > 0 else 0
    discrepancies = 0  # Will need detailed comparison
    
    print(f"{athlete_name:<25} {comps:<8} {matches:<10} {discrepancies:<15} {status}")
    
    summary.append({
        'name': athlete_name,
        'athlete_key': athlete_key,
        'competitions_validated': comps,
        'json_results_count': json_count,
        'pdf_matches_count': pdf_count,
        'matches': matches,
        'discrepancies': discrepancies,
        'status': status
    })

# Save to JSON
output = {
    'validation_date': '2026-01-28',
    'source_json': 'us_junior_athletes_history.json',
    'source_pdf': '2024_US_ST_Championships.pdf',
    'athletes_validated': len(athletes_to_validate) + 2,
    'summary': summary,
    'detailed_results': validation_results
}

with open('/Users/garychen/clawd/shorttrack-analytics/data/cross_validation_results.json', 'w') as f:
    json.dump(output, f, indent=2, default=str)

print("\n" + "="*80)
print("Results saved to cross_validation_results.json")
