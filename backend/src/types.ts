// Mirrored from frontend types
export interface LLMProvider {
    id: string;
    name: string;
    endpoint: string;
    type: 'ollama' | 'anthropic' | 'openai' | 'google' | 'custom';
    model: string;
    apiKeyEnv?: string;
}

export interface Persona {
    id: string;
    name: string;
    codename: string;
    frequency: string;
    systemPrompt: string;
    portraitUrl?: string;
    // オーケストレーション用拡張
    preferredLLM?: string;
    allowedSkills?: string[];
    allowedTools?: string[];
    isOrchestrator?: boolean;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    providerId?: string;
    personaId?: string;
    metadata?: MessageMetadata;
    thinking?: string;
    thinkingCollapsed?: boolean;
}

export interface MessageMetadata {
    tokens?: {
        prompt: number;
        completion: number;
        total: number;
    };
    latencyMs?: number;
    model?: string;
}

export interface ChatRequest {
    message: string;
    providerId: string;
    personaId?: string;
    context?: Message[];
    systemPrompt?: string;
    useMcp?: boolean;
    useThinking?: boolean; // Ollamaのthinkingモード有効化
    useOrchestrator?: boolean; // オーケストレーターモード有効化
}

export interface ChatResponse {
    content: string;
    metadata?: MessageMetadata;
}
