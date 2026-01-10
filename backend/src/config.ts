import { LLMProvider, Persona } from './types';

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
    },
    {
        id: 'system',
        name: 'AI Assistant',
        codename: 'SYSTEM',
        frequency: '000.00',
        systemPrompt: '', // 空のシステムプロンプト = 素のAI
    },
];

export const LLM_PROVIDERS: LLMProvider[] = [
    {
        id: 'ollama-llama',
        name: 'Llama 3.2',
        endpoint: `http://${process.env.OLLAMA_HOST || 'localhost:11434'}`,
        type: 'ollama',
        model: 'llama3.2',
    },
    {
        id: 'ollama-gpt-oss',
        name: 'GPT-OSS 20B',
        endpoint: `http://${process.env.OLLAMA_HOST || 'localhost:11434'}`,
        type: 'ollama',
        model: 'gpt-oss:20b',
    },
    {
        id: 'ollama-codestral',
        name: 'Codestral',
        endpoint: `http://${process.env.OLLAMA_HOST || 'localhost:11434'}`,
        type: 'ollama',
        model: 'codestral',
    },
    {
        id: 'claude-sonnet',
        name: 'Claude Sonnet',
        endpoint: 'https://api.anthropic.com/v1/messages', // Direct API URL since backend makes the call
        type: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        apiKeyEnv: 'ANTHROPIC_API_KEY',
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
        type: 'google',
        model: 'gemini-2.5-flash',
        apiKeyEnv: 'GOOGLE_API_KEY',
    },
];

export const DEFAULT_PROVIDERS = LLM_PROVIDERS;
