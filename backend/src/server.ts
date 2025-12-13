import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ChatRequest, ChatResponse, MessageMetadata } from './types';
import { DEFAULT_PROVIDERS } from './config';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'Codec Backend', version: '0.1.0' });
});

app.post('/api/chat', async (req: Request, res: Response) => {
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] Chat request received`);

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const body: ChatRequest = req.body;
        const { message, providerId, context, systemPrompt } = body;

        const provider = DEFAULT_PROVIDERS.find((p) => p.id === providerId);
        if (!provider) {
            res.write(JSON.stringify({ error: 'Provider not found' }) + '\n');
            res.end();
            return;
        }

        let fullContent = '';
        let promptTokens = 0;
        let completionTokens = 0;

        if (provider.type === 'ollama') {
            const response = await fetch(`${provider.endpoint}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: provider.model,
                    messages: [
                        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                        ...(context?.map((m) => ({ role: m.role, content: m.content })) || []),
                        { role: 'user', content: message },
                    ],
                    stream: true,
                }),
            });

            if (!response.ok || !response.body) throw new Error(`Ollama error: ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(Boolean);

                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        if (json.message?.content) {
                            const content = json.message.content;
                            fullContent += content;
                            res.write(JSON.stringify({ content }) + '\n');
                        }
                        if (json.done) {
                            promptTokens = json.prompt_eval_count || 0;
                            completionTokens = json.eval_count || 0;
                        }
                    } catch (e) {/* ignore partial json */ }
                }
            }

        } else if (provider.type === 'anthropic') {
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: provider.model,
                    max_tokens: 4096,
                    system: systemPrompt || '',
                    messages: [
                        ...(context?.map((m) => ({ role: m.role, content: m.content })) || []),
                        { role: 'user', content: message },
                    ],
                    stream: true,
                }),
            });

            if (!response.ok || !response.body) {
                const errText = await response.text();
                throw new Error(`Claude error: ${response.status} - ${errText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') continue;
                        try {
                            const event = JSON.parse(dataStr);
                            if (event.type === 'content_block_delta' && event.delta?.text) {
                                const content = event.delta.text;
                                fullContent += content;
                                res.write(JSON.stringify({ content }) + '\n');
                            }
                            if (event.type === 'message_start') {
                                promptTokens = event.message?.usage?.input_tokens || 0;
                            }
                            if (event.type === 'message_delta') {
                                completionTokens = event.usage?.output_tokens || 0;
                            }
                        } catch (e) { }
                    }
                }
            }

        } else if (provider.type === 'google') {
            const apiKey = process.env.GOOGLE_API_KEY;
            if (!apiKey) throw new Error('GOOGLE_API_KEY not configured');

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:streamGenerateContent?key=${apiKey}&alt=sse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        ...(systemPrompt ? [{ role: 'user', parts: [{ text: `System Instruction: ${systemPrompt}` }] }] : []),
                        ...(context?.map((m) => ({
                            role: m.role === 'assistant' ? 'model' : 'user',
                            parts: [{ text: m.content }]
                        })) || []),
                        { role: 'user', parts: [{ text: message }] },
                    ],
                    generationConfig: { maxOutputTokens: 4096 }
                }),
            });

            if (!response.ok || !response.body) {
                const errText = await response.text();
                throw new Error(`Gemini error: ${response.status} - ${errText}`);
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
                    if (line.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(line.slice(6));
                            const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (text) {
                                fullContent += text;
                                res.write(JSON.stringify({ content: text }) + '\n');
                            }
                            if (json.usageMetadata) {
                                promptTokens = json.usageMetadata.promptTokenCount || 0;
                                completionTokens = json.usageMetadata.candidatesTokenCount || 0;
                            }
                        } catch (e) { }
                    }
                }
            }
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
        const err = error as Error;
        console.error('Chat API Error:', error);
        // If headers not sent, send JSON error. If sent, write error chunk.
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        } else {
            res.write(JSON.stringify({ error: err.message }) + '\n');
            res.end();
        }
    }
});

app.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
});
