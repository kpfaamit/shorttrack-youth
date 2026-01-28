// ShortTrack Analytics App
let skatersData = {};
let resultsData = [];
let selectedSkaters = [];
let pbChart = null;

const CHART_COLORS = ['#2563eb', '#dc2626', '#16a34a'];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupNavigation();
    setupSearch();
    setupCompare();
    setupStats();
});

// Load data from JSON files
async function loadData() {
    try {
        const [skatersRes, resultsRes] = await Promise.all([
            fetch('data/skaters.json'),
            fetch('data/us_historical_results.json')
        ]);
        
        const skatersJson = await skatersRes.json();
        skatersData = skatersJson.skaters;
        
        resultsData = await resultsRes.json();
        
        console.log(`Loaded ${Object.keys(skatersData).length} skaters and ${resultsData.length} results`);
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Navigation
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            
            // Update nav
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Update sections
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById(section).classList.add('active');
        });
    });
}

// Search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        if (query.length < 2) {
            searchResults.classList.remove('active');
            return;
        }
        
        const matches = Object.values(skatersData)
            .filter(s => s.name.toLowerCase().includes(query))
            .slice(0, 10);
        
        if (matches.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item"><span class="name">No results found</span></div>';
        } else {
            searchResults.innerHTML = matches.map(skater => `
                <div class="search-result-item" data-name="${escapeHtml(skater.name)}">
                    <span class="name">${escapeHtml(skater.name)}</span>
                    <span class="meta">${skater.seasons.join(', ')} • ${Object.keys(skater.best_times).length} PBs</span>
                </div>
            `).join('');
        }
        
        searchResults.classList.add('active');
    });
    
    searchResults.addEventListener('click', (e) => {
        const item = e.target.closest('.search-result-item');
        if (item && item.dataset.name) {
            showSkaterProfile(item.dataset.name);
            searchInput.value = '';
            searchResults.classList.remove('active');
        }
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResults.classList.remove('active');
        }
    });
}

// Show skater profile
function showSkaterProfile(name) {
    const skater = skatersData[name];
    if (!skater) return;
    
    const profile = document.getElementById('skaterProfile');
    profile.classList.remove('hidden');
    
    document.getElementById('skaterName').textContent = skater.name;
    document.getElementById('skaterSeasons').textContent = skater.seasons.join(', ');
    
    // Personal bests
    const pbContainer = document.getElementById('personalBests');
    const distances = ['500m', '1000m', '1500m', '3000m'];
    pbContainer.innerHTML = distances
        .filter(d => skater.best_times[d])
        .map(d => `
            <div class="pb-card">
                <div class="distance">${d}</div>
                <div class="time">${skater.best_times[d]}</div>
            </div>
        `).join('');
    
    // Race history
    const skaterResults = resultsData.filter(r => r.name === name);
    const historyContainer = document.getElementById('raceHistory');
    
    if (skaterResults.length === 0) {
        historyContainer.innerHTML = '<p style="color: var(--text-light);">No race history available</p>';
    } else {
        historyContainer.innerHTML = skaterResults
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
            .slice(0, 50)
            .map(r => {
                const placeClass = r.place === 1 ? 'gold' : r.place === 2 ? 'silver' : r.place === 3 ? 'bronze' : '';
                return `
                    <div class="race-item">
                        <span class="competition">${escapeHtml(r.competition || 'Unknown')} (${r.season})</span>
                        <span class="distance">${r.distance}</span>
                        <span class="place ${placeClass}">#${r.place || '-'}</span>
                        <span class="time">${r.time || '-'}</span>
                    </div>
                `;
            }).join('');
    }
    
    // Add to compare button
    const addBtn = document.getElementById('addToCompare');
    addBtn.onclick = () => {
        addToCompare(name);
        document.querySelector('[data-section="compare"]').click();
    };
    
    // Scroll to profile
    profile.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Compare functionality
function setupCompare() {
    const searchInput = document.getElementById('compareSearchInput');
    const searchResults = document.getElementById('compareSearchResults');
    
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        if (query.length < 2) {
            searchResults.classList.remove('active');
            return;
        }
        
        const matches = Object.values(skatersData)
            .filter(s => s.name.toLowerCase().includes(query))
            .filter(s => !selectedSkaters.includes(s.name))
            .slice(0, 10);
        
        if (matches.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item"><span class="name">No results found</span></div>';
        } else {
            searchResults.innerHTML = matches.map(skater => `
                <div class="search-result-item" data-name="${escapeHtml(skater.name)}">
                    <span class="name">${escapeHtml(skater.name)}</span>
                    <span class="meta">${skater.seasons.join(', ')}</span>
                </div>
            `).join('');
        }
        
        searchResults.classList.add('active');
    });
    
    searchResults.addEventListener('click', (e) => {
        const item = e.target.closest('.search-result-item');
        if (item && item.dataset.name) {
            addToCompare(item.dataset.name);
            searchInput.value = '';
            searchResults.classList.remove('active');
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.compare-selector')) {
            searchResults.classList.remove('active');
        }
    });
}

function addToCompare(name) {
    if (selectedSkaters.includes(name) || selectedSkaters.length >= 3) return;
    
    selectedSkaters.push(name);
    updateCompareUI();
}

function removeFromCompare(name) {
    selectedSkaters = selectedSkaters.filter(n => n !== name);
    updateCompareUI();
}

function updateCompareUI() {
    const container = document.getElementById('selectedSkaters');
    container.innerHTML = selectedSkaters.map((name, i) => `
        <div class="selected-skater">
            <span class="color-dot" style="background: ${CHART_COLORS[i]}"></span>
            <span>${escapeHtml(name)}</span>
            <button class="remove-btn" onclick="removeFromCompare('${escapeHtml(name)}')">&times;</button>
        </div>
    `).join('');
    
    const chartSection = document.getElementById('comparisonChart');
    if (selectedSkaters.length >= 2) {
        chartSection.classList.remove('hidden');
        renderComparison();
    } else {
        chartSection.classList.add('hidden');
    }
}

function renderComparison() {
    const distances = ['500m', '1000m', '1500m'];
    const skaters = selectedSkaters.map(name => skatersData[name]);
    
    // Prepare chart data
    const datasets = skaters.map((skater, i) => ({
        label: skater.name,
        data: distances.map(d => timeToSeconds(skater.best_times[d])),
        backgroundColor: CHART_COLORS[i],
        borderColor: CHART_COLORS[i],
        borderWidth: 2
    }));
    
    // Update/create chart
    const ctx = document.getElementById('pbChart').getContext('2d');
    if (pbChart) pbChart.destroy();
    
    pbChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: distances,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const seconds = context.raw;
                            return `${context.dataset.label}: ${secondsToTime(seconds)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Time (seconds)'
                    }
                }
            }
        }
    });
    
    // Comparison table
    const tableHtml = `
        <table>
            <thead>
                <tr>
                    <th>Distance</th>
                    ${skaters.map(s => `<th>${escapeHtml(s.name)}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${distances.map(d => {
                    const times = skaters.map(s => s.best_times[d]);
                    const validTimes = times.filter(t => t).map(t => timeToSeconds(t));
                    const bestTime = validTimes.length > 0 ? Math.min(...validTimes) : null;
                    
                    return `
                        <tr>
                            <td><strong>${d}</strong></td>
                            ${times.map(t => {
                                const isBest = t && timeToSeconds(t) === bestTime;
                                return `<td class="${isBest ? 'best' : ''}">${t || '-'}</td>`;
                            }).join('')}
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    document.getElementById('comparisonTable').innerHTML = tableHtml;
}

// Stats functionality
function setupStats() {
    // Update stats
    document.getElementById('totalSkaters').textContent = Object.keys(skatersData).length.toLocaleString();
    document.getElementById('totalResults').textContent = resultsData.length.toLocaleString();
    
    const seasons = new Set(resultsData.map(r => r.season));
    document.getElementById('totalSeasons').textContent = seasons.size;
    
    // Distance tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showLeaderboard(btn.dataset.distance);
        });
    });
    
    // Initial leaderboard
    showLeaderboard('500m');
}

function showLeaderboard(distance) {
    const skatersByPB = Object.values(skatersData)
        .filter(s => s.best_times[distance])
        .map(s => ({
            name: s.name,
            time: s.best_times[distance],
            seconds: timeToSeconds(s.best_times[distance])
        }))
        .sort((a, b) => a.seconds - b.seconds)
        .slice(0, 20);
    
    const container = document.getElementById('leaderboard');
    container.innerHTML = skatersByPB.map((s, i) => {
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        return `
            <div class="leaderboard-item">
                <span class="rank ${rankClass}">${i + 1}</span>
                <span class="name">${escapeHtml(s.name)}</span>
                <span class="time">${s.time}</span>
            </div>
        `;
    }).join('');
}

// Utility functions
function timeToSeconds(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(timeStr);
}

function secondsToTime(seconds) {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return mins > 0 ? `${mins}:${secs.padStart(6, '0')}` : secs;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make removeFromCompare available globally
window.removeFromCompare = removeFromCompare;
