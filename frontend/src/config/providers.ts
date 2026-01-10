import { LLMProvider, Persona } from '@/types';

// ===== CHARACTER PERSONAS (独立したキャラクター) =====
// ===== CHARACTER PERSONAS (独立したキャラクター) =====
// Note: Personas are now loaded asynchronously via usePersonas hook
// SYSTEM is the only static fallback required for initialization
export const SYSTEM_PERSONA_FALLBACK: Persona = {
    id: 'system',
    name: 'AI Assistant',
    codename: 'SYSTEM',
    frequency: '000.00',
    systemPrompt: '',
    portraitUrl: '',
    isBuiltIn: true,
};


// ===== 動的モデル取得用インターフェース =====
export interface ModelInfo {
    id: string;
    name: string;
    provider: 'ollama' | 'anthropic' | 'google' | 'openai';
    model: string;
    available: boolean;
}

export interface ProviderInfo {
    name: string;
    available: boolean;
    models: ModelInfo[];
}

export interface ModelsResponse {
    providers: {
        ollama: ProviderInfo;
        google: ProviderInfo;
        anthropic: ProviderInfo;
        openai: ProviderInfo;
    };
}

// ===== フォールバック用静的プロバイダー =====
export const FALLBACK_PROVIDERS: LLMProvider[] = [
    {
        id: 'ollama-gpt-oss',
        name: 'Ollama (GPT-OSS 20B)',
        endpoint: 'http://localhost:11434',
        type: 'ollama',
        model: 'gpt-oss:20b',
        apiKeyEnv: '',
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        endpoint: '/api/chat',
        type: 'google',
        model: 'gemini-2.5-flash',
        apiKeyEnv: 'GOOGLE_API_KEY',
    },
];

// Default selections
export const DEFAULT_PERSONA = SYSTEM_PERSONA_FALLBACK;
export const DEFAULT_LLM = FALLBACK_PROVIDERS[0];

// Backend URL for API access
// - Local dev (localhost:3000): Direct access to localhost:3001 for streaming
// - Docker/ngrok (other hosts): Relative path through Next.js rewrites
export const getBackendUrl = (): string => {
    if (typeof window === 'undefined') return ''; // SSR: use relative path
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:3001'; // Direct access for streaming
    }
    return ''; // Use Next.js rewrites for Docker/ngrok
};

// Legacy: For backwards compatibility (use getBackendUrl() instead)
export const BACKEND_URL = '';

// ===== 動的モデル取得関数 =====
export async function fetchAvailableModels(): Promise<ModelsResponse | null> {
    try {
        const response = await fetch(`${getBackendUrl()}/api/models`, {
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('[Models] Failed to fetch:', error);
        return null;
    }
}

// ModelInfoをLLMProviderに変換
export function modelToProvider(model: ModelInfo): LLMProvider {
    const typeMap: Record<string, 'ollama' | 'anthropic' | 'google' | 'openai'> = {
        ollama: 'ollama',
        anthropic: 'anthropic',
        google: 'google',
        openai: 'openai',
    };

    return {
        id: model.id,
        name: model.name,
        endpoint: model.provider === 'ollama'
            ? `http://${process.env.NEXT_PUBLIC_OLLAMA_HOST || 'localhost:11434'}`
            : '/api/chat',
        type: typeMap[model.provider] || 'custom',
        model: model.model,
        apiKeyEnv: model.provider === 'google' ? 'GOOGLE_API_KEY'
            : model.provider === 'anthropic' ? 'ANTHROPIC_API_KEY'
                : model.provider === 'openai' ? 'OPENAI_API_KEY'
                    : undefined,
    };
}

// Legacy exports for compatibility
export const LLM_PROVIDERS = FALLBACK_PROVIDERS;
export const DEFAULT_PROVIDERS = FALLBACK_PROVIDERS;
