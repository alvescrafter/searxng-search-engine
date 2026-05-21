// ============================================
// SearXNG Search Engine — Configuration
// ============================================

const CONFIG = {
    // Default SearXNG instance (local Docker)
    defaultInstance: 'http://localhost:8080',

    // API paths
    api: {
        search: '/search',
        autocomplete: '/autocompleter',
        config: '/config',
    },

    // Proxy prefix — when using nginx, API calls go through /api/
    // Set to '' if calling SearXNG directly
    proxyPrefix: '/api',

    // Search categories mapped to SearXNG category names
    categories: {
        general:  { label: 'General',    icon: 'globe',    searxng: 'general' },
        images:   { label: 'Images',     icon: 'image',    searxng: 'images' },
        videos:   { label: 'Videos',     icon: 'video',    searxng: 'videos' },
        news:     { label: 'News',       icon: 'news',     searxng: 'news' },
        map:      { label: 'Maps',       icon: 'map',      searxng: 'map' },
        science:  { label: 'Science/IT',  icon: 'science',  searxng: 'science,it' },
        music:    { label: 'Music',      icon: 'music',    searxng: 'music' },
        files:    { label: 'Files',      icon: 'files',    searxng: 'files' },
    },

    // Default search settings
    defaults: {
        category: 'general',
        language: 'auto',
        safesearch: 0,
        timeRange: '',
        theme: 'dark',
        openNewTab: true,
        historyEnabled: true,
        maxHistoryItems: 200,
        autocompleteEnabled: true,
    },

    // Languages supported
    languages: [
        { code: 'auto', label: 'Auto-detect' },
        { code: 'en', label: 'English' },
        { code: 'de', label: 'German' },
        { code: 'fr', label: 'French' },
        { code: 'es', label: 'Spanish' },
        { code: 'it', label: 'Italian' },
        { code: 'pt', label: 'Portuguese' },
        { code: 'nl', label: 'Dutch' },
        { code: 'pl', label: 'Polish' },
        { code: 'ru', label: 'Russian' },
        { code: 'ja', label: 'Japanese' },
        { code: 'zh', label: 'Chinese' },
        { code: 'ko', label: 'Korean' },
        { code: 'ar', label: 'Arabic' },
        { code: 'hi', label: 'Hindi' },
    ],

    // searx.space API for fetching public instances
    searxSpaceApi: 'https://searx.space/data/instances.json',

    // CORS proxy fallback (for public instances that block CORS)
    corsProxies: [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url=',
    ],

    // Result type mapping from SearXNG engine categories
    resultTypes: {
        // Images category → render as image cards
        images: 'image',
        // Videos category → render as video cards
        videos: 'video',
        // News category → render as news cards
        news: 'news',
        // Map category → render as map cards
        map: 'map',
        // Music category → render as music cards
        music: 'music',
        // Files category → render as file cards
        files: 'file',
        // Everything else → general result cards
        general: 'general',
        science: 'general',
        it: 'general',
    },

    // Cache duration (ms)
    cacheDuration: 30 * 60 * 1000, // 30 minutes

    // Autocomplete debounce (ms)
    autocompleteDebounce: 300,

    // Max autocomplete suggestions
    maxAutocomplete: 8,
};