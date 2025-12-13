"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";
import { Message, LLMProvider, Persona } from "@/types";
import { PERSONAS, LLM_PROVIDERS, DEFAULT_PERSONA, DEFAULT_LLM } from "@/config/providers";

export default function CodecPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [currentPersona, setCurrentPersona] = useState<Persona>(DEFAULT_PERSONA);
    const [currentLLM, setCurrentLLM] = useState<LLMProvider>(DEFAULT_LLM);
    const [showSelector, setShowSelector] = useState(false);
    const [selectorTab, setSelectorTab] = useState<'character' | 'llm'>('character');
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage.content,
                    providerId: currentLLM.id,
                    personaId: currentPersona.id,
                    context: messages.slice(-10),
                    systemPrompt: currentPersona.systemPrompt,
                }),
            });

            if (!response.ok) throw new Error("Transmission failed");

            const data = await response.json();

            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: data.content,
                timestamp: new Date(),
                providerId: currentLLM.id,
                personaId: currentPersona.id,
                metadata: data.metadata,
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error("CODEC Error:", error);
            const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: "// TRANSMISSION ERROR - Check connection //",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

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
                            onClick={() => setShowSelector(true)}
                        >
                            CONFIG
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
                                    // CODEC ONLINE - Ready for transmission //
                                </span>
                            </div>
                        )}
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`${styles.message} ${styles[msg.role]}`}
                            >
                                <span className={styles.messageSender}>
                                    {msg.role === "user" ? "ME" : currentPersona.codename}
                                </span>
                                <span className={styles.messageContent}>{msg.content}</span>
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
                        <button
                            className={styles.sendButton}
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                        >
                            SEND
                        </button>
                    </div>
                </main>

                {/* Right Panel - Contact Info */}
                <aside className={styles.codecContactPanel}>
                    <div className={styles.contactInfo}>
                        <div className={styles.portraitFrame}>
                            {currentPersona.portraitUrl ? (
                                <img
                                    src={currentPersona.portraitUrl}
                                    alt={currentPersona.name}
                                    className={styles.portraitImage}
                                />
                            ) : (
                                <span className={styles.portraitPlaceholder}>
                                    {currentPersona.codename[0]}
                                </span>
                            )}
                        </div>
                        <div className={styles.portraitName}>
                            {currentPersona.codename}
                        </div>
                        <div className={styles.portraitStatus}>
                            {currentPersona.name}
                        </div>
                    </div>
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
                        <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>Messages</span>
                            <span className={styles.debugValue}>{messages.length}</span>
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
                </aside>
            </div>

            {/* Config Modal with Tabs */}
            {showSelector && (
                <div className={styles.modalOverlay} onClick={() => setShowSelector(false)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <span className={styles.modalTitle}>CONFIGURATION</span>
                            <button
                                className={styles.modalClose}
                                onClick={() => setShowSelector(false)}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className={styles.modalTabs}>
                            <button
                                className={`${styles.modalTab} ${selectorTab === 'character' ? styles.activeTab : ''}`}
                                onClick={() => setSelectorTab('character')}
                            >
                                CHARACTER
                            </button>
                            <button
                                className={`${styles.modalTab} ${selectorTab === 'llm' ? styles.activeTab : ''}`}
                                onClick={() => setSelectorTab('llm')}
                            >
                                LLM
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            {/* Character Selection */}
                            {selectorTab === 'character' && (
                                <div className={styles.providerList}>
                                    {PERSONAS.map((persona) => (
                                        <div
                                            key={persona.id}
                                            className={`${styles.providerOption} ${currentPersona.id === persona.id ? styles.selected : ""
                                                }`}
                                            onClick={() => {
                                                setCurrentPersona(persona);
                                            }}
                                        >
                                            <div className={styles.providerIcon}>
                                                {persona.portraitUrl ? (
                                                    <img
                                                        src={persona.portraitUrl}
                                                        alt={persona.codename}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
                                                    />
                                                ) : (
                                                    persona.codename[0]
                                                )}
                                            </div>
                                            <div className={styles.providerDetails}>
                                                <div className={styles.providerName}>
                                                    {persona.codename}
                                                </div>
                                                <div className={styles.providerMeta}>
                                                    {persona.name}
                                                </div>
                                            </div>
                                            <div className={styles.providerFreq}>
                                                {persona.frequency}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* LLM Selection */}
                            {selectorTab === 'llm' && (
                                <div className={styles.providerList}>
                                    {LLM_PROVIDERS.map((llm) => (
                                        <div
                                            key={llm.id}
                                            className={`${styles.providerOption} ${currentLLM.id === llm.id ? styles.selected : ""
                                                }`}
                                            onClick={() => {
                                                setCurrentLLM(llm);
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
                                                    {llm.type} • {llm.model}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
