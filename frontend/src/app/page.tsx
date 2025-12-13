"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";
import { Message, LLMProvider, Persona } from "@/types";
import { PERSONAS, LLM_PROVIDERS, DEFAULT_PERSONA, DEFAULT_LLM, BACKEND_URL } from "@/config/providers";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function CodecPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [currentPersona, setCurrentPersona] = useState<Persona>(DEFAULT_PERSONA);
    const [currentLLM, setCurrentLLM] = useState<LLMProvider>(DEFAULT_LLM);
    // Modal for LLM only now
    const [showSelector, setShowSelector] = useState(false);
    const [selectedService, setSelectedService] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

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
            },
        ]);

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
                }),
                signal: controller.signal,
            });

            if (!response.ok) throw new Error("Transmission failed");
            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(Boolean);

                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        if (json.error) throw new Error(json.error);

                        if (json.content) {
                            accumulatedContent += json.content;
                            setMessages((prev) =>
                                prev.map((msg) =>
                                    msg.id === assistantMessageId
                                        ? { ...msg, content: accumulatedContent }
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
            console.error("CODEC Error Details:", error);
            const err = error as Error;

            // Remove the empty partial message if it failed immediately? 
            // Better to update it with error status.

            let errorContent = "// TRANSMISSION ERROR //";
            const isNetworkError =
                err.name === 'TypeError' ||
                err.message.includes('fetch') ||
                err.message.includes('Network request failed') ||
                err.message.includes('Failed to fetch') ||
                err.message.includes('Load failed');

            if (err.name === 'AbortError') {
                errorContent = "// CANCELED //";
            } else if (isNetworkError) {
                errorContent = "// ENCRYPTION MODULE OFFLINE - CHECK BACKEND //";
            } else {
                errorContent = `// ERROR: ${err.message} //`;
            }

            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === assistantMessageId
                        ? { ...msg, content: msg.content + "\n" + errorContent }
                        : msg
                )
            );
        } finally {
            setIsLoading(false);
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
            e.preventDefault();
            handleSend();
        }
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
                    <span className={styles.codecTitle}>SNAKE</span>
                    <div className={styles.frequencyContainer}>
                        <span className={styles.frequencyValue}>
                            {currentPersona.frequency}
                        </span>
                        <span className={styles.frequencyLabel}>MHz</span>
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
                </aside>

                {/* Center - Chat Area */}
                <main className={styles.codecChatPanel}>
                    <div className={styles.chatMessages}>
                        {messages.length === 0 && (
                            <div className={styles.message}>
                                <span className={styles.messageSender}>SYSTEM</span>
                                <span className={styles.messageContent}>
                                    {"// CODEC ONLINE - Ready for transmission //"}
                                </span>
                            </div>
                        )}
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`${styles.message} ${msg.role === 'user' ? styles.user : styles.assistant}`}
                            >
                                <span className={styles.messageSender}>
                                    {msg.role === "user" ? "ME" : currentPersona.codename}
                                </span>
                                <div className={`${styles.messageContent} markdown-content`}>
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            // Override p to avoid unnecessary margins in simple messages if needed
                                            // but global css handles markdown-content p
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className={styles.loadingIndicator}>
                                <span className={styles.loadingDot}></span>
                                <span className={styles.loadingDot}></span>
                                <span className={styles.loadingDot}></span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className={styles.chatInputArea}>
                        <input
                            type="text"
                            className={styles.chatInput}
                            placeholder="Enter message..."
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
                    <div className={styles.contactListTitle}>FREQUENCY LIST</div>

                    {PERSONAS.map((persona) => (
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
                    ))}

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
                            {!selectedService ? (
                                <div className={styles.providerList}>
                                    {Array.from(new Set(LLM_PROVIDERS.map((p) => p.type))).map((type) => (
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
                                    ))}
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
                                    <div className={styles.providerList}>
                                        {LLM_PROVIDERS.filter(p => p.type === selectedService).map((llm) => (
                                            <div
                                                key={llm.id}
                                                className={`${styles.providerOption} ${currentLLM.id === llm.id ? styles.selected : ""
                                                    }`}
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
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
