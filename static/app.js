// Global App State
let appReleases = [];
let selectedReleases = new Set();
let activeFilter = 'all';
let searchQuery = '';
let currentTweetMode = 'single'; // 'single' or 'bulk'
let singleTargetReleaseId = null;
let currentLayout = 'bullet'; // 'bullet' or 'compact'

// Constant Constraints
const TWEET_CHAR_LIMIT = 280;
const CIRCUMFERENCE = 2 * Math.PI * 12; // Radius is 12, circum is ~75.4

// Elements Cache
const elements = {
    refreshBtn: document.getElementById('refreshBtn'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    filterPillsContainer: document.getElementById('filterPillsContainer'),
    lastUpdatedText: document.getElementById('lastUpdatedText'),
    skeletonContainer: document.getElementById('skeletonContainer'),
    emptyState: document.getElementById('emptyState'),
    notesTimeline: document.getElementById('notesTimeline'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    
    // Selection Drawer
    selectionDrawer: document.getElementById('selectionDrawer'),
    selectedCountBadge: document.getElementById('selectedCountBadge'),
    selectedCountText: document.getElementById('selectedCountText'),
    clearSelectionBtn: document.getElementById('clearSelectionBtn'),
    tweetSelectedBtn: document.getElementById('tweetSelectedBtn'),
    
    // Modal
    tweetModal: document.getElementById('tweetModal'),
    modalTitle: document.getElementById('modalTitle'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelModalBtn: document.getElementById('cancelModalBtn'),
    postTweetBtn: document.getElementById('postTweetBtn'),
    tweetTextArea: document.getElementById('tweetTextArea'),
    charCounter: document.getElementById('charCounter'),
    progressCircle: document.getElementById('progressCircle'),
    draftNotice: document.getElementById('draftNotice'),
    draftNoticeText: document.getElementById('draftNoticeText'),
    
    // Intent Option Layout Buttons
    layoutBtnBullet: document.getElementById('layoutBtnBullet'),
    layoutBtnCompact: document.getElementById('layoutBtnCompact'),
    
    // Toast Container
    toastContainer: document.getElementById('toastContainer'),
    exportCsvBtn: document.getElementById('exportCsvBtn')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchReleases(false);
    setupEventListeners();
    initProgressRing();
});

// Setup Event Listeners
function setupEventListeners() {
    // Refresh action
    elements.refreshBtn.addEventListener('click', () => fetchReleases(true));
    elements.exportCsvBtn.addEventListener('click', exportReleasesToCSV);
    
    // Search inputs
    elements.searchInput.addEventListener('input', handleSearch);
    elements.clearSearchBtn.addEventListener('click', clearSearch);
    
    // Filters
    elements.filterPillsContainer.addEventListener('click', handleFilterClick);
    elements.resetFiltersBtn.addEventListener('click', resetFilters);
    
    // Selection Drawer
    elements.clearSelectionBtn.addEventListener('click', clearSelection);
    elements.tweetSelectedBtn.addEventListener('click', openBulkTweetComposer);
    
    // Modal actions
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.cancelModalBtn.addEventListener('click', closeModal);
    elements.postTweetBtn.addEventListener('click', launchTwitterIntent);
    elements.tweetTextArea.addEventListener('input', handleTweetTextInput);
    
    // Layout switches
    elements.layoutBtnBullet.addEventListener('click', () => changeTweetLayout('bullet'));
    elements.layoutBtnCompact.addEventListener('click', () => changeTweetLayout('compact'));
}

// Fetch Releases from Flask API
async function fetchReleases(forceRefresh = false) {
    toggleLoading(true);
    clearSelection();
    
    try {
        const url = `/api/releases${forceRefresh ? '?force_refresh=true' : ''}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            appReleases = data.releases;
            updateLastUpdatedTime(data.last_updated);
            renderReleases();
            if (forceRefresh) {
                showToast('Feed refreshed successfully!', 'success');
            }
        } else {
            console.error('API Error:', data.error);
            showToast(`Error: ${data.error}`, 'error');
            renderErrorState();
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        showToast('Failed to connect to backend service.', 'error');
        renderErrorState();
    } finally {
        toggleLoading(false);
    }
}

// Toggle loading states (spinner & skeleton loaders)
function toggleLoading(isLoading) {
    if (isLoading) {
        elements.refreshBtn.classList.add('loading');
        elements.refreshBtn.disabled = true;
        elements.skeletonContainer.style.display = 'block';
        elements.notesTimeline.style.display = 'none';
        elements.emptyState.style.display = 'none';
    } else {
        elements.refreshBtn.classList.remove('loading');
        elements.refreshBtn.disabled = false;
        elements.skeletonContainer.style.display = 'none';
    }
}

// Update Last Updated Timestamp
function updateLastUpdatedTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    elements.lastUpdatedText.textContent = `Last synced: Today at ${timeStr}`;
}

// Render Release Notes Grid
function renderReleases() {
    const filtered = appReleases.filter(note => {
        // Filter Pill check
        let matchesFilter = true;
        const typeLower = note.type.toLowerCase();
        if (activeFilter === 'feature') {
            matchesFilter = typeLower === 'feature';
        } else if (activeFilter === 'fix') {
            matchesFilter = typeLower === 'fix';
        } else if (activeFilter === 'other') {
            matchesFilter = typeLower !== 'feature' && typeLower !== 'fix';
        }
        
        // Search Input check
        let matchesSearch = true;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const inText = note.plain_text.toLowerCase();
            const inDate = note.date.toLowerCase();
            const inType = note.type.toLowerCase();
            matchesSearch = inText.includes(query) || inDate.includes(query) || inType.includes(query);
        }
        
        return matchesFilter && matchesSearch;
    });
    
    if (filtered.length === 0) {
        elements.notesTimeline.style.display = 'none';
        elements.emptyState.style.display = 'block';
        return;
    }
    
    elements.emptyState.style.display = 'none';
    elements.notesTimeline.style.display = 'flex';
    
    // Clear and build timeline HTML
    elements.notesTimeline.innerHTML = '';
    
    filtered.forEach(note => {
        const isSelected = selectedReleases.has(note.id);
        const card = document.createElement('article');
        card.className = `note-card${isSelected ? ' selected' : ''}`;
        card.dataset.id = note.id;
        
        // Map badge styling
        let badgeClass = 'badge-other';
        if (note.type.toLowerCase() === 'feature') badgeClass = 'badge-feature';
        if (note.type.toLowerCase() === 'fix') badgeClass = 'badge-fix';
        
        card.innerHTML = `
            <div class="note-checkbox-wrapper">
                <div class="custom-checkbox" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
            </div>
            
            <div class="note-details">
                <div class="note-meta">
                    <span class="note-date">${note.date}</span>
                    <span class="badge ${badgeClass}">${note.type}</span>
                </div>
                <div class="note-body">
                    ${note.content}
                </div>
            </div>
            
            <div class="note-actions">
                <button class="btn-card-copy" title="Copy update text" aria-label="Copy update text">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </button>
                <button class="btn-card-tweet" title="Tweet this update" aria-label="Tweet this update">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                </button>
            </div>
        `;
        
        // Add Event Listeners
        // Clicking card selects it (unless clicking on a link or button)
        card.addEventListener('click', (e) => {
            if (e.target.closest('a') || e.target.closest('.btn-card-tweet') || e.target.closest('.btn-card-copy')) {
                return;
            }
            toggleSelectRelease(note.id);
        });
        
        // Card level copy action
        card.querySelector('.btn-card-copy').addEventListener('click', (e) => {
            e.stopPropagation();
            copyReleaseToClipboard(note);
        });
        
        // Card level tweet action
        card.querySelector('.btn-card-tweet').addEventListener('click', (e) => {
            e.stopPropagation();
            openSingleTweetComposer(note.id);
        });
        
        elements.notesTimeline.appendChild(card);
    });
}

// Search Inputs Handling
function handleSearch(e) {
    searchQuery = e.target.value;
    if (searchQuery) {
        elements.clearSearchBtn.style.display = 'flex';
    } else {
        elements.clearSearchBtn.style.display = 'none';
    }
    renderReleases();
}

function clearSearch() {
    elements.searchInput.value = '';
    searchQuery = '';
    elements.clearSearchBtn.style.display = 'none';
    renderReleases();
}

// Filter pill clicks
function handleFilterClick(e) {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    
    // Deactivate current active pill
    elements.filterPillsContainer.querySelector('.pill.active').classList.remove('active');
    // Activate clicked pill
    pill.classList.add('active');
    
    activeFilter = pill.dataset.filter;
    renderReleases();
}

// Reset filters button
function resetFilters() {
    clearSearch();
    elements.filterPillsContainer.querySelector('.pill.active').classList.remove('active');
    elements.filterPillsContainer.querySelector('[data-filter="all"]').classList.add('active');
    activeFilter = 'all';
    renderReleases();
}

// Render Error Fallback
function renderErrorState() {
    elements.notesTimeline.style.display = 'none';
    elements.emptyState.style.display = 'block';
    elements.emptyState.querySelector('h3').textContent = 'Unable to Load Feed';
    elements.emptyState.querySelector('p').textContent = 'We encountered an error connecting to the API. Check your Flask server and try again.';
}

// Selection Logic
function toggleSelectRelease(id) {
    if (selectedReleases.has(id)) {
        selectedReleases.delete(id);
    } else {
        selectedReleases.add(id);
    }
    
    // Toggle class on the DOM node directly for speed
    const card = elements.notesTimeline.querySelector(`[data-id="${id}"]`);
    if (card) {
        card.classList.toggle('selected');
    }
    
    updateSelectionDrawer();
}

function clearSelection() {
    selectedReleases.clear();
    elements.notesTimeline.querySelectorAll('.note-card.selected').forEach(el => {
        el.classList.remove('selected');
    });
    updateSelectionDrawer();
}

function updateSelectionDrawer() {
    const count = selectedReleases.size;
    if (count > 0) {
        elements.selectedCountBadge.textContent = count;
        elements.selectedCountText.textContent = count === 1 ? 'update selected' : 'updates selected';
        elements.selectionDrawer.classList.add('active');
    } else {
        elements.selectionDrawer.classList.remove('active');
    }
}

// Tweet Drafting Math & Generation Logic
function generateSingleTweetText(note, layout = 'bullet') {
    const cleanDate = note.date;
    const cleanText = note.plain_text;
    const url = note.link;
    
    if (layout === 'compact') {
        // Compact draft format:
        // BigQuery [Date]: [Text] #GoogleCloud [URL]
        const prefix = `BigQuery Release (${cleanDate}): `;
        const suffix = ` #GoogleCloud ${url}`;
        const allowedLen = TWEET_CHAR_LIMIT - prefix.length - suffix.length;
        
        let tweetBody = cleanText;
        if (tweetBody.length > allowedLen) {
            tweetBody = tweetBody.substring(0, allowedLen - 3) + '...';
        }
        return `${prefix}${tweetBody}${suffix}`;
    } else {
        // Bullet/Full format layout:
        // BigQuery Update • [Date]
        // [Text]
        // Link: [URL]
        const header = `BigQuery Update • ${cleanDate}\n`;
        const footer = `\n\nDetails: ${url}`;
        const allowedLen = TWEET_CHAR_LIMIT - header.length - footer.length;
        
        let tweetBody = cleanText;
        if (tweetBody.length > allowedLen) {
            tweetBody = tweetBody.substring(0, allowedLen - 3) + '...';
        }
        return `${header}${tweetBody}${footer}`;
    }
}

function generateBulkTweetText(notes, layout = 'bullet') {
    const header = `Latest BigQuery Updates:\n`;
    const defaultUrl = 'https://cloud.google.com/bigquery/docs/release-notes';
    const footer = `\n\nFeed: ${defaultUrl}`;
    
    if (layout === 'compact') {
        // Compact bulk format:
        // BigQuery Updates: [Text 1] | [Text 2] [URL]
        const bulkPrefix = `BigQuery Updates: `;
        const bulkSuffix = `\n\nMore: ${defaultUrl}`;
        const allowedLen = TWEET_CHAR_LIMIT - bulkPrefix.length - bulkSuffix.length;
        
        let bodies = notes.map(n => `• ${n.date}: ${n.plain_text}`);
        let combined = bodies.join(' | ');
        if (combined.length > allowedLen) {
            combined = combined.substring(0, allowedLen - 3) + '...';
        }
        return `${bulkPrefix}${combined}${bulkSuffix}`;
    } else {
        // Bullet format layout:
        // Latest BigQuery Updates:
        // • [Date]: [Text 1]
        // • [Date]: [Text 2]
        // Feed: [URL]
        const allowedLen = TWEET_CHAR_LIMIT - header.length - footer.length;
        const bulletCount = notes.length;
        
        // Calculate an even share of chars for each bullet to guarantee fitting
        const avgShare = Math.floor(allowedLen / bulletCount) - 5; // offset for bullets formatting
        
        const bulletLines = notes.map(note => {
            const datePrefix = `• ${note.date}: `;
            const textLimit = avgShare - datePrefix.length;
            let text = note.plain_text;
            if (text.length > textLimit) {
                text = text.substring(0, textLimit - 3) + '...';
            }
            return `${datePrefix}${text}`;
        });
        
        return `${header}${bulletLines.join('\n')}${footer}`;
    }
}

// Modal Interaction
function openSingleTweetComposer(id) {
    currentTweetMode = 'single';
    singleTargetReleaseId = id;
    
    const note = appReleases.find(n => n.id === id);
    if (!note) return;
    
    elements.modalTitle.textContent = 'Tweet this Update';
    elements.draftNotice.style.display = 'none';
    
    // Generate text draft
    const text = generateSingleTweetText(note, currentLayout);
    elements.tweetTextArea.value = text;
    
    // Display Modal
    elements.tweetModal.classList.add('active');
    elements.tweetModal.style.display = 'flex';
    
    handleTweetTextInput();
}

function openBulkTweetComposer() {
    if (selectedReleases.size === 0) return;
    currentTweetMode = 'bulk';
    
    const notes = Array.from(selectedReleases).map(id => appReleases.find(n => n.id === id)).filter(Boolean);
    
    elements.modalTitle.textContent = `Tweet Selected (${notes.length})`;
    elements.draftNotice.style.display = 'flex';
    elements.draftNoticeText.textContent = `Drafting a summary of ${notes.length} selected release notes.`;
    
    // Generate bulk text draft
    const text = generateBulkTweetText(notes, currentLayout);
    elements.tweetTextArea.value = text;
    
    // Display Modal
    elements.tweetModal.classList.add('active');
    elements.tweetModal.style.display = 'flex';
    
    handleTweetTextInput();
}

function changeTweetLayout(layout) {
    if (currentLayout === layout) return;
    currentLayout = layout;
    
    if (layout === 'bullet') {
        elements.layoutBtnBullet.classList.add('active');
        elements.layoutBtnCompact.classList.remove('active');
    } else {
        elements.layoutBtnBullet.classList.remove('active');
        elements.layoutBtnCompact.classList.add('active');
    }
    
    // Regenerate layout based on current mode
    if (currentTweetMode === 'single') {
        const note = appReleases.find(n => n.id === singleTargetReleaseId);
        if (note) {
            elements.tweetTextArea.value = generateSingleTweetText(note, currentLayout);
        }
    } else {
        const notes = Array.from(selectedReleases).map(id => appReleases.find(n => n.id === id)).filter(Boolean);
        elements.tweetTextArea.value = generateBulkTweetText(notes, currentLayout);
    }
    
    handleTweetTextInput();
}

function closeModal() {
    elements.tweetModal.classList.remove('active');
    setTimeout(() => {
        elements.tweetModal.style.display = 'none';
    }, 200);
}

// Progress Ring Math & Input Handling
function initProgressRing() {
    elements.progressCircle.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
    elements.progressCircle.style.strokeDashoffset = CIRCUMFERENCE;
}

function setProgressRing(percent) {
    const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
    elements.progressCircle.style.strokeDashoffset = offset;
}

function handleTweetTextInput() {
    const text = elements.tweetTextArea.value;
    const len = text.length;
    const remaining = TWEET_CHAR_LIMIT - len;
    
    elements.charCounter.textContent = remaining;
    
    // Set circle percentage progress
    const pct = Math.min((len / TWEET_CHAR_LIMIT) * 100, 100);
    setProgressRing(pct);
    
    // Colors & Warning styling
    elements.charCounter.classList.remove('warning', 'danger');
    elements.progressCircle.style.stroke = '#8b5cf6'; // default purple accent
    
    if (remaining <= 20 && remaining > 0) {
        elements.charCounter.classList.add('warning');
        elements.progressCircle.style.stroke = '#f59e0b'; // amber color
    } else if (remaining <= 0) {
        elements.charCounter.classList.add('danger');
        elements.progressCircle.style.stroke = '#ec4899'; // pink/red color
    }
}

// Launch Web Twitter Intent in New Tab
function launchTwitterIntent() {
    const text = elements.tweetTextArea.value;
    if (!text.trim()) {
        showToast("Tweet content cannot be empty!", "error");
        return;
    }
    
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
    closeModal();
    showToast("Twitter intent launched!", "success");
}

// Toast System
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    elements.toastContainer.appendChild(toast);
    
    // Trigger slide-in animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Delete toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Copy single release text to clipboard
function copyReleaseToClipboard(note) {
    const textToCopy = `BigQuery Release (${note.date})\nType: ${note.type}\n\n${note.plain_text}\n\nDetails: ${note.link}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast("Copied update to clipboard!", "success");
    }).catch(err => {
        console.error('Could not copy text: ', err);
        showToast("Failed to copy text.", "error");
    });
}

// Export releases to CSV
function exportReleasesToCSV() {
    let releasesToExport = [];
    
    if (selectedReleases.size > 0) {
        // Export selected releases
        releasesToExport = Array.from(selectedReleases)
            .map(id => appReleases.find(n => n.id === id))
            .filter(Boolean);
        showToast(`Exporting ${releasesToExport.length} selected updates...`, 'success');
    } else {
        // Export all loaded releases
        releasesToExport = appReleases;
        if (releasesToExport.length === 0) {
            showToast("No release notes available to export.", "error");
            return;
        }
        showToast(`Exporting all ${releasesToExport.length} updates...`, 'success');
    }
    
    // Build CSV (Date, Type, Content, Link)
    const headers = ["Date", "Type", "Content", "Link"];
    const rows = releasesToExport.map(note => [
        note.date,
        note.type,
        note.plain_text,
        note.link
    ]);
    
    const escapeCSVCell = (val) => {
        if (val === null || val === undefined) return '';
        let stringVal = String(val);
        if (stringVal.includes('"') || stringVal.includes(',') || stringVal.includes('\n') || stringVal.includes('\r')) {
            stringVal = '"' + stringVal.replace(/"/g, '""') + '"';
        }
        return stringVal;
    };
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(escapeCSVCell).join(','))
    ].join('\r\n');
    
    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bigquery_releases_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Light/Dark Theme Initialization and Toggle
function initTheme() {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const sunIcon = themeToggleBtn.querySelector('.theme-icon-sun');
    const moonIcon = themeToggleBtn.querySelector('.theme-icon-moon');
    
    // Load persisted theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    }
    
    // Bind click handler
    themeToggleBtn.addEventListener('click', () => {
        const isLightTheme = document.body.classList.toggle('light-theme');
        if (isLightTheme) {
            localStorage.setItem('theme', 'light');
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
            showToast("Switched to Light Mode!", "success");
        } else {
            localStorage.setItem('theme', 'dark');
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
            showToast("Switched to Dark Mode!", "success");
        }
    });
}
