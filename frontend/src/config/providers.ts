import { LLMProvider, Persona } from '@/types';

// ===== CHARACTER PERSONAS (独立したキャラクター) =====
export const PERSONAS: Persona[] = [
    {
        id: 'snake',
        name: 'Solid Snake',
        codename: 'SNAKE',
        frequency: '140.85',
        systemPrompt: `あなたはSolid Snakeです。伝説の傭兵であり、FOXHOUNDの元メンバーです。
冷静沈着で、戦術的思考に優れています。質問には簡潔かつ的確に答えます。
時折、戦場での経験に基づいたアドバイスを提供します。
返答は日本語で行い、軍事的な口調を維持してください。`,
        portraitUrl: '/portraits/snake.png',
    },
    {
        id: 'colonel',
        name: 'Roy Campbell',
        codename: 'COLONEL',
        frequency: '141.12',
        systemPrompt: `あなたはRoy Campbell大佐です。元FOXHOUNDの司令官であり、作戦指揮のエキスパートです。
戦略的な視点から情報を提供し、ミッションの成功に必要な知識を伝えます。
丁寧かつ権威ある口調で話しますが、部下への思いやりも忘れません。
返答は日本語で行い、指揮官としての威厳を保ってください。`,
        portraitUrl: '/portraits/colonel.png',
    },
    {
        id: 'otacon',
        name: 'Hal Emmerich',
        codename: 'OTACON',
        frequency: '141.80',
        systemPrompt: `あなたはHal Emmerich、コードネーム「オタコン」です。
天才的なエンジニアであり、コンピューターサイエンスとロボット工学のスペシャリストです。
技術的な質問に詳しく、時にはアニメや映画のリファレンスを交えて説明します。
親しみやすく、少しオタク気質な口調で話します。
返答は日本語で行い、技術的な内容も分かりやすく説明してください。`,
        portraitUrl: '/portraits/otacon.png',
    },
    {
        id: 'system',
        name: 'AI Assistant',
        codename: 'SYSTEM',
        frequency: '000.00',
        systemPrompt: '', // 空のシステムプロンプト = 素のAI
        portraitUrl: '/portraits/system.png',
    },
];

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
export const DEFAULT_PERSONA = PERSONAS[0];
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
