// ============================================
// SearXNG Search Engine — Storage (localStorage)
// ============================================

const Storage = {
    PREFIX: 'searxng_',

    // --- Core get/set ---
    get(key, fallback = null) {
        try {
            const raw = localStorage.getItem(this.PREFIX + key);
            return raw !== null ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
        } catch (e) {
            console.warn('Storage write failed:', e);
        }
    },

    remove(key) {
        localStorage.removeItem(this.PREFIX + key);
    },

    // --- Settings ---
    getSettings() {
        return this.get('settings', {
            instance: CONFIG.defaultInstance,
            instanceMode: 'local', // 'local' | 'public' | 'custom'
            language: CONFIG.defaults.language,
            safesearch: CONFIG.defaults.safesearch,
            defaultCategory: CONFIG.defaults.category,
            theme: CONFIG.defaults.theme,
            openNewTab: CONFIG.defaults.openNewTab,
            historyEnabled: CONFIG.defaults.historyEnabled,
            autocompleteEnabled: CONFIG.defaults.autocompleteEnabled,
        });
    },

    saveSettings(settings) {
        this.set('settings', settings);
    },

    // --- Search History ---
    getHistory() {
        return this.get('history', []);
    },

    addToHistory(query, category) {
        if (!query || !query.trim()) return;
        const history = this.getHistory();
        // Remove duplicates
        const filtered = history.filter(h => h.query !== query);
        // Add to front
        filtered.unshift({
            query: query.trim(),
            category: category || 'general',
            timestamp: Date.now(),
        });
        // Limit size
        if (filtered.length > CONFIG.defaults.maxHistoryItems) {
            filtered.length = CONFIG.defaults.maxHistoryItems;
        }
        this.set('history', filtered);
    },

    removeFromHistory(query) {
        const history = this.getHistory().filter(h => h.query !== query);
        this.set('history', history);
    },

    clearHistory() {
        this.set('history', []);
    },

    // --- Favorites ---
    getFavorites() {
        return this.get('favorites', []);
    },

    addFavorite(url, title) {
        const favorites = this.getFavorites();
        if (!favorites.find(f => f.url === url)) {
            favorites.push({ url, title, timestamp: Date.now() });
            this.set('favorites', favorites);
        }
    },

    removeFavorite(url) {
        const favorites = this.getFavorites().filter(f => f.url !== url);
        this.set('favorites', favorites);
    },

    // --- Instance List Cache ---
    getInstanceCache() {
        return this.get('instance_cache', { timestamp: 0, instances: [] });
    },

    setInstanceCache(instances) {
        this.set('instance_cache', { timestamp: Date.now(), instances });
    },

    // --- Custom Instances ---
    getCustomInstances() {
        return this.get('custom_instances', []);
    },

    addCustomInstance(url) {
        const instances = this.getCustomInstances();
        if (!instances.includes(url)) {
            instances.push(url);
            this.set('custom_instances', instances);
        }
    },

    removeCustomInstance(url) {
        const instances = this.getCustomInstances().filter(u => u !== url);
        this.set('custom_instances', instances);
    },

    // --- Search Cache ---
    getSearchCache(key) {
        const cache = this.get('search_cache_' + key);
        if (!cache) return null;
        if (Date.now() - cache.timestamp > CONFIG.cacheDuration) {
            this.remove('search_cache_' + key);
            return null;
        }
        return cache.data;
    },

    setSearchCache(key, data) {
        this.set('search_cache_' + key, { data, timestamp: Date.now() });
    },

    // --- Clear All ---
    clearAll() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.PREFIX)) {
                keys.push(key);
            }
        }
        keys.forEach(key => localStorage.removeItem(key));
    },

    clearCache() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.PREFIX + 'search_cache_') || key === this.PREFIX + 'instance_cache') {
                keys.push(key);
            }
        }
        keys.forEach(key => localStorage.removeItem(key));
    },
};