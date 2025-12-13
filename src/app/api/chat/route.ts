import { NextRequest, NextResponse } from 'next/server';
import { ChatRequest, ChatResponse, MessageMetadata } from '@/types';
import { DEFAULT_PROVIDERS } from '@/config/providers';

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    try {
        const body: ChatRequest = await request.json();
        const { message, providerId, context, systemPrompt } = body;

        // Find provider
        const provider = DEFAULT_PROVIDERS.find((p) => p.id === providerId);
        if (!provider) {
            return NextResponse.json(
                { error: 'Provider not found' },
                { status: 400 }
            );
        }

        let responseContent = '';
        let metadata: MessageMetadata = {};

        if (provider.type === 'ollama') {
            // Ollama API
            const ollamaResponse = await fetch(`${provider.endpoint}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: provider.model,
                    messages: [
                        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                        ...(context?.map((m) => ({ role: m.role, content: m.content })) || []),
                        { role: 'user', content: message },
                    ],
                    stream: false,
                }),
            });

            if (!ollamaResponse.ok) {
                throw new Error(`Ollama error: ${ollamaResponse.status}`);
            }

            const ollamaData = await ollamaResponse.json();
            responseContent = ollamaData.message?.content || '';
            metadata = {
                model: provider.model,
                tokens: {
                    prompt: ollamaData.prompt_eval_count || 0,
                    completion: ollamaData.eval_count || 0,
                    total: (ollamaData.prompt_eval_count || 0) + (ollamaData.eval_count || 0),
                },
                latencyMs: Date.now() - startTime,
            };
        } else if (provider.type === 'anthropic') {
            // Anthropic Claude API - requires ANTHROPIC_API_KEY env var
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) {
                return NextResponse.json(
                    { error: 'ANTHROPIC_API_KEY not configured' },
                    { status: 500 }
                );
            }

            const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
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
                }),
            });

            if (!claudeResponse.ok) {
                const errText = await claudeResponse.text();
                throw new Error(`Claude error: ${claudeResponse.status} - ${errText}`);
            }

            const claudeData = await claudeResponse.json();
            responseContent = claudeData.content?.[0]?.text || '';
            metadata = {
                model: provider.model,
                tokens: {
                    prompt: claudeData.usage?.input_tokens || 0,
                    completion: claudeData.usage?.output_tokens || 0,
                    total: (claudeData.usage?.input_tokens || 0) + (claudeData.usage?.output_tokens || 0),
                },
                latencyMs: Date.now() - startTime,
            };
        } else if (provider.type === 'google') {
            // Google Gemini API - requires GOOGLE_API_KEY env var
            const apiKey = process.env.GOOGLE_API_KEY;
            if (!apiKey) {
                return NextResponse.json(
                    { error: 'GOOGLE_API_KEY not configured' },
                    { status: 500 }
                );
            }

            const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        ...(systemPrompt ? [{ role: 'user', parts: [{ text: `System Instruction: ${systemPrompt}` }] }] : []),
                        ...(context?.map((m) => ({
                            role: m.role === 'assistant' ? 'model' : 'user',
                            parts: [{ text: m.content }]
                        })) || []),
                        { role: 'user', parts: [{ text: message }] },
                    ],
                    generationConfig: {
                        maxOutputTokens: 4096,
                    }
                }),
            });

            if (!geminiResponse.ok) {
                const errText = await geminiResponse.text();
                throw new Error(`Gemini error: ${geminiResponse.status} - ${errText}`);
            }

            const geminiData = await geminiResponse.json();
            responseContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Gemini doesn't always return token counts in the standard response, checking usageMetadata
            const usage = geminiData.usageMetadata;
            metadata = {
                model: provider.model,
                tokens: {
                    prompt: usage?.promptTokenCount || 0,
                    completion: usage?.candidatesTokenCount || 0,
                    total: usage?.totalTokenCount || 0,
                },
                latencyMs: Date.now() - startTime,
            };
        } else {
            return NextResponse.json(
                { error: `Provider type '${provider.type}' not implemented` },
                { status: 501 }
            );
        }

        const response: ChatResponse = {
            content: responseContent,
            metadata,
        };

        return NextResponse.json(response);
    } catch (error) {
        console.error('Chat API Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
