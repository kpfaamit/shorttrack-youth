#!/usr/bin/env python3
"""
Build time trend data by merging USS results (primary) with STL personal bests (fallback).
Outputs: dist/data/skater_time_trends.json
"""

import json
import os
import re
from collections import defaultdict
from datetime import datetime
from typing import Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'dist', 'data')

def parse_date(date_str: str) -> Optional[datetime]:
    """Parse date from various formats like '11.11. - 11.11.2022' or '2023-10-15'"""
    if not date_str:
        return None
    
    # Try ISO format first
    try:
        return datetime.strptime(date_str[:10], '%Y-%m-%d')
    except:
        pass
    
    # Try DD.MM. - DD.MM.YYYY format
    match = re.search(r'(\d{1,2})\.(\d{1,2})\.\s*-\s*\d{1,2}\.\d{1,2}\.(\d{4})', date_str)
    if match:
        day, month, year = match.groups()
        try:
            return datetime(int(year), int(month), int(day))
        except:
            pass
    
    # Try DD.MM.YYYY format
    match = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{4})', date_str)
    if match:
        day, month, year = match.groups()
        try:
            return datetime(int(year), int(month), int(day))
        except:
            pass
    
    return None

def parse_time(time_str: str) -> Optional[float]:
    """Parse time string to seconds"""
    if not time_str:
        return None
    
    time_str = time_str.strip()
    
    # Handle MM:SS.mmm format
    if ':' in time_str:
        parts = time_str.split(':')
        try:
            mins = float(parts[0])
            secs = float(parts[1])
            return mins * 60 + secs
        except:
            return None
    
    # Handle SS.mmm format
    try:
        return float(time_str)
    except:
        return None

def normalize_distance(distance: int) -> int:
    """Map non-standard distances to standard event distances.
    
    Different rinks have different track lengths (107m, 111m, 100m).
    STL stores actual distance skated, need to map to standard events.
    Standard short track is 111.12m per lap.
    """
    if not distance:
        return None
    
    # Standard distances and their common variations
    # Being generous with ranges to catch different track sizes
    mappings = {
        # 222m (2 laps) - tracks from 100m to 115m
        (200, 240): 222,
        # 333m (3 laps)  
        (300, 360): 333,
        # 400m (special event, rare)
        (390, 430): 500,  # Map 400m variants to 500m
        # 500m (4.5 laps)
        (450, 550): 500,
        # 600m (special, rare) - map to 500m or 777m based on time validation later
        (580, 620): 500,
        # 666m (6 laps on 111m track) - map to 777m
        (640, 700): 777,
        # 777m (7 laps)
        (740, 820): 777,
        # 1000m (9 laps)
        (900, 1100): 1000,
        # 1500m (13.5 laps)
        (1400, 1600): 1500,
        # 2000m (rare) - could be misclassified 1500m
        (1900, 2100): 1500,
        # 3000m (27 laps)
        (2800, 3200): 3000,
    }
    
    for (low, high), standard in mappings.items():
        if low <= distance <= high:
            return standard
    
    # Return as-is if it's already a standard distance
    if distance in [222, 333, 500, 777, 1000, 1500, 3000]:
        return distance
    
    # Filter out clearly wrong distances (under 200m or over 4000m)
    if distance < 200 or distance > 4000:
        return None
    
    return None  # Don't keep unusual distances that don't map

def is_valid_time_for_distance(time_secs: float, distance: int) -> bool:
    """Check if time is plausible for the given distance.
    
    Filters out obvious data errors like 47s for 1000m.
    Uses conservative bounds for youth skating (most skaters aren't elite).
    """
    if not time_secs or not distance:
        return False
    
    # Minimum times set conservatively for youth skating
    # (elite times are rare and often data errors at local meets)
    # Maximum times for slow recreational skaters
    bounds = {
        222: (18, 90),      # 222m: 18s - 1.5min
        333: (25, 120),     # 333m: 25s - 2min  
        500: (38, 150),     # 500m: 38s - 2.5min
        777: (60, 210),     # 777m: 60s - 3.5min
        1000: (80, 300),    # 1000m: 1:20 - 5min (filter suspicious <1:20 times)
        1500: (130, 420),   # 1500m: 2:10 - 7min
        3000: (280, 720),   # 3000m: 4:40 - 12min
    }
    
    if distance in bounds:
        min_time, max_time = bounds[distance]
        return min_time <= time_secs <= max_time
    
    # Unknown distance - accept if reasonable overall
    return 25 <= time_secs <= 600

def normalize_name(name: str) -> str:
    """Normalize skater name for matching: 'CHEN Daniel USA-PSSP' -> 'chen daniel'"""
    # Replace non-breaking spaces and normalize
    name = name.replace('\xa0', ' ').replace('  ', ' ').strip().lower()
    
    # Remove club/country suffixes like "USA-PSSP", "USA-SCSC", "CAN-XXXXXX"
    # Pattern: 3-letter country code followed by dash and club code
    name = re.sub(r'\s+[a-z]{2,3}-[a-z0-9]+$', '', name, flags=re.IGNORECASE)
    
    # Remove standalone country codes at end
    name = re.sub(r'\s+(usa|can|chn|kor|jpn|ned|ita|rus|gbr|ger|fra|aus)$', '', name, flags=re.IGNORECASE)
    
    # Remove leading numbers (e.g., "44CHEN Daniel" -> "chen daniel")  
    name = re.sub(r'^\d+', '', name)
    
    # Remove trailing asterisks
    name = re.sub(r'\*+$', '', name)
    
    # Clean up extra spaces
    name = ' '.join(name.split())
    
    return name

def load_uss_results() -> dict:
    """Load all USS results from multiple sources, return dict keyed by normalized name.
    
    Data sources (in priority order):
    1. uss_all_results.json - Parsed from USS PDFs (official times)
    2. us_historical_results.json - Historical USS data (2017-2023)
    3. scraped_us_results_s*.json - STL scraped data (fallback)
    """
    results_by_skater = defaultdict(list)
    
    # 1. Load uss_all_results.json (from USS PDFs - highest priority)
    # Path relative to clawd workspace
    uss_pdf_path = os.path.expanduser('~/clawd/shorttrack-knowledge-base/processed_data/uss_all_results.json')
    if os.path.exists(uss_pdf_path):
        print(f"  Loading USS PDF results from {uss_pdf_path}")
        with open(uss_pdf_path) as f:
            data = json.load(f)
        
        for result in data.get('results', []):
            name = result.get('skater', '')
            time_str = result.get('time')
            time_secs = parse_time(time_str)
            distance_str = result.get('distance', '')
            
            # Parse distance (e.g., "500m" -> 500)
            dist_match = re.search(r'(\d+)', distance_str)
            distance = int(dist_match.group(1)) if dist_match else None
            
            if not name or not time_secs or not distance:
                continue
            
            # Validate time is plausible for the distance (filter parsing errors)
            if not is_valid_time_for_distance(time_secs, distance):
                continue
            
            norm_name = normalize_name(name)
            result_date = parse_date(result.get('date', ''))
            
            results_by_skater[norm_name].append({
                'distance': distance,
                'time': time_secs,
                'time_str': time_str,
                'competition': result.get('competition', 'Unknown'),
                'date': result_date.isoformat() if result_date else None,
                'place': result.get('rank'),
                'source': 'uss_pdf',
            })
        print(f"    Loaded {sum(len(v) for v in results_by_skater.values())} results")
    
    # 2. Load us_historical_results.json (older seasons)
    hist_path = os.path.join(DATA_DIR, 'us_historical_results.json')
    if os.path.exists(hist_path):
        print(f"  Loading historical results from {hist_path}")
        with open(hist_path) as f:
            data = json.load(f)
        
        hist_count = 0
        for result in data.get('results', []):
            name = result.get('skater', '')
            time_str = result.get('time')
            if not time_str:
                continue
            time_secs = parse_time(time_str)
            distance_str = result.get('distance', '')
            
            dist_match = re.search(r'(\d+)', distance_str)
            raw_distance = int(dist_match.group(1)) if dist_match else None
            distance = normalize_distance(raw_distance)
            
            if not name or not time_secs or not distance:
                continue
            
            # Validate time is plausible for the distance
            if not is_valid_time_for_distance(time_secs, distance):
                continue
            
            norm_name = normalize_name(name)
            result_date = parse_date(result.get('date', ''))
            
            results_by_skater[norm_name].append({
                'distance': distance,
                'time': time_secs,
                'time_str': time_str,
                'competition': result.get('competition', 'Unknown'),
                'date': result_date.isoformat() if result_date else None,
                'place': result.get('place'),
                'source': 'uss_hist',
            })
            hist_count += 1
        print(f"    Loaded {hist_count} historical results")
    
    # 3. Load STL scraped results (fallback for coverage)
    stl_files = [
        'scraped_us_results_s16.json',
        'scraped_us_results_s17.json', 
        'scraped_us_results_s18.json',
        'scraped_us_results_s19.json',
        'scraped_us_results_s20.json',
    ]
    
    stl_count = 0
    for filename in stl_files:
        filepath = os.path.join(DATA_DIR, filename)
        if not os.path.exists(filepath):
            continue
            
        with open(filepath) as f:
            data = json.load(f)
        
        for comp in data.get('competitions', []):
            comp_name = comp.get('name', 'Unknown')
            comp_date = parse_date(comp_name)
            
            for event in comp.get('events', []):
                raw_distance = event.get('distance')
                distance = normalize_distance(raw_distance)
                if not distance:
                    continue
                
                for result in event.get('results', []):
                    name = result.get('name', '')
                    time_str = result.get('time')
                    time_secs = parse_time(time_str)
                    
                    if not name or not time_secs:
                        continue
                    
                    # Validate time is plausible for the distance
                    if not is_valid_time_for_distance(time_secs, distance):
                        continue
                    
                    norm_name = normalize_name(name)
                    results_by_skater[norm_name].append({
                        'distance': distance,
                        'time': time_secs,
                        'time_str': time_str,
                        'competition': comp_name,
                        'date': comp_date.isoformat() if comp_date else None,
                        'place': result.get('place'),
                        'source': 'stl',
                    })
                    stl_count += 1
    
    print(f"    Loaded {stl_count} STL results")
    
    return results_by_skater

def load_skaters() -> list:
    """Load skaters.json"""
    with open(os.path.join(DATA_DIR, 'skaters.json')) as f:
        return json.load(f)

def build_time_trends():
    """Build time trend data for all skaters"""
    print("Loading USS results...")
    uss_results = load_uss_results()
    print(f"  Loaded results for {len(uss_results)} unique skaters")
    
    print("Loading skaters...")
    skaters = load_skaters()
    print(f"  Loaded {len(skaters)} skaters")
    
    time_trends = {}
    matched = 0
    
    for skater in skaters:
        skater_id = skater.get('id')
        name = skater.get('name', '')
        norm_name = normalize_name(name)
        
        # Collect all results for this skater
        all_results = []
        
        # 1. USS results (primary source)
        if norm_name in uss_results:
            all_results.extend(uss_results[norm_name])
            matched += 1
        
        # 2. Also try reversed name format (LAST FIRST vs FIRST LAST)
        name_parts = norm_name.split()
        if len(name_parts) >= 2:
            reversed_name = f"{name_parts[-1]} {' '.join(name_parts[:-1])}"
            if reversed_name in uss_results and reversed_name != norm_name:
                all_results.extend(uss_results[reversed_name])
        
        # 3. STL personal_bests as fallback (only add if no USS data for that competition)
        profile = skater.get('profile') or {}
        stl_pbs = profile.get('personal_bests_detail', []) or []
        uss_comps = {r['competition'] for r in all_results}
        
        for pb in stl_pbs:
            # Check if we already have USS data for this competition
            pb_comp = pb.get('competition', '')
            if any(pb_comp in c or c in pb_comp for c in uss_comps):
                continue  # Skip, we have USS data
            
            time_secs = parse_time(pb.get('time'))
            raw_distance = pb.get('distance')
            distance = normalize_distance(raw_distance)
            
            # Validate time is plausible for the distance
            if not time_secs or not distance:
                continue
            if not is_valid_time_for_distance(time_secs, distance):
                continue
                
            pb_date = parse_date(pb.get('date'))
            all_results.append({
                'distance': distance,
                'time': time_secs,
                'time_str': pb.get('time'),
                'competition': pb_comp,
                'date': pb_date.isoformat() if pb_date else None,
                'place': None,
                'source': 'stl',
            })
        
        if all_results:
            # Organize by distance and sort by date
            by_distance = defaultdict(list)
            for r in all_results:
                dist = r['distance']
                by_distance[dist].append(r)
            
            # Sort and deduplicate each distance
            # Keep only the BEST time per competition (per date within 2 days)
            source_priority = {'uss_pdf': 0, 'uss_hist': 1, 'stl': 2}
            
            for dist in by_distance:
                # Sort by date, then by time (fastest first)
                by_distance[dist].sort(key=lambda x: (x['date'] or '9999', x['time']))
                
                # Keep only best time per competition (group by date within 2 days)
                deduped = []
                
                for r in by_distance[dist]:
                    if not r['date']:
                        # No date - check if same competition name exists
                        dominated = False
                        for existing in deduped:
                            if existing.get('competition', '')[:30] == r.get('competition', '')[:30]:
                                # Same competition, keep faster time
                                if r['time'] < existing['time']:
                                    deduped.remove(existing)
                                    deduped.append(r)
                                dominated = True
                                break
                        if not dominated:
                            deduped.append(r)
                        continue
                    
                    # Check if we already have a result for this competition (within 2 days)
                    dominated = False
                    for i, existing in enumerate(deduped):
                        if not existing['date']:
                            continue
                        try:
                            r_date = datetime.fromisoformat(r['date'])
                            e_date = datetime.fromisoformat(existing['date'])
                            diff = abs((r_date - e_date).days)
                            # Same competition if within 2 days
                            if diff <= 2:
                                # Keep the faster time
                                if r['time'] < existing['time']:
                                    deduped[i] = r
                                dominated = True
                                break
                        except:
                            pass
                    
                    if not dominated:
                        deduped.append(r)
                
                by_distance[dist] = deduped
            
            time_trends[skater_id] = dict(by_distance)
    
    print(f"  Matched {matched} skaters to USS results")
    print(f"  Generated time trends for {len(time_trends)} skaters")
    
    # Save output
    output = {
        'generated': datetime.now().isoformat(),
        'total_skaters': len(time_trends),
        'sources': ['uss', 'stl'],
        'trends': time_trends,
    }
    
    output_path = os.path.join(DATA_DIR, 'skater_time_trends.json')
    with open(output_path, 'w') as f:
        json.dump(output, f)
    
    print(f"  Saved to {output_path}")
    
    # Print sample for Daniel Chen
    daniel_id = 'daniel-chen-usa'
    if daniel_id in time_trends:
        print(f"\nSample - Daniel Chen 500m:")
        for r in time_trends[daniel_id].get(500, []):
            print(f"  {r['date']} | {r['time_str']} | {r['competition'][:40]} | {r['source']}")

if __name__ == '__main__':
    build_time_trends()
