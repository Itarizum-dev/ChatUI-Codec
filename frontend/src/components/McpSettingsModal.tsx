/**
 * MCP Settings Modal Component
 * MCPサーバーの追加・削除を行うUI
 */
'use client';

import { useState, useEffect } from 'react';
import styles from './McpSettingsModal.module.css';

interface McpServerConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    disabled?: boolean;
}

interface McpServerInfo {
    name: string;
    config: {
        command: string;
        args?: string[];
        env?: Record<string, string>;
        disabled?: boolean;
    };
    status: 'connected' | 'connecting' | 'disconnected' | 'error' | 'disabled';
    error?: string;
    tools: { name: string; description?: string }[];
}

interface McpSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    backendUrl: string;
}

export default function McpSettingsModal({ isOpen, onClose, backendUrl }: McpSettingsModalProps) {
    const [servers, setServers] = useState<McpServerInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Add server form
    const [newName, setNewName] = useState('');
    const [newCommand, setNewCommand] = useState('');
    const [newArgs, setNewArgs] = useState('');
    const [newEnv, setNewEnv] = useState('');
    const [adding, setAdding] = useState(false);

    // Fetch servers on open
    useEffect(() => {
        if (isOpen) {
            fetchServers();
        }
    }, [isOpen]);

    const fetchServers = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${backendUrl}/api/mcp/servers`);
            if (!res.ok) throw new Error('Failed to fetch servers');
            const data = await res.json();
            setServers(data.servers || []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddServer = async () => {
        if (!newName.trim() || !newCommand.trim()) {
            setError('Name and Command are required');
            return;
        }

        setAdding(true);
        setError(null);

        try {
            const config: McpServerConfig = {
                command: newCommand.trim(),
            };
            if (newArgs.trim()) {
                config.args = newArgs.split(',').map(a => a.trim());
            }
            if (newEnv.trim()) {
                config.env = {};
                newEnv.split(',').forEach(pair => {
                    const [key, value] = pair.split('=').map(s => s.trim());
                    if (key && value) config.env![key] = value;
                });
            }

            const res = await fetch(`${backendUrl}/api/mcp/servers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim(), config }),
            });

            if (!res.ok) throw new Error('Failed to add server');

            // Clear form and refresh
            setNewName('');
            setNewCommand('');
            setNewArgs('');
            setNewEnv('');
            await fetchServers();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setAdding(false);
        }
    };

    const removeServer = async (name: string) => {
        if (!confirm(`Are you sure you want to remove server "${name}"?`)) return;
        try {
            await fetch(`${backendUrl}/api/mcp/servers/${encodeURIComponent(name)}`, { method: 'DELETE' });
            fetchServers();
        } catch (error) {
            console.error('Failed to remove server:', error);
            setError(error instanceof Error ? error.message : 'Unknown error removing server');
        }
    };

    const toggleServer = async (name: string, currentDisabled: boolean) => {
        try {
            await fetch(`${backendUrl}/api/mcp/servers/${encodeURIComponent(name)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ disabled: !currentDisabled })
            });
            fetchServers();
        } catch (error) {
            console.error('Failed to toggle server:', error);
            setError(error instanceof Error ? error.message : 'Unknown error toggling server');
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <span className={styles.title}>MCP SERVERS</span>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.body}>
                    {loading && <div className={styles.loading}>Loading...</div>}
                    {error && <div className={styles.error}>{error}</div>}

                    {/* Server List */}
                    <div className={styles.serverList}>
                        {servers.length === 0 && !loading && (
                            <div className={styles.empty}>No MCP servers configured</div>
                        )}
                        {servers.map((server) => (
                            <div key={server.name} className={styles.serverItem}>
                                <div className={styles.serverInfo}>
                                    <div className={styles.serverName}>
                                        <span className={`${styles.statusDot} ${styles[server.status]}`}></span>
                                        {server.name}
                                    </div>
                                    <div className={styles.serverCommand}>
                                        {server.config.command} {server.config.args?.join(' ')}
                                    </div>
                                    {server.error && (
                                        <div className={styles.serverError}>{server.error}</div>
                                    )}
                                </div>
                                <div className={styles.serverMeta}>
                                    <div className={`${styles.statusBadge} ${styles[server.status]}`}>
                                        {server.status.toUpperCase()}
                                    </div>
                                    <div className={styles.toolCount}>
                                        {server.tools.length} tools
                                    </div>
                                </div>
                                <div className={styles.serverActions}>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={!server.config.disabled}
                                            onChange={() => toggleServer(server.name, !!server.config.disabled)}
                                        />
                                        <span className={`${styles.slider} ${styles.round}`}></span>
                                    </label>
                                    <button
                                        className={styles.removeBtn}
                                        onClick={() => removeServer(server.name)}
                                        title="Remove Server"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Quick Add: Filesystem Template */}
                    <div className={styles.templateSection}>
                        <div className={styles.formTitle}>Quick Add: Filesystem</div>
                        <div className={styles.templateRow}>
                            <input
                                type="text"
                                placeholder="Directory path (e.g. /home/user/projects)"
                                id="filesystem-path"
                                className={styles.input}
                            />
                            <button
                                className={styles.templateBtn}
                                onClick={async () => {
                                    const pathInput = document.getElementById('filesystem-path') as HTMLInputElement;
                                    const dirPath = pathInput?.value?.trim();
                                    if (!dirPath) {
                                        setError('Directory path is required');
                                        return;
                                    }
                                    setAdding(true);
                                    setError(null);
                                    try {
                                        const res = await fetch(`${backendUrl}/api/mcp/servers`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                name: 'filesystem',
                                                config: {
                                                    command: 'npx',
                                                    args: ['-y', '@modelcontextprotocol/server-filesystem', dirPath],
                                                },
                                            }),
                                        });
                                        if (!res.ok) throw new Error('Failed to add server');
                                        pathInput.value = '';
                                        await fetchServers();
                                    } catch (e) {
                                        setError(e instanceof Error ? e.message : 'Unknown error');
                                    } finally {
                                        setAdding(false);
                                    }
                                }}
                                disabled={adding}
                            >
                                ADD
                            </button>
                        </div>
                    </div>

                    {/* Add Server Form */}
                    <div className={styles.addForm}>
                        <div className={styles.formTitle}>Custom Server</div>
                        <input
                            type="text"
                            placeholder="Name (e.g. github)"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className={styles.input}
                        />
                        <input
                            type="text"
                            placeholder="Command (e.g. npx)"
                            value={newCommand}
                            onChange={e => setNewCommand(e.target.value)}
                            className={styles.input}
                        />
                        <input
                            type="text"
                            placeholder="Args (comma-separated)"
                            value={newArgs}
                            onChange={e => setNewArgs(e.target.value)}
                            className={styles.input}
                        />
                        <input
                            type="text"
                            placeholder="Env (KEY=VALUE, comma-separated)"
                            value={newEnv}
                            onChange={e => setNewEnv(e.target.value)}
                            className={styles.input}
                        />
                        <button
                            className={styles.addBtn}
                            onClick={handleAddServer}
                            disabled={adding}
                        >
                            {adding ? 'Adding...' : 'ADD SERVER'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
