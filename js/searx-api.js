// ============================================
// SearXNG Search Engine — SearXNG API Client
// ============================================

const SearXAPI = {
    // Current instance base URL
    baseUrl: CONFIG.defaultInstance,

    // Whether to use the nginx proxy prefix
    useProxy: true,

    // Abort controller for cancelling requests
    _abortController: null,

    // --- Set Instance ---
    setInstance(url, useProxy = true) {
        // Normalize URL — remove trailing slash
        this.baseUrl = url.replace(/\/+$/, '');
        this.useProxy = useProxy;
    },

    // --- Build API URL ---
    _buildUrl(path, params = {}) {
        const base = this.useProxy ? CONFIG.proxyPrefix : this.baseUrl;
        const url = new URL(base + path, window.location.origin);
        Object.entries(params).forEach(([key, val]) => {
            if (val !== '' && val !== null && val !== undefined) {
                url.searchParams.set(key, val);
            }
        });
        return url.toString();
    },

    // --- Search ---
    async search(query, options = {}) {
        // Cancel any in-flight request
        if (this._abortController) {
            this._abortController.abort();
        }
        this._abortController = new AbortController();

        const params = {
            q: query,
            format: 'json',
            categories: options.categories || 'general',
            language: options.language || 'auto',
            pageno: options.page || 1,
        };

        if (options.safesearch !== undefined) {
            params.safesearch = options.safesearch;
        }
        if (options.time_range) {
            params.time_range = options.time_range;
        }

        const url = this._buildUrl(CONFIG.api.search, params);

        // Check cache first
        const cacheKey = `${query}_${params.categories}_${params.language}_${params.pageno}_${params.time_range || ''}_${params.safesearch || 0}`;
        const cached = Storage.getSearchCache(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const response = await fetch(url, {
                signal: this._abortController.signal,
                headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Cache the result
            Storage.setSearchCache(cacheKey, data);

            return data;
        } catch (err) {
            if (err.name === 'AbortError') {
                return null; // Request was cancelled
            }
            throw err;
        }
    },

    // --- Autocomplete / Suggestions ---
    async autocomplete(query) {
        if (!query || query.length < 2) return [];

        const params = {
            q: query,
        };

        const url = this._buildUrl(CONFIG.api.autocomplete, params);

        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(3000),
            });

            if (!response.ok) return [];

            const data = await response.json();

            // SearXNG returns suggestions as array of strings
            // or as { suggestions: [...], infoboxes: [...] }
            if (Array.isArray(data)) {
                return data.slice(0, CONFIG.maxAutocomplete);
            }
            if (data.suggestions) {
                return data.suggestions.slice(0, CONFIG.maxAutocomplete);
            }
            return [];
        } catch {
            return [];
        }
    },

    // --- Test Connection ---
    async testConnection(url) {
        try {
            const testUrl = this.useProxy
                ? this._buildUrl(CONFIG.api.search, { q: 'test', format: 'json' })
                : `${url.replace(/\/+$/, '')}/search?q=test&format=json`;

            const response = await fetch(testUrl, {
                signal: AbortSignal.timeout(8000),
                headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) {
                return { ok: false, error: `HTTP ${response.status}` };
            }

            const data = await response.json();

            if (data && (data.results !== undefined || data.query !== undefined)) {
                return { ok: true, version: data.version || 'unknown' };
            }

            return { ok: false, error: 'Invalid response format' };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    },

    // --- Fetch Instance Config ---
    async fetchConfig() {
        try {
            const url = this._buildUrl(CONFIG.api.config);
            const response = await fetch(url, {
                signal: AbortSignal.timeout(5000),
            });

            if (!response.ok) return null;

            return await response.json();
        } catch {
            return null;
        }
    },

    // --- Build Direct Search URL (for sharing) ---
    getSearchUrl(query, options = {}) {
        const params = new URLSearchParams({
            q: query,
            categories: options.categories || 'general',
        });
        if (options.language && options.language !== 'auto') {
            params.set('language', options.language);
        }
        if (options.time_range) {
            params.set('time_range', options.time_range);
        }
        return `${this.baseUrl}/search?${params.toString()}`;
    },
};