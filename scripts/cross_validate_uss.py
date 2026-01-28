#!/usr/bin/env python3
"""
Cross-validate shorttracklive.info data against USS PDF results.
Checks: name, competition, date, time (where available)
"""

import json
import re
from collections import defaultdict
from pathlib import Path

def normalize_name(name):
    """Normalize skater name for matching."""
    if not name:
        return ""
    # Handle "LAST First" format
    parts = name.strip().split()
    if len(parts) >= 2:
        # Check if first part is all caps (likely last name)
        if parts[0].isupper() and not parts[1].isupper():
            # Convert "SEARS Liam" -> "Liam Sears"
            name = " ".join(parts[1:]) + " " + parts[0].title()
    name = name.lower().strip()
    name = re.sub(r'\s+', ' ', name)
    return name

def normalize_comp_name(name):
    """Normalize competition name for matching."""
    name = re.sub(r'\d{2}\.\d{2}\.\s*-\s*\d{2}\.\d{2}\.\d{4},?\s*', '', name)
    name = re.sub(r'\d{4}', '', name)
    name = re.sub(r'\d+(st|nd|rd|th)', '', name, flags=re.IGNORECASE)
    name = re.sub(r'#\d+', '', name)
    name = re.sub(r'[,\-]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip().lower()
    for loc in ['usa', 'ut', 'il', 'ny', 'wi', 'ma', 'nj', 'ct', 'nh', 'salt lake city', 'milwaukee']:
        name = re.sub(rf'\s{loc}\s*$', '', name, flags=re.IGNORECASE)
    return name.strip()

def parse_time(time_str):
    """Parse time string to seconds."""
    if not time_str:
        return None
    try:
        time_str = str(time_str).strip()
        if ':' in time_str:
            parts = time_str.split(':')
            if len(parts) == 2:
                mins, secs = parts
                return float(mins) * 60 + float(secs)
            elif len(parts) == 3:
                hours, mins, secs = parts
                return float(hours) * 3600 + float(mins) * 60 + float(secs)
        else:
            return float(time_str)
    except:
        return None

def main():
    data_dir = Path(__file__).parent.parent / "dist" / "data"
    
    # Load USS historical results
    with open(data_dir / "us_historical_results.json") as f:
        uss_data = json.load(f)
    
    # Load STL skater facts (has competition participation)
    with open(data_dir / "us_youth_skater_facts.json") as f:
        stl_facts = json.load(f)
    
    # Load STL raw scraped results for times
    stl_results = []
    for season_file in data_dir.glob("scraped_us_results*.json"):
        with open(season_file) as f:
            season_data = json.load(f)
            for comp in season_data.get('competitions', []):
                for race in comp.get('races', []):
                    for result in race.get('results', []):
                        result['competition'] = comp.get('name', '')
                        result['distance'] = race.get('distance', '')
                        result['race_date'] = race.get('date', '')
                        stl_results.append(result)
    
    # Build USS lookup: (normalized_name, normalized_comp, distance) -> results
    uss_lookup = defaultdict(list)
    for r in uss_data.get('results', []):
        key = (
            normalize_name(r.get('skater', '')),
            normalize_comp_name(r.get('competition', '')),
            r.get('distance', '').lower()
        )
        uss_lookup[key].append(r)
    
    print(f"USS results: {len(uss_data.get('results', []))}")
    print(f"USS unique skaters: {len(set(normalize_name(r.get('skater','')) for r in uss_data.get('results',[])))}")
    print(f"STL skater facts: {len(stl_facts)}")
    print(f"STL raw results: {len(stl_results)}")
    print()
    
    # Cross-validate: check STL facts against USS results
    matches = []
    mismatches = []
    not_found = []
    
    for skater_id, skater in stl_facts.items():
        stl_name = normalize_name(skater.get('name', ''))
        
        for event in skater.get('events', []):
            event_name = event.get('name', '')
            norm_comp = normalize_comp_name(event_name)
            
            # Check if this competition exists in USS data
            # We don't have distance info in facts, so check any match
            found_any = False
            for dist in ['500m', '1000m', '1500m', '3000m']:
                key = (stl_name, norm_comp, dist)
                if key in uss_lookup:
                    found_any = True
                    uss_results = uss_lookup[key]
                    # We found a match - compare what we can
                    matches.append({
                        'skater': skater.get('name'),
                        'stl_event': event_name[:60],
                        'uss_comp': uss_results[0].get('competition'),
                        'distance': dist,
                        'stl_best_rank': event.get('best_rank'),
                        'uss_place': uss_results[0].get('place'),
                        'uss_time': uss_results[0].get('time'),
                    })
            
            if not found_any:
                # Check if competition exists at all
                comp_exists = any(normalize_comp_name(r.get('competition','')) == norm_comp 
                                  for r in uss_data.get('results', []))
                if comp_exists:
                    not_found.append({
                        'skater': skater.get('name'),
                        'stl_event': event_name[:60],
                        'note': 'Competition exists but skater not found in USS'
                    })
    
    print("=" * 60)
    print("CROSS-VALIDATION RESULTS")
    print("=" * 60)
    print(f"\nMatches found: {len(matches)}")
    print(f"Skaters not in USS for existing comps: {len(not_found)}")
    
    # Show sample matches
    print("\n--- Sample Matches ---")
    for m in matches[:10]:
        print(f"  {m['skater']}")
        print(f"    STL: {m['stl_event']}")
        print(f"    USS: {m['uss_comp']} | {m['distance']} | place={m['uss_place']} time={m['uss_time']}")
        print(f"    STL best_rank={m['stl_best_rank']}")
        print()
    
    # Show discrepancies (where rank/place don't match)
    discrepancies = [m for m in matches if m['stl_best_rank'] and m['uss_place'] and m['stl_best_rank'] != m['uss_place']]
    print(f"\n--- Rank Discrepancies: {len(discrepancies)} ---")
    for d in discrepancies[:10]:
        print(f"  {d['skater']} @ {d['uss_comp'][:40]} {d['distance']}")
        print(f"    STL best_rank={d['stl_best_rank']} vs USS place={d['uss_place']}")
    
    # Show some not-found cases
    print(f"\n--- Sample Skaters Not Found in USS ---")
    for nf in not_found[:10]:
        print(f"  {nf['skater']} @ {nf['stl_event']}")

if __name__ == "__main__":
    main()
