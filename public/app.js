// ShortTrack Analytics App
let skatersData = [];
let skatersMap = {};
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
        const skatersRes = await fetch('data/skaters.json');
        skatersData = await skatersRes.json();
        
        // Build lookup map by name
        skatersData.forEach(s => {
            skatersMap[s.name] = s;
        });
        
        // Try to load US historical results
        try {
            const resultsRes = await fetch('data/us_historical_results.json');
            resultsData = await resultsRes.json();
        } catch (e) {
            console.log('US historical results not loaded');
            resultsData = [];
        }
        
        console.log(`Loaded ${skatersData.length} skaters`);
        
        // Update stats immediately
        document.getElementById('totalSkaters').textContent = skatersData.length.toLocaleString();
        document.getElementById('totalResults').textContent = skatersData.reduce((sum, s) => sum + (s.stats?.total_races || 0), 0).toLocaleString();
        
        const countries = new Set(skatersData.map(s => s.nationality).filter(Boolean));
        document.getElementById('totalSeasons').textContent = countries.size + ' countries';
        
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
            
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
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
        
        const matches = skatersData
            .filter(s => s.name.toLowerCase().includes(query))
            .slice(0, 15);
        
        if (matches.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item"><span class="name">No results found</span></div>';
        } else {
            searchResults.innerHTML = matches.map(skater => {
                const pbCount = skater.personal_bests ? Object.keys(skater.personal_bests).length : 0;
                const races = skater.stats?.total_races || 0;
                return `
                    <div class="search-result-item" data-name="${escapeHtml(skater.name)}">
                        <span class="name">${skater.flag || ''} ${escapeHtml(skater.name)}</span>
                        <span class="meta">${skater.nationality || ''} • ${races} races • ${pbCount} PBs</span>
                    </div>
                `;
            }).join('');
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
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResults.classList.remove('active');
        }
    });
}

// Show skater profile
function showSkaterProfile(name) {
    const skater = skatersMap[name];
    if (!skater) return;
    
    const profile = document.getElementById('skaterProfile');
    profile.classList.remove('hidden');
    
    document.getElementById('skaterName').textContent = `${skater.flag || ''} ${skater.name}`;
    
    // Build seasons info
    const info = [];
    if (skater.nationality) info.push(skater.nationality);
    if (skater.age) info.push(`${skater.age} years old`);
    if (skater.category) info.push(skater.category);
    document.getElementById('skaterSeasons').textContent = info.join(' • ') || 'N/A';
    
    // Personal bests
    const pbContainer = document.getElementById('personalBests');
    const distances = ['500', '1000', '1500', '3000'];
    
    if (skater.personal_bests && Object.keys(skater.personal_bests).length > 0) {
        pbContainer.innerHTML = distances
            .filter(d => skater.personal_bests[d])
            .map(d => `
                <div class="pb-card">
                    <div class="distance">${d}m</div>
                    <div class="time">${formatTime(skater.personal_bests[d])}</div>
                </div>
            `).join('');
    } else if (skater.distances && skater.distances.length > 0) {
        // Fallback to distances array
        pbContainer.innerHTML = skater.distances
            .filter(d => d.best_time)
            .map(d => `
                <div class="pb-card">
                    <div class="distance">${d.distance}m</div>
                    <div class="time">${formatTime(d.best_time)}</div>
                </div>
            `).join('');
    } else {
        pbContainer.innerHTML = '<p style="color: var(--text-light);">No personal bests recorded</p>';
    }
    
    // Race history / events
    const historyContainer = document.getElementById('raceHistory');
    
    if (skater.events && skater.events.length > 0) {
        historyContainer.innerHTML = skater.events
            .slice(0, 20)
            .map(e => {
                const medal = e.medal ? `🏅 ${e.medal}` : '';
                return `
                    <div class="race-item">
                        <span class="competition">${escapeHtml(e.name)}</span>
                        <span class="distance">${e.races} races</span>
                        <span class="place ${e.finals_reached ? 'gold' : ''}">
                            ${e.finals_reached ? '🏆 Finals' : `Best: #${e.best_rank}`}
                        </span>
                        <span class="time">${medal}</span>
                    </div>
                `;
            }).join('');
    } else {
        historyContainer.innerHTML = '<p style="color: var(--text-light);">No event history available</p>';
    }
    
    // Stats cards
    const statsHtml = `
        <div class="stat-card">
            <span class="stat-label">Total Races</span>
            <span class="stat-value">${skater.stats?.total_races || 0}</span>
        </div>
        <div class="stat-card">
            <span class="stat-label">Medals</span>
            <span class="stat-value">${skater.stats?.medals?.total || 0}</span>
        </div>
        <div class="stat-card">
            <span class="stat-label">Finals</span>
            <span class="stat-value">${skater.stats?.finals_appearances || 0}</span>
        </div>
    `;
    document.querySelector('.profile-stats').innerHTML = statsHtml;
    
    // Add to compare button
    const addBtn = document.getElementById('addToCompare');
    addBtn.onclick = () => {
        addToCompare(name);
        document.querySelector('[data-section="compare"]').click();
    };
    
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
        
        const matches = skatersData
            .filter(s => s.name.toLowerCase().includes(query))
            .filter(s => !selectedSkaters.includes(s.name))
            .slice(0, 10);
        
        if (matches.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item"><span class="name">No results found</span></div>';
        } else {
            searchResults.innerHTML = matches.map(skater => `
                <div class="search-result-item" data-name="${escapeHtml(skater.name)}">
                    <span class="name">${skater.flag || ''} ${escapeHtml(skater.name)}</span>
                    <span class="meta">${skater.nationality || ''}</span>
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
    container.innerHTML = selectedSkaters.map((name, i) => {
        const skater = skatersMap[name];
        return `
            <div class="selected-skater">
                <span class="color-dot" style="background: ${CHART_COLORS[i]}"></span>
                <span>${skater?.flag || ''} ${escapeHtml(name)}</span>
                <button class="remove-btn" onclick="removeFromCompare('${escapeHtml(name)}')">&times;</button>
            </div>
        `;
    }).join('');
    
    const chartSection = document.getElementById('comparisonChart');
    if (selectedSkaters.length >= 2) {
        chartSection.classList.remove('hidden');
        renderComparison();
    } else {
        chartSection.classList.add('hidden');
    }
}

function renderComparison() {
    const distances = ['500', '1000', '1500'];
    const skaters = selectedSkaters.map(name => skatersMap[name]).filter(Boolean);
    
    // Get PB times
    const datasets = skaters.map((skater, i) => ({
        label: skater.name,
        data: distances.map(d => {
            if (skater.personal_bests && skater.personal_bests[d]) {
                return timeToSeconds(skater.personal_bests[d]);
            }
            return null;
        }),
        backgroundColor: CHART_COLORS[i],
        borderColor: CHART_COLORS[i],
        borderWidth: 2
    }));
    
    const ctx = document.getElementById('pbChart').getContext('2d');
    if (pbChart) pbChart.destroy();
    
    pbChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: distances.map(d => d + 'm'),
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const seconds = context.raw;
                            return seconds ? `${context.dataset.label}: ${secondsToTime(seconds)}` : `${context.dataset.label}: N/A`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: { display: true, text: 'Time (seconds)' }
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
                    ${skaters.map(s => `<th>${s.flag || ''} ${escapeHtml(s.name)}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${distances.map(d => {
                    const times = skaters.map(s => s.personal_bests?.[d] || null);
                    const validTimes = times.filter(t => t).map(t => timeToSeconds(t));
                    const bestTime = validTimes.length > 0 ? Math.min(...validTimes) : null;
                    
                    return `
                        <tr>
                            <td><strong>${d}m</strong></td>
                            ${times.map(t => {
                                const isBest = t && timeToSeconds(t) === bestTime;
                                return `<td class="${isBest ? 'best' : ''}">${t ? formatTime(t) : '-'}</td>`;
                            }).join('')}
                        </tr>
                    `;
                }).join('')}
                <tr>
                    <td><strong>Total Races</strong></td>
                    ${skaters.map(s => `<td>${s.stats?.total_races || 0}</td>`).join('')}
                </tr>
                <tr>
                    <td><strong>Medals</strong></td>
                    ${skaters.map(s => {
                        const m = s.stats?.medals;
                        if (!m) return '<td>-</td>';
                        return `<td>🥇${m.gold || 0} 🥈${m.silver || 0} 🥉${m.bronze || 0}</td>`;
                    }).join('')}
                </tr>
            </tbody>
        </table>
    `;
    document.getElementById('comparisonTable').innerHTML = tableHtml;
}

// Stats functionality
function setupStats() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showLeaderboard(btn.dataset.distance);
        });
    });
    
    showLeaderboard('500m');
}

function showLeaderboard(distanceWithM) {
    const distance = distanceWithM.replace('m', '');
    
    const skatersByPB = skatersData
        .filter(s => s.personal_bests && s.personal_bests[distance])
        .map(s => ({
            name: s.name,
            flag: s.flag || '',
            time: s.personal_bests[distance],
            seconds: timeToSeconds(s.personal_bests[distance])
        }))
        .filter(s => s.seconds > 0 && s.seconds < 600) // Filter unrealistic times
        .sort((a, b) => a.seconds - b.seconds)
        .slice(0, 20);
    
    const container = document.getElementById('leaderboard');
    
    if (skatersByPB.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-light);">No data for this distance</p>';
        return;
    }
    
    container.innerHTML = skatersByPB.map((s, i) => {
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        return `
            <div class="leaderboard-item" style="cursor: pointer" onclick="showSkaterFromLeaderboard('${escapeHtml(s.name)}')">
                <span class="rank ${rankClass}">${i + 1}</span>
                <span class="name">${s.flag} ${escapeHtml(s.name)}</span>
                <span class="time">${formatTime(s.time)}</span>
            </div>
        `;
    }).join('');
}

function showSkaterFromLeaderboard(name) {
    document.querySelector('[data-section="search"]').click();
    setTimeout(() => showSkaterProfile(name), 100);
}

// Utility functions
function timeToSeconds(timeStr) {
    if (!timeStr) return null;
    const str = String(timeStr);
    const parts = str.split(':');
    if (parts.length === 2) {
        return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(str);
}

function secondsToTime(seconds) {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return mins > 0 ? `${mins}:${secs.padStart(6, '0')}` : secs;
}

function formatTime(timeStr) {
    if (!timeStr) return '-';
    // Already formatted
    if (String(timeStr).includes(':')) return timeStr;
    // Seconds only
    const secs = parseFloat(timeStr);
    if (secs >= 60) {
        const mins = Math.floor(secs / 60);
        const remainder = (secs % 60).toFixed(3);
        return `${mins}:${remainder.padStart(6, '0')}`;
    }
    return secs.toFixed(3);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Global functions
window.removeFromCompare = removeFromCompare;
window.showSkaterFromLeaderboard = showSkaterFromLeaderboard;
