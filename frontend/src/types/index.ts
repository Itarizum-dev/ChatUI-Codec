// LLM Provider Configuration (separate from persona)
export interface LLMProvider {
    id: string;
    name: string;
    endpoint: string;
    type: 'ollama' | 'anthropic' | 'openai' | 'google' | 'custom';
    model: string;
    apiKeyEnv?: string; // environment variable name for API key
}

// Character Persona (separate from LLM)
export interface Persona {
    id: string;
    name: string;
    codename: string;
    frequency: string;
    systemPrompt: string;
    portraitUrl?: string;
}

// Chat Message
export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    providerId?: string;
    personaId?: string;
    metadata?: MessageMetadata;
}

// Debug/Performance Metadata
export interface MessageMetadata {
    tokens?: {
        prompt: number;
        completion: number;
        total: number;
    };
    latencyMs?: number;
    model?: string;
}

// Chat State
export interface ChatState {
    messages: Message[];
    isLoading: boolean;
    currentProvider: LLMProvider | null;
    currentPersona: Persona | null;
    error: string | null;
}

// API Request/Response
export interface ChatRequest {
    message: string;
    providerId: string;
    personaId?: string;
    context?: Message[];
    systemPrompt?: string;
}

export interface ChatResponse {
    content: string;
    metadata?: MessageMetadata;
}
