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
    lastSearchResults: null, // Store results for AI summary

    // --- Initialize ---
    async init() {
        await this.detectProxy();
        this.loadSettings();
        this.bindEvents();
        this.updateUI();
        this.initAISidebar();
        this.checkUrlParams();

        // Test current instance and fall back if needed
        await this.testAndFallbackInstance();
    },

    // --- Detect proxy availability ---
    // Checks if nginx proxy is available (Docker deployment)
    // Falls back to direct SearXNG calls (Live Server / development)
    async detectProxy() {
        await Promise.all([
            SearXAPI.detectProxy(),
            AIAPI.detectProxy(),
        ]);
    },

    // --- Test current instance and fall back to alternatives ---
    async testAndFallbackInstance() {
        // Skip if behind nginx proxy (always works)
        if (SearXAPI.useProxy) return;

        const current = SearXAPI.baseUrl;

        // Quick test — don't block the UI for too long
        try {
            const result = await SearXAPI.testConnection(current);
            if (result.ok) return; // Current instance works
        } catch {
            // Connection failed, try fallbacks
        }

        console.warn(`[App] Instance ${current} not reachable, trying fallbacks…`);

        // Try fallback instances
        for (const fallback of CONFIG.fallbackInstances) {
            if (fallback === current) continue; // Skip current (already tested)

            try {
                const test = await SearXAPI.testConnection(fallback);
                if (test.ok) {
                    console.log(`[App] Switched to fallback instance: ${fallback}`);
                    SearXAPI.setInstance(fallback, false);

                    // Update saved settings
                    const settings = Storage.getSettings();
                    settings.instance = fallback;
                    settings.instanceMode = 'public';
                    Storage.saveSettings(settings);

                    UI.updateInstanceDisplay();
                    UI.toast(`Switched to ${fallback} (local instance was unreachable)`, 'info', 5000);
                    return;
                }
            } catch {
                continue;
            }
        }

        console.warn('[App] No reachable instance found');
    },

    // --- Load Settings ---
    loadSettings() {
        const settings = Storage.getSettings();

        // Apply theme
        UI.applyTheme(settings.theme || 'dark');

        // Set instance (don't override useProxy — auto-detection handles it)
        const instance = settings.instance || CONFIG.defaultInstance;
        SearXAPI.setInstance(instance, null);

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

        // AI Settings events
        this.bindAISettingsEvents();

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
            // Ctrl+I to toggle AI sidebar
            if (e.key === 'i' && e.ctrlKey && !e.target.closest('input, textarea, select')) {
                e.preventDefault();
                this.toggleAISidebar();
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

        // Switch Instance button (shown on connection errors)
        const switchInstanceBtn = UI.$('#switch-instance-btn');
        if (switchInstanceBtn) {
            switchInstanceBtn.addEventListener('click', () => {
                UI.openModal('instance-modal');
            });
        }

        // AI Sidebar toggle button
        const aiSidebarBtn = UI.$('#ai-sidebar-btn');
        if (aiSidebarBtn) {
            aiSidebarBtn.addEventListener('click', () => this.toggleAISidebar());
        }

        // AI Sidebar close button
        const aiCloseBtn = UI.$('#ai-close-btn');
        if (aiCloseBtn) {
            aiCloseBtn.addEventListener('click', () => UI.hideAISidebar());
        }

        // AI Settings button
        const aiSettingsBtn = UI.$('#ai-settings-btn');
        if (aiSettingsBtn) {
            aiSettingsBtn.addEventListener('click', () => this.openAISettings());
        }

        // AI Summarize button
        const aiSummarizeBtn = UI.$('#ai-summarize-btn');
        if (aiSummarizeBtn) {
            aiSummarizeBtn.addEventListener('click', () => this.generateAISummary());
        }

        // AI Chat input
        const aiChatInput = UI.$('#ai-chat-input');
        const aiChatSend = UI.$('#ai-chat-send');
        if (aiChatInput) {
            aiChatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendAIChat();
                }
            });
        }
        if (aiChatSend) {
            aiChatSend.addEventListener('click', () => this.sendAIChat());
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

            // Store results for AI summary
            this.lastSearchResults = data.results || [];

            // Auto-summarize if enabled and sidebar is open
            const aiSettings = Storage.getAISettings();
            if (aiSettings.autoSummarize && !UI.$('#ai-sidebar')?.classList.contains('hidden')) {
                this.generateAISummary();
            }

        } catch (err) {
            UI.hideLoading();
            // Show helpful error message with guidance
            let errorMsg = err.message || 'Unknown error';
            let helpHint = '';
            if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('Network request failed') || errorMsg.includes('ERR_CONNECTION_REFUSED')) {
                helpHint = ' — The search instance may be down. Try switching to a different instance (⚙ → Select Instance).';
            } else if (errorMsg.includes('CORS') || errorMsg.includes('cross-origin')) {
                helpHint = ' — This instance blocks cross-origin requests. Try a different public instance.';
            }
            UI.showError(`Search failed: ${errorMsg}${helpHint}`);
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

        try {
            // For local mode, use auto-detected proxy; for public/custom, use direct
            const useProxy = mode === 'local' ? null : false;
            SearXAPI.setInstance(url, useProxy);

            const result = await SearXAPI.testConnection(url);

            if (!result.ok) {
                UI.toast(`Connection failed: ${result.error}`, 'error');
                return;
            }
        } catch (err) {
            UI.toast(`Connection test failed: ${err.message}`, 'error');
            return;
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
        this.lastSearchResults = null;
        UI.$('#search-input').value = '';
        UI.$('#clear-btn').classList.remove('visible');
        UI.hideResults();
        UI.hideNoResults();
        UI.hideError();
        UI.hideLoading();
        UI.expandSearch();
        UI.$('#pagination')?.classList.add('hidden');
        AISummary.reset();
        UI.resetAISidebar();
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

    // ========================================
    // AI Sidebar Methods
    // ========================================

    // --- Initialize AI Sidebar ---
    initAISidebar() {
        const aiSettings = Storage.getAISettings();

        // Restore sidebar state
        if (aiSettings.sidebarOpen) {
            UI.showAISidebar();
        }

        // Try auto-detecting AI providers
        this.detectAIProviders();
    },

    // --- Toggle AI Sidebar ---
    toggleAISidebar() {
        const show = UI.toggleAISidebar();
        if (show) {
            this.detectAIProviders();
        }
    },

    // --- Detect AI Providers ---
    async detectAIProviders() {
        UI.updateAIStatus('disconnected');

        try {
            const detection = await AIAPI.autoDetect();

            if (detection.available) {
                const provider = detection.providers[0];
                const model = provider.models[0]?.id || '';
                UI.updateAIStatus('connected', model);

                // Auto-save detected provider
                const aiSettings = Storage.getAISettings();
                if (aiSettings.provider === 'auto') {
                    aiSettings._detectedProvider = provider.provider;
                    aiSettings._detectedModel = model;
                }
                Storage.saveAISettings(aiSettings);
            }
        } catch {
            // Detection failed silently — user can configure manually
        }
    },

    // --- Generate AI Summary ---
    async generateAISummary() {
        if (!this.currentQuery || !this.lastSearchResults?.length) {
            UI.showAIError('Search for something first to generate a summary.');
            return;
        }

        if (AISummary.isGenerating) {
            AISummary.cancelGeneration();
            return;
        }

        const summarizeBtn = UI.$('#ai-summarize-btn');
        if (summarizeBtn) {
            summarizeBtn.classList.add('generating');
            summarizeBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor"/></svg>
                Cancel
            `;
        }

        UI.showAILoading('Generating summary...');
        UI.updateAIStatus('generating');

        try {
            await AISummary.generateSummary(this.currentQuery, this.lastSearchResults);
        } catch (err) {
            UI.showAIError(err.message);
            UI.updateAIStatus('error');
        } finally {
            if (summarizeBtn) {
                summarizeBtn.classList.remove('generating');
                summarizeBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="16" height="16"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    Summarize Results
                `;
            }
        }
    },

    // --- Send AI Chat Message ---
    async sendAIChat() {
        const input = UI.$('#ai-chat-input');
        if (!input) return;

        const message = input.value.trim();
        if (!message) return;

        if (AISummary.isGenerating) return;

        // Add user message to chat UI
        UI.addChatMessage('user', message);
        input.value = '';

        // Disable send button while generating
        const sendBtn = UI.$('#ai-chat-send');
        if (sendBtn) sendBtn.disabled = true;

        UI.updateAIStatus('generating');

        try {
            await AISummary.sendChat(message);
        } catch (err) {
            UI.showAIError(err.message);
            UI.updateAIStatus('error');
        } finally {
            if (sendBtn) sendBtn.disabled = false;
            UI.updateAIStatus('connected', Storage.getAISettings()._detectedModel || Storage.getAISettings().model);
        }
    },

    // --- Open AI Settings Modal ---
    openAISettings() {
        UI.updateAISettingsUI();
        UI.openModal('ai-settings-modal');
    },

    // --- Bind AI Settings Events ---
    bindAISettingsEvents() {
        // Provider select
        const providerSelect = UI.$('#ai-provider-select');
        if (providerSelect) {
            providerSelect.addEventListener('change', (e) => {
                const settings = Storage.getAISettings();
                settings.provider = e.target.value;
                Storage.saveAISettings(settings);
            });
        }

        // Model select
        const modelSelect = UI.$('#ai-model-select');
        if (modelSelect) {
            modelSelect.addEventListener('change', (e) => {
                const settings = Storage.getAISettings();
                settings.model = e.target.value;
                Storage.saveAISettings(settings);
                UI.updateAIStatus('connected', e.target.value);
            });
        }

        // Detect models button
        const detectBtn = UI.$('#ai-detect-btn');
        if (detectBtn) {
            detectBtn.addEventListener('click', async () => {
                const statusEl = UI.$('#ai-detection-status');
                if (statusEl) {
                    statusEl.className = 'ai-detection-status detecting';
                    statusEl.textContent = 'Detecting AI models...';
                    statusEl.classList.remove('hidden');
                }

                try {
                    const detection = await AIAPI.autoDetect();

                    if (detection.available) {
                        const allModels = detection.providers.flatMap(p =>
                            p.models.map(m => ({ ...m, provider: p.provider }))
                        );

                        UI.setAIModels(allModels, '');

                        if (statusEl) {
                            statusEl.className = 'ai-detection-status success';
                            const providerNames = detection.providers.map(p => p.provider).join(', ');
                            statusEl.textContent = `Found ${allModels.length} model(s) on ${providerNames}`;
                        }

                        // Auto-select first model
                        if (allModels.length > 0) {
                            const settings = Storage.getAISettings();
                            settings.model = allModels[0].id;
                            settings._detectedProvider = detection.providers[0].provider;
                            settings._detectedModel = allModels[0].id;
                            Storage.saveAISettings(settings);

                            if (modelSelect) modelSelect.value = allModels[0].id;
                            UI.updateAIStatus('connected', allModels[0].id);
                        }
                    } else {
                        UI.setAIModels([]);
                        if (statusEl) {
                            statusEl.className = 'ai-detection-status error';
                            statusEl.textContent = 'No AI providers found. Make sure Ollama or LM Studio is running.';
                        }
                    }
                } catch (err) {
                    if (statusEl) {
                        statusEl.className = 'ai-detection-status error';
                        statusEl.textContent = `Detection failed: ${err.message}`;
                    }
                }
            });
        }

        // Test Ollama connection
        const testOllamaBtn = UI.$('#ai-test-ollama');
        if (testOllamaBtn) {
            testOllamaBtn.addEventListener('click', async () => {
                const statusEl = UI.$('#ai-ollama-status');
                const urlInput = UI.$('#ai-ollama-url');
                const url = urlInput?.value.trim() || CONFIG.ai.ollamaUrl;

                if (statusEl) { statusEl.textContent = 'Testing...'; statusEl.className = 'ai-conn-status'; }

                const result = await AIAPI.testConnection('ollama', url);
                if (result.ok) {
                    if (statusEl) { statusEl.textContent = `✓ Connected (${result.models.length} models)`; statusEl.className = 'ai-conn-status success'; }
                } else {
                    if (statusEl) { statusEl.textContent = `✗ ${result.error}`; statusEl.className = 'ai-conn-status error'; }
                }
            });
        }

        // Test LM Studio connection
        const testLMStudioBtn = UI.$('#ai-test-lmstudio');
        if (testLMStudioBtn) {
            testLMStudioBtn.addEventListener('click', async () => {
                const statusEl = UI.$('#ai-lmstudio-status');
                const urlInput = UI.$('#ai-lmstudio-url');
                const url = urlInput?.value.trim() || CONFIG.ai.lmstudioUrl;

                if (statusEl) { statusEl.textContent = 'Testing...'; statusEl.className = 'ai-conn-status'; }

                const result = await AIAPI.testConnection('lmstudio', url);
                if (result.ok) {
                    if (statusEl) { statusEl.textContent = `✓ Connected (${result.models.length} models)`; statusEl.className = 'ai-conn-status success'; }
                } else {
                    if (statusEl) { statusEl.textContent = `✗ ${result.error}`; statusEl.className = 'ai-conn-status error'; }
                }
            });
        }

        // Ollama URL change
        const ollamaUrlInput = UI.$('#ai-ollama-url');
        if (ollamaUrlInput) {
            ollamaUrlInput.addEventListener('change', (e) => {
                const settings = Storage.getAISettings();
                settings.ollamaUrl = e.target.value.trim();
                Storage.saveAISettings(settings);
            });
        }

        // LM Studio URL change
        const lmstudioUrlInput = UI.$('#ai-lmstudio-url');
        if (lmstudioUrlInput) {
            lmstudioUrlInput.addEventListener('change', (e) => {
                const settings = Storage.getAISettings();
                settings.lmstudioUrl = e.target.value.trim();
                Storage.saveAISettings(settings);
            });
        }

        // Auto-summarize toggle
        const autoSumToggle = UI.$('#ai-auto-summarize');
        if (autoSumToggle) {
            autoSumToggle.addEventListener('change', (e) => {
                const settings = Storage.getAISettings();
                settings.autoSummarize = e.target.checked;
                Storage.saveAISettings(settings);
            });
        }

        // Temperature slider
        const tempSlider = UI.$('#ai-temperature');
        const tempValue = UI.$('#ai-temp-value');
        if (tempSlider) {
            tempSlider.addEventListener('input', (e) => {
                if (tempValue) tempValue.textContent = e.target.value;
                const settings = Storage.getAISettings();
                settings.temperature = parseFloat(e.target.value);
                Storage.saveAISettings(settings);
            });
        }
    },
};

// --- Start App ---
document.addEventListener('DOMContentLoaded', () => { App.init(); });