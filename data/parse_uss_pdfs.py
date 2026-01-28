#!/usr/bin/env python3
"""
USS PDF Results Parser
Extracts race results from US Speed Skating PDF archives (2022-2026)
"""

import json
import os
import re
import tempfile
import urllib.request
from datetime import datetime
from pathlib import Path
from collections import defaultdict
import pdfplumber

# Standard distances to include
STANDARD_DISTANCES = ['500m', '1000m', '1500m', '3000m']


def normalize_category(cat_line):
    """Normalize category line to standard format."""
    cat = cat_line.strip()
    
    # Check for gender
    is_women = any(x in cat.lower() for x in ['women', 'ladies', 'girls', 'female'])
    is_men = any(x in cat.lower() for x in ['men', 'boys', 'male']) and not is_women
    
    # Check for age group
    if 'junior a' in cat.lower():
        return 'Junior A Women' if is_women else 'Junior A Men'
    elif 'junior b' in cat.lower():
        return 'Junior B Women' if is_women else 'Junior B Men'
    elif 'junior c' in cat.lower():
        return 'Junior C Women' if is_women else 'Junior C Men'
    elif 'junior d' in cat.lower():
        return 'Junior D Women' if is_women else 'Junior D Men'
    elif 'junior e' in cat.lower():
        return 'Junior E Women' if is_women else 'Junior E Men'
    elif 'junior f' in cat.lower():
        return 'Junior F Women' if is_women else 'Junior F Men'
    elif 'master' in cat.lower():
        return 'Masters Women' if is_women else 'Masters Men'
    elif 'novice' in cat.lower():
        return 'Novice Women' if is_women else 'Novice Men'
    elif 'nest' in cat.lower():
        return 'NEST Women' if is_women else 'NEST Men'
    elif 'group' in cat.lower():
        return f'{cat} Women' if is_women else f'{cat} Men'
    elif is_women:
        return 'Women'
    elif is_men:
        return 'Men'
    elif cat in ['Men', 'Women', 'Ladies']:
        return 'Women' if cat == 'Ladies' else cat
    
    return cat


def parse_time_classification_page(text):
    """Parse a Time Classification page."""
    results = []
    lines = text.split('\n')
    
    current_category = None
    current_distance = None
    
    for line in lines:
        line = line.strip()
        
        if not line or 'Skater #' in line or 'Time Classification' in line:
            continue
        if 'Tempus' in line or 'Printed' in line or 'Page' in line:
            continue
        
        # Check for distance
        dist_match = re.match(r'^(\d+)\s*Meters?$', line, re.IGNORECASE)
        if dist_match:
            current_distance = f'{dist_match.group(1)}m'
            continue
        
        # Check for category (standalone line with category name)
        if not re.match(r'^\d', line) and len(line) < 50:
            cat = normalize_category(line)
            if cat and cat != line:  # Successfully normalized
                current_category = cat
                continue
            # Also check for simple category names
            if line in ['Men', 'Women', 'Ladies'] or any(x in line for x in ['Junior', 'Master', 'NEST', 'Novice', 'Group']):
                current_category = normalize_category(line)
                continue
        
        # Parse result line: "1 493 Marcus Howard 2:12.734"
        result_match = re.match(r'^(\d+)\s+(\d+)\s+(.+?)\s+(\d+:\d+\.\d+)$', line)
        if result_match and current_distance:
            rank = int(result_match.group(1))
            name = result_match.group(3).strip().rstrip('*')  # Remove trailing asterisks
            time = result_match.group(4)
            
            results.append({
                'rank': rank,
                'skater': name,
                'time': time,
                'distance': current_distance,
                'category': current_category or 'Unknown'
            })
    
    return results


def parse_event_time_results_page(text):
    """Parse Event Time Results format (local meets)."""
    results = []
    lines = text.split('\n')
    
    current_distance = None
    current_category = 'Mixed'
    
    for line in lines:
        line = line.strip()
        
        # Check for distance header like "500M Mixed"
        dist_match = re.match(r'^(\d+)M\s*(.*)$', line, re.IGNORECASE)
        if dist_match:
            current_distance = f'{dist_match.group(1)}m'
            cat = dist_match.group(2).strip()
            if cat:
                current_category = normalize_category(cat)
            else:
                current_category = 'Mixed'
            continue
        
        # Parse result line: "432 HURLEY, STELLA 34.330"
        result_match = re.match(r'^(\d+)\s+([A-Z][A-Z\s,\'\-\.]+?)\s+(\d+:\d+\.\d+|\d+\.\d+)\s*$', line)
        if result_match and current_distance:
            name = result_match.group(2).strip()
            time = result_match.group(3)
            
            if ':' not in time:
                time = f'0:{time}'
            
            results.append({
                'rank': 0,
                'skater': name.title(),
                'time': time,
                'distance': current_distance,
                'category': current_category
            })
    
    # Assign ranks by time
    groups = defaultdict(list)
    for r in results:
        key = (r['distance'], r['category'])
        groups[key].append(r)
    
    for key, group in groups.items():
        group.sort(key=lambda x: x['time'])
        for i, r in enumerate(group):
            r['rank'] = i + 1
    
    return results


def dedupe_results(results):
    """Keep best time per skater/distance/category."""
    best = defaultdict(list)
    for r in results:
        key = (r['skater'].lower(), r['distance'], r['category'])
        best[key].append(r)
    
    deduped = []
    for key, rlist in best.items():
        rlist.sort(key=lambda x: x['time'])
        deduped.append(rlist[0])
    
    return deduped


def download_pdf(url, temp_dir):
    """Download PDF to temp directory."""
    filename = os.path.join(temp_dir, 'temp.pdf')
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            with open(filename, 'wb') as f:
                f.write(response.read())
        return filename
    except Exception as e:
        return None


def parse_pdf(pdf_path):
    """Parse a PDF and extract all results."""
    all_results = []
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ''
                
                if 'Time Classification' in text:
                    results = parse_time_classification_page(text)
                    all_results.extend(results)
                elif 'Event Time Results' in text:
                    results = parse_event_time_results_page(text)
                    all_results.extend(results)
    except Exception as e:
        pass
    
    all_results = dedupe_results(all_results)
    all_results = [r for r in all_results if r['distance'] in STANDARD_DISTANCES]
    
    return all_results


def main():
    data_dir = Path('/Users/garychen/clawd/shorttrack-analytics/data')
    catalog_path = data_dir / 'us_pdf_catalog.json'
    output_path = data_dir / 'uss_all_results.json'
    
    with open(catalog_path) as f:
        catalog = json.load(f)
    
    all_results = []
    all_competitions = []
    processed_seasons = set()
    failed = []
    
    priority_seasons = ['2024-2025', '2023-2024', '2025-2026', '2022-2023']
    
    with tempfile.TemporaryDirectory() as temp_dir:
        for season_data in catalog['seasons']:
            season = season_data['season']
            
            if season not in priority_seasons:
                continue
                
            processed_seasons.add(season)
            print(f"\n=== Processing {season} ===", flush=True)
            
            for comp in season_data['competitions']:
                if comp['type'] != 'short_track':
                    continue
                
                comp_name = comp['name']
                comp_date = comp.get('date')
                pdf_url = comp['pdf_url']
                
                print(f"  {comp_name}...", end='', flush=True)
                
                pdf_path = download_pdf(pdf_url, temp_dir)
                if not pdf_path:
                    print(" [download failed]")
                    failed.append({'name': comp_name, 'error': 'download'})
                    continue
                
                results = parse_pdf(pdf_path)
                
                if results:
                    print(f" {len(results)} results")
                    
                    for r in results:
                        r['competition'] = comp_name
                        r['date'] = comp_date
                        r['season'] = season
                    
                    all_results.extend(results)
                    all_competitions.append({
                        'name': comp_name,
                        'date': comp_date,
                        'season': season,
                        'result_count': len(results)
                    })
                else:
                    print(" [no results]")
                    failed.append({'name': comp_name, 'error': 'parse'})
    
    output = {
        'source': 'US Speed Skating PDF archives',
        'scraped_at': datetime.now().strftime('%Y-%m-%d'),
        'seasons': sorted(list(processed_seasons)),
        'total_results': len(all_results),
        'total_competitions': len(all_competitions),
        'competitions': all_competitions,
        'results': all_results,
        'failed': failed
    }
    
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n=== Summary ===")
    print(f"Seasons: {sorted(processed_seasons)}")
    print(f"Competitions: {len(all_competitions)}")
    print(f"Total results: {len(all_results)}")
    print(f"Failed: {len(failed)}")
    print(f"Output: {output_path}")


if __name__ == '__main__':
    main()
