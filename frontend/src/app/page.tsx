"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./page.module.css";
import { Message, LLMProvider, Persona } from "@/types";
import { PERSONAS, DEFAULT_PERSONA, DEFAULT_LLM, BACKEND_URL, fetchAvailableModels, modelToProvider, ModelsResponse, FALLBACK_PROVIDERS } from "@/config/providers";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import McpSettingsModal from '@/components/McpSettingsModal';
import { CodeBlock } from '@/components/CodeBlock';
import { useCodecSound } from '@/hooks/useCodecSound';
import SkillList from '@/components/skills/SkillList';
import SkillDetailModal from '@/components/skills/SkillDetailModal';

export default function CodecPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'contacts' | 'skills'>('contacts');
    const [viewingSkill, setViewingSkill] = useState<string | null>(null);
    const [currentPersona, setCurrentPersona] = useState<Persona>(DEFAULT_PERSONA);
    const [currentLLM, setCurrentLLM] = useState<LLMProvider>(DEFAULT_LLM);
    // Modal for LLM only now
    const [showSelector, setShowSelector] = useState(false);
    const [selectedService, setSelectedService] = useState<string | null>(null);

    // MCP state
    const [useMcp, setUseMcp] = useState(false);
    const [showMcpSettings, setShowMcpSettings] = useState(false);
    const [toolStatus, setToolStatus] = useState<string | null>(null);

    // Thinking mode state (Ollama only)
    const [useThinking, setUseThinking] = useState(false);
    const [thinkingError, setThinkingError] = useState<string | null>(null);

    // Sound
    const { playTypeSound, playCallSound, toggleMute } = useCodecSound();
    const [isMuted, setIsMuted] = useState(false);

    const handleMuteToggle = () => {
        const newState = !isMuted;
        setIsMuted(newState);
        toggleMute(newState);
    };
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Dynamic model state
    const [modelsData, setModelsData] = useState<ModelsResponse | null>(null);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [availableProviders, setAvailableProviders] = useState<LLMProvider[]>(FALLBACK_PROVIDERS);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Fetch available models on mount and when modal opens
    const refreshModels = useCallback(async () => {
        setModelsLoading(true);
        const data = await fetchAvailableModels();
        if (data) {
            setModelsData(data);
            // Convert all models to LLMProvider format
            const allModels: LLMProvider[] = [];
            Object.values(data.providers).forEach(provider => {
                if (provider.available) {
                    provider.models.forEach(m => {
                        allModels.push(modelToProvider(m));
                    });
                }
            });
            setAvailableProviders(allModels.length > 0 ? allModels : FALLBACK_PROVIDERS);
        }
        setModelsLoading(false);
    }, []);

    useEffect(() => {
        refreshModels();
    }, [refreshModels]);

    // History persistence
    useEffect(() => {
        const saved = localStorage.getItem('codec-history');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const restored = parsed.map((m: any) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                }));
                setMessages(restored);
            } catch (e) {
                console.error("Failed to load history", e);
            }
        }
        // Play Open Sound on load (interaction required usually, but try)
        // playOpenSound(); 
    }, []);

    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('codec-history', JSON.stringify(messages));
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        // Command: Clear history
        if (input.trim() === '/clear') {
            setMessages([]);
            localStorage.removeItem('codec-history');
            setInput("");
            playTypeSound();
            return;
        }

        // Command: Help
        if (input.trim() === '/help') {
            const helpContent = "**Available Commands**\n\n- `/help`: Show this help message\n- `/clear`: Clear conversation history";

            const helpMessage: Message = {
                id: crypto.randomUUID(),
                role: 'system',
                content: helpContent,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, helpMessage]);
            setInput("");
            playTypeSound();
            return;
        }

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const assistantMessageId = crypto.randomUUID();
        // Initial empty assistant message
        setMessages((prev) => [
            ...prev,
            {
                id: assistantMessageId,
                role: "assistant",
                content: "",
                timestamp: new Date(),
                providerId: currentLLM.id,
                personaId: currentPersona.id,
                thinking: "",
                thinkingCollapsed: false,
            },
        ]);

        // Clear previous thinking error
        setThinkingError(null);

        // Connection Timeout Logic - 30s to allow for model loading (especially Ollama)
        const CONNECTION_TIMEOUT = 30000;
        const timeoutId = setTimeout(() => {
            console.warn("Backend connection timed out");
            controller.abort("timeout");
        }, CONNECTION_TIMEOUT);

        try {
            const response = await fetch(`${BACKEND_URL}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage.content,
                    providerId: currentLLM.id,
                    personaId: currentPersona.id,
                    context: messages.slice(-10),
                    systemPrompt: currentPersona.systemPrompt,
                    useMcp: useMcp,
                    useThinking: useThinking && currentLLM.type === 'ollama',
                }),
                signal: controller.signal,
            });

            // Connection established, clear timeout
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Transmission failed");
            }
            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = "";
            let accumulatedThinking = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(Boolean);

                // Play typing sound on data receive
                playTypeSound();

                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        console.log('[Frontend] Received:', JSON.stringify(json).slice(0, 100));

                        // Ignore ping messages
                        if (json.type === 'ping') continue;

                        if (json.error) throw new Error(json.error);

                        // Handle tool calls
                        if (json.toolCall) {
                            setToolStatus(`🔧 Calling: ${json.toolCall.name}`);
                            continue;
                        }
                        if (json.toolResult) {
                            setToolStatus(`✓ ${json.toolResult.name} done`);
                            continue;
                        }
                        if (json.warning) {
                            console.warn('MCP Warning:', json.warning);
                            continue;
                        }

                        // Handle thinking mode (Ollama)
                        if (json.thinking) {
                            accumulatedThinking += json.thinking;
                        }
                        if (json.thinkingError) {
                            setThinkingError(json.thinkingError);
                        }
                        if (json.content) {
                            setToolStatus(null);
                            accumulatedContent += json.content;
                            console.log('[Frontend] Accumulated content:', accumulatedContent);
                        }

                        // Single state update for all message fields
                        const hasThinkingUpdate = json.thinking || json.thinkingDone;
                        const hasContentUpdate = json.content;

                        if (hasThinkingUpdate || hasContentUpdate) {
                            setMessages((prev) =>
                                prev.map((msg) =>
                                    msg.id === assistantMessageId
                                        ? {
                                            ...msg,
                                            thinking: accumulatedThinking || msg.thinking,
                                            content: accumulatedContent || msg.content,
                                            thinkingCollapsed: json.thinkingDone ? true : msg.thinkingCollapsed,
                                        }
                                        : msg
                                )
                            );
                        }

                        if (json.metadata) {
                            setMessages((prev) =>
                                prev.map((msg) =>
                                    msg.id === assistantMessageId
                                        ? { ...msg, metadata: json.metadata }
                                        : msg
                                )
                            );
                        }
                    } catch (e) {
                        console.warn("Failed to parse chunk:", line);
                    }
                }
            }

        } catch (error) {
            // Ensure timeout is cleared if fetch failed immediately
            clearTimeout(timeoutId);

            console.error("CODEC Error Details:", error);
            const _err = error as any; // Cast to any to access custom properties/messages easily
            const errMessage = _err.message || _err.toString();

            let errorContent = "// TRANSMISSION ERROR //";
            const isNetworkError =
                _err.name === 'TypeError' ||
                errMessage.includes('fetch') ||
                errMessage.includes('Network request failed') ||
                errMessage.includes('Failed to fetch') ||
                errMessage.includes('Load failed');

            if (_err === 'timeout' || (_err.name === 'AbortError' && abortControllerRef.current?.signal.aborted && abortControllerRef.current.signal.reason === 'timeout')) {
                errorContent = "// ENCRYPTION MODULE OFFLINE - TIMEOUT //";
            } else if (_err.name === 'AbortError') {
                errorContent = "// CANCELED //";
            } else if (isNetworkError) {
                errorContent = "// ENCRYPTION MODULE OFFLINE - CHECK BACKEND //";
            } else {
                errorContent = `// ERROR: ${errMessage} //`;
            }

            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === assistantMessageId
                        ? { ...msg, content: msg.content ? msg.content + "\n" + errorContent : errorContent }
                        : msg
                )
            );
        } finally {
            setIsLoading(false);
            setToolStatus(null);
            abortControllerRef.current = null;
        }
    };

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();
            handleSend();
        }
    };

    const handleHelpClick = () => {
        setInput('/help');
        inputRef.current?.focus();
    };

    // Calculate total tokens for the session
    const totalTokens = messages.reduce((acc, msg) => {
        return acc + (msg.metadata?.tokens?.total || 0);
    }, 0);

    const getLastMessageMetadata = () => {
        const lastAssistant = [...messages]
            .reverse()
            .find((m) => m.role === "assistant" && m.metadata);
        return lastAssistant?.metadata;
    };

    return (
        <>
            <div className={styles.codecContainer}>
                {/* Header */}
                <header className={styles.codecHeader}>
                    <span className={styles.codecMainTitle}>CODEC</span>
                    <div className={styles.frequencyContainer}>
                        <span className={styles.frequencyValue}>
                            {currentPersona.frequency}
                        </span>
                        <span className={styles.frequencyLabel}>MHz</span>
                        <button
                            className={`${styles.mcpToggle} ${useMcp ? styles.active : ''}`}
                            onClick={() => setUseMcp(!useMcp)}
                            title={useMcp ? 'MCP Enabled' : 'MCP Disabled'}
                        >
                            MCP {useMcp ? 'ON' : 'OFF'}
                        </button>
                        <button
                            className={`${styles.mcpToggle} ${useThinking ? styles.active : ''}`}
                            onClick={() => setUseThinking(!useThinking)}
                            title={useThinking ? 'Thinking Mode Enabled (Ollama only)' : 'Thinking Mode Disabled'}
                            style={{ marginLeft: '4px' }}
                        >
                            🧠 {useThinking ? 'ON' : 'OFF'}
                        </button>
                        <button
                            className={styles.mcpSettingsBtn}
                            onClick={() => setShowMcpSettings(true)}
                            title="MCP Settings"
                        >
                            ⚙
                        </button>
                        <button
                            className={styles.frequencyButton}
                            onClick={() => {
                                setShowSelector(true);
                                setSelectedService(null);
                            }}
                        >
                            LLM CONFIG
                        </button>
                    </div>
                    <span className={styles.codecTitle}>
                        {currentPersona.codename}
                    </span>
                </header>

                {/* Left Panel - ME Portrait */}
                <aside className={styles.codecPortraitPanel}>
                    <div className={styles.portraitFrame}>
                        <img
                            src="/portraits/soldier_me.png"
                            alt="Me"
                            className={styles.portraitImageRaw}
                        />
                    </div>
                    <div className={styles.portraitName}>ME</div>
                    <div className={styles.portraitStatus}>SOLDIER</div>

                    {/* Decorative Filler: Audio Visualizer & Status */}
                    <div className={styles.panelFiller}>
                        <div className={styles.audioVisualizer}>
                            <div className={styles.bar}></div>
                            <div className={styles.bar}></div>
                            <div className={styles.bar}></div>
                            <div className={styles.bar}></div>
                            <div className={styles.bar}></div>
                        </div>
                        <div className={styles.systemData}>
                            <div className={styles.dataRow}>
                                <span>ENCRYPTION</span>
                                <span>ON</span>
                            </div>
                            <div className={styles.dataRow}>
                                <span>MUTE</span>
                                <span
                                    onClick={handleMuteToggle}
                                    style={{
                                        cursor: 'pointer',
                                        color: isMuted ? 'var(--codec-green-bright)' : 'var(--codec-green-dark)',
                                        fontWeight: isMuted ? 'bold' : 'normal',
                                        textDecoration: 'underline'
                                    }}
                                    title="Toggle Sound"
                                >
                                    {isMuted ? 'ON' : 'OFF'}
                                </span>
                            </div>
                            <div className={styles.dataRow}>
                                <span>SIGNAL</span>
                                <span>100%</span>
                            </div>
                            <div className={styles.dataRow}>
                                <span>CMD LIST</span>
                                <span
                                    onClick={handleHelpClick}
                                    style={{
                                        cursor: 'pointer',
                                        color: 'var(--codec-green-dark)',
                                        textDecoration: 'underline'
                                    }}
                                    className={styles.clickableValue}
                                    title="Insert /help"
                                >
                                    /HELP
                                </span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Center - Chat Area */}
                <main className={styles.codecChatPanel}>
                    <div className={styles.chatMessages}>
                        {messages.length === 0 && (
                            <div className={styles.message}>
                                <span className={styles.messageSender}>SYSTEM</span>
                                <span className={styles.messageContent}>
                                    {"// CODEC ONLINE - Ready for transmission //"} <br />
                                    {"// Type /help for command list //"}
                                </span>
                            </div>
                        )}
                        {messages.map((msg) => {
                            console.log('[Render] Message:', msg.role, 'content length:', msg.content?.length, 'content:', msg.content?.slice(0, 30));
                            const isUser = msg.role === 'user';
                            const isSystem = msg.role === 'system';
                            const persona = !isUser && !isSystem
                                ? (PERSONAS.find(p => p.id === msg.personaId) || currentPersona)
                                : null;
                            const iconSrc = isUser
                                ? "/portraits/soldier_me.png"
                                : (persona?.portraitUrl || null);
                            const iconAlt = isUser ? "ME" : isSystem ? "SYS" : (persona?.codename || "Unknown");

                            // Toggle thinking panel collapse
                            const toggleThinkingCollapse = () => {
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === msg.id
                                            ? { ...m, thinkingCollapsed: !m.thinkingCollapsed }
                                            : m
                                    )
                                );
                            };

                            return (
                                <div key={msg.id} className={`${styles.messageRow} ${isUser ? styles.user : styles.assistant}`}>
                                    <div className={styles.messageIcon}>
                                        {iconSrc ? (
                                            <img src={iconSrc} alt={iconAlt} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--codec-green-mid)' }}>
                                                {iconAlt[0]}
                                            </div>
                                        )}
                                    </div>
                                    <div className={`${styles.message} ${isUser ? styles.user : styles.assistant}`}>
                                        <span className={styles.messageSender}>
                                            {isUser ? "ME" : isSystem ? "SYSTEM" : persona?.codename}
                                        </span>

                                        {/* Thinking Panel */}
                                        {!isUser && msg.thinking && (
                                            <div className={styles.thinkingPanel}>
                                                <div
                                                    className={styles.thinkingHeader}
                                                    onClick={toggleThinkingCollapse}
                                                >
                                                    <span>🧠 {msg.thinkingCollapsed ? '思考過程を表示' : '思考中...'}</span>
                                                    <span className={styles.thinkingToggle}>
                                                        {msg.thinkingCollapsed ? '▶' : '▼'}
                                                    </span>
                                                </div>
                                                {!msg.thinkingCollapsed && (
                                                    <div className={styles.thinkingContent}>
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                            {msg.thinking}
                                                        </ReactMarkdown>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Thinking Error */}
                                        {!isUser && thinkingError && messages.indexOf(msg) === messages.length - 1 && (
                                            <div className={styles.thinkingError}>
                                                ⚠️ {thinkingError}
                                            </div>
                                        )}

                                        <div className={`${styles.messageContent} markdown-content`}>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    code({ node, inline, className, children, ...props }: any) {
                                                        const match = /language-(\w+)/.exec(className || '')
                                                        return !inline && match ? (
                                                            <CodeBlock
                                                                language={match[1]}
                                                                value={String(children).replace(/\n$/, '')}
                                                            />
                                                        ) : (
                                                            <code className={className} {...props}>
                                                                {children}
                                                            </code>
                                                        )
                                                    }
                                                }}
                                            >
                                                {/* Escape square brackets to prevent Markdown link parsing issues */}
                                                {(msg.content || (isLoading && msg.role === 'assistant' && messages.indexOf(msg) === messages.length - 1 ? "// RECEIVING TRANSMISSION... //" : ""))
                                                    .replace(/\[/g, '\\[').replace(/\]/g, '\\]')}
                                            </ReactMarkdown>
                                            {isLoading && msg.role === 'assistant' && messages.indexOf(msg) === messages.length - 1 && (
                                                <span className={styles.cursorBlock}></span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {isLoading && (
                            <div className={styles.loadingIndicator}>
                                {toolStatus ? (
                                    <span className={styles.toolStatus}>{toolStatus}</span>
                                ) : (
                                    <>
                                        <span className={styles.loadingDot}></span>
                                        <span className={styles.loadingDot}></span>
                                        <span className={styles.loadingDot}></span>
                                    </>
                                )}
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className={styles.chatInputArea}>
                        <input
                            ref={inputRef}
                            type="text"
                            className={styles.chatInput}
                            placeholder="Enter message... (Type /help)"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                        />
                        {isLoading ? (
                            <button
                                className="cancel-button"
                                onClick={handleCancel}
                            >
                                CANCEL
                            </button>
                        ) : (
                            <button
                                className={styles.sendButton}
                                onClick={handleSend}
                                disabled={!input.trim()}
                            >
                                SEND
                            </button>
                        )}
                    </div>
                </main>

                {/* Right Panel - Character List & Token Info */}
                <aside className={styles.codecContactPanel}>
                    <div className={styles.contactListTitle}>
                        <span
                            style={{
                                cursor: 'pointer',
                                color: activeTab === 'contacts' ? 'var(--codec-green-bright)' : 'var(--codec-green-dark)',
                                opacity: activeTab === 'contacts' ? 1 : 0.7,
                                marginRight: '8px',
                                textShadow: activeTab === 'contacts' ? '0 0 8px rgba(0, 255, 65, 0.4)' : 'none'
                            }}
                            onClick={() => setActiveTab('contacts')}
                        >
                            CONTACTS
                        </span>
                        /
                        <span
                            style={{
                                cursor: 'pointer',
                                color: activeTab === 'skills' ? 'var(--codec-green-bright)' : 'var(--codec-green-dark)',
                                opacity: activeTab === 'skills' ? 1 : 0.7,
                                marginLeft: '8px',
                                textShadow: activeTab === 'skills' ? '0 0 8px rgba(0, 255, 65, 0.4)' : 'none'
                            }}
                            onClick={() => setActiveTab('skills')}
                        >
                            SKILLS
                        </span>
                    </div>

                    {activeTab === 'contacts' ? (
                        PERSONAS.map((persona) => (
                            <div
                                key={persona.id}
                                className={`${styles.contactItem} ${currentPersona.id === persona.id ? styles.active : ''}`}
                                onClick={() => setCurrentPersona(persona)}
                            >
                                <div className={styles.contactIcon}>
                                    {persona.portraitUrl ? (
                                        <img src={persona.portraitUrl} alt={persona.codename} />
                                    ) : (
                                        persona.codename[0]
                                    )}
                                </div>
                                <div className={styles.contactInfoMini}>
                                    <div className={styles.contactName}>{persona.codename}</div>
                                    <div className={styles.contactFreq}>{persona.frequency}</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <SkillList onSelectSkill={setViewingSkill} />
                    )}

                    <div className={styles.panelFooter}>
                        <div className={styles.debugPanel}>
                            <div className={styles.debugRow}>
                                <span className={styles.debugLabel}>LLM</span>
                                <span className={styles.debugValue}>{currentLLM.name}</span>
                            </div>
                            <div className={styles.debugRow}>
                                <span className={styles.debugLabel}>Model</span>
                                <span className={styles.debugValue}>
                                    {currentLLM.model.slice(0, 12)}
                                </span>
                            </div>
                            {getLastMessageMetadata()?.latencyMs && (
                                <div className={styles.debugRow}>
                                    <span className={styles.debugLabel}>Latency</span>
                                    <span className={styles.debugValue}>
                                        {getLastMessageMetadata()?.latencyMs}ms
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className={styles.tokenCounter}>
                            TOKENS: <span className={styles.tokenValue}>{totalTokens}</span>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Config Modal - LLM Selection Only */}
            {showSelector && (
                <div className={styles.modalOverlay} onClick={() => setShowSelector(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <span className={styles.modalTitle}>Encryption Module</span>
                            <button
                                className={styles.modalClose}
                                onClick={() => setShowSelector(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            {modelsLoading ? (
                                <div className={styles.providerList}>
                                    <div className={styles.loadingIndicator}>
                                        <span className={styles.loadingDot}></span>
                                        <span className={styles.loadingDot}></span>
                                        <span className={styles.loadingDot}></span>
                                        <span style={{ marginLeft: 10 }}>Loading models...</span>
                                    </div>
                                </div>
                            ) : !selectedService ? (
                                <div className={styles.providerList}>
                                    {modelsData ? (
                                        Object.entries(modelsData.providers)
                                            .filter(([_, p]) => p.available)
                                            .map(([key, provider]) => (
                                                <div
                                                    key={key}
                                                    className={styles.providerOption}
                                                    onClick={() => setSelectedService(key)}
                                                >
                                                    <div className={styles.providerIcon}>
                                                        {provider.name[0]}
                                                    </div>
                                                    <div className={styles.providerDetails}>
                                                        <div className={styles.providerName}>
                                                            {provider.name}
                                                        </div>
                                                        <div className={styles.providerMeta}>
                                                            {provider.models.length} models available
                                                        </div>
                                                    </div>
                                                    <div className={styles.arrow}>→</div>
                                                </div>
                                            ))
                                    ) : (
                                        Array.from(new Set(availableProviders.map((p) => p.type))).map((type) => (
                                            <div
                                                key={type}
                                                className={styles.providerOption}
                                                onClick={() => setSelectedService(type)}
                                            >
                                                <div className={styles.providerIcon}>
                                                    {type[0].toUpperCase()}
                                                </div>
                                                <div className={styles.providerDetails}>
                                                    <div className={styles.providerName}>
                                                        {type.toUpperCase()}
                                                    </div>
                                                    <div className={styles.providerMeta}>
                                                        Select Model...
                                                    </div>
                                                </div>
                                                <div className={styles.arrow}>→</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <>
                                    <div
                                        className={styles.providerOption}
                                        style={{ marginBottom: '10px', border: '1px solid #333', opacity: 0.8 }}
                                        onClick={() => setSelectedService(null)}
                                    >
                                        <div className={styles.providerIcon}>←</div>
                                        <div className={styles.providerDetails}>
                                            <div className={styles.providerName}>BACK</div>
                                        </div>
                                    </div>
                                    <div className={styles.providerList} style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                        {modelsData && modelsData.providers[selectedService as keyof typeof modelsData.providers] ? (
                                            modelsData.providers[selectedService as keyof typeof modelsData.providers].models.map((model) => {
                                                const llm = modelToProvider(model);
                                                return (
                                                    <div
                                                        key={llm.id}
                                                        className={`${styles.providerOption} ${currentLLM.id === llm.id ? styles.selected : ""}`}
                                                        onClick={() => {
                                                            setCurrentLLM(llm);
                                                            setShowSelector(false);
                                                        }}
                                                    >
                                                        <div className={styles.providerIcon}>
                                                            {llm.type[0].toUpperCase()}
                                                        </div>
                                                        <div className={styles.providerDetails}>
                                                            <div className={styles.providerName}>
                                                                {llm.name}
                                                            </div>
                                                            <div className={styles.providerMeta}>
                                                                {llm.model}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            availableProviders.filter(p => p.type === selectedService).map((llm) => (
                                                <div
                                                    key={llm.id}
                                                    className={`${styles.providerOption} ${currentLLM.id === llm.id ? styles.selected : ""}`}
                                                    onClick={() => {
                                                        setCurrentLLM(llm);
                                                        setShowSelector(false);
                                                    }}
                                                >
                                                    <div className={styles.providerIcon}>
                                                        {llm.type[0].toUpperCase()}
                                                    </div>
                                                    <div className={styles.providerDetails}>
                                                        <div className={styles.providerName}>
                                                            {llm.name}
                                                        </div>
                                                        <div className={styles.providerMeta}>
                                                            {llm.model}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MCP Settings Modal */}
            <McpSettingsModal
                isOpen={showMcpSettings}
                onClose={() => setShowMcpSettings(false)}
                backendUrl={BACKEND_URL}
            />

            {/* Skill Detail Modal */}
            <SkillDetailModal
                skillName={viewingSkill}
                onClose={() => setViewingSkill(null)}
            />
        </>
    );
}
