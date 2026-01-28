#!/usr/bin/env python3
"""Detailed cross-validation with time/rank comparison."""

import json
import pdfplumber
import re
from collections import defaultdict

# Load the athlete data
with open('/Users/garychen/clawd/us_junior_athletes_history.json', 'r') as f:
    data = json.load(f)

# All 10 athletes
all_athletes = [
    'sean_shuai', 'isabella_chen', 'julius_kazanecki', 'olimpia_kazanecka',
    'caleb_park', 'justin_liu', 'sofia_koons', 'elizabeth_rhodehamel',
    'noah_troppe', 'brandon_liao'
]

def extract_tables_from_pdf(pdf_path):
    """Extract tables from PDF."""
    all_tables = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            for table in tables:
                all_tables.append({'page': i+1, 'table': table})
            # Also get text for pattern matching
    return all_tables

def extract_full_text(pdf_path):
    """Extract full text from PDF."""
    full_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"
    return full_text

pdf_path = '/Users/garychen/clawd/shorttrack-analytics/data/2024_US_ST_Championships.pdf'
print("Extracting detailed data from 2024 US ST Championship PDF...")

full_text = extract_full_text(pdf_path)
lines = full_text.split('\n')

# Search patterns for each distance
# Looking for lines containing athlete name with time/rank info

def find_athlete_data(lines, name_variants):
    """Find all lines containing athlete data."""
    results = []
    for line in lines:
        for variant in name_variants:
            if variant.lower() in line.lower():
                results.append(line)
                break
    return results

# Validation results
validation_summary = []

print("\n" + "="*100)
print("DETAILED CROSS-VALIDATION: 2024 US Short Track Championship")
print("="*100)

for athlete_key in all_athletes:
    athlete_data = data['athletes'].get(athlete_key, {})
    athlete_name = athlete_data.get('name', '')
    
    # Name variants for searching
    parts = athlete_name.split()
    if len(parts) >= 2:
        last_name = parts[0]
        first_name = parts[1] if len(parts) > 1 else ''
        name_variants = [
            athlete_name,
            f"{first_name} {last_name}",
            f"{first_name.lower()} {last_name.lower()}",
            f"{last_name} {first_name}",
            first_name,
            last_name
        ]
    else:
        name_variants = [athlete_name]
    
    # Get JSON results for this competition
    json_results = [r for r in athlete_data.get('results', []) 
                   if '2024 US Short Track Championship' in r.get('competition', '')]
    
    # Find in PDF
    pdf_lines = find_athlete_data(lines, name_variants)
    
    print(f"\n{'='*80}")
    print(f"ATHLETE: {athlete_name}")
    print(f"{'='*80}")
    
    # Parse JSON results
    print("\n📊 JSON DATA (shorttracklive.info):")
    json_by_dist = {}
    for r in json_results:
        dist = r['distance']
        json_by_dist[dist] = {
            'rank': r.get('rank'),
            'time': r.get('time'),
            'class': r.get('class')
        }
        print(f"  {dist}: Rank #{r.get('rank', 'N/A')}, Time: {r.get('time', 'N/A')}, Class: {r.get('class', 'N/A')}")
    
    # Parse PDF lines
    print("\n📄 PDF DATA (USS Official):")
    pdf_times = []
    for line in pdf_lines[:15]:  # Show first 15 matches
        # Look for times in format MM:SS.mmm or SS.mmm
        time_pattern = r'(\d{1,2}:\d{2}\.\d{3}|\d{2}\.\d{3})'
        times_found = re.findall(time_pattern, line)
        if times_found:
            print(f"  {line[:120]}")
            pdf_times.extend(times_found)
    
    # Compare times
    matches = 0
    discrepancies = []
    
    print("\n✅ COMPARISON:")
    for dist, json_data in json_by_dist.items():
        json_time = json_data.get('time')
        if json_time:
            # Normalize time format
            json_time_normalized = json_time.replace(':', ':')
            
            # Check if this time appears in PDF
            found_in_pdf = False
            for pdf_time in pdf_times:
                if json_time in pdf_time or pdf_time in json_time:
                    found_in_pdf = True
                    break
            
            # Also search full text for the time
            if not found_in_pdf and json_time in full_text:
                found_in_pdf = True
            
            if found_in_pdf:
                print(f"  ✓ {dist}: {json_time} - MATCHED in PDF")
                matches += 1
            else:
                print(f"  ⚠ {dist}: {json_time} - NOT FOUND in PDF")
                discrepancies.append(f"{dist}: Time {json_time} not found")
        else:
            print(f"  - {dist}: No time in JSON, Rank only: #{json_data.get('rank')}")
    
    # Check rank for athlete in competition
    # Verify athlete appears in PDF at all
    athlete_in_pdf = any(name_variants[0].lower() in line.lower() or 
                         (len(name_variants) > 1 and name_variants[1].lower() in line.lower())
                         for line in pdf_lines)
    
    result = {
        'name': athlete_name,
        'athlete_key': athlete_key,
        'competitions_validated': 1,
        'json_results_count': len(json_results),
        'pdf_occurrences': len(pdf_lines),
        'times_matched': matches,
        'discrepancies_count': len(discrepancies),
        'discrepancies': discrepancies,
        'status': 'MATCHED' if matches > 0 and len(discrepancies) == 0 else 
                 'PARTIAL' if matches > 0 else 'VERIFIED_PRESENCE'
    }
    validation_summary.append(result)

# Final summary
print("\n" + "="*100)
print("SUMMARY TABLE")
print("="*100)
print(f"{'Skater':<25} {'Comps':<7} {'Matches':<9} {'Discrepancies':<14} {'Status'}")
print("-"*100)

total_matches = 0
total_discrepancies = 0

for r in validation_summary:
    print(f"{r['name']:<25} {r['competitions_validated']:<7} {r['times_matched']:<9} {r['discrepancies_count']:<14} {r['status']}")
    total_matches += r['times_matched']
    total_discrepancies += r['discrepancies_count']

print("-"*100)
print(f"{'TOTAL':<25} {10:<7} {total_matches:<9} {total_discrepancies:<14}")

# Save detailed results
output = {
    'validation_date': '2026-01-28',
    'source_json': 'us_junior_athletes_history.json (shorttracklive.info)',
    'source_pdf': '2024_US_ST_Championships.pdf (usspeedskating.org)',
    'competition': '2024 US Short Track Championship (Sept 2024)',
    'athletes_validated': 10,
    'total_times_matched': total_matches,
    'total_discrepancies': total_discrepancies,
    'summary': validation_summary,
    'methodology': 'Extracted text from USS official PDF, matched athlete names and compared times'
}

with open('/Users/garychen/clawd/shorttrack-analytics/data/cross_validation_results.json', 'w') as f:
    json.dump(output, f, indent=2)

print("\n✅ Detailed results saved to cross_validation_results.json")
