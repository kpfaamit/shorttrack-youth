const fs = require('fs');
const path = require('path');

// Load data
const stlData = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../dist/data/us_youth_skater_facts.json'), 'utf8'
));
const ussData = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../dist/data/us_historical_results.json'), 'utf8'
));

// Try to load new USS results if available
let ussNewResults = null;
try {
  ussNewResults = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'uss_all_results.json'), 'utf8'
  ));
  console.log('Loaded uss_all_results.json with', ussNewResults?.results?.length || 0, 'results');
} catch (e) {
  console.log('uss_all_results.json not available yet, using only historical data');
}

// Normalize name: "SEARS Liam" or "Liam Sears" -> "liam sears"
function normalizeName(name) {
  if (!name) return '';
  name = name.trim().toLowerCase();
  // Handle double spaces
  name = name.replace(/\s+/g, ' ');
  // Check if it's "LAST First" format (all caps last name)
  const parts = name.split(' ');
  if (parts.length === 2) {
    const [first, second] = parts;
    // If first part was originally all caps, it's likely "LAST First"
    // We'll check if the original has uppercase pattern
    return `${second} ${first}`.toLowerCase();
  }
  return name;
}

// For STL names which are "LAST First" format
function normalizeStlName(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    // "SEARS Liam" -> "liam sears"
    const lastName = parts[0].toLowerCase();
    const firstName = parts.slice(1).join(' ').toLowerCase();
    return `${firstName} ${lastName}`;
  }
  return name.toLowerCase();
}

// For USS names which are "First Last" format
function normalizeUssName(name) {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Fuzzy match competition names
function competitionSimilarity(comp1, comp2) {
  if (!comp1 || !comp2) return 0;
  
  // Normalize both
  const n1 = comp1.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const n2 = comp2.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  
  if (n1 === n2) return 1.0;
  
  // Extract key terms
  const terms1 = new Set(n1.split(' ').filter(t => t.length > 2));
  const terms2 = new Set(n2.split(' ').filter(t => t.length > 2));
  
  // Count overlapping terms
  let overlap = 0;
  for (const t of terms1) {
    if (terms2.has(t)) overlap++;
  }
  
  const maxTerms = Math.max(terms1.size, terms2.size);
  if (maxTerms === 0) return 0;
  
  return overlap / maxTerms;
}

// Extract year from STL event name
function extractYearFromStlEvent(eventName) {
  // Patterns: "2021 Chicago Silver Skates" or "16.10. - 16.10.2021" or "23.10. - 23.10.2022, 104th Silver Skates"
  const yearMatch = eventName.match(/\b(20\d{2})\b/);
  return yearMatch ? parseInt(yearMatch[1]) : null;
}

// Build USS lookup index by normalized name
const ussIndex = new Map();
const ussResults = ussData.results || [];

// Combine with new results if available
if (ussNewResults?.results) {
  ussResults.push(...ussNewResults.results);
}

console.log(`Building index from ${ussResults.length} USS results...`);

for (const result of ussResults) {
  const normalizedName = normalizeUssName(result.skater);
  if (!ussIndex.has(normalizedName)) {
    ussIndex.set(normalizedName, []);
  }
  ussIndex.get(normalizedName).push(result);
}

console.log(`USS index has ${ussIndex.size} unique skaters`);

// Validation results
const validation = {
  validation_date: new Date().toISOString().split('T')[0],
  total_skaters: 0,
  skaters_with_uss_matches: 0,
  skaters_without_uss_matches: 0,
  total_events_checked: 0,
  events_matched: 0,
  events_mismatched: 0,
  events_not_found: 0,
  match_rate: '0%',
  mismatches: [],
  not_found_samples: [],
  matched_samples: [],
  summary_by_category: {},
  skater_match_details: []
};

const skaterIds = Object.keys(stlData);
validation.total_skaters = skaterIds.length;
console.log(`\nValidating ${skaterIds.length} STL skaters...`);

let processed = 0;
for (const skaterId of skaterIds) {
  const skater = stlData[skaterId];
  const stlName = skater.name; // "SEARS Liam"
  const normalizedName = normalizeStlName(stlName);
  const category = skater.category || 'unknown';
  
  // Initialize category stats
  if (!validation.summary_by_category[category]) {
    validation.summary_by_category[category] = {
      total_skaters: 0,
      matched: 0,
      not_matched: 0,
      events_checked: 0,
      events_matched: 0,
      events_mismatched: 0
    };
  }
  validation.summary_by_category[category].total_skaters++;
  
  // Find USS results for this skater
  const ussMatches = ussIndex.get(normalizedName) || [];
  
  const skaterDetail = {
    stl_id: skaterId,
    stl_name: stlName,
    normalized_name: normalizedName,
    category: category,
    stl_events: skater.events?.length || 0,
    uss_results_found: ussMatches.length,
    events_matched: 0,
    events_mismatched: 0,
    events_not_in_uss: 0
  };
  
  if (ussMatches.length > 0) {
    validation.skaters_with_uss_matches++;
    validation.summary_by_category[category].matched++;
    
    // Check each STL event against USS results
    for (const event of (skater.events || [])) {
      validation.total_events_checked++;
      validation.summary_by_category[category].events_checked++;
      
      const stlEventName = event.name;
      const stlYear = extractYearFromStlEvent(stlEventName);
      const stlRank = event.best_rank;
      
      // Find best matching USS result
      let bestMatch = null;
      let bestSimilarity = 0;
      
      for (const ussResult of ussMatches) {
        const ussYear = ussResult.date ? parseInt(ussResult.date.split('-')[0]) : null;
        
        // Year must match if both have years
        if (stlYear && ussYear && Math.abs(stlYear - ussYear) > 1) continue;
        
        const similarity = competitionSimilarity(stlEventName, ussResult.competition);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = ussResult;
        }
      }
      
      if (bestMatch && bestSimilarity > 0.3) {
        // Found a potential match - compare ranks
        const ussRank = bestMatch.place;
        
        if (stlRank === ussRank) {
          validation.events_matched++;
          validation.summary_by_category[category].events_matched++;
          skaterDetail.events_matched++;
          
          // Sample some matches
          if (validation.matched_samples.length < 20) {
            validation.matched_samples.push({
              skater: stlName,
              stl_event: stlEventName,
              uss_competition: bestMatch.competition,
              rank: stlRank,
              similarity: bestSimilarity.toFixed(2)
            });
          }
        } else {
          validation.events_mismatched++;
          validation.summary_by_category[category].events_mismatched++;
          skaterDetail.events_mismatched++;
          
          validation.mismatches.push({
            skater: stlName,
            stl_event: stlEventName,
            uss_competition: bestMatch.competition,
            stl_rank: stlRank,
            uss_rank: ussRank,
            similarity: bestSimilarity.toFixed(2)
          });
        }
      } else {
        validation.events_not_found++;
        skaterDetail.events_not_in_uss++;
        
        // Sample some not-found events
        if (validation.not_found_samples.length < 50) {
          validation.not_found_samples.push({
            skater: stlName,
            normalized_name: normalizedName,
            stl_event: stlEventName,
            stl_rank: stlRank,
            uss_results_count: ussMatches.length,
            best_similarity: bestSimilarity.toFixed(2),
            note: ussMatches.length > 0 ? 'Has USS results but no match for this event' : 'No USS results at all'
          });
        }
      }
    }
  } else {
    validation.skaters_without_uss_matches++;
    validation.summary_by_category[category].not_matched++;
    
    // Count all their events as not found
    const eventCount = skater.events?.length || 0;
    validation.total_events_checked += eventCount;
    validation.events_not_found += eventCount;
    validation.summary_by_category[category].events_checked += eventCount;
    skaterDetail.events_not_in_uss = eventCount;
    
    // Sample some skaters not found in USS
    if (validation.not_found_samples.length < 50) {
      validation.not_found_samples.push({
        skater: stlName,
        normalized_name: normalizedName,
        stl_event: skater.events?.[0]?.name || 'N/A',
        stl_events_total: eventCount,
        note: 'Skater not found in USS data'
      });
    }
  }
  
  validation.skater_match_details.push(skaterDetail);
  
  processed++;
  if (processed % 200 === 0) {
    console.log(`  Processed ${processed}/${skaterIds.length} skaters...`);
  }
}

// Calculate match rate
const eventsWithMatch = validation.events_matched + validation.events_mismatched;
if (eventsWithMatch > 0) {
  validation.match_rate = ((validation.events_matched / eventsWithMatch) * 100).toFixed(1) + '%';
}

// Add summary
validation.summary = {
  skater_match_rate: ((validation.skaters_with_uss_matches / validation.total_skaters) * 100).toFixed(1) + '%',
  event_coverage: ((eventsWithMatch / validation.total_events_checked) * 100).toFixed(1) + '%',
  data_accuracy: validation.match_rate,
  uss_data_source: ussNewResults ? 'historical + new' : 'historical only',
  uss_total_results: ussResults.length
};

// Limit mismatches in output to first 100
if (validation.mismatches.length > 100) {
  validation.mismatches_total = validation.mismatches.length;
  validation.mismatches = validation.mismatches.slice(0, 100);
  validation.mismatches_note = `Showing first 100 of ${validation.mismatches_total} mismatches`;
}

// Remove detailed skater info from main output (too large)
const fullReport = { ...validation };
delete fullReport.skater_match_details;

// Write main report
fs.writeFileSync(
  path.join(__dirname, 'full_validation_report.json'),
  JSON.stringify(fullReport, null, 2)
);

// Write detailed skater report separately
fs.writeFileSync(
  path.join(__dirname, 'skater_validation_details.json'),
  JSON.stringify({
    generated: new Date().toISOString(),
    total_skaters: validation.total_skaters,
    details: validation.skater_match_details
  }, null, 2)
);

console.log('\n=== VALIDATION COMPLETE ===');
console.log(`Total skaters: ${validation.total_skaters}`);
console.log(`Skaters with USS matches: ${validation.skaters_with_uss_matches} (${validation.summary.skater_match_rate})`);
console.log(`Skaters without USS matches: ${validation.skaters_without_uss_matches}`);
console.log(`\nTotal events checked: ${validation.total_events_checked}`);
console.log(`Events matched (rank agrees): ${validation.events_matched}`);
console.log(`Events mismatched (rank differs): ${validation.events_mismatched}`);
console.log(`Events not found in USS: ${validation.events_not_found}`);
console.log(`\nData accuracy (where matched): ${validation.match_rate}`);
console.log(`Event coverage: ${validation.summary.event_coverage}`);

console.log('\n--- Category Breakdown ---');
for (const [cat, stats] of Object.entries(validation.summary_by_category)) {
  console.log(`${cat}: ${stats.matched}/${stats.total_skaters} skaters matched, ${stats.events_matched}/${stats.events_checked} events agree`);
}

console.log('\nReports written to:');
console.log('  - full_validation_report.json');
console.log('  - skater_validation_details.json');
