// ============================================
// SearXNG Search Engine — AI Summary Module
// Handles summarization, chat, and prompt building
// ============================================

const AISummary = {
    // State
    isGenerating: false,
    chatHistory: [],     // { role, content } messages
    currentQuery: '',    // Current search query
    currentResults: [],  // Current search results (for context)
    abortController: null,

    // --- System Prompt ---
    _systemPrompt: `You are an AI research assistant integrated into a search engine. Your role is to:
1. Summarize search results clearly and concisely
2. Highlight key findings, facts, and insights
3. Answer follow-up questions about the search topic
4. Always cite which sources support your claims when possible

Format your responses using markdown for readability. Use headers, bullet points, and bold text where appropriate.`,

    // --- Build context from search results ---
    _buildContext(results, maxResults = 8) {
        if (!results || results.length === 0) return 'No search results available.';

        const limited = results.slice(0, maxResults);
        return limited.map((r, i) => {
            const title = r.title || 'Untitled';
            const snippet = r.content || r.description || '';
            const url = r.url || '';
            const source = url ? new URL(url).hostname.replace(/^www\./, '') : 'Unknown source';
            return `[${i + 1}] **${title}** (${source})\n${snippet}`;
        }).join('\n\n');
    },

    // --- Build summary prompt ---
    _buildSummaryPrompt(query, results) {
        const context = this._buildContext(results);
        return `Please provide a comprehensive summary of the search results for: "${query}"

Here are the search results:

${context}

Please summarize the key findings, organize them by topic, and highlight the most important information. Use markdown formatting with headers and bullet points. Cite sources using [number] references where applicable.`;
    },

    // --- Build chat prompt (follow-up) ---
    _buildChatPrompt(userMessage) {
        const context = this._buildContext(this.currentResults, 5);
        return `Based on the search results for "${this.currentQuery}", the user asks:

${userMessage}

Search results context:
${context}

Please answer the user's question based on the search results. If the answer isn't in the results, say so and provide what information you can. Use markdown formatting.`;
    },

    // --- Generate Summary ---
    async generateSummary(query, results) {
        if (this.isGenerating) {
            this.cancelGeneration();
        }

        this.currentQuery = query;
        this.currentResults = results || [];
        this.isGenerating = true;
        this.chatHistory = []; // Reset chat history on new summary

        const userMessage = this._buildSummaryPrompt(query, results);
        const messages = [
            { role: 'system', content: this._systemPrompt },
            { role: 'user', content: userMessage },
        ];

        this.chatHistory.push({ role: 'user', content: userMessage });

        try {
            let fullContent = '';
            const generator = AIAPI.streamChat(messages);

            for await (const chunk of generator) {
                if (chunk.type === 'token') {
                    fullContent += chunk.content;
                    // Update UI in real-time
                    UI.updateAISummaryContent(fullContent, false);
                }
                if (chunk.type === 'done' || chunk.type === 'aborted') {
                    break;
                }
            }

            this.chatHistory.push({ role: 'assistant', content: fullContent });
            UI.updateAISummaryContent(fullContent, true);
            UI.updateAIStatus('ready');
            return fullContent;
        } catch (err) {
            UI.updateAISummaryContent('', true);
            UI.showAIError(err.message);
            UI.updateAIStatus('error');
            throw err;
        } finally {
            this.isGenerating = false;
        }
    },

    // --- Send Chat Message ---
    async sendChat(userMessage) {
        if (this.isGenerating) {
            this.cancelGeneration();
        }

        if (!this.currentQuery) {
            UI.showAIError('Please search for something first before chatting.');
            return;
        }

        this.isGenerating = true;

        // Add user message to history
        const chatPrompt = this._buildChatPrompt(userMessage);
        this.chatHistory.push({ role: 'user', content: chatPrompt });

        // Build messages for API (include system prompt + chat history, but limit context)
        const messages = [
            { role: 'system', content: this._systemPrompt },
            // Keep last N messages for context window
            ...this.chatHistory.slice(-10),
        ];

        try {
            let fullContent = '';
            const generator = AIAPI.streamChat(messages);

            for await (const chunk of generator) {
                if (chunk.type === 'token') {
                    fullContent += chunk.content;
                    UI.updateAIChatContent(fullContent, false);
                }
                if (chunk.type === 'done' || chunk.type === 'aborted') {
                    break;
                }
            }

            this.chatHistory.push({ role: 'assistant', content: fullContent });
            UI.updateAIChatContent(fullContent, true);
            UI.updateAIStatus('ready');
            return fullContent;
        } catch (err) {
            UI.showAIError(err.message);
            UI.updateAIStatus('error');
            throw err;
        } finally {
            this.isGenerating = false;
        }
    },

    // --- Cancel Generation ---
    cancelGeneration() {
        AIAPI.cancel();
        this.isGenerating = false;
        UI.updateAIStatus('ready');
    },

    // --- Reset State ---
    reset() {
        this.chatHistory = [];
        this.currentQuery = '';
        this.currentResults = [];
        this.isGenerating = false;
        AIAPI.cancel();
    },

    // --- Simple Markdown Renderer ---
    renderMarkdown(text) {
        if (!text) return '';

        let html = text;

        // Code blocks (```language\n...\n```)
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
            const escaped = this._escapeHtml(code.trim());
            return `<pre class="ai-code-block"><code${lang ? ` class="language-${lang}"` : ''}>${escaped}</code></pre>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

        // Headers
        html = html.replace(/^### (.+)$/gm, '<h4 class="ai-md-h3">$1</h4>');
        html = html.replace(/^## (.+)$/gm, '<h3 class="ai-md-h2">$1</h3>');
        html = html.replace(/^# (.+)$/gm, '<h2 class="ai-md-h1">$1</h2>');

        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Source citations [1], [2], etc.
        html = html.replace(/\[(\d+)\]/g, '<sup class="ai-citation">[$1]</sup>');

        // Unordered lists
        html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul class="ai-md-list">$&</ul>');

        // Ordered lists
        html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

        // Paragraphs (double newlines)
        html = html.replace(/\n\n/g, '</p><p class="ai-md-para">');

        // Single newlines → <br>
        html = html.replace(/\n/g, '<br>');

        // Wrap in paragraph if not already wrapped
        if (!html.startsWith('<')) {
            html = `<p class="ai-md-para">${html}</p>`;
        }

        return html;
    },

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};