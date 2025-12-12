// LLM Provider Configuration
export interface LLMProvider {
    id: string;
    name: string;
    frequency: string;
    endpoint: string;
    type: 'ollama' | 'anthropic' | 'openai' | 'custom';
    model?: string;
    persona?: Persona;
}

// Character Persona
export interface Persona {
    id: string;
    name: string;
    codename: string;
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
    error: string | null;
}

// API Request/Response
export interface ChatRequest {
    message: string;
    providerId: string;
    context?: Message[];
    systemPrompt?: string;
}

export interface ChatResponse {
    content: string;
    metadata?: MessageMetadata;
}
