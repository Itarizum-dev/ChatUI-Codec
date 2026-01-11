import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import { ChatRequest, ChatResponse, MessageMetadata } from './types';
import { DEFAULT_PROVIDERS, PERSONAS } from './config';
import { McpManager } from './mcp/McpManager'; // Changed import for McpManager class
import { SkillManager } from './skills/skillManager'; // Added SkillManager import
import { SkillCreator } from './skills/skillCreator'; // Added SkillCreator import
import { McpServerConfig, McpTool } from './mcp/types';
import { BUILTIN_TOOLS, findBuiltinTool, BuiltinTool, registerSkillCreator } from './tools/builtinTools';


// Set IPv4 first for DNS resolution (fixes host.docker.internal issues on some Node versions)
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

console.log('====================================');
console.log('  CODEC BACKEND REFRESHED (v0.8.3)  ');
console.log('====================================');

app.use(cors());
app.use(express.json());

// Initialize MCP Manager, Skill Manager, and Skill Creator
const mcpManager = new McpManager(path.join(__dirname, '../data/mcp-settings.json'));
const skillManager = new SkillManager(path.join(__dirname, '../skills'));
const skillCreator = new SkillCreator(skillManager);
registerSkillCreator(skillCreator);

// Debug Logger
const DEBUG_LOG_PATH = path.join(__dirname, '../data/backend-debug.log');
const logToDebugFile = (tag: string, data: any) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${tag}] ${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}\n`;
    fs.appendFileSync(DEBUG_LOG_PATH, logMessage);
};


app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'Codec Backend', version: '0.6.1' });
});

/** デバッグログ閲覧API (直近N行) */
app.get('/api/debug/log', (req, res) => {
    try {
        if (!fs.existsSync(DEBUG_LOG_PATH)) {
            return res.json({ log: 'No log file found.' });
        }
        const logContent = fs.readFileSync(DEBUG_LOG_PATH, 'utf-8');
        // 直近100行を返す
        const lines = logContent.split('\n').slice(-100).join('\n');
        res.json({ log: lines });
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

// ============================================
// Skills API Endpoints
// ============================================

/** スキル一覧取得 */
app.get('/api/skills', async (req, res) => {
    try {
        const skills = await skillManager.getAvailableSkills();
        res.json({ skills });
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
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
        console.log(`[Models] Fetching Ollama models from http://${ollamaHost}/api/tags...`);
        const response = await fetch(`http://${ollamaHost}/api/tags`, {
            signal: AbortSignal.timeout(30000), // Extended timeout to 30s
        });
        if (!response.ok) {
            const errorInfo = { status: response.status, text: response.statusText };
            console.log(`[Models] Ollama API error: ${response.status} ${response.statusText}`);
            logToDebugFile('OLLAMA_API_ERROR', errorInfo);
            return [];
        }

        const data = await response.json() as { models: Array<{ name: string; model: string }> };
        const models = (data.models || []).map(m => ({
            id: `ollama-${m.name.replace(/[/:]/g, '-')}`,
            name: m.name,
            provider: 'ollama' as const,
            model: m.name,
            available: true,
        }));
        console.log(`[Models] Fetched ${models.length} Ollama models`);
        return models;
    } catch (error) {
        const err = error as Error & { cause?: unknown };
        const errorMsg = err.message;
        const errorCause = err.cause ? JSON.stringify(err.cause) : 'no-cause';
        console.warn(`[Models] Ollama connection failed (http://${ollamaHost}):`, errorMsg, errorCause);
        logToDebugFile('OLLAMA_CONN_ERROR', { host: ollamaHost, error: errorMsg, cause: err.cause });
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
// Skills API Endpoints
// ============================================

/** [Stage 1] 全スキルメタデータ一覧取得（軽量） */
app.get('/api/skills', async (req, res) => {
    try {
        console.log('[API] GET /api/skills - Stage 1 Discovery');
        const skills = await skillManager.getAvailableSkills();
        res.json({ skills });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/** [Stage 2] スキルをアクティベート（SKILL.md本文読み込み） */
app.get('/api/skills/:name/activate', async (req, res) => {
    try {
        const { name } = req.params;
        console.log(`[API] GET /api/skills/${name}/activate - Stage 2 Activation`);
        const skill = await skillManager.activateSkill(name);
        if (!skill) {
            return res.status(404).json({ error: 'Skill not found' });
        }
        res.json({ skill });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/** [Stage 3] スキルリソース読み込み */
app.get('/api/skills/:name/resource/*', async (req, res) => {
    try {
        const { name } = req.params;
        // ワイルドカード部分を抽出（/api/skills/:name/resource/ 以降のパス）
        const resourcePath = req.path.replace(`/api/skills/${name}/resource/`, '');
        console.log(`[API] GET /api/skills/${name}/resource/${resourcePath} - Stage 3 Resource`);
        const content = await skillManager.loadSkillResource(name, resourcePath);
        if (!content) {
            return res.status(404).json({ error: 'Resource not found' });
        }
        res.json({ content });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/** 特定スキル詳細取得（Stage 2と同等、後方互換用） */
app.get('/api/skills/:name', async (req, res) => {
    try {
        const { name } = req.params;
        console.log(`[API] GET /api/skills/${name} - Activating (backward compat)`);
        const skill = await skillManager.activateSkill(name);
        if (!skill) {
            return res.status(404).json({ error: 'Skill not found' });
        }
        res.json({ skill });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/** 新規スキル初期化（Creator用） */
app.post('/api/skills/init', async (req, res) => {
    try {
        const { name, description = 'No description provided.' } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const result = await skillCreator.initSkill(name, description);
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

/** スキル検証（Creator用） */
app.post('/api/skills/validate', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const result = await skillCreator.validateSkill(name);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
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
                const prefix = `[${p.codename}]:`;
                if (!content.trim().startsWith(prefix)) {
                    content = `${prefix} ${content}`;
                }
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

// Convert built-in tools to Claude format (no serverName prefix)
const builtinToClaudeTools = (tools: BuiltinTool[]) => {
    return tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
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

// Convert built-in tools to Gemini format
const builtinToGeminiDeclarations = (tools: BuiltinTool[]) => {
    return tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
    }));
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

// Convert built-in tools to Ollama format
const builtinToOllamaTools = (tools: BuiltinTool[]) => {
    return tools.map(t => ({
        type: 'function',
        function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
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

    logToDebugFile('REQUEST_RECEIVED', {
        providerId: req.body.providerId,
        messageLength: req.body.message?.length,
        contextSize: req.body.context?.length
    });

    if (req.body.context && req.body.context.length > 0) {
        logToDebugFile('CONTEXT_DUMP', req.body.context.map((m: any) => ({
            role: m.role,
            contentPreview: m.content?.slice(0, 50),
            personaId: m.personaId
        })));
    }

    console.log(`[Chat] Context size: ${req.body.context?.length || 0}`);
    if (req.body.context) {
        req.body.context.forEach((m: any, i: number) => {
            console.log(`[Chat] Ctx[${i}] role=${m.role} content_len=${m.content?.length || 0} persona=${m.personaId || 'none'}`);
        });
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send immediate ping to confirm connection
    res.write(JSON.stringify({ type: 'ping' }) + '\n');

    const body: ChatRequest = req.body;
    const { message, providerId, context, systemPrompt, useMcp, useThinking } = body;

    // Inject available skills into system prompt
    let enhancedSystemPrompt = systemPrompt || '';
    try {
        const skills = await skillManager.getAvailableSkills();
        if (skills.length > 0) {
            const skillsXml = skills.map(s =>
                `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n    <location>${s.path}/SKILL.md</location>\n  </skill>`
            ).join('\n');

            enhancedSystemPrompt += `\n\n<available_skills>\n${skillsXml}\n</available_skills>\n\n` +
                `The above skills are available in the system. You are an AI Agent capable of using these skills to help the user.\n` +
                `When a user asks for a task that matches a skill, you MUST first read the skill instructions using the 'cat' tool.\n` +
                `Example: To read a skill, call the 'cat' tool with the path from <location>.\n` +
                `After reading the SKILL.md file, follow its instructions step by step.`;
        }
    } catch (e) {
        console.warn('[Skills] Failed to inject skills into system prompt:', e);
    }

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

    // Built-in tools are always available (lightweight, no MCP overhead)
    const builtinTools = BUILTIN_TOOLS;
    console.log(`[Builtin] ${builtinTools.length} tools available`);

    let fullContent = '';
    let promptTokens = 0;
    let completionTokens = 0;

    try {
        if (provider.type === 'ollama') {
            fullContent = await handleOllamaChat(
                provider, enhancedSystemPrompt, context, message, mcpTools, builtinTools, res,
                (p, c) => { promptTokens = p; completionTokens = c; },
                useThinking || false
            );

        } else if (provider.type === 'anthropic') {
            fullContent = await handleAnthropicChat(
                provider, enhancedSystemPrompt, context, message, mcpTools, builtinTools, res,
                (p, c) => { promptTokens = p; completionTokens = c; }
            );

        } else if (provider.type === 'google') {
            fullContent = await handleGoogleChat(
                provider, enhancedSystemPrompt, context, message, mcpTools, builtinTools, res,
                (p, c) => { promptTokens = p; completionTokens = c; }
            );

        } else if (provider.type === 'openai') {
            fullContent = await handleOpenAIChat(
                provider, enhancedSystemPrompt, context, message, mcpTools, builtinTools, res,
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
    builtinTools: BuiltinTool[],
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
    // Add useThinking parameter (inferred from callers or passed down - but here we need to check if we can add it to signature or just support parsing)
    // Since I cannot easily change the signature in this step without changing the caller, I will assume parsing is always active if tags are present.
    // However, the previous step added useThinking to the body, but it wasn't passed to this function.
    // For now, I will just implement the parsing which covers "if available".

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const requestBody: Record<string, unknown> = {
            model: provider.model,
            max_tokens: 4096,
            system: systemPrompt || '',
            messages,
            stream: true, // Enable streaming!
        };

        // Combine MCP tools and built-in tools for LLM
        const allTools = [
            ...toClaudeTools(mcpTools),
            ...builtinToClaudeTools(builtinTools)
        ];
        if (allTools.length > 0) {
            requestBody.tools = allTools;
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

        if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            let currentMessageContent = ''; // For this iteration
            let toolUseBlock: { type: 'tool_use', id: string, name: string, input: any } | null = null;
            let jsonAccumulator = ''; // For accumulating tool input JSON

            // Thinking Parser State
            let insideThinking = false;
            let capturedThinking = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('event: ')) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6);
                            if (dataStr.trim() === '[DONE]') continue;

                            try {
                                const data = JSON.parse(dataStr);

                                switch (data.type) {
                                    case 'message_start':
                                        if (data.message?.usage) {
                                            setTokens(data.message.usage.input_tokens || 0, 0);
                                        }
                                        break;

                                    case 'content_block_start':
                                        if (data.content_block?.type === 'tool_use') {
                                            toolUseBlock = {
                                                type: 'tool_use',
                                                id: data.content_block.id,
                                                name: data.content_block.name,
                                                input: {}
                                            };
                                            jsonAccumulator = '';
                                        }
                                        break;

                                    case 'content_block_delta':
                                        if (data.delta?.type === 'text_delta') {
                                            const text = data.delta.text;

                                            // Simple parser for <think> tags
                                            // Handle split tags across chunks is complex, but for now implementing basic check
                                            let textToProcess = text;

                                            if (!insideThinking) {
                                                if (textToProcess.includes('<think>')) {
                                                    const parts = textToProcess.split('<think>');
                                                    if (parts[0]) {
                                                        currentMessageContent += parts[0];
                                                        fullContent += parts[0];
                                                        res.write(JSON.stringify({ content: parts[0] }) + '\n');
                                                    }
                                                    insideThinking = true;
                                                    textToProcess = parts[1] || '';
                                                    // Continue processing rest as thinking
                                                }
                                            }

                                            if (insideThinking) {
                                                if (textToProcess.includes('</think>')) {
                                                    const parts = textToProcess.split('</think>');
                                                    capturedThinking += parts[0];
                                                    // Emit thinking
                                                    res.write(JSON.stringify({ thinking: parts[0] }) + '\n');
                                                    res.write(JSON.stringify({ thinkingDone: true }) + '\n');

                                                    insideThinking = false;
                                                    if (parts[1]) {
                                                        currentMessageContent += parts[1];
                                                        fullContent += parts[1];
                                                        res.write(JSON.stringify({ content: parts[1] }) + '\n');
                                                    }
                                                } else {
                                                    capturedThinking += textToProcess;
                                                    res.write(JSON.stringify({ thinking: textToProcess }) + '\n');
                                                }
                                            } else {
                                                // Normal content
                                                if (textToProcess) {
                                                    currentMessageContent += textToProcess;
                                                    fullContent += textToProcess;
                                                    res.write(JSON.stringify({ content: textToProcess }) + '\n');
                                                }
                                            }
                                        } else if (data.delta?.type === 'input_json_delta') {
                                            jsonAccumulator += data.delta.partial_json;
                                        }
                                        break;

                                    case 'content_block_stop':
                                        if (toolUseBlock && jsonAccumulator) {
                                            try {
                                                toolUseBlock.input = JSON.parse(jsonAccumulator);
                                            } catch (e) {
                                                console.error('Failed to parse tool input JSON', e);
                                            }
                                        }
                                        break;

                                    case 'message_delta':
                                        if (data.usage?.output_tokens) {
                                            setTokens(0, data.usage.output_tokens); // Updating completion tokens
                                        }
                                        if (data.stop_reason === 'tool_use' && toolUseBlock) {
                                            // Tool execution will happen after stream
                                        }
                                        break;
                                }
                            } catch (e) {
                                // ignore
                            }
                        }
                    }
                }
            }

            // If tool used
            if (toolUseBlock) {
                const block = toolUseBlock;
                console.log(`[Tool] Tool call received: ${block.name}`, JSON.stringify(block.input));

                res.write(JSON.stringify({ toolCall: { name: block.name, args: block.input } }) + '\n');

                let resultText: string;

                // Execute Tool
                const builtinTool = findBuiltinTool(block.name || '');
                if (builtinTool) {
                    console.log(`[Builtin] Executing ${block.name}...`);
                    resultText = await builtinTool.execute(block.input as Record<string, unknown> || {});
                } else {
                    const [serverName, toolName] = (block.name || '').split('__');
                    if (!serverName || !toolName) {
                        resultText = `Error: Invalid tool name format: ${block.name}`;
                    } else {
                        try {
                            const toolResult = await mcpManager.callTool(serverName, toolName, block.input || {});
                            resultText = toolResult.content.map(c => c.text || '').join('\n');
                        } catch (e: any) {
                            resultText = `Error calling tool: ${e.message}`;
                        }
                    }
                }

                res.write(JSON.stringify({ toolResult: { name: block.name, result: resultText.slice(0, 200) } }) + '\n');

                // Add to history
                messages.push({
                    role: 'assistant', content: [
                        ...(currentMessageContent ? [{ type: 'text', text: currentMessageContent }] : []),
                        { type: 'tool_use', id: block.id, name: block.name, input: block.input }
                    ] as any
                }); // Types mismatch a bit but okay for this internal representation

                messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: block.id, content: resultText }] as any });

                // Reset for next iteration
                fullContent = ''; // We only return the final answer content typically, or we accumulate? 
                // In streaming, we usually just want the final text.
                // But the loop continues.
                continue;

            } else {
                // Done
                break;
            }
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
    builtinTools: BuiltinTool[],
    res: Response,
    setTokens: (prompt: number, completion: number) => void
): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY not configured');

    const formattedContext = formatContext(context).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));

    const contents = [
        ...formattedContext,
        { role: 'user', parts: [{ text: message }] },
    ];

    let fullContent = '';
    const MAX_TOOL_ITERATIONS = 10;

    // Combine MCP tools and built-in tools for LLM
    const mcpDeclarations = mcpTools.length > 0 ? toGeminiTools(mcpTools)[0].function_declarations : [];
    const builtinDeclarations = builtinToGeminiDeclarations(builtinTools);
    const allDeclarations = [...mcpDeclarations, ...builtinDeclarations];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const requestBody: Record<string, unknown> = {
            contents,
            generationConfig: { maxOutputTokens: 4096 },
        };

        if (systemPrompt) {
            requestBody.system_instruction = {
                parts: [{ text: systemPrompt }]
            };
        }

        if (allDeclarations.length > 0) {
            requestBody.tools = [{ function_declarations: allDeclarations }];
        }

        logToDebugFile('GEMINI_REQUEST_CONTENTS', contents.map(c => ({
            role: c.role,
            parts: c.parts?.map(p => p.text?.slice(0, 50))
        })));

        // Use streaming endpoint
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:streamGenerateContent?key=${apiKey}&alt=sse`;

        console.log(`[Gemini] Iteration ${iteration + 1}: Sending request with ${contents.length} messages`);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        console.log(`[Gemini] Response status: ${response.status}`);

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

        if (response.body) {
            // Streaming mode: parse SSE chunks
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let promptTokens = 0;
            let completionTokens = 0;
            let pendingFunctionCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
            let buffer = '';

            // Thinking State
            let insideThinking = false;
            let capturedThinking = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonStr = line.slice(6);
                        if (jsonStr.trim() === '[DONE]') continue;

                        try {
                            const json = JSON.parse(jsonStr) as {
                                candidates?: Array<{
                                    content?: {
                                        parts?: Array<{ text?: string; functionCall?: { name: string; args: Record<string, unknown> } }>;
                                    };
                                }>;
                                usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
                            };

                            const parts = json.candidates?.[0]?.content?.parts || [];
                            for (const part of parts) {
                                // Stream text content
                                if (part.text) {
                                    const text = part.text;
                                    let textToProcess = text;

                                    // Simple generic <think> parsing
                                    if (!insideThinking) {
                                        if (textToProcess.includes('<think>')) {
                                            const splitParts = textToProcess.split('<think>');
                                            if (splitParts[0]) {
                                                fullContent += splitParts[0];
                                                res.write(JSON.stringify({ content: splitParts[0] }) + '\n');
                                            }
                                            insideThinking = true;
                                            textToProcess = splitParts[1] || '';
                                        }
                                    }

                                    if (insideThinking) {
                                        if (textToProcess.includes('</think>')) {
                                            const splitParts = textToProcess.split('</think>');
                                            capturedThinking += splitParts[0];
                                            res.write(JSON.stringify({ thinking: splitParts[0] }) + '\n');
                                            res.write(JSON.stringify({ thinkingDone: true }) + '\n');
                                            insideThinking = false;

                                            if (splitParts[1]) {
                                                fullContent += splitParts[1];
                                                res.write(JSON.stringify({ content: splitParts[1] }) + '\n');
                                            }
                                        } else {
                                            capturedThinking += textToProcess;
                                            res.write(JSON.stringify({ thinking: textToProcess }) + '\n');
                                        }
                                    } else {
                                        // Normal content
                                        if (textToProcess) {
                                            fullContent += textToProcess;
                                            res.write(JSON.stringify({ content: textToProcess }) + '\n');
                                        }
                                    }
                                }
                                // Collect function calls
                                if (part.functionCall) {
                                    pendingFunctionCalls.push(part.functionCall);
                                }
                            }

                            if (json.usageMetadata) {
                                promptTokens = json.usageMetadata.promptTokenCount || 0;
                                completionTokens = json.usageMetadata.candidatesTokenCount || 0;
                            }
                        } catch (e) {
                            // Parsing error, skip this line
                            console.warn('[Gemini] Failed to parse streaming chunk:', (e as Error).message);
                        }
                    }
                }
            }

            setTokens(promptTokens, completionTokens);

            // Process function calls if any
            if (pendingFunctionCalls.length > 0) {
                const functionResponses: Array<{ functionResponse: { name: string; response: { result: string } } }> = [];
                const modelParts: Array<{ functionCall: { name: string; args: Record<string, unknown> } }> = [];

                for (const fc of pendingFunctionCalls) {
                    console.log(`[Tool] Tool call received (Gemini): ${fc.name}`, JSON.stringify(fc.args));

                    res.write(JSON.stringify({ toolCall: { name: fc.name, args: fc.args } }) + '\n');

                    let resultText: string;

                    const builtinTool = findBuiltinTool(fc.name);
                    if (builtinTool) {
                        console.log(`[Builtin] Executing ${fc.name}...`);
                        resultText = await builtinTool.execute(fc.args as Record<string, unknown> || {});
                    } else {
                        const [serverName, toolName] = fc.name.split('__');
                        if (!serverName || !toolName) {
                            console.error(`[MCP] Invalid tool name format: ${fc.name}`);
                            resultText = `Error: Invalid tool name format: ${fc.name}`;
                        } else {
                            console.log(`[MCP] Executing ${toolName} on ${serverName}...`);
                            const toolResult = await mcpManager.callTool(serverName, toolName, fc.args);
                            console.log(`[MCP] Tool result:`, JSON.stringify(toolResult));
                            resultText = toolResult.content.map(c => c.text || '').join('\n');
                        }
                    }

                    modelParts.push({ functionCall: fc });
                    functionResponses.push({
                        functionResponse: {
                            name: fc.name,
                            response: { result: resultText },
                        },
                    });

                    res.write(JSON.stringify({ toolResult: { name: fc.name, result: resultText.slice(0, 200) } }) + '\n');
                }

                // Add model response and function results
                contents.push({ role: 'model', parts: modelParts as unknown as Array<{ text: string }> });
                contents.push({ role: 'user', parts: functionResponses as unknown as Array<{ text: string }> });

                // Reset for next iteration
                fullContent = '';
                continue;
            }

            return fullContent;
        } else {
            throw new Error('No response body from Gemini API');
        }
    }

    return fullContent;
}

// ============================================
// Server Startup
// ============================================
async function startServer() {
    // MCP Manager Initialization
    await mcpManager.initialize();
    console.log('[MCP] Manager initialized');

    // Skill Manager Initialization
    await skillManager.initialize();
    console.log('[Skills] Manager initialized');

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
    builtinTools: BuiltinTool[],
    res: Response,
    setTokens: (prompt: number, completion: number) => void,
    useThinking: boolean = false
): Promise<string> {
    const formattedContext = formatContext(context);

    let messages: Array<{ role: string; content: string; tool_calls?: unknown[] }> = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...formattedContext,
        { role: 'user', content: message },
    ];

    if (systemPrompt) {
        console.log(`[Ollama] System prompt applied: ${systemPrompt.slice(0, 50)}...`);
    }
    console.log(`[Ollama] Sending ${messages.length} messages. Roles: ${messages.map(m => m.role).join(', ')}`);

    logToDebugFile('OLLAMA_REQUEST_MESSAGES', messages.map(m => ({
        role: m.role,
        contentPreview: m.content?.slice(0, 100)
    })));

    messages.forEach((m, i) => {
        console.log(`[Ollama] Msg[${i}] role=${m.role} head=${m.content?.slice(0, 30)}...`);
    });

    let fullContent = '';
    let fullThinking = '';
    const MAX_TOOL_ITERATIONS = 10;

    // Combine MCP tools and built-in tools for LLM
    const allTools = [
        ...toOllamaTools(mcpTools),
        ...builtinToOllamaTools(builtinTools)
    ];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const requestBody: Record<string, unknown> = {
            model: provider.model,
            messages,
            stream: true, // Enable streaming
        };

        // Enable thinking mode if requested
        if (useThinking) {
            requestBody.think = true;
            console.log('[Ollama] Thinking mode enabled');
        }

        if (allTools.length > 0) {
            requestBody.tools = allTools;
        }

        // --- Keep-Alive & Timeout Logic for Ollama ---
        const LLM_TIMEOUT = 5 * 60 * 1000; // 5 minutes
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, LLM_TIMEOUT);

        try {
            console.log(`[Ollama] Iteration ${iteration + 1}: Sending request to ${provider.model}`);

            let response = await fetch(`${provider.endpoint}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            // Retry logic for models that don't support tools (Ollama returns 400)
            if (!response.ok && response.status === 400 && requestBody.tools) {
                console.warn(`[Ollama] Request failed (400) with tools. Retrying without tools for model ${provider.model}...`);
                delete requestBody.tools;
                response = await fetch(`${provider.endpoint}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal,
                });
            }

            clearTimeout(timeoutId);
            console.log(`[Ollama] Response status: ${response.status}`);

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

            if (response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let promptTokens = 0;
                let completionTokens = 0;
                let pendingToolCalls: Array<{ function: { name: string; arguments: Record<string, unknown> } }> = [];
                let lastMessageContent = '';
                let receivedAnyThinking = false;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line.trim()) continue;

                        try {
                            const json = JSON.parse(line) as {
                                message?: {
                                    role: string;
                                    content: string;
                                    thinking?: string;
                                    tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>;
                                };
                                done?: boolean;
                                prompt_eval_count?: number;
                                eval_count?: number;
                            };

                            // Stream thinking content (for reasoning models)
                            if (json.message?.thinking) {
                                fullThinking += json.message.thinking;
                                receivedAnyThinking = true;
                                res.write(JSON.stringify({ thinking: json.message.thinking }) + '\n');
                            }

                            // Stream text content
                            if (json.message?.content) {
                                fullContent += json.message.content;
                                lastMessageContent += json.message.content;

                                // Some models (like gpt-oss) embed thinking in content with <think> tags
                                if (json.message.content.includes('<think>') || json.message.content.includes('</think>')) {
                                    receivedAnyThinking = true;
                                }

                                res.write(JSON.stringify({ content: json.message.content }) + '\n');
                            }

                            // Collect tool calls (usually in final message)
                            if (json.message?.tool_calls) {
                                pendingToolCalls = json.message.tool_calls;
                            }

                            // Token counts (in final chunk)
                            if (json.done && json.prompt_eval_count !== undefined) {
                                promptTokens = json.prompt_eval_count;
                                completionTokens = json.eval_count || 0;
                                console.log(`[Ollama] Stream done. Tokens: ${promptTokens}/${completionTokens}`);
                            }
                        } catch (e) {
                            console.warn('[Ollama] Failed to parse streaming chunk:', line.slice(0, 100));
                        }
                    }
                }

                console.log(`[Ollama] Streaming complete. Content length: ${fullContent.length}`);
                console.log(`[Ollama] Content preview: "${fullContent.slice(0, 200)}"`);
                setTokens(promptTokens, completionTokens);

                // Check for unsupported model (thinking mode ON but no thinking received)
                if (useThinking && !receivedAnyThinking && fullContent) {
                    res.write(JSON.stringify({
                        thinkingError: 'このモデルはThinkingモードに対応していません。対応モデル: qwen3, deepseek-r1, phi4-reasoning 等'
                    }) + '\n');
                }

                // Send thinkingDone signal if we received any thinking
                if (receivedAnyThinking) {
                    res.write(JSON.stringify({ thinkingDone: true }) + '\n');
                }

                // Handle tool calls if any
                if (pendingToolCalls.length > 0) {
                    // Add assistant message with tool calls to history
                    messages.push({
                        role: 'assistant',
                        content: lastMessageContent || '',
                        tool_calls: pendingToolCalls
                    });

                    for (const toolCall of pendingToolCalls) {
                        const fc = toolCall.function;
                        console.log(`[Tool] Tool call received (Ollama): ${fc.name}`, JSON.stringify(fc.arguments));

                        res.write(JSON.stringify({ toolCall: { name: fc.name, args: fc.arguments } }) + '\n');

                        let resultText: string;

                        const builtinTool = findBuiltinTool(fc.name);
                        if (builtinTool) {
                            console.log(`[Builtin] Executing ${fc.name}...`);
                            resultText = await builtinTool.execute(fc.arguments as Record<string, unknown> || {});
                        } else {
                            const [serverName, toolName] = fc.name.split('__');
                            if (!serverName || !toolName) {
                                console.error(`[MCP] Invalid tool name format: ${fc.name}`);
                                resultText = `Error: Invalid tool name format: ${fc.name}`;
                            } else {
                                console.log(`[MCP] Executing ${toolName} on ${serverName}...`);
                                const toolResult = await mcpManager.callTool(serverName, toolName, fc.arguments);
                                console.log(`[MCP] Tool result:`, JSON.stringify(toolResult));
                                resultText = toolResult.content.map(c => c.text || '').join('\n');
                            }
                        }

                        messages.push({
                            role: 'tool',
                            content: resultText,
                        } as any);

                        res.write(JSON.stringify({ toolResult: { name: fc.name, result: resultText.slice(0, 200) } }) + '\n');
                    }

                    // Reset for next iteration
                    fullContent = '';
                    continue;
                }

                return fullContent;
            } else {
                throw new Error('No response body from Ollama API');
            }
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    return fullContent;
}

// ============================================
// OpenAI Handler with Tool Loop
// ============================================
async function handleOpenAIChat(
    provider: import('./types').LLMProvider,
    systemPrompt: string | undefined,
    context: import('./types').Message[] | undefined,
    message: string,
    mcpTools: McpTool[],
    builtinTools: BuiltinTool[],
    res: Response,
    setTokens: (prompt: number, completion: number) => void
): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    // Build conversation messages
    let messages: Array<{ role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string }> = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...formatContext(context).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
    ];

    console.log(`[OpenAI] Sending ${messages.length} messages to ${provider.model}`);

    let fullContent = '';
    const MAX_TOOL_ITERATIONS = 10;

    // Combine MCP tools and built-in tools for LLM
    const allTools = [
        ...toOllamaTools(mcpTools), // OpenAI uses same tool format as Ollama (standard JSON schema)
        ...builtinToOllamaTools(builtinTools)
    ];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        // o1 models generally don't support system messages or streaming in the same way (preview)
        const isO1 = provider.model.startsWith('o1');
        const requestBody: Record<string, unknown> = {
            model: provider.model,
            messages,
            stream: !isO1,
        };

        if (!isO1 && allTools.length > 0) {
            requestBody.tools = allTools;
            requestBody.tool_choice = 'auto';
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errText = await response.text();
            let errorMessage = errText;
            try {
                const errJson = JSON.parse(errText);
                errorMessage = errJson.error?.message || errText;
            } catch (e) { }
            throw new Error(`OpenAI Error (${response.status}): ${errorMessage}`);
        }

        // Handle Non-Streaming (e.g. o1)
        if (!requestBody.stream) {
            const data = await response.json() as any;
            const choice = data.choices?.[0];
            const content = choice?.message?.content || '';
            const toolCalls = choice?.message?.tool_calls;

            if (content) {
                fullContent += content;
                res.write(JSON.stringify({ content }) + '\n');
            }

            if (data.usage) {
                setTokens(data.usage.prompt_tokens, data.usage.completion_tokens);
            }

            if (toolCalls && toolCalls.length > 0) {
                messages.push(choice.message);

                for (const tc of toolCalls) {
                    const func = tc.function;
                    console.log(`[Tool] Tool call received (OpenAI Non-Stream): ${func.name}`);
                    res.write(JSON.stringify({ toolCall: { name: func.name, args: JSON.parse(func.arguments) } }) + '\n');

                    let resultText: string;
                    try {
                        const args = JSON.parse(func.arguments);
                        const builtinTool = findBuiltinTool(func.name);
                        if (builtinTool) {
                            resultText = await builtinTool.execute(args);
                        } else {
                            const [serverName, toolName] = func.name.split('__');
                            if (!serverName || !toolName) {
                                resultText = `Error: Invalid tool name format`;
                            } else {
                                const toolResult = await mcpManager.callTool(serverName, toolName, args);
                                resultText = toolResult.content.map(c => c.text || '').join('\n');
                            }
                        }
                    } catch (e: any) {
                        resultText = `Error execution tool: ${e.message}`;
                    }

                    res.write(JSON.stringify({ toolResult: { name: func.name, result: resultText.slice(0, 200) } }) + '\n');
                    messages.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: resultText
                    } as any);
                }
                continue; // Loop again with tool results
            }
            break; // Done if no tools
        }

        // Handle Streaming
        if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            let currentContent = '';
            let currentToolCalls: Map<number, { id: string; name: string; args: string }> = new Map();
            let insideThinking = false;
            let capturedThinking = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr.trim() === '[DONE]') continue;

                        try {
                            const json = JSON.parse(dataStr);
                            const delta = json.choices?.[0]?.delta;

                            if (json.usage) {
                                setTokens(json.usage.prompt_tokens, json.usage.completion_tokens);
                            }

                            if (delta) {
                                if (delta.content) {
                                    const text = delta.content;
                                    let textToProcess = text;

                                    // Parse <think> tags logic
                                    if (!insideThinking) {
                                        if (textToProcess.includes('<think>')) {
                                            const parts = textToProcess.split('<think>');
                                            if (parts[0]) {
                                                currentContent += parts[0];
                                                fullContent += parts[0];
                                                res.write(JSON.stringify({ content: parts[0] }) + '\n');
                                            }
                                            insideThinking = true;
                                            textToProcess = parts[1] || '';
                                        }
                                    }

                                    if (insideThinking) {
                                        if (textToProcess.includes('</think>')) {
                                            const parts = textToProcess.split('</think>');
                                            capturedThinking += parts[0];
                                            res.write(JSON.stringify({ thinking: parts[0] }) + '\n');
                                            res.write(JSON.stringify({ thinkingDone: true }) + '\n');
                                            insideThinking = false;
                                            if (parts[1]) {
                                                currentContent += parts[1];
                                                fullContent += parts[1];
                                                res.write(JSON.stringify({ content: parts[1] }) + '\n');
                                            }
                                        } else {
                                            capturedThinking += textToProcess;
                                            res.write(JSON.stringify({ thinking: textToProcess }) + '\n');
                                        }
                                    } else {
                                        if (textToProcess) {
                                            currentContent += textToProcess;
                                            fullContent += textToProcess;
                                            res.write(JSON.stringify({ content: textToProcess }) + '\n');
                                        }
                                    }
                                }

                                if (delta.tool_calls) {
                                    for (const tc of delta.tool_calls) {
                                        const index = tc.index;
                                        if (!currentToolCalls.has(index)) {
                                            currentToolCalls.set(index, { id: '', name: '', args: '' });
                                        }
                                        const current = currentToolCalls.get(index)!;
                                        if (tc.id) current.id = tc.id;
                                        if (tc.function?.name) current.name += tc.function.name;
                                        if (tc.function?.arguments) current.args += tc.function.arguments;
                                    }
                                }
                            }
                        } catch (e) {
                            // ignore parse error
                        }
                    }
                }
            }

            const finalToolCalls = Array.from(currentToolCalls.values());
            if (finalToolCalls.length > 0) {
                messages.push({
                    role: 'assistant',
                    content: currentContent || null,
                    tool_calls: finalToolCalls.map(ft => ({
                        id: ft.id,
                        type: 'function',
                        function: { name: ft.name, arguments: ft.args }
                    }))
                });

                for (const ft of finalToolCalls) {
                    console.log(`[Tool] Tool call received (OpenAI Stream): ${ft.name}`);
                    let args = {};
                    try { args = JSON.parse(ft.args); } catch (e) { console.error('JSON parse error for args', e); }

                    res.write(JSON.stringify({ toolCall: { name: ft.name, args } }) + '\n');

                    let resultText: string;
                    const builtinTool = findBuiltinTool(ft.name);
                    if (builtinTool) {
                        resultText = await builtinTool.execute(args as Record<string, unknown>);
                    } else {
                        const [serverName, toolName] = ft.name.split('__');
                        if (!serverName || !toolName) {
                            resultText = `Error: Invalid tool name format`;
                        } else {
                            try {
                                const toolResult = await mcpManager.callTool(serverName, toolName, args);
                                resultText = toolResult.content.map(c => c.text || '').join('\n');
                            } catch (e: any) {
                                resultText = `Error: ${e.message}`;
                            }
                        }
                    }

                    res.write(JSON.stringify({ toolResult: { name: ft.name, result: resultText.slice(0, 200) } }) + '\n');
                    messages.push({
                        role: 'tool',
                        tool_call_id: ft.id,
                        content: resultText
                    } as any);
                }
                continue;
            }
            break;
        }
    }

    return fullContent;
}

