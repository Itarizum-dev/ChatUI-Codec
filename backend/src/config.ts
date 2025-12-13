import { LLMProvider, Persona } from './types';

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
    },
];

export const LLM_PROVIDERS: LLMProvider[] = [
    {
        id: 'ollama-llama',
        name: 'Llama 3.2',
        endpoint: 'http://host.docker.internal:11434',
        type: 'ollama',
        model: 'llama3.2',
    },
    {
        id: 'ollama-gpt-oss',
        name: 'GPT-OSS 20B',
        endpoint: 'http://host.docker.internal:11434',
        type: 'ollama',
        model: 'gpt-oss:20b',
    },
    {
        id: 'ollama-codestral',
        name: 'Codestral',
        endpoint: 'http://host.docker.internal:11434',
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
