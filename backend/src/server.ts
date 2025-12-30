import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path'; // Added path import
import { ChatRequest, ChatResponse, MessageMetadata } from './types';
import { DEFAULT_PROVIDERS, PERSONAS } from './config';
import { McpManager } from './mcp/McpManager'; // Changed import for McpManager class
import { SkillManager } from './skills/skillManager'; // Added SkillManager import
import { SkillCreator } from './skills/skillCreator'; // Added SkillCreator import
import { McpServerConfig, McpTool } from './mcp/types';
import { BUILTIN_TOOLS, findBuiltinTool, BuiltinTool, registerSkillCreator } from './tools/builtinTools';

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
// Skills API Endpoints
// ============================================

/** 全スキル一覧取得 */
app.get('/api/skills', async (req, res) => {
    try {
        const skills = await skillManager.getAvailableSkills();
        res.json({ skills });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/** 特定スキル詳細取得 */
app.get('/api/skills/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const skill = await skillManager.getSkill(name);
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

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const requestBody: Record<string, unknown> = {
            model: provider.model,
            max_tokens: 4096,
            system: systemPrompt || '',
            messages,
            stream: false, // Non-streaming for tool loop simplicity
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
                console.log(`[Tool] Tool call received: ${block.name}`, JSON.stringify(block.input));

                res.write(JSON.stringify({ toolCall: { name: block.name, args: block.input } }) + '\n');

                let resultText: string;

                // First, check if it's a built-in tool (no __ prefix)
                const builtinTool = findBuiltinTool(block.name || '');
                if (builtinTool) {
                    console.log(`[Builtin] Executing ${block.name}...`);
                    resultText = await builtinTool.execute(block.input as Record<string, unknown> || {});
                } else {
                    // MCP tool: parse serverName__toolName format
                    const [serverName, toolName] = (block.name || '').split('__');
                    if (!serverName || !toolName) {
                        console.error(`[MCP] Invalid tool name format: ${block.name}`);
                        resultText = `Error: Invalid tool name format: ${block.name}`;
                    } else {
                        console.log(`[MCP] Executing ${toolName} on ${serverName}...`);
                        const toolResult = await mcpManager.callTool(serverName, toolName, block.input || {});
                        console.log(`[MCP] Tool result:`, JSON.stringify(toolResult));
                        resultText = toolResult.content.map(c => c.text || '').join('\n');
                    }
                }

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

    let contents = [
        ...(systemPrompt ? [{ role: 'user', parts: [{ text: `System Instruction: ${systemPrompt}` }] }] : []),
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

        if (allDeclarations.length > 0) {
            requestBody.tools = [{ function_declarations: allDeclarations }];
        }

        // Use streaming endpoint
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:streamGenerateContent?key=${apiKey}&alt=sse`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

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
                                    fullContent += part.text;
                                    const payload = JSON.stringify({ content: part.text }) + '\n';
                                    res.write(payload);
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
            const response = await fetch(`${provider.endpoint}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

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
                            }
                        } catch (e) {
                            console.warn('[Ollama] Failed to parse streaming chunk:', line.slice(0, 100));
                        }
                    }
                }

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

