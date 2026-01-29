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
    // オーケストレーション用拡張
    preferredLLM?: string;        // 将来: このペルソナ専用のLLM
    allowedSkills?: string[];     // 後方互換用（deprecated）
    allowedTools?: string[];      // 後方互換用（deprecated）
    isOrchestrator?: boolean;     // オーケストレーターとして動作
    isBuiltIn?: boolean;          // 組み込みキャラかどうか
    isUser?: boolean;             // ユーザー自身かどうか
    portraitData?: string;        // Base64画像データ（カスタムペルソナ用）
    // 新しい権限設定
    permissions?: PersonaPermissions;
}

// 権限設定の型
export interface PermissionSetting {
    mode: 'all' | 'allowlist' | 'none';
    list?: string[];
}

export interface PersonaPermissions {
    skills?: PermissionSetting;
    tools?: PermissionSetting;
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
    thinking?: string;  // Ollamaのthinkingモードで受信した推論過程
    thinkingCollapsed?: boolean; // UI用: 折りたたみ状態
    debugPayload?: DebugPayload; // デバッグモード用: LLMへのIN/OUT
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

// LLM Debug Payload (for debug mode)
export interface DebugPayload {
    request: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        systemPrompt?: string;
        tools?: unknown[];
        useMcp?: boolean;
        useThinking?: boolean;
    };
    responseEvents: Array<{
        type: string;
        data: unknown;
        timestamp: number;
        // サブエージェント用拡張
        agentId?: string;
    }>;
    meta: {
        tokens?: {
            prompt: number;
            completion: number;
            total: number;
        };
        latencyMs?: number;
        model?: string;
        toolCalls?: Array<{ name: string; success: boolean; input?: Record<string, unknown>; output?: string }>;
        injectedSkills?: Array<{ name: string; description: string }>;
    };
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
    useOrchestrator?: boolean;
    allowedSkills?: string[]; // ペルソナに許可されたスキル (空配列=スキルなし, undefined=全許可)
}

export interface ChatResponse {
    content: string;
    metadata?: MessageMetadata;
}
