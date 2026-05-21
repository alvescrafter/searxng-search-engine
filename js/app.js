// ============================================
// SearXNG Search Engine — Main Application
// ============================================

const App = {
    // State
    currentQuery: '',
    currentCategory: 'general',
    currentPage: 1,
    searchStartTime: 0,
    autocompleteTimer: null,
    autocompleteIndex: -1,

    // --- Initialize ---
    init() {
        this.loadSettings();
        this.bindEvents();
        this.updateUI();
        this.checkUrlParams();
    },

    // --- Load Settings ---
    loadSettings() {
        const settings = Storage.getSettings();

        // Apply theme
        UI.applyTheme(settings.theme || 'dark');

        // Set instance
        const instance = settings.instance || CONFIG.defaultInstance;
        const mode = settings.instanceMode || 'local';
        SearXAPI.setInstance(instance, mode === 'local');

        // Set default category
        this.currentCategory = settings.defaultCategory || 'general';
    },

    // --- Bind All Events ---
    bindEvents() {
        // Search input
        const searchInput = UI.$('#search-input');
        const clearBtn = UI.$('#clear-btn');

        searchInput.addEventListener('input', () => {
            clearBtn.classList.toggle('visible', searchInput.value.length > 0);
            this.handleAutocomplete(searchInput.value);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.search();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateAutocomplete(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateAutocomplete(-1);
            } else if (e.key === 'Escape') {
                UI.hideAutocomplete();
            }
        });

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.classList.remove('visible');
            searchInput.focus();
            UI.hideAutocomplete();
        });

        // Search button
        UI.$('#search-btn').addEventListener('click', () => this.search());

        // Category tabs
        UI.$$('.cat-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const cat = tab.dataset.category;
                this.switchCategory(cat);
            });
        });

        // Search filters
        UI.$('#filter-language').addEventListener('change', (e) => {
            const settings = Storage.getSettings();
            settings.language = e.target.value;
            Storage.saveSettings(settings);
        });

        UI.$('#filter-time').addEventListener('change', (e) => {
            // Time range is per-search, no persistence needed
        });

        UI.$('#filter-safesearch').addEventListener('change', (e) => {
            const settings = Storage.getSettings();
            settings.safesearch = parseInt(e.target.value);
            Storage.saveSettings(settings);
        });

        // Pagination
        UI.$('#prev-page').addEventListener('click', () => this.prevPage());
        UI.$('#next-page').addEventListener('click', () => this.nextPage());

        // Header buttons
        UI.$('#theme-btn').addEventListener('click', () => UI.toggleTheme());
        UI.$('#history-btn').addEventListener('click', () => this.openHistory());
        UI.$('#instance-btn').addEventListener('click', () => this.openInstanceModal());
        UI.$('#settings-btn').addEventListener('click', () => this.openSettings());

        // Modal backdrops — click to close
        UI.$$('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', () => UI.closeAllModals());
        });

        // Modal close buttons
        UI.$$('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => UI.closeAllModals());
        });

        // Autocomplete clicks
        UI.$('#autocomplete-dropdown').addEventListener('click', (e) => {
            const item = e.target.closest('.autocomplete-item');
            if (item) {
                const value = item.dataset.value;
                UI.$('#search-input').value = value;
                UI.hideAutocomplete();
                this.search();
            }
        });

        // Click outside autocomplete to close
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                UI.hideAutocomplete();
            }
        });

        // Instance modal events
        this.bindInstanceEvents();

        // Settings modal events
        this.bindSettingsEvents();

        // History modal events
        this.bindHistoryEvents();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // / to focus search
            if (e.key === '/' && !e.target.closest('input, textarea, select')) {
                e.preventDefault();
                searchInput.focus();
            }
            // Escape to close modals
            if (e.key === 'Escape') {
                UI.closeAllModals();
            }
        });

        // Logo click — reset to home
        UI.$('.logo').addEventListener('click', () => this.goHome());

        // Retry button
        const retryBtn = UI.$('#retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                if (this.currentQuery) this.executeSearch();
            });
        }
    },

    // --- Instance Modal Events ---
    bindInstanceEvents() {
        // Mode toggle buttons
        UI.$$('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                UI.$$('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Show/hide panels
                UI.$$('.instance-panel').forEach(p => p.classList.add('hidden'));
                const panel = UI.$(`#panel-${mode}`);
                if (panel) panel.classList.remove('hidden');
            });
        });

        // Local Docker connect
        UI.$('#local-connect').addEventListener('click', () => {
            const url = UI.$('#local-url').value.trim() || CONFIG.defaultInstance;
            this.connectInstance(url, 'local');
        });

        // Public instances — fetch on panel show
        UI.$('#refresh-public').addEventListener('click', () => {
            this.loadPublicInstances(true);
        });

        // Public instance search
        UI.$('#public-search').addEventListener('input', (e) => {
            const filtered = Instances.filterInstances(e.target.value);
            UI.renderInstanceList(filtered, UI.$('#public-list'));
        });

        // Public list clicks
        UI.$('#public-list').addEventListener('click', (e) => {
            const item = e.target.closest('.instance-item');
            if (item) {
                const url = item.dataset.url;
                this.connectInstance(url, 'public');
            }
        });

        // Custom instance add
        UI.$('#custom-add').addEventListener('click', () => {
            const url = UI.$('#custom-url-input').value.trim();
            if (!url) {
                UI.toast('Please enter a URL', 'warning');
                return;
            }
            if (!url.startsWith('http')) {
                UI.toast('URL must start with http:// or https://', 'warning');
                return;
            }
            Instances.addCustomInstance(url);
            UI.$('#custom-url-input').value = '';
            UI.renderCustomInstances(UI.$('#custom-list'));
            UI.toast('Instance added', 'success');
        });

        // Custom list clicks
        UI.$('#custom-list').addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-custom-instance');
            if (removeBtn) {
                e.stopPropagation();
                Instances.removeCustomInstance(removeBtn.dataset.url);
                UI.renderCustomInstances(UI.$('#custom-list'));
                UI.toast('Instance removed', 'info');
                return;
            }
            const item = e.target.closest('.instance-item');
            if (item) {
                this.connectInstance(item.dataset.url, 'custom');
            }
        });
    },

    // --- Settings Modal Events ---
    bindSettingsEvents() {
        UI.$('#setting-language').addEventListener('change', (e) => {
            const settings = Storage.getSettings();
            settings.language = e.target.value;
            Storage.saveSettings(settings);
        });

        UI.$('#setting-safesearch').addEventListener('change', (e) => {
            const settings = Storage.getSettings();
            settings.safesearch = parseInt(e.target.value);
            Storage.saveSettings(settings);
        });

        UI.$('#setting-default-category').addEventListener('change', (e) => {
            const settings = Storage.getSettings();
            settings.defaultCategory = e.target.value;
            Storage.saveSettings(settings);
            this.currentCategory = e.target.value;
            this.updateUI();
        });

        UI.$('#setting-newtab').addEventListener('change', (e) => {
            const settings = Storage.getSettings();
            settings.openNewTab = e.target.checked;
            Storage.saveSettings(settings);
        });

        UI.$('#setting-history').addEventListener('change', (e) => {
            const settings = Storage.getSettings();
            settings.historyEnabled = e.target.checked;
            Storage.saveSettings(settings);
        });

        UI.$('#setting-autocomplete').addEventListener('change', (e) => {
            const settings = Storage.getSettings();
            settings.autocompleteEnabled = e.target.checked;
            Storage.saveSettings(settings);
        });

        UI.$('#setting-theme').addEventListener('change', (e) => {
            const theme = e.target.value;
            if (theme === 'auto') {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                this.applyTheme(prefersDark ? 'dark' : 'light');
            } else {
                UI.applyTheme(theme);
            }
        });

        UI.$('#clear-history-btn').addEventListener('click', () => {
            if (confirm('Clear all search history?')) {
                Storage.clearHistory();
                UI.toast('History cleared', 'success');
            }
        });

        UI.$('#clear-cache-btn').addEventListener('click', () => {
            Storage.clearCache();
            UI.toast('Cache cleared', 'success');
        });

        UI.$('#clear-all-btn').addEventListener('click', () => {
            if (confirm('Clear ALL data including settings, history, and cache?')) {
                Storage.clearAll();
                UI.toast('All data cleared', 'success');
                this.loadSettings();
                this.updateUI();
            }
        });
    },

    // --- History Modal Events ---
    bindHistoryEvents() {
        UI.$('#history-search').addEventListener('input', (e) => {
            UI.renderHistory(e.target.value);
        });

        UI.$('#history-list').addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.history-delete');
            if (deleteBtn) {
                e.stopPropagation();
                Storage.removeFromHistory(deleteBtn.dataset.query);
                UI.renderHistory(UI.$('#history-search').value);
                return;
            }

            const item = e.target.closest('.history-item');
            if (item) {
                const query = item.dataset.query;
                const category = item.dataset.category || 'general';
                UI.$('#search-input').value = query;
                this.switchCategory(category);
                UI.closeAllModals();
                this.search();
            }
        });

        UI.$('#clear-all-history').addEventListener('click', () => {
            if (confirm('Clear all search history?')) {
                Storage.clearHistory();
                UI.renderHistory();
                UI.toast('History cleared', 'success');
            }
        });
    },

    // --- Update UI State ---
    updateUI() {
        // Set active category tab
        UI.$$('.cat-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === this.currentCategory);
        });

        // Update instance display
        UI.updateInstanceDisplay();

        // Update settings UI
        UI.updateSettingsUI();

        // Update filter selects from settings
        const settings = Storage.getSettings();
        const langFilter = UI.$('#filter-language');
        const safeFilter = UI.$('#filter-safesearch');
        if (langFilter) langFilter.value = settings.language || 'auto';
        if (safeFilter) safeFilter.value = String(settings.safesearch || 0);
    },

    // --- Switch Category ---
    switchCategory(category) {
        if (!CONFIG.categories[category]) return;
        this.currentCategory = category;
        this.currentPage = 1;

        // Save as default
        const settings = Storage.getSettings();
        settings.defaultCategory = category;
        Storage.saveSettings(settings);

        this.updateUI();

        // If there's a current query, re-search in new category
        if (this.currentQuery) {
            this.search();
        }
    },

    // --- Perform Search ---
    async search() {
        const input = UI.$('#search-input');
        const query = input.value.trim();

        if (!query) {
            input.focus();
            return;
        }

        UI.hideAutocomplete();
        this.currentQuery = query;
        this.currentPage = 1;

        // Add to history
        const settings = Storage.getSettings();
        if (settings.historyEnabled !== false) {
            Storage.addToHistory(query, this.currentCategory);
        }

        await this.executeSearch();
    },

    // --- Execute Search (with current state) ---
    async executeSearch() {
        const query = this.currentQuery;
        if (!query) return;

        const settings = Storage.getSettings();
        const category = CONFIG.categories[this.currentCategory]?.searxng || 'general';
        const language = UI.$('#filter-language')?.value || settings.language || 'auto';
        const timeRange = UI.$('#filter-time')?.value || '';
        const safesearch = parseInt(UI.$('#filter-safesearch')?.value) || settings.safesearch || 0;

        // Show loading
        UI.showLoading();
        UI.hideResults();
        UI.hideNoResults();
        UI.hideError();
        UI.shrinkSearch();

        this.searchStartTime = performance.now();

        try {
            const data = await SearXAPI.search(query, {
                categories: category,
                language: language,
                page: this.currentPage,
                time_range: timeRange || undefined,
                safesearch: safesearch,
            });

            UI.hideLoading();

            if (!data) {
                // Request was cancelled
                return;
            }

            const elapsed = performance.now() - this.searchStartTime;

            // Render results
            UI.renderResults(data.results || [], this.currentCategory);
            UI.renderResultsHeader(query, data.number_of_results || (data.results || []).length, elapsed);
            UI.renderPagination(this.currentPage, data.number_of_results || (data.results || []).length);
            UI.showResults();

            // Handle suggestions
            if (data.suggestions && data.suggestions.length > 0) {
                // Could show "Did you mean?" — for now just log
            }

            // Handle infoboxes
            if (data.infoboxes && data.infoboxes.length > 0) {
                this.renderInfoboxes(data.infoboxes);
            }

            if (!data.results || data.results.length === 0) {
                UI.showNoResults();
            }

            // Scroll to results
            UI.$('#results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (err) {
            UI.hideLoading();
            UI.showError(`Search failed: ${err.message}`);
            UI.showResults();
            console.error('Search error:', err);
        }
    },

    // --- Render Infoboxes ---
    renderInfoboxes(infoboxes) {
        const container = UI.$('#results-container');
        if (!container || !infoboxes.length) return;

        infoboxes.forEach(box => {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.style.borderLeft = '3px solid var(--accent)';

            const title = UI.escapeHtml(box.title || '');
            const content = UI.escapeHtml(box.content || '');
            const url = box.urls?.[0]?.url || '';

            card.innerHTML = `
                ${title ? `<div class="result-title" style="font-size:1.15rem;margin-bottom:8px;">${title}</div>` : ''}
                ${content ? `<div class="result-snippet" style="-webkit-line-clamp:unset;">${content}</div>` : ''}
                ${url ? `<div class="result-meta" style="margin-top:8px;"><a href="${UI.escapeHtml(url)}" target="_blank" rel="noopener" style="font-size:0.85rem;">Source</a></div>` : ''}
            `;

            container.insertBefore(card, container.firstChild);
        });
    },

    // --- Pagination ---
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.executeSearch();
        }
    },

    nextPage() {
        this.currentPage++;
        this.executeSearch();
    },

    // --- Autocomplete ---
    handleAutocomplete(query) {
        const settings = Storage.getSettings();
        if (settings.autocompleteEnabled === false) return;
        if (!query || query.length < 2) {
            UI.hideAutocomplete();
            return;
        }

        clearTimeout(this.autocompleteTimer);
        this.autocompleteIndex = -1;

        this.autocompleteTimer = setTimeout(async () => {
            try {
                const suggestions = await SearXAPI.autocomplete(query);
                UI.renderAutocomplete(suggestions);
            } catch {
                UI.hideAutocomplete();
            }
        }, CONFIG.autocompleteDebounce);
    },

    navigateAutocomplete(direction) {
        const items = UI.$$('.autocomplete-item');
        if (items.length === 0) return;

        this.autocompleteIndex += direction;
        if (this.autocompleteIndex < 0) this.autocompleteIndex = items.length - 1;
        if (this.autocompleteIndex >= items.length) this.autocompleteIndex = 0;

        items.forEach((item, i) => {
            item.classList.toggle('active', i === this.autocompleteIndex);
        });

        if (items[this.autocompleteIndex]) {
            UI.$('#search-input').value = items[this.autocompleteIndex].dataset.value;
        }
    },

    // --- Open Instance Modal ---
    async openInstanceModal() {
        UI.openModal('instance-modal');
        UI.updateInstanceDisplay();

        // Set active mode
        const current = Instances.getCurrentInstance();
        UI.$$('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === current.mode);
        });
        UI.$$('.instance-panel').forEach(p => p.classList.add('hidden'));
        const activePanel = UI.$(`#panel-${current.mode}`);
        if (activePanel) activePanel.classList.remove('hidden');

        // Set local URL
        UI.$('#local-url').value = current.mode === 'local' ? current.url : CONFIG.defaultInstance;

        // Load public instances
        this.loadPublicInstances();
        UI.renderCustomInstances(UI.$('#custom-list'));
    },

    // --- Load Public Instances ---
    async loadPublicInstances(forceRefresh = false) {
        const list = UI.$('#public-list');
        if (!list) return;

        list.innerHTML = '<div class="instance-loading">Loading instances…</div>';

        const instances = await Instances.fetchPublicInstances(forceRefresh);
        UI.renderInstanceList(instances, list);
    },

    // --- Connect to Instance ---
    async connectInstance(url, mode) {
        url = url.replace(/\/+$/, '');

        // Test connection first
        UI.toast('Testing connection…', 'info');

        // For local Docker, test via proxy
        if (mode === 'local') {
            try {
                const savedProxy = SearXAPI.useProxy;
                SearXAPI.useProxy = true;
                const result = await SearXAPI.testConnection(url);
                SearXAPI.useProxy = savedProxy;

                if (!result.ok) {
                    UI.toast(`Connection failed: ${result.error}`, 'error');
                    return;
                }
            } catch (err) {
                UI.toast(`Connection test failed: ${err.message}`, 'error');
                return;
            }
        }

        await Instances.connect(url, mode);
        UI.updateInstanceDisplay();
        UI.closeAllModals();
        UI.toast(`Connected to ${mode} instance`, 'success');
    },

    // --- Open Settings ---
    openSettings() {
        UI.updateSettingsUI();
        UI.openModal('settings-modal');
    },

    // --- Open History ---
    openHistory() {
        UI.renderHistory();
        UI.$('#history-search').value = '';
        UI.openModal('history-modal');
    },

    // --- Go Home ---
    goHome() {
        this.currentQuery = '';
        this.currentPage = 1;
        UI.$('#search-input').value = '';
        UI.$('#clear-btn').classList.remove('visible');
        UI.hideResults();
        UI.hideNoResults();
        UI.hideError();
        UI.hideLoading();
        UI.expandSearch();
        UI.$('#pagination')?.classList.add('hidden');
    },

    // --- Check URL Params ---
    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const q = params.get('q');
        const cat = params.get('categories') || params.get('category');

        if (q) {
            UI.$('#search-input').value = q;
            if (cat) {
                // Find matching category
                for (const [key, val] of Object.entries(CONFIG.categories)) {
                    if (val.searxng === cat || key === cat) {
                        this.currentCategory = key;
                        break;
                    }
                }
            }
            this.updateUI();
            this.search();
        }
    },
};

// --- Start App ---
document.addEventListener('DOMContentLoaded', () => App.init());