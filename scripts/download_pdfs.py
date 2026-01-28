#!/usr/bin/env python3
"""Download all USS Short Track PDFs from the catalog."""

import json
import os
import subprocess
import re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_DIR = Path("/Users/garychen/dev/shorttrack-analytics/data/pdfs")
CATALOG_PATH = Path("/Users/garychen/dev/shorttrack-analytics/data/us_pdf_catalog.json")

def sanitize_filename(name: str) -> str:
    """Make filename safe for filesystem."""
    # Remove/replace problematic characters
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = re.sub(r'\s+', '_', name)
    name = re.sub(r'_+', '_', name)
    name = name.strip('_.')
    return name[:100]  # Limit length

def download_pdf(url: str, output_path: Path) -> tuple[bool, str, int]:
    """Download a PDF using curl. Returns (success, message, size_bytes)."""
    if output_path.exists():
        size = output_path.stat().st_size
        return True, f"Already exists: {output_path.name}", size
    
    # Check for malformed URLs
    if "https://assets" in url and url.count("http") > 1:
        # Fix URLs like https://www.usspeedskating.org/...https://assets...
        url = "https://assets" + url.split("https://assets")[1]
    
    try:
        result = subprocess.run(
            ["curl", "-sL", "-o", str(output_path), url],
            capture_output=True,
            timeout=60
        )
        if result.returncode == 0 and output_path.exists():
            size = output_path.stat().st_size
            if size > 1000:  # Valid PDF should be > 1KB
                return True, f"Downloaded: {output_path.name}", size
            else:
                output_path.unlink()
                return False, f"Too small (likely error): {output_path.name}", 0
        return False, f"Failed: {output_path.name}", 0
    except Exception as e:
        return False, f"Error: {output_path.name} - {e}", 0

def main():
    # Load catalog
    with open(CATALOG_PATH) as f:
        catalog = json.load(f)
    
    # Collect all short_track PDFs
    downloads = []
    for season_data in catalog["seasons"]:
        season = season_data["season"]
        for comp in season_data["competitions"]:
            if comp["type"] == "short_track":
                downloads.append({
                    "season": season,
                    "date": comp["date"],
                    "name": comp["name"],
                    "url": comp["pdf_url"]
                })
    
    print(f"Found {len(downloads)} short_track PDFs to download\n")
    
    # Create directories and prepare download tasks
    tasks = []
    for item in downloads:
        season_dir = BASE_DIR / item["season"]
        season_dir.mkdir(parents=True, exist_ok=True)
        
        date_str = item["date"] if item["date"] else "unknown"
        safe_name = sanitize_filename(item["name"])
        filename = f"{date_str}_{safe_name}.pdf"
        output_path = season_dir / filename
        
        tasks.append((item["url"], output_path))
    
    # Download with parallel workers
    success_count = 0
    fail_count = 0
    total_size = 0
    
    print("Downloading...")
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(download_pdf, url, path): path for url, path in tasks}
        for future in as_completed(futures):
            success, msg, size = future.result()
            if success:
                success_count += 1
                total_size += size
            else:
                fail_count += 1
                print(f"  FAIL: {msg}")
    
    # Summary
    print(f"\n{'='*50}")
    print(f"Download complete!")
    print(f"  Success: {success_count}")
    print(f"  Failed:  {fail_count}")
    print(f"  Total size: {total_size / (1024*1024):.1f} MB")
    
    # List directories
    print(f"\nDirectories created:")
    for d in sorted(BASE_DIR.iterdir()):
        if d.is_dir():
            count = len(list(d.glob("*.pdf")))
            print(f"  {d.name}/  ({count} PDFs)")

if __name__ == "__main__":
    main()
