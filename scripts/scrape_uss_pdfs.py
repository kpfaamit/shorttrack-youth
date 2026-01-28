#!/usr/bin/env python3
"""
Scrape all PDF links from USS results page for seasons 2022-2026.
"""

import json
import re
import subprocess
from pathlib import Path
from datetime import datetime

def get_page_source():
    """Get page source using curl."""
    url = "https://www.usspeedskating.org/results"
    result = subprocess.run(['curl', '-s', url], capture_output=True, text=True)
    return result.stdout

def extract_pdf_links(html):
    """Extract PDF links and competition names from HTML."""
    # Pattern for PDF links in the page
    pattern = r'href="(https://assets\.contentstack\.io/[^"]+\.pdf)"[^>]*>([^<]+)</a>'
    matches = re.findall(pattern, html, re.IGNORECASE)
    
    # Also try alternative pattern
    pattern2 = r'"(https://assets\.contentstack\.io/[^"]+\.pdf)"'
    pdf_urls = set(re.findall(pattern2, html))
    
    # Extract date and name from link text
    results = []
    for url, text in matches:
        # Parse date from text (format: YYYY-MM-DD - Name)
        date_match = re.match(r'(\d{4}-\d{2}-\d{2})\s*[-–]\s*(.+)', text.strip())
        if date_match:
            date = date_match.group(1)
            name = date_match.group(2).strip()
        else:
            date = None
            name = text.strip()
        
        results.append({
            'url': url,
            'name': name,
            'date': date
        })
    
    return results, pdf_urls

def main():
    print("Fetching USS results page...")
    html = get_page_source()
    
    # Save raw HTML for debugging
    Path('uss_results_page.html').write_text(html)
    print(f"Saved HTML ({len(html)} bytes)")
    
    # Extract PDF links
    results, all_urls = extract_pdf_links(html)
    
    print(f"\nFound {len(results)} PDF links with names")
    print(f"Found {len(all_urls)} total unique PDF URLs")
    
    # Group by season (based on date)
    by_season = {}
    for r in results:
        if r['date']:
            year = int(r['date'][:4])
            month = int(r['date'][5:7])
            # Season runs Aug-Jul, so Aug+ is next season
            if month >= 8:
                season = f"{year}-{year+1}"
            else:
                season = f"{year-1}-{year}"
        else:
            season = "unknown"
        
        if season not in by_season:
            by_season[season] = []
        by_season[season].append(r)
    
    print("\nBy season:")
    for season in sorted(by_season.keys()):
        print(f"  {season}: {len(by_season[season])} competitions")
    
    # Save to JSON
    output = {
        'scraped_at': datetime.now().isoformat(),
        'total_pdfs': len(results),
        'by_season': by_season,
        'all_results': results
    }
    
    output_path = Path(__file__).parent.parent / 'data' / 'uss_pdf_links.json'
    output_path.parent.mkdir(exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\nSaved to {output_path}")
    
    # Print sample
    print("\nSample competitions (2022-2023 and 2023-2024):")
    for season in ['2022-2023', '2023-2024']:
        if season in by_season:
            print(f"\n  {season}:")
            for r in by_season[season][:5]:
                print(f"    - {r['date']}: {r['name'][:50]}")

if __name__ == "__main__":
    main()
