"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";
import { Message, LLMProvider } from "@/types";
import { DEFAULT_PROVIDERS, PERSONAS } from "@/config/providers";

export default function CodecPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [currentProvider, setCurrentProvider] = useState<LLMProvider>(
        DEFAULT_PROVIDERS[0]
    );
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
                    providerId: currentProvider.id,
                    context: messages.slice(-10),
                    systemPrompt: currentProvider.persona?.systemPrompt,
                }),
            });

            if (!response.ok) throw new Error("Transmission failed");

            const data = await response.json();

            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: data.content,
                timestamp: new Date(),
                providerId: currentProvider.id,
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
        <div className={styles.codecContainer}>
            {/* Header - Frequency Display */}
            <header className={styles.codecHeader}>
                <span className={styles.codecTitle}>CODEC</span>
                <div className={styles.frequencyContainer}>
                    <div>
                        <div className={`${styles.frequencyValue} glow-text`}>
                            {currentProvider.frequency}
                        </div>
                        <div className={styles.frequencyLabel}>MHz</div>
                    </div>
                </div>
                <span className={styles.codecTitle}>
                    {currentProvider.persona?.codename || "OPERATOR"}
                </span>
            </header>

            {/* Left Panel - Portrait */}
            <aside className={styles.codecPortraitPanel}>
                <div className={styles.portraitFrame}>
                    <span className={styles.portraitPlaceholder}>
                        {currentProvider.persona?.codename?.[0] || "?"}
                    </span>
                </div>
                <div className={styles.portraitName}>
                    {currentProvider.persona?.name || "Unknown"}
                </div>
                <div className={styles.portraitStatus}>
                    {currentProvider.name} // {currentProvider.model}
                </div>
            </aside>

            {/* Center - Chat */}
            <main className={styles.codecChatPanel}>
                <div className={styles.chatMessages}>
                    {messages.length === 0 && (
                        <div className={styles.message}>
                            <span className={styles.messageSender}>SYSTEM</span>
                            <span className={styles.messageContent}>
                // CODEC ONLINE - Select frequency and begin transmission //
                            </span>
                        </div>
                    )}
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`${styles.message} ${styles[msg.role]}`}
                        >
                            <span className={styles.messageSender}>
                                {msg.role === "user"
                                    ? "SNAKE"
                                    : currentProvider.persona?.codename || "OPERATOR"}
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

            {/* Right Panel - Settings */}
            <aside className={styles.codecSettingsPanel}>
                <div className={styles.settingsSection}>
                    <div className={styles.settingsTitle}>Frequency</div>
                    <div className={styles.frequencySelector}>
                        {DEFAULT_PROVIDERS.map((provider) => (
                            <button
                                key={provider.id}
                                className={`${styles.frequencyOption} ${currentProvider.id === provider.id ? styles.active : ""
                                    }`}
                                onClick={() => setCurrentProvider(provider)}
                            >
                                <span className={styles.frequencyOptionFreq}>
                                    {provider.frequency}
                                </span>
                                <span className={styles.frequencyOptionName}>
                                    {provider.persona?.codename || provider.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.settingsSection}>
                    <div className={styles.settingsTitle}>Debug</div>
                    <div className={styles.debugPanel}>
                        <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>Provider</span>
                            <span className={styles.debugValue}>{currentProvider.type}</span>
                        </div>
                        <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>Model</span>
                            <span className={styles.debugValue}>
                                {currentProvider.model?.slice(0, 12)}
                            </span>
                        </div>
                        <div className={styles.debugRow}>
                            <span className={styles.debugLabel}>Messages</span>
                            <span className={styles.debugValue}>{messages.length}</span>
                        </div>
                        {getLastMessageMetadata() && (
                            <>
                                <div className={styles.debugRow}>
                                    <span className={styles.debugLabel}>Tokens</span>
                                    <span className={styles.debugValue}>
                                        {getLastMessageMetadata()?.tokens?.total || "-"}
                                    </span>
                                </div>
                                <div className={styles.debugRow}>
                                    <span className={styles.debugLabel}>Latency</span>
                                    <span className={styles.debugValue}>
                                        {getLastMessageMetadata()?.latencyMs || "-"}ms
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );
}
