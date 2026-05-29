// ============================================
// SearXNG Search Engine — UI Rendering Helpers
// ============================================

const UI = {
    // --- DOM Shortcuts ---
    $(sel) { return document.querySelector(sel); },
    $$(sel) { return document.querySelectorAll(sel); },

    // --- Toast Notifications ---
    toast(message, type = 'info', duration = 3000) {
        const container = this.$('#toast-container');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = message;
        container.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(10px)';
            el.style.transition = '0.3s ease';
            setTimeout(() => el.remove(), 300);
        }, duration);
    },

    // --- Modal Management ---
    openModal(id) {
        const modal = this.$(`#${id}`);
        if (modal) modal.classList.remove('hidden');
    },

    closeModal(id) {
        const modal = this.$(`#${id}`);
        if (modal) modal.classList.add('hidden');
    },

    closeAllModals() {
        this.$$('.modal').forEach(m => m.classList.add('hidden'));
    },

    // --- Theme ---
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const settings = Storage.getSettings();
        settings.theme = theme;
        Storage.saveSettings(settings);
    },

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        this.applyTheme(current === 'dark' ? 'light' : 'dark');
    },

    // --- Escape HTML ---
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // --- Truncate text ---
    truncate(str, len = 200) {
        if (!str || str.length <= len) return str;
        return str.substring(0, len).trim() + '…';
    },

    // --- Format date ---
    formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const d = typeof dateStr === 'number' ? new Date(dateStr) : new Date(dateStr);
            if (isNaN(d.getTime())) return '';
            const now = new Date();
            const diff = now - d;
            const mins = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);

            if (mins < 1) return 'Just now';
            if (mins < 60) return `${mins}m ago`;
            if (hours < 24) return `${hours}h ago`;
            if (days < 7) return `${days}d ago`;
            return d.toLocaleDateString();
        } catch {
            return '';
        }
    },

    // --- Format file size ---
    formatSize(bytes) {
        if (!bytes) return '';
        const units = ['B', 'KB', 'MB', 'GB'];
        let i = 0;
        let size = bytes;
        while (size >= 1024 && i < units.length - 1) {
            size /= 1024;
            i++;
        }
        return `${size.toFixed(1)} ${units[i]}`;
    },

    // --- Get domain from URL ---
    getDomain(url) {
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch {
            return url;
        }
    },

    // --- Render Result Cards ---
    renderResults(results, category) {
        const container = this.$('#results-container');
        if (!container) return;

        container.innerHTML = '';

        if (!results || results.length === 0) {
            this.showNoResults();
            return;
        }

        this.hideNoResults();
        this.hideError();

        // Determine render mode based on category
        const catKey = category in CONFIG.resultTypes ? category : 'general';
        const renderType = CONFIG.resultTypes[catKey];

        if (renderType === 'image') {
            this._renderImageGrid(container, results);
        } else {
            results.forEach(result => {
                const card = this._renderCard(result, renderType);
                if (card) container.appendChild(card);
            });
        }
    },

    // --- Render a single card based on type ---
    _renderCard(result, type) {
        switch (type) {
            case 'image': return this._createImageCard(result);
            case 'video': return this._createVideoCard(result);
            case 'news': return this._createNewsCard(result);
            case 'map': return this._createMapCard(result);
            case 'music': return this._createMusicCard(result);
            case 'file': return this._createFileCard(result);
            default: return this._createGeneralCard(result);
        }
    },

    // --- General Result Card ---
    _createGeneralCard(result) {
        const card = document.createElement('div');
        card.className = 'result-card';

        const url = result.url || '#';
        const domain = this.getDomain(url);
        const title = this.escapeHtml(result.title || 'Untitled');
        const snippet = this.escapeHtml(result.content || '');
        const engines = (result.engines || []).slice(0, 3);
        const date = this.formatDate(result.publishedDate);

        card.innerHTML = `
            <div class="result-url">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span>${this.escapeHtml(domain)}</span>
            </div>
            <div class="result-title">
                <a href="${this.escapeHtml(url)}" target="_blank" rel="noopener">${title}</a>
            </div>
            ${snippet ? `<div class="result-snippet">${snippet}</div>` : ''}
            <div class="result-meta">
                ${engines.map(e => `<span class="result-engine">${this.escapeHtml(e)}</span>`).join('')}
                ${date ? `<span class="result-engine">${date}</span>` : ''}
            </div>
        `;

        return card;
    },

    // --- Image Grid ---
    _renderImageGrid(container, results) {
        const grid = document.createElement('div');
        grid.className = 'results-images-grid';

        results.forEach(result => {
            const card = this._createImageCard(result);
            if (card) grid.appendChild(card);
        });

        container.appendChild(grid);
    },

    // --- Image Card ---
    _createImageCard(result) {
        const card = document.createElement('div');
        card.className = 'image-card';

        const url = result.url || '#';
        const thumbnail = result.thumbnail || result.img_src || result.url || '';
        const title = this.escapeHtml(result.title || 'Image');
        const source = this.escapeHtml(this.getDomain(result.source || url));

        card.innerHTML = `
            <a href="${this.escapeHtml(url)}" target="_blank" rel="noopener">
                <img class="image-thumb" src="${this.escapeHtml(thumbnail)}" alt="${title}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22220%22 height=%22165%22><rect fill=%22%23ddd%22 width=%22220%22 height=%22165%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2214%22>No Image</text></svg>'">
            </a>
            <div class="image-info">
                <div class="image-title">${title}</div>
                <div class="image-source">${source}</div>
            </div>
        `;

        return card;
    },

    // --- Video Card ---
    _createVideoCard(result) {
        const card = document.createElement('div');
        card.className = 'video-card';

        const url = result.url || '#';
        const thumbnail = result.thumbnail || '';
        const title = this.escapeHtml(result.title || 'Video');
        const channel = this.escapeHtml(result.author || result.channel || '');
        const desc = this.escapeHtml(result.content || '');
        const duration = result.duration || '';
        const date = this.formatDate(result.publishedDate);

        card.innerHTML = `
            <a href="${this.escapeHtml(url)}" target="_blank" rel="noopener" class="video-thumb">
                ${thumbnail ? `<img src="${this.escapeHtml(thumbnail)}" alt="${title}" loading="lazy" onerror="this.style.display='none'">` : ''}
                ${duration ? `<span class="video-duration">${this.escapeHtml(duration)}</span>` : ''}
            </a>
            <div class="video-info">
                <div class="video-title"><a href="${this.escapeHtml(url)}" target="_blank" rel="noopener">${title}</a></div>
                ${channel ? `<div class="video-channel">${channel}${date ? ` · ${date}` : ''}</div>` : ''}
                ${desc ? `<div class="video-desc">${desc}</div>` : ''}
            </div>
        `;

        return card;
    },

    // --- News Card ---
    _createNewsCard(result) {
        const card = document.createElement('div');
        card.className = 'news-card';

        const url = result.url || '#';
        const source = this.escapeHtml(result.source || this.getDomain(url));
        const title = this.escapeHtml(result.title || 'Untitled');
        const snippet = this.escapeHtml(result.content || '');
        const date = this.formatDate(result.publishedDate);

        card.innerHTML = `
            <div class="news-source">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M18 18h-8M18 10h-8"/></svg>
                ${source}
            </div>
            <div class="news-title"><a href="${this.escapeHtml(url)}" target="_blank" rel="noopener">${title}</a></div>
            ${snippet ? `<div class="news-snippet">${snippet}</div>` : ''}
            ${date ? `<div class="news-time">${date}</div>` : ''}
        `;

        return card;
    },

    // --- Map Card ---
    _createMapCard(result) {
        const card = document.createElement('div');
        card.className = 'map-card';

        const url = result.url || '#';
        const title = this.escapeHtml(result.title || 'Location');
        const address = this.escapeHtml(result.content || result.address || '');
        const lat = result.latitude || result.geo?.lat;
        const lon = result.longitude || result.geo?.lon;

        // Build OpenStreetMap embed URL
        let mapSrc = '';
        if (lat && lon) {
            mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.01},${lat-0.01},${lon+0.01},${lat+0.01}&layer=mapnik&marker=${lat},${lon}`;
        }

        card.innerHTML = `
            ${mapSrc ? `<iframe class="map-embed" src="${mapSrc}" loading="lazy"></iframe>` : ''}
            <div class="map-info">
                <div class="map-title"><a href="${this.escapeHtml(url)}" target="_blank" rel="noopener">${title}</a></div>
                ${address ? `<div class="map-address">${address}</div>` : ''}
            </div>
        `;

        return card;
    },

    // --- Music Card ---
    _createMusicCard(result) {
        const card = document.createElement('div');
        card.className = 'music-card';

        const url = result.url || '#';
        const thumbnail = result.thumbnail || '';
        const title = this.escapeHtml(result.title || 'Track');
        const artist = this.escapeHtml(result.artist || result.author || '');
        const duration = result.length || result.duration || '';

        card.innerHTML = `
            ${thumbnail ? `<img class="music-thumb" src="${this.escapeHtml(thumbnail)}" alt="${title}" loading="lazy">` : `<div class="music-thumb" style="display:flex;align-items:center;justify-content:center;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>`}
            <div class="music-info">
                <div class="music-title"><a href="${this.escapeHtml(url)}" target="_blank" rel="noopener">${title}</a></div>
                ${artist ? `<div class="music-artist">${artist}</div>` : ''}
            </div>
            ${duration ? `<div class="music-duration">${this.escapeHtml(duration)}</div>` : ''}
        `;

        return card;
    },

    // --- File Card ---
    _createFileCard(result) {
        const card = document.createElement('div');
        card.className = 'file-card';

        const url = result.url || '#';
        const title = this.escapeHtml(result.title || 'File');
        const size = result.filesize ? this.formatSize(result.filesize) : '';
        const seeds = result.seed || result.seeds || 0;
        const leech = result.leech || 0;
        const magnet = result.magnetlink || '';
        const domain = this.getDomain(url);

        // Determine file type icon
        const ext = title.split('.').pop().toLowerCase();
        let fileIcon = 'file';
        if (['mp4','avi','mkv','mov'].includes(ext)) fileIcon = 'video';
        else if (['mp3','flac','wav','ogg'].includes(ext)) fileIcon = 'music';
        else if (['pdf'].includes(ext)) fileIcon = 'file-text';
        else if (['zip','rar','7z','tar','gz'].includes(ext)) fileIcon = 'archive';
        else if (['exe','msi','dmg','app'].includes(ext)) fileIcon = 'app';

        const iconSvg = this._getFileIconSvg(fileIcon);

        card.innerHTML = `
            <div class="file-icon">${iconSvg}</div>
            <div class="file-info">
                <div class="file-title"><a href="${this.escapeHtml(url)}" target="_blank" rel="noopener">${title}</a></div>
                <div class="file-meta">
                    ${size ? `<span class="file-size"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ${size}</span>` : ''}
                    ${seeds ? `<span class="file-seeds"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> <span class="seed-count">${seeds}</span></span>` : ''}
                    <span style="color:var(--text-muted)">${this.escapeHtml(domain)}</span>
                </div>
            </div>
            ${magnet ? `<a href="${this.escapeHtml(magnet)}" class="icon-btn" title="Magnet link" style="flex-shrink:0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 15a6 6 0 0 0 12 0v-6"/><circle cx="12" cy="9" r="3"/><path d="M12 12v9"/></svg></a>` : ''}
        `;

        return card;
    },

    // --- File type SVG icons ---
    _getFileIconSvg(type) {
        const icons = {
            file: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/></svg>',
            video: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
            music: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
            'file-text': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>',
            archive: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
            app: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
        };
        return icons[type] || icons.file;
    },

    // --- Render Autocomplete ---
    renderAutocomplete(suggestions) {
        const dropdown = this.$('#autocomplete-dropdown');
        if (!dropdown) return;

        if (!suggestions || suggestions.length === 0) {
            dropdown.classList.add('hidden');
            return;
        }

        dropdown.innerHTML = suggestions.map(s => `
            <div class="autocomplete-item" data-value="${this.escapeHtml(s)}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <span>${this.escapeHtml(s)}</span>
            </div>
        `).join('');

        dropdown.classList.remove('hidden');
    },

    hideAutocomplete() {
        const dropdown = this.$('#autocomplete-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
    },

    // --- Render Pagination ---
    renderPagination(currentPage, totalResults) {
        const pagination = this.$('#pagination');
        const pageInfo = this.$('#page-info');
        const prevBtn = this.$('#prev-page');
        const nextBtn = this.$('#next-page');

        if (!pagination) return;

        if (!totalResults || totalResults === 0) {
            pagination.classList.add('hidden');
            return;
        }

        pagination.classList.remove('hidden');
        prevBtn.disabled = currentPage <= 1;
        pageInfo.textContent = `Page ${currentPage}`;
    },

    // --- Render Results Header ---
    renderResultsHeader(query, resultCount, time) {
        const header = this.$('#results-header');
        if (!header) return;

        const countText = resultCount !== undefined ? `${resultCount} results` : '';
        const timeText = time ? `${(time / 1000).toFixed(2)}s` : '';
        header.innerHTML = `
            <span>${this.escapeHtml(query)}</span>
            <span>${[countText, timeText].filter(Boolean).join(' · ')}</span>
        `;
    },

    // --- Show/Hide States ---
    showLoading() { const el = this.$('#loading'); if (el) el.classList.remove('hidden'); },
    hideLoading() { const el = this.$('#loading'); if (el) el.classList.add('hidden'); },

    showNoResults() { const el = this.$('#no-results'); if (el) el.classList.remove('hidden'); },
    hideNoResults() { const el = this.$('#no-results'); if (el) el.classList.add('hidden'); },

    showError(msg) {
        const el = this.$('#error-state');
        const msgEl = this.$('#error-message');
        if (msgEl) msgEl.textContent = msg || 'An error occurred';
        if (el) el.classList.remove('hidden');
    },
    hideError() { const el = this.$('#error-state'); if (el) el.classList.add('hidden'); },

    showResults() {
        const mainLayout = this.$('#main-layout');
        const resultsSection = this.$('#results-section');
        if (mainLayout) mainLayout.classList.remove('hidden');
        if (resultsSection) resultsSection.classList.remove('hidden');
    },
    hideResults() {
        const mainLayout = this.$('#main-layout');
        const resultsSection = this.$('#results-section');
        if (mainLayout) mainLayout.classList.add('hidden');
        if (resultsSection) resultsSection.classList.add('hidden');
    },

    // --- Search Section Shrink ---
    shrinkSearch() { const el = this.$('#search-section'); if (el) el.classList.add('has-results'); },
    expandSearch() { const el = this.$('#search-section'); if (el) el.classList.remove('has-results'); },

    // --- Render History ---
    renderHistory(filter = '') {
        const list = this.$('#history-list');
        const empty = this.$('#history-empty');
        if (!list) return;

        const history = Storage.getHistory();
        const filtered = filter
            ? history.filter(h => h.query.toLowerCase().includes(filter.toLowerCase()))
            : history;

        if (filtered.length === 0) {
            list.innerHTML = '';
            if (empty) empty.classList.remove('hidden');
            return;
        }

        if (empty) empty.classList.add('hidden');

        list.innerHTML = filtered.map(h => `
            <div class="history-item" data-query="${this.escapeHtml(h.query)}" data-category="${h.category || 'general'}">
                <div>
                    <div class="history-query">${this.escapeHtml(h.query)}</div>
                    <div class="history-time">${this.formatDate(h.timestamp)}</div>
                </div>
                <button class="history-delete" data-query="${this.escapeHtml(h.query)}" title="Remove">&times;</button>
            </div>
        `).join('');
    },

    // --- Render Instance List ---
    renderInstanceList(instances, container) {
        if (!container) return;

        if (!instances || instances.length === 0) {
            container.innerHTML = '<div class="instance-loading">No instances found</div>';
            return;
        }

        container.innerHTML = instances.map(inst => {
            const info = Instances.formatInstanceInfo(inst);
            return `
                <div class="instance-item" data-url="${this.escapeHtml(inst.url)}">
                    <div>
                        <div class="instance-url">${this.escapeHtml(inst.url)}</div>
                        <div class="instance-stats">${info}</div>
                    </div>
                    <div class="instance-version">${this.escapeHtml(inst.version)}</div>
                </div>
            `;
        }).join('');
    },

    // --- Render Custom Instances ---
    renderCustomInstances(container) {
        if (!container) return;

        const customs = Instances.getCustomInstances();

        if (customs.length === 0) {
            container.innerHTML = '<div class="instance-loading">No custom instances added</div>';
            return;
        }

        container.innerHTML = customs.map(url => `
            <div class="instance-item" data-url="${this.escapeHtml(url)}">
                <div class="instance-url">${this.escapeHtml(url)}</div>
                <button class="icon-btn remove-custom-instance" data-url="${this.escapeHtml(url)}" title="Remove">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `).join('');
    },

    // --- Update Instance Display ---
    updateInstanceDisplay() {
        const current = Instances.getCurrentInstance();
        const display = this.$('#instance-display');
        if (display) {
            display.textContent = current.url;
        }
    },

    // --- Update Settings UI ---
    updateSettingsUI() {
        const settings = Storage.getSettings();

        // Language
        const langSelect = this.$('#setting-language');
        if (langSelect) langSelect.value = settings.language || 'auto';

        // Safe search
        const safeSelect = this.$('#setting-safesearch');
        if (safeSelect) safeSelect.value = String(settings.safesearch || 0);

        // Default category
        const catSelect = this.$('#setting-default-category');
        if (catSelect) catSelect.value = settings.defaultCategory || 'general';

        // Theme
        const themeSelect = this.$('#setting-theme');
        if (themeSelect) themeSelect.value = settings.theme || 'dark';

        // Open in new tab
        const newTabToggle = this.$('#setting-newtab');
        if (newTabToggle) newTabToggle.checked = settings.openNewTab !== false;

        // History
        const historyToggle = this.$('#setting-history');
        if (historyToggle) historyToggle.checked = settings.historyEnabled !== false;

        // Autocomplete
        const acToggle = this.$('#setting-autocomplete');
        if (acToggle) acToggle.checked = settings.autocompleteEnabled !== false;
    },

    // ========================================
    // AI Sidebar Methods
    // ========================================

    // --- Toggle AI Sidebar ---
    toggleAISidebar(show) {
        const sidebar = this.$('#ai-sidebar');
        const layout = this.$('#main-layout');
        if (!sidebar || !layout) return;

        if (show === undefined) {
            show = sidebar.classList.contains('hidden');
        }

        if (show) {
            sidebar.classList.remove('hidden');
            layout.classList.add('ai-sidebar-open');
        } else {
            sidebar.classList.add('hidden');
            layout.classList.remove('ai-sidebar-open');
        }

        // Save state
        const aiSettings = Storage.getAISettings();
        aiSettings.sidebarOpen = show;
        Storage.saveAISettings(aiSettings);

        return show;
    },

    // --- Show AI Sidebar ---
    showAISidebar() {
        return this.toggleAISidebar(true);
    },

    // --- Hide AI Sidebar ---
    hideAISidebar() {
        return this.toggleAISidebar(false);
    },

    // --- Update AI Status ---
    updateAIStatus(status, model = '') {
        const statusText = this.$('#ai-status-text');
        const modelBadge = this.$('#ai-model-badge');

        if (!statusText) return;

        statusText.className = 'ai-status-text';

        switch (status) {
            case 'connected':
                statusText.className = 'ai-status-text connected';
                statusText.textContent = 'Connected';
                break;
            case 'generating':
                statusText.className = 'ai-status-text generating';
                statusText.textContent = 'Generating...';
                break;
            case 'error':
                statusText.className = 'ai-status-text error';
                statusText.textContent = 'Error';
                break;
            case 'disconnected':
            default:
                statusText.textContent = 'No AI connected';
                break;
        }

        if (modelBadge) {
            if (model) {
                modelBadge.textContent = model;
                modelBadge.classList.remove('hidden');
            } else {
                modelBadge.classList.add('hidden');
            }
        }
    },

    // --- Update AI Summary Content ---
    updateAISummaryContent(content, isFinal = false) {
        const welcome = this.$('#ai-welcome');
        const output = this.$('#ai-summary-output');
        const loading = this.$('#ai-loading');
        const errorEl = this.$('#ai-error');

        if (welcome) welcome.classList.add('hidden');
        if (errorEl) errorEl.classList.add('hidden');

        if (!content) {
            if (loading) loading.classList.remove('hidden');
            if (output) output.classList.add('hidden');
            return;
        }

        if (loading) loading.classList.add('hidden');
        if (output) {
            output.classList.remove('hidden');
            output.innerHTML = AISummary.renderMarkdown(content);
            if (isFinal) {
                output.classList.add('ai-summary-complete');
            }
            // Auto-scroll to bottom
            output.scrollTop = output.scrollHeight;
        }
    },

    // --- Update AI Chat Content ---
    updateAIChatContent(content, isFinal = false) {
        const messagesEl = this.$('#ai-chat-messages');
        if (!messagesEl) return;

        messagesEl.classList.remove('hidden');

        // Find or create the last assistant message
        let lastMsg = messagesEl.querySelector('.ai-chat-msg.assistant:last-child');
        if (!lastMsg) {
            lastMsg = document.createElement('div');
            lastMsg.className = 'ai-chat-msg assistant';
            messagesEl.appendChild(lastMsg);
        }

        lastMsg.innerHTML = AISummary.renderMarkdown(content);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    },

    // --- Add Chat Message to UI ---
    addChatMessage(role, content) {
        const messagesEl = this.$('#ai-chat-messages');
        if (!messagesEl) return;

        messagesEl.classList.remove('hidden');

        const msg = document.createElement('div');
        msg.className = `ai-chat-msg ${role}`;
        msg.textContent = content;
        messagesEl.appendChild(msg);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    },

    // --- Show AI Error ---
    showAIError(message) {
        const errorEl = this.$('#ai-error');
        const loading = this.$('#ai-loading');
        const welcome = this.$('#ai-welcome');

        if (loading) loading.classList.add('hidden');
        if (welcome) welcome.classList.add('hidden');

        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    },

    // --- Show AI Loading ---
    showAILoading(text = 'Generating summary...') {
        const loading = this.$('#ai-loading');
        const loadingText = this.$('#ai-loading-text');
        const welcome = this.$('#ai-welcome');
        const output = this.$('#ai-summary-output');
        const errorEl = this.$('#ai-error');

        if (welcome) welcome.classList.add('hidden');
        if (output) output.classList.add('hidden');
        if (errorEl) errorEl.classList.add('hidden');
        if (loading) loading.classList.remove('hidden');
        if (loadingText) loadingText.textContent = text;
    },

    // --- Hide AI Loading ---
    hideAILoading() {
        const loading = this.$('#ai-loading');
        if (loading) loading.classList.add('hidden');
    },

    // --- Reset AI Sidebar ---
    resetAISidebar() {
        const welcome = this.$('#ai-welcome');
        const output = this.$('#ai-summary-output');
        const errorEl = this.$('#ai-error');
        const loading = this.$('#ai-loading');
        const messagesEl = this.$('#ai-chat-messages');

        if (welcome) welcome.classList.remove('hidden');
        if (output) { output.classList.add('hidden'); output.innerHTML = ''; }
        if (errorEl) errorEl.classList.add('hidden');
        if (loading) loading.classList.add('hidden');
        if (messagesEl) { messagesEl.innerHTML = ''; messagesEl.classList.add('hidden'); }

        this.updateAIStatus('disconnected');
    },

    // --- Update AI Settings UI ---
    updateAISettingsUI() {
        const settings = Storage.getAISettings();

        const providerSelect = this.$('#ai-provider-select');
        const modelSelect = this.$('#ai-model-select');
        const ollamaUrl = this.$('#ai-ollama-url');
        const lmstudioUrl = this.$('#ai-lmstudio-url');
        const autoSummarize = this.$('#ai-auto-summarize');
        const temperature = this.$('#ai-temperature');
        const tempValue = this.$('#ai-temp-value');

        if (providerSelect) providerSelect.value = settings.provider || 'auto';
        if (modelSelect) modelSelect.value = settings.model || '';
        if (ollamaUrl) ollamaUrl.value = settings.ollamaUrl || CONFIG.ai.ollamaUrl;
        if (lmstudioUrl) lmstudioUrl.value = settings.lmstudioUrl || CONFIG.ai.lmstudioUrl;
        if (autoSummarize) autoSummarize.checked = settings.autoSummarize || false;
        if (temperature) temperature.value = settings.temperature ?? 0.7;
        if (tempValue) tempValue.textContent = settings.temperature ?? 0.7;
    },

    // --- Populate AI Model Dropdown ---
    setAIModels(models, selectedModel = '') {
        const modelSelect = this.$('#ai-model-select');
        if (!modelSelect) return;

        modelSelect.innerHTML = '';

        if (models.length === 0) {
            modelSelect.innerHTML = '<option value="">No models found</option>';
            return;
        }

        models.forEach(m => {
            const option = document.createElement('option');
            option.value = m.id;
            option.textContent = m.name || m.id;
            if (m.id === selectedModel) option.selected = true;
            modelSelect.appendChild(option);
        });
    },
};