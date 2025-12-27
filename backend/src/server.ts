import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ChatRequest, ChatResponse, MessageMetadata } from './types';
import { DEFAULT_PROVIDERS, PERSONAS } from './config';
import { mcpManager } from './mcp/McpManager';
import { McpServerConfig, McpTool } from './mcp/types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

console.log('====================================');
console.log('  CODEC BACKEND REFRESHED (v0.8.3)  ');
console.log('====================================');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'Codec Backend', version: '0.6.1' });
});

// ============================================
// MCP API Endpoints
// ============================================

/** MCPサーバー一覧取得 */
app.get('/api/mcp/servers', (req, res) => {
    const servers = mcpManager.getServers();
    res.json({ servers });
});

/** MCPサーバー追加 */
app.post('/api/mcp/servers', async (req, res) => {
    const { name, config } = req.body as { name: string; config: McpServerConfig };
    if (!name || !config?.command) {
        return res.status(400).json({ error: 'name and config.command are required' });
    }
    const server = await mcpManager.addServer(name, config);
    res.json({ server });
});

/** MCPサーバー削除 */
app.delete('/api/mcp/servers/:name', async (req, res) => {
    const { name } = req.params;
    await mcpManager.removeServer(name);
    res.json({ success: true });
});

/** MCPサーバー有効/無効切り替え */
app.patch('/api/mcp/servers/:name', async (req, res) => {
    const { name } = req.params;
    const { disabled } = req.body as { disabled: boolean };

    try {
        const result = await mcpManager.toggleServer(name, disabled);
        res.json(result);
    } catch (e) {
        res.status(404).json({ error: (e as Error).message });
    }
});

/** 利用可能なツール一覧取得 */
app.get('/api/mcp/tools', async (req, res) => {
    const tools = await mcpManager.getAllTools();
    res.json({ tools });
});

// ============================================
// Models API Endpoints - 動的モデル取得
// ============================================

interface ModelInfo {
    id: string;
    name: string;
    provider: 'ollama' | 'anthropic' | 'google' | 'openai';
    model: string;
    available: boolean;
}

/** Ollamaモデル一覧取得 */
async function fetchOllamaModels(): Promise<ModelInfo[]> {
    const ollamaHost = process.env.OLLAMA_HOST || 'localhost:11434';
    try {
        const response = await fetch(`http://${ollamaHost}/api/tags`, {
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return [];

        const data = await response.json() as { models: Array<{ name: string; model: string }> };
        return (data.models || []).map(m => ({
            id: `ollama-${m.name.replace(/[/:]/g, '-')}`,
            name: m.name,
            provider: 'ollama' as const,
            model: m.name,
            available: true,
        }));
    } catch (error) {
        console.log('[Models] Ollama not available:', (error as Error).message);
        return [];
    }
}

/** Geminiモデル一覧取得 */
async function fetchGeminiModels(): Promise<ModelInfo[]> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.log('[Models] GOOGLE_API_KEY not set, skipping Gemini');
        return [];
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            { signal: AbortSignal.timeout(10000) }
        );
        if (!response.ok) return [];

        const data = await response.json() as {
            models: Array<{ name: string; displayName: string; supportedGenerationMethods?: string[] }>
        };

        // Filter for chat-capable models only
        const chatModels = (data.models || []).filter(m =>
            m.supportedGenerationMethods?.includes('generateContent')
        );

        return chatModels.map(m => {
            const modelId = m.name.replace('models/', '');
            return {
                id: `gemini-${modelId.replace(/[/:]/g, '-')}`,
                name: m.displayName || modelId,
                provider: 'google' as const,
                model: modelId,
                available: true,
            };
        });
    } catch (error) {
        console.log('[Models] Gemini API error:', (error as Error).message);
        return [];
    }
}

/** Claudeモデル一覧取得 */
async function fetchClaudeModels(): Promise<ModelInfo[]> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.log('[Models] ANTHROPIC_API_KEY not set, skipping Claude');
        return [];
    }

    try {
        const response = await fetch('https://api.anthropic.com/v1/models', {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return [];

        const data = await response.json() as { data: Array<{ id: string; display_name?: string }> };
        return (data.data || []).map(m => ({
            id: `claude-${m.id.replace(/[/:]/g, '-')}`,
            name: m.display_name || m.id,
            provider: 'anthropic' as const,
            model: m.id,
            available: true,
        }));
    } catch (error) {
        console.log('[Models] Claude API error:', (error as Error).message);
        return [];
    }
}

/** OpenAIモデル一覧取得 */
async function fetchOpenAIModels(): Promise<ModelInfo[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.log('[Models] OPENAI_API_KEY not set, skipping OpenAI');
        return [];
    }

    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return [];

        const data = await response.json() as { data: Array<{ id: string; owned_by: string }> };
        // Filter for GPT models only (exclude embedding, whisper, etc.)
        const gptModels = (data.data || []).filter(m =>
            m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3')
        );

        return gptModels.map(m => ({
            id: `openai-${m.id.replace(/[/:]/g, '-')}`,
            name: m.id,
            provider: 'openai' as const,
            model: m.id,
            available: true,
        }));
    } catch (error) {
        console.log('[Models] OpenAI API error:', (error as Error).message);
        return [];
    }
}

/** 全プロバイダーのモデル一覧取得 */
app.get('/api/models', async (req, res) => {
    console.log('[Models] Fetching available models...');

    const [ollama, gemini, claude, openai] = await Promise.all([
        fetchOllamaModels(),
        fetchGeminiModels(),
        fetchClaudeModels(),
        fetchOpenAIModels(),
    ]);

    const providers = {
        ollama: { name: 'OLLAMA', available: ollama.length > 0, models: ollama },
        google: { name: 'GOOGLE', available: gemini.length > 0, models: gemini },
        anthropic: { name: 'ANTHROPIC', available: claude.length > 0, models: claude },
        openai: { name: 'OPENAI', available: openai.length > 0, models: openai },
    };

    console.log(`[Models] Found: Ollama(${ollama.length}), Gemini(${gemini.length}), Claude(${claude.length}), OpenAI(${openai.length})`);

    res.json({ providers });
});

/** 特定プロバイダーのモデル一覧取得 */
app.get('/api/models/:provider', async (req, res) => {
    const { provider } = req.params;

    let models: ModelInfo[] = [];
    switch (provider) {
        case 'ollama':
            models = await fetchOllamaModels();
            break;
        case 'google':
        case 'gemini':
            models = await fetchGeminiModels();
            break;
        case 'anthropic':
        case 'claude':
            models = await fetchClaudeModels();
            break;
        case 'openai':
            models = await fetchOpenAIModels();
            break;
        default:
            return res.status(400).json({ error: 'Unknown provider' });
    }

    res.json({ models });
});

// ============================================
// Chat API
// ============================================

// Helper to format context with character names
const formatContext = (context?: import('./types').Message[]) => {
    return context?.map((m) => {
        let content = m.content;
        if (m.role === 'assistant' && m.personaId) {
            const p = PERSONAS.find((per) => per.id === m.personaId);
            if (p) {
                content = `[${p.codename}]: ${content}`;
            }
        }
        return { role: m.role, content };
    }) || [];
};

// Convert MCP tools to Claude format
const toClaudeTools = (tools: McpTool[]) => {
    return tools.map(t => ({
        name: `${t.serverName}__${t.name}`,
        description: t.description || '',
        input_schema: cleanSchema(t.inputSchema),
    }));
};

// Convert MCP tools to Gemini format
const toGeminiTools = (tools: McpTool[]) => {
    return [{
        function_declarations: tools.map(t => ({
            name: `${t.serverName}__${t.name}`,
            description: t.description || '',
            parameters: cleanSchema(t.inputSchema),
        }))
    }];
};

// Convert MCP tools to OpenAI/Ollama format
const toOllamaTools = (tools: McpTool[]) => {
    return tools.map(t => ({
        type: 'function',
        function: {
            name: `${t.serverName}__${t.name}`,
            description: t.description || '',
            parameters: cleanSchema(t.inputSchema),
        }
    }));
};

// Clean schema for LLM consumption (remove $schema, etc)
const cleanSchema = (schema: any): any => {
    if (!schema || typeof schema !== 'object') return schema;

    // Create copy to modify
    const cleaned = { ...schema };

    // Remove unsupported properties
    delete cleaned.$schema;
    delete cleaned.default; // Gemini sometimes has issues with default in nested objects

    // Recurse for nested properties
    if (cleaned.properties) {
        for (const key in cleaned.properties) {
            cleaned.properties[key] = cleanSchema(cleaned.properties[key]);
        }
    }

    if (cleaned.items) {
        cleaned.items = cleanSchema(cleaned.items);
    }

    return cleaned;
};

app.post('/api/chat', async (req: Request, res: Response) => {
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] Chat request received`);

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send immediate ping to confirm connection
    res.write(JSON.stringify({ type: 'ping' }) + '\n');

    const body: ChatRequest = req.body;
    const { message, providerId, context, systemPrompt, useMcp } = body;

    // First try static providers
    let provider = DEFAULT_PROVIDERS.find((p) => p.id === providerId);

    // If not found, try to resolve dynamically from providerId
    if (!provider && providerId) {
        // Parse providerId format: {provider}-{model} e.g., "gemini-gemini-2.5-flash", "ollama-llama3.2"
        let providerType: 'ollama' | 'anthropic' | 'google' | 'openai' | undefined;
        let modelName: string | undefined;

        if (providerId.startsWith('gemini-') || providerId.startsWith('google-')) {
            providerType = 'google';
            modelName = providerId.replace(/^(gemini|google)-/, '');
        } else if (providerId.startsWith('claude-') || providerId.startsWith('anthropic-')) {
            providerType = 'anthropic';
            modelName = providerId.replace(/^(claude|anthropic)-/, '');
        } else if (providerId.startsWith('ollama-')) {
            providerType = 'ollama';
            // Model names like "gpt-oss:20b" become "ollama-gpt-oss-20b" in ID
            // We need to convert the LAST hyphen back to colon (for tag)
            const rawModel = providerId.replace(/^ollama-/, '');
            // Find last hyphen and convert to colon (for version tag like :20b)
            const lastHyphenIndex = rawModel.lastIndexOf('-');
            if (lastHyphenIndex > 0) {
                modelName = rawModel.substring(0, lastHyphenIndex) + ':' + rawModel.substring(lastHyphenIndex + 1);
            } else {
                modelName = rawModel;
            }
        } else if (providerId.startsWith('openai-')) {
            providerType = 'openai';
            modelName = providerId.replace(/^openai-/, '');
        }

        if (providerType && modelName) {
            const ollamaHost = process.env.OLLAMA_HOST || 'localhost:11434';
            provider = {
                id: providerId,
                name: modelName,
                type: providerType,
                model: modelName,
                endpoint: providerType === 'ollama'
                    ? `http://${ollamaHost}`
                    : providerType === 'anthropic'
                        ? 'https://api.anthropic.com/v1/messages'
                        : providerType === 'google'
                            ? 'https://generativelanguage.googleapis.com/v1beta/models'
                            : 'https://api.openai.com/v1',
            };
            console.log(`[Chat] Dynamically resolved provider: ${JSON.stringify(provider)}`);
        }
    }

    if (!provider) {
        console.error(`[Chat] Provider not found: ${providerId}`);
        res.write(JSON.stringify({ error: `Provider not found: ${providerId}` }) + '\n');
        res.end();
        return;
    }

    // Get MCP tools if enabled (supported by Claude, Gemini, and some Ollama models)
    let mcpTools: McpTool[] = [];
    if (useMcp) {
        mcpTools = await mcpManager.getAllTools();
        console.log(`[MCP] ${mcpTools.length} tools available`);
    }

    let fullContent = '';
    let promptTokens = 0;
    let completionTokens = 0;

    try {
        if (provider.type === 'ollama') {
            fullContent = await handleOllamaChat(
                provider, systemPrompt, context, message, mcpTools, res,
                (p, c) => { promptTokens = p; completionTokens = c; }
            );

        } else if (provider.type === 'anthropic') {
            fullContent = await handleAnthropicChat(
                provider, systemPrompt, context, message, mcpTools, res,
                (p, c) => { promptTokens = p; completionTokens = c; }
            );

        } else if (provider.type === 'google') {
            fullContent = await handleGoogleChat(
                provider, systemPrompt, context, message, mcpTools, res,
                (p, c) => { promptTokens = p; completionTokens = c; }
            );
        }

        // Send metadata as final chunk
        const metadata: MessageMetadata = {
            model: provider.model,
            tokens: {
                prompt: promptTokens,
                completion: completionTokens,
                total: promptTokens + completionTokens,
            },
            latencyMs: Date.now() - startTime,
        };
        res.write(JSON.stringify({ metadata }) + '\n');
        res.end();

    } catch (error) {
        console.error('Chat API Error:', error);
        const errMessage = (error as Error).message;
        if (!res.headersSent) {
            res.status(500).json({ error: errMessage });
        } else {
            res.write(JSON.stringify({ error: errMessage }) + '\n');
            res.end();
        }
    }
});

// ============================================
// Anthropic (Claude) Handler with Tool Loop
// ============================================
async function handleAnthropicChat(
    provider: import('./types').LLMProvider,
    systemPrompt: string | undefined,
    context: import('./types').Message[] | undefined,
    message: string,
    mcpTools: McpTool[],
    res: Response,
    setTokens: (prompt: number, completion: number) => void
): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    // Build conversation messages
    let messages: Array<{ role: string; content: string | Array<unknown> }> = [
        ...formatContext(context),
        { role: 'user', content: message },
    ];

    let fullContent = '';
    const MAX_TOOL_ITERATIONS = 10;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const requestBody: Record<string, unknown> = {
            model: provider.model,
            max_tokens: 4096,
            system: systemPrompt || '',
            messages,
            stream: false, // Non-streaming for tool loop simplicity
        };

        if (mcpTools.length > 0) {
            requestBody.tools = toClaudeTools(mcpTools);
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errText = await response.text();
            let errorMessage = errText;
            try {
                const errJson = JSON.parse(errText);
                errorMessage = errJson.error?.message || errText;
            } catch (e) {
                // Not JSON
            }
            throw new Error(`Claude Error (${response.status}): ${errorMessage}`);
        }

        const result = await response.json() as {
            content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
            stop_reason: string;
            usage?: { input_tokens: number; output_tokens: number };
        };

        setTokens(result.usage?.input_tokens || 0, result.usage?.output_tokens || 0);

        // Check for tool use
        const toolUseBlocks = result.content.filter(b => b.type === 'tool_use');

        if (toolUseBlocks.length > 0 && result.stop_reason === 'tool_use') {
            // Execute tools
            const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];

            for (const block of toolUseBlocks) {
                console.log(`[MCP] Tool call received: ${block.name}`, JSON.stringify(block.input));
                const [serverName, toolName] = (block.name || '').split('__');

                if (!serverName || !toolName) {
                    console.error(`[MCP] Invalid tool name format: ${block.name}`);
                    continue;
                }

                res.write(JSON.stringify({ toolCall: { name: block.name, args: block.input } }) + '\n');

                console.log(`[MCP] Executing ${toolName} on ${serverName}...`);
                const toolResult = await mcpManager.callTool(serverName, toolName, block.input || {});
                console.log(`[MCP] Tool result:`, JSON.stringify(toolResult));
                const resultText = toolResult.content.map(c => c.text || '').join('\n');

                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id!,
                    content: resultText,
                });

                res.write(JSON.stringify({ toolResult: { name: block.name, result: resultText.slice(0, 200) } }) + '\n');
            }

            // Add assistant response and tool results to messages
            messages.push({ role: 'assistant', content: result.content as unknown as Array<unknown> });
            messages.push({ role: 'user', content: toolResults as unknown as Array<unknown> });

        } else {
            // No tool use, extract text and finish
            for (const block of result.content) {
                if (block.type === 'text' && block.text) {
                    fullContent += block.text;
                    res.write(JSON.stringify({ content: block.text }) + '\n');
                }
            }
            break;
        }
    }

    return fullContent;
}

// ============================================
// Google (Gemini) Handler with Tool Loop
// ============================================
async function handleGoogleChat(
    provider: import('./types').LLMProvider,
    systemPrompt: string | undefined,
    context: import('./types').Message[] | undefined,
    message: string,
    mcpTools: McpTool[],
    res: Response,
    setTokens: (prompt: number, completion: number) => void
): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY not configured');

    const formattedContext = formatContext(context).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));

    let contents = [
        ...(systemPrompt ? [{ role: 'user', parts: [{ text: `System Instruction: ${systemPrompt}` }] }] : []),
        ...formattedContext,
        { role: 'user', parts: [{ text: message }] },
    ];

    let fullContent = '';
    const MAX_TOOL_ITERATIONS = 10;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const requestBody: Record<string, unknown> = {
            contents,
            generationConfig: { maxOutputTokens: 4096 },
        };

        if (mcpTools.length > 0) {
            requestBody.tools = toGeminiTools(mcpTools);
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            let errorMessage = errText;
            try {
                const errJson = JSON.parse(errText);
                errorMessage = errJson.error?.message || errText;
            } catch (e) {
                // Not JSON, use raw text
            }
            throw new Error(`Gemini Error (${response.status}): ${errorMessage}`);
        }

        const result = await response.json() as {
            candidates: Array<{
                content: {
                    parts: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }>;
                    role: string;
                };
            }>;
            usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
        };

        setTokens(result.usageMetadata?.promptTokenCount || 0, result.usageMetadata?.candidatesTokenCount || 0);

        const parts = result.candidates?.[0]?.content?.parts || [];
        const functionCalls = parts.filter(p => p.functionCall);

        if (functionCalls.length > 0) {
            // Execute tools
            const functionResponses: Array<{ functionResponse: { name: string; response: { result: string } } }> = [];

            for (const part of functionCalls) {
                const fc = part.functionCall!;
                console.log(`[MCP] Tool call received (Gemini): ${fc.name}`, JSON.stringify(fc.args));

                const [serverName, toolName] = fc.name.split('__');
                if (!serverName || !toolName) {
                    console.error(`[MCP] Invalid tool name format: ${fc.name}`);
                    continue;
                }

                res.write(JSON.stringify({ toolCall: { name: fc.name, args: fc.args } }) + '\n');

                console.log(`[MCP] Executing ${toolName} on ${serverName}...`);
                const toolResult = await mcpManager.callTool(serverName, toolName, fc.args);
                console.log(`[MCP] Tool result:`, JSON.stringify(toolResult));
                const resultText = toolResult.content.map(c => c.text || '').join('\n');

                functionResponses.push({
                    functionResponse: {
                        name: fc.name,
                        response: { result: resultText },
                    },
                });

                res.write(JSON.stringify({ toolResult: { name: fc.name, result: resultText.slice(0, 200) } }) + '\n');
            }

            // Add model response and function results
            contents.push({ role: 'model', parts: parts as unknown as Array<{ text: string }> });
            contents.push({ role: 'user', parts: functionResponses as unknown as Array<{ text: string }> });

        } else {
            // No function call, extract text and finish
            for (const part of parts) {
                if (part.text) {
                    fullContent += part.text;
                    res.write(JSON.stringify({ content: part.text }) + '\n');
                }
            }
            break;
        }
    }

    return fullContent;
}

// ============================================
// Server Startup
// ============================================
async function startServer() {
    // Initialize MCP Manager
    await mcpManager.initialize();
    console.log('[MCP] Manager initialized');

    app.listen(PORT, () => {
        console.log(`Backend server is running on port ${PORT}`);
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});


// ============================================
// Ollama Handler with Tool Loop
// ============================================
async function handleOllamaChat(
    provider: import('./types').LLMProvider,
    systemPrompt: string | undefined,
    context: import('./types').Message[] | undefined,
    message: string,
    mcpTools: McpTool[],
    res: Response,
    setTokens: (prompt: number, completion: number) => void
): Promise<string> {
    const formattedContext = formatContext(context);

    let messages: Array<{ role: string; content: string; tool_calls?: unknown[] }> = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...formattedContext,
        { role: 'user', content: message },
    ];

    let fullContent = '';
    const MAX_TOOL_ITERATIONS = 10;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const requestBody: Record<string, unknown> = {
            model: provider.model,
            messages,
            stream: false, // Using non-streaming for tool loop simplicity
        };

        if (mcpTools.length > 0) {
            requestBody.tools = toOllamaTools(mcpTools);
        }

        // --- Keep-Alive & Timeout Logic for Ollama ---
        // Creating a promise that wraps the fetch with timeout and keep-alive pings
        const LLM_TIMEOUT = 5 * 60 * 1000; // 5 minutes
        const KEEP_ALIVE_INTERVAL = 15000; // 15 seconds

        const fetchPromise = new Promise<any>(async (resolve, reject) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                reject(new Error('LLM Timeout: 5 minutes exceeded'));
            }, LLM_TIMEOUT);

            // Keep-Alive Ping Interval
            const pingInterval = setInterval(() => {
                if (!res.headersSent || res.writableEnded) {
                    clearInterval(pingInterval);
                    return;
                }
                res.write(JSON.stringify({ type: 'ping' }) + '\n');
            }, KEEP_ALIVE_INTERVAL);

            try {
                const response = await fetch(`${provider.endpoint}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);
                clearInterval(pingInterval);
                resolve(response);
            } catch (error) {
                clearTimeout(timeoutId);
                clearInterval(pingInterval);
                reject(error);
            }
        });

        const response = await fetchPromise;

        if (!response.ok) {
            const errText = await response.text();
            let errorMessage = errText;
            try {
                const errJson = JSON.parse(errText);
                errorMessage = errJson.error || errText;
            } catch (e) {
                // Not JSON
            }
            throw new Error(`Ollama Error (${response.status}): ${errorMessage}`);
        }

        const result = await response.json() as {
            message: {
                role: string;
                content: string;
                tool_calls?: Array<{
                    function: { name: string; arguments: Record<string, unknown> }
                }>;
            };
            prompt_eval_count?: number;
            eval_count?: number;
            done?: boolean;
        };

        setTokens(result.prompt_eval_count || 0, result.eval_count || 0);

        const responseMessage = result.message;

        // Handle tool calls
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            // Since Ollama might not return content when calling tools, handled here
            // Add assistant message with tool calls to history
            messages.push({
                role: 'assistant',
                content: responseMessage.content || '',
                tool_calls: responseMessage.tool_calls
            });

            for (const toolCall of responseMessage.tool_calls) {
                const fc = toolCall.function;
                console.log(`[MCP] Tool call received (Ollama): ${fc.name}`, JSON.stringify(fc.arguments));

                const [serverName, toolName] = fc.name.split('__');
                if (!serverName || !toolName) {
                    console.error(`[MCP] Invalid tool name format: ${fc.name}`);
                    continue;
                }

                res.write(JSON.stringify({ toolCall: { name: fc.name, args: fc.arguments } }) + '\n');

                console.log(`[MCP] Executing ${toolName} on ${serverName}...`);
                const toolResult = await mcpManager.callTool(serverName, toolName, fc.arguments);
                console.log(`[MCP] Tool result:`, JSON.stringify(toolResult));

                const resultText = toolResult.content.map(c => c.text || '').join('\n');

                // Respond with tool result
                messages.push({
                    role: 'tool',
                    content: resultText,
                    // Ollama expects name/tool_call_id? Some versions simplified.
                    // Checking common Ollama tool format: role: 'tool', content: string
                } as any);

                res.write(JSON.stringify({ toolResult: { name: fc.name, result: resultText.slice(0, 200) } }) + '\n');
            }

        } else {
            // No tool calls, final response
            if (responseMessage.content) {
                fullContent += responseMessage.content;
                res.write(JSON.stringify({ content: responseMessage.content }) + '\n');
            }
            break;
        }
    }

    return fullContent;
}
