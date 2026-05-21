// ============================================
// SearXNG Search Engine — Instance Management
// ============================================

const Instances = {
    // Cached list of public instances
    publicInstances: [],

    // Loading state
    loading: false,

    // --- Fetch Public Instances from searx.space ---
    async fetchPublicInstances(forceRefresh = false) {
        // Check cache first (cache for 1 hour)
        const cache = Storage.getInstanceCache();
        const cacheAge = Date.now() - cache.timestamp;
        if (!forceRefresh && cache.instances.length > 0 && cacheAge < 60 * 60 * 1000) {
            this.publicInstances = cache.instances;
            return this.publicInstances;
        }

        this.loading = true;

        try {
            const response = await fetch(CONFIG.searxSpaceApi, {
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Parse instances — filter for HTTPS, normal network, good uptime
            const instances = [];
            const raw = data.instances || {};

            for (const [url, info] of Object.entries(raw)) {
                // Skip Tor-only instances
                if (info.network_type === 'tor') continue;
                // Skip instances without HTTPS
                if (!url.startsWith('https://')) continue;

                // Extract useful info
                const timing = info.timing || {};
                const searchTiming = timing.search || {};
                const uptime = info.uptime || {};

                instances.push({
                    url: url,
                    version: info.version || 'unknown',
                    country: this._extractCountry(info),
                    searchTime: searchTiming.all ? searchTiming.all.median : null,
                    initialTime: timing.initial ? timing.initial.all : null,
                    uptimeDay: uptime.uptimeDay || 0,
                    uptimeWeek: uptime.uptimeWeek || 0,
                    tls: (info.tls || {}).grade || '?',
                    http: (info.http || {}).grade || '?',
                    html: (info.html || {}).grade || '?',
                });
            }

            // Sort by uptime (descending), then search time (ascending)
            instances.sort((a, b) => {
                const uptimeDiff = (b.uptimeWeek || 0) - (a.uptimeWeek || 0);
                if (Math.abs(uptimeDiff) > 5) return uptimeDiff;
                return (a.searchTime || 999) - (b.searchTime || 999);
            });

            this.publicInstances = instances;
            Storage.setInstanceCache(instances);

            return instances;
        } catch (err) {
            console.warn('Failed to fetch public instances:', err);
            // Fall back to cache even if stale
            if (cache.instances.length > 0) {
                this.publicInstances = cache.instances;
                return cache.instances;
            }
            return [];
        } finally {
            this.loading = false;
        }
    },

    // --- Extract country from instance data ---
    _extractCountry(info) {
        try {
            const network = info.network || {};
            const ips = network.ips || {};
            const firstIp = Object.values(ips)[0] || {};
            // Try to get country from AS info
            return firstIp.country || '';
        } catch {
            return '';
        }
    },

    // --- Filter instances by search query ---
    filterInstances(query) {
        if (!query) return this.publicInstances;
        const q = query.toLowerCase();
        return this.publicInstances.filter(inst =>
            inst.url.toLowerCase().includes(q) ||
            inst.country.toLowerCase().includes(q)
        );
    },

    // --- Test an instance URL ---
    async testInstance(url) {
        // Temporarily switch to test
        const savedBase = SearXAPI.baseUrl;
        const savedProxy = SearXAPI.useProxy;

        // For public instances, we need to try direct (may fail due to CORS)
        // or use a CORS proxy
        SearXAPI.setInstance(url, false);

        try {
            const result = await SearXAPI.testConnection(url);
            return result;
        } finally {
            // Restore
            SearXAPI.baseUrl = savedBase;
            SearXAPI.useProxy = savedProxy;
        }
    },

    // --- Connect to an instance ---
    async connect(url, mode = 'local') {
        const settings = Storage.getSettings();
        settings.instance = url.replace(/\/+$/, '');
        settings.instanceMode = mode;
        Storage.saveSettings(settings);

        SearXAPI.setInstance(settings.instance, mode === 'local');
    },

    // --- Get current instance info ---
    getCurrentInstance() {
        const settings = Storage.getSettings();
        return {
            url: settings.instance || CONFIG.defaultInstance,
            mode: settings.instanceMode || 'local',
        };
    },

    // --- Get custom instances ---
    getCustomInstances() {
        return Storage.getCustomInstances();
    },

    // --- Add custom instance ---
    addCustomInstance(url) {
        const normalized = url.replace(/\/+$/, '');
        Storage.addCustomInstance(normalized);
    },

    // --- Remove custom instance ---
    removeCustomInstance(url) {
        Storage.removeCustomInstance(url);
    },

    // --- Format instance display info ---
    formatInstanceInfo(inst) {
        const parts = [];
        if (inst.uptimeWeek) parts.push(`${Math.round(inst.uptimeWeek)}% up`);
        if (inst.searchTime) parts.push(`${inst.searchTime.toFixed(2)}s`);
        if (inst.tls && inst.tls !== '?') parts.push(`TLS ${inst.tls}`);
        return parts.join(' · ');
    },
};