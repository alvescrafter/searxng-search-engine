// ============================================
// SearXNG Search Engine — SearXNG API Client
// ============================================

const SearXAPI = {
    // Current instance base URL
    baseUrl: CONFIG.defaultInstance,

    // Whether to use the nginx proxy prefix
    // Auto-detected on init: true if nginx proxy is available, false for direct calls
    useProxy: true,

    // Whether proxy detection has been completed
    _proxyDetected: false,

    // Abort controller for cancelling requests
    _abortController: null,

    // --- Auto-detect proxy availability ---
    // Checks if the nginx proxy (/api/) is reachable.
    // Falls back to direct SearXNG calls if not behind nginx.
    async detectProxy() {
        if (this._proxyDetected) return;

        try {
            // Try the nginx proxy first (fast check)
            const response = await fetch('/api/search?q=test&format=json', {
                method: 'HEAD',
                signal: AbortSignal.timeout(3000),
            });
            // If we get any response (even error), the proxy exists
            this.useProxy = true;
        } catch {
            // Proxy not available — use direct SearXNG calls
            this.useProxy = false;
        }

        this._proxyDetected = true;
        console.log(`[SearXAPI] Proxy detected: ${this.useProxy ? 'nginx proxy' : 'direct connection'}`);
    },

    // --- Set Instance ---
    setInstance(url, useProxy = null) {
        // Normalize URL — remove trailing slash
        this.baseUrl = url.replace(/\/+$/, '');
        // If useProxy is explicitly set, use it; otherwise keep auto-detected value
        if (useProxy !== null) {
            this.useProxy = useProxy;
        }
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
            const data = await this._fetchWithCorsFallback(url, this._abortController.signal);

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

    // --- Fetch with CORS proxy fallback ---
    // Tries direct fetch first, falls back to CORS proxies if blocked
    async _fetchWithCorsFallback(url, signal, retries = 0) {
        try {
            const response = await fetch(url, {
                signal,
                headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (err) {
            // Only try CORS proxy for network errors (CORS, connection refused, etc.)
            // and only if we're not already using a proxy and haven't exhausted retries
            if (!this.useProxy && retries < CONFIG.corsProxies.length && (err instanceof TypeError || err.name === 'TypeError')) {
                const proxyUrl = CONFIG.corsProxies[retries] + encodeURIComponent(url);
                console.log(`[SearXAPI] Direct fetch failed, trying CORS proxy: ${CONFIG.corsProxies[retries]}`);
                try {
                    const proxyResponse = await fetch(proxyUrl, {
                        signal,
                        headers: { 'Accept': 'application/json' },
                    });
                    if (!proxyResponse.ok) {
                        throw new Error(`HTTP ${proxyResponse.status}`);
                    }
                    return await proxyResponse.json();
                } catch {
                    // Try next proxy
                    return this._fetchWithCorsFallback(url, signal, retries + 1);
                }
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
            const data = await this._fetchWithCorsFallback(url, AbortSignal.timeout(3000));

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

            try {
                const data = await this._fetchWithCorsFallback(testUrl, AbortSignal.timeout(8000));

                if (data && (data.results !== undefined || data.query !== undefined)) {
                    return { ok: true, version: data.version || 'unknown' };
                }

                return { ok: false, error: 'Invalid response format' };
            } catch (fetchErr) {
                return { ok: false, error: fetchErr.message };
            }
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