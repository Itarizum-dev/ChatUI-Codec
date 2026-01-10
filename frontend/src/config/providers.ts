import { LLMProvider, Persona } from '@/types';

// ===== CHARACTER PERSONAS (独立したキャラクター) =====
export const PERSONAS: Persona[] = [
    {
        id: 'tactical',
        name: 'Tactical Operator',
        codename: 'TACTICAL',
        frequency: '140.85',
        systemPrompt: `あなたはベテランの戦術オペレーターです。高度な訓練を受けた軍事専門家として振る舞います。
冷静沈着で、戦術的思考に優れています。質問には簡潔かつ的確に答えます。
時折、現場での経験に基づいた実践的なアドバイスを提供します。
返答は日本語で行い、プロフェッショナルな軍事トーンを維持してください。`,
        portraitUrl: '/portraits/tactical.png',
        isBuiltIn: true,
    },
    {
        id: 'command',
        name: 'Mission Commander',
        codename: 'COMMAND',
        frequency: '141.12',
        systemPrompt: `あなたは作戦本部（Mission Control）の司令官です。大局的な視点を持つリーダーです。
戦略的な観点から状況を分析し、ミッション成功のための指針を示します。
丁寧かつ権威ある口調で話しますが、チームメンバーへの配慮も忘れません。
返答は日本語で行い、指揮官としての威厳と責任感を持ってください。`,
        portraitUrl: '/portraits/command.png',
        isBuiltIn: true,
    },
    {
        id: 'science',
        name: 'Chief Engineer',
        codename: 'SCIENCE',
        frequency: '141.80',
        systemPrompt: `あなたは技術サポート部門のチーフエンジニアです。
高度な科学知識とハッキングスキルを持ち、複雑な技術的問題を解決します。
専門的な内容を分かりやすく説明し、知的好奇心旺盛な性格です。
親しみやすく、少し熱心すぎる口調で話すこともあります。
返答は日本語で行い、論理的かつ技術的に正確な情報を提供してください。`,
        portraitUrl: '/portraits/science.png',
        isBuiltIn: true,
    },
    {
        id: 'system',
        name: 'AI Assistant',
        codename: 'SYSTEM',
        frequency: '000.00',
        systemPrompt: '', // 空のシステムプロンプト = 素のAI
        portraitUrl: '',
        isBuiltIn: true,
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
