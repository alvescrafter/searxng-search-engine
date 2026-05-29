// ============================================
// SearXNG Search Engine — AI API Module
// Auto-detects Ollama & LM Studio, streaming chat
// ============================================

const AIAPI = {
    // --- Provider Detection ---
    _abortController: null,

    // Whether nginx proxy is available (auto-detected)
    _useProxy: true,
    _proxyDetected: false,

    // --- Auto-detect proxy availability ---
    async detectProxy() {
        if (this._proxyDetected) return;

        try {
            // Try the nginx proxy for Ollama first
            const response = await fetch('/ollama-api/api/tags', {
                method: 'HEAD',
                signal: AbortSignal.timeout(2000),
            });
            this._useProxy = true;
        } catch {
            // Try LM Studio proxy
            try {
                await fetch('/lmstudio-api/v1/models', {
                    method: 'HEAD',
                    signal: AbortSignal.timeout(2000),
                });
                this._useProxy = true;
            } catch {
                // Neither proxy available — use direct connections
                this._useProxy = false;
            }
        }

        this._proxyDetected = true;
        console.log(`[AIAPI] Proxy detected: ${this._useProxy ? 'nginx proxy' : 'direct connection'}`);
    },

    // --- Detect Ollama models ---
    async detectOllamaModels(baseUrl = null) {
        const settings = Storage.getAISettings();
        const url = (baseUrl || settings.ollamaUrl || CONFIG.ai.ollamaUrl).replace(/\/+$/, '');

        try {
            // Try proxy first (for Docker), then direct
            const urls = [
                `${CONFIG.ai.proxyPrefix.ollama}/api/tags`,
                `${url}/api/tags`,
            ];

            for (const endpoint of urls) {
                try {
                    const response = await fetch(endpoint, {
                        signal: AbortSignal.timeout(5000),
                        headers: { 'Accept': 'application/json' },
                    });

                    if (!response.ok) continue;

                    const data = await response.json();
                    if (data.models && Array.isArray(data.models)) {
                        return {
                            ok: true,
                            provider: 'ollama',
                            url: endpoint.includes(CONFIG.ai.proxyPrefix.ollama) ? 'proxy' : url,
                            models: data.models.map(m => ({
                                id: m.name || m.model,
                                name: m.name || m.model,
                                size: m.size,
                                modified: m.modified_at,
                            })),
                        };
                    }
                } catch {
                    continue;
                }
            }
            return { ok: false, provider: 'ollama', models: [] };
        } catch {
            return { ok: false, provider: 'ollama', models: [] };
        }
    },

    // Detect LM Studio models
    async detectLMStudioModels(baseUrl = null) {
        const settings = Storage.getAISettings();
        const url = (baseUrl || settings.lmstudioUrl || CONFIG.ai.lmstudioUrl).replace(/\/+$/, '');

        try {
            const urls = [
                `${CONFIG.ai.proxyPrefix.lmstudio}/v1/models`,
                `${url}/v1/models`,
            ];

            for (const endpoint of urls) {
                try {
                    const response = await fetch(endpoint, {
                        signal: AbortSignal.timeout(5000),
                        headers: { 'Accept': 'application/json' },
                    });

                    if (!response.ok) continue;

                    const data = await response.json();
                    if (data.data && Array.isArray(data.data)) {
                        return {
                            ok: true,
                            provider: 'lmstudio',
                            url: endpoint.includes(CONFIG.ai.proxyPrefix.lmstudio) ? 'proxy' : url,
                            models: data.data.map(m => ({
                                id: m.id,
                                name: m.id,
                            })),
                        };
                    }
                } catch {
                    continue;
                }
            }
            return { ok: false, provider: 'lmstudio', models: [] };
        } catch {
            return { ok: false, provider: 'lmstudio', models: [] };
        }
    },

    // Auto-detect all available providers
    async autoDetect() {
        const [ollama, lmstudio] = await Promise.all([
            this.detectOllamaModels(),
            this.detectLMStudioModels(),
        ]);

        const providers = [];
        if (ollama.ok && ollama.models.length > 0) providers.push(ollama);
        if (lmstudio.ok && lmstudio.models.length > 0) providers.push(lmstudio);

        return {
            available: providers.length > 0,
            providers,
            ollama,
            lmstudio,
        };
    },

    // Test connection to a specific provider
    async testConnection(provider, baseUrl = null) {
        if (provider === 'ollama') {
            const result = await this.detectOllamaModels(baseUrl);
            return { ok: result.ok, models: result.models, error: result.ok ? null : 'Could not connect to Ollama' };
        }
        if (provider === 'lmstudio') {
            const result = await this.detectLMStudioModels(baseUrl);
            return { ok: result.ok, models: result.models, error: result.ok ? null : 'Could not connect to LM Studio' };
        }
        return { ok: false, error: 'Unknown provider' };
    },

    // --- Build API URL for chat ---
    _getChatUrl(provider, settings) {
        const useProxy = this._useProxy && settings.useProxy !== false;

        if (provider === 'ollama') {
            const baseUrl = (settings.ollamaUrl || CONFIG.ai.ollamaUrl).replace(/\/+$/, '');
            return useProxy
                ? `${CONFIG.ai.proxyPrefix.ollama}/api/chat`
                : `${baseUrl}/api/chat`;
        }
        // LM Studio (OpenAI-compatible)
        const baseUrl = (settings.lmstudioUrl || CONFIG.ai.lmstudioUrl).replace(/\/+$/, '');
        return useProxy
            ? `${CONFIG.ai.proxyPrefix.lmstudio}/v1/chat/completions`
            : `${baseUrl}/v1/chat/completions`;
    },

    // --- Streaming Chat ---
    async *streamChat(messages, options = {}) {
        const settings = Storage.getAISettings();
        const provider = options.provider || settings.provider || 'auto';
        const model = options.model || settings.model || '';

        // Resolve auto provider
        let resolvedProvider = provider;
        let resolvedModel = model;

        if (provider === 'auto') {
            const detection = await this.autoDetect();
            if (!detection.available) {
                throw new Error('No AI provider available. Start Ollama or LM Studio.');
            }
            const first = detection.providers[0];
            resolvedProvider = first.provider;
            resolvedModel = model || first.models[0]?.id;
            if (!resolvedModel) {
                throw new Error(`No models found for ${resolvedProvider}`);
            }
        } else if (!resolvedModel) {
            // Detect models for the chosen provider
            const detection = provider === 'ollama'
                ? await this.detectOllamaModels()
                : await this.detectLMStudioModels();
            if (!detection.ok || !detection.models.length) {
                throw new Error(`No models found for ${provider}`);
            }
            resolvedModel = detection.models[0].id;
        }

        // Cancel any in-flight request
        if (this._abortController) {
            this._abortController.abort();
        }
        this._abortController = new AbortController();

        const url = this._getChatUrl(resolvedProvider, settings);

        // Build request body
        let body;
        let headers = { 'Content-Type': 'application/json' };

        if (resolvedProvider === 'ollama') {
            // Ollama native API
            body = {
                model: resolvedModel,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                stream: true,
                options: {
                    temperature: options.temperature ?? settings.temperature ?? 0.7,
                },
            };
        } else {
            // LM Studio / OpenAI-compatible
            body = {
                model: resolvedModel,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                stream: true,
                temperature: options.temperature ?? settings.temperature ?? 0.7,
                max_tokens: options.maxTokens ?? 2048,
            };
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: this._abortController.signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI request failed: ${response.status} ${errorText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    // Handle SSE format (data: {...})
                    if (trimmed.startsWith('data: ')) {
                        const jsonStr = trimmed.slice(6);
                        if (jsonStr === '[DONE]') return;

                        try {
                            const data = JSON.parse(jsonStr);

                            if (resolvedProvider === 'ollama') {
                                // Ollama streaming format
                                if (data.message && data.message.content) {
                                    yield {
                                        type: 'token',
                                        content: data.message.content,
                                        done: data.done || false,
                                    };
                                }
                            } else {
                                // OpenAI-compatible streaming format
                                const delta = data.choices?.[0]?.delta;
                                if (delta?.content) {
                                    yield {
                                        type: 'token',
                                        content: delta.content,
                                        done: false,
                                    };
                                }
                                if (data.choices?.[0]?.finish_reason === 'stop') {
                                    yield { type: 'done' };
                                    return;
                                }
                            }
                        } catch {
                            // Skip malformed JSON lines
                            continue;
                        }
                    } else {
                        // Handle raw JSON (Ollama non-SSE mode)
                        try {
                            const data = JSON.parse(trimmed);
                            if (resolvedProvider === 'ollama' && data.message?.content) {
                                yield {
                                    type: 'token',
                                    content: data.message.content,
                                    done: data.done || false,
                                };
                            }
                        } catch {
                            continue;
                        }
                    }
                }
            }

            yield { type: 'done' };
        } catch (err) {
            if (err.name === 'AbortError') {
                yield { type: 'aborted' };
                return;
            }
            throw err;
        } finally {
            this._abortController = null;
        }
    },

    // --- Non-streaming chat (for simple queries) ---
    async chat(messages, options = {}) {
        let fullContent = '';
        for await (const chunk of this.streamChat(messages, options)) {
            if (chunk.type === 'token') {
                fullContent += chunk.content;
            }
            if (chunk.type === 'done' || chunk.type === 'aborted') break;
        }
        return fullContent;
    },

    // --- Cancel in-flight request ---
    cancel() {
        if (this._abortController) {
            this._abortController.abort();
            this._abortController = null;
        }
    },
};