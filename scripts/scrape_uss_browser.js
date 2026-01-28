// Run in browser console on https://www.usspeedskating.org/results
// After expanding all seasons

function scrapeAllPDFs() {
  const results = [];
  
  // Find all links that contain PDF URLs
  document.querySelectorAll('a[href*=".pdf"]').forEach(link => {
    const url = link.href;
    const text = link.textContent.trim();
    
    // Parse date from text
    const dateMatch = text.match(/^(\d{4}-\d{2}-\d{2})\s*[-–]\s*(.+)/);
    let date = null;
    let name = text;
    
    if (dateMatch) {
      date = dateMatch[1];
      name = dateMatch[2].trim();
    }
    
    results.push({ url, name, date, rawText: text });
  });
  
  return results;
}

// Click all season buttons to expand them
async function expandAllSeasons() {
  const buttons = document.querySelectorAll('button[class*="accordion"]');
  for (const btn of buttons) {
    if (!btn.getAttribute('aria-expanded') || btn.getAttribute('aria-expanded') === 'false') {
      btn.click();
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

// Main
await expandAllSeasons();
const data = scrapeAllPDFs();
console.log(JSON.stringify(data, null, 2));
