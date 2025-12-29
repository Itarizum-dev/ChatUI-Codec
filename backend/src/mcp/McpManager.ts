/**
 * MCP Manager - MCPサーバーの設定管理とクライアント接続を担当
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { McpSettings, McpServerConfig, McpServerInfo, McpTool, McpToolResult, McpServerStatus } from './types';
import * as fs from 'fs';
import * as path from 'path';

interface ServerConnection {
    client: Client;
    transport: StdioClientTransport;
    status: McpServerStatus;
    error?: string;
}

export class McpManager {
    private settingsPath: string;
    private settings: McpSettings = { mcpServers: {} };
    private connections: Map<string, ServerConnection> = new Map();
    private toolCache: Map<string, McpTool[]> = new Map();

    constructor(settingsPath?: string) {
        this.settingsPath = settingsPath || path.join(__dirname, '../../data/mcp-settings.json');
    }

    /**
     * 設定を読み込み、全サーバーに接続
     */
    async initialize(): Promise<void> {
        this.loadSettings();
        await this.connectAll();
    }

    /**
     * 全サーバーを切断
     */
    async shutdown(): Promise<void> {
        for (const [name, conn] of this.connections) {
            try {
                await conn.transport.close();
                console.log(`[MCP] Disconnected from ${name}`);
            } catch (e) {
                console.error(`[MCP] Error disconnecting ${name}:`, e);
            }
        }
        this.connections.clear();
        this.toolCache.clear();
    }

    /**
     * 設定ファイルを読み込み
     */
    private loadSettings(): void {
        try {
            if (fs.existsSync(this.settingsPath)) {
                const data = fs.readFileSync(this.settingsPath, 'utf-8');
                this.settings = JSON.parse(data);
            }
        } catch (e) {
            console.error('[MCP] Failed to load settings:', e);
            this.settings = { mcpServers: {} };
        }
    }

    /**
     * 設定ファイルを保存
     */
    private saveSettings(): void {
        try {
            const dir = path.dirname(this.settingsPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
        } catch (e) {
            console.error('[MCP] Failed to save settings:', e);
        }
    }

    /**
     * 全サーバーに接続
     */
    private async connectAll(): Promise<void> {
        for (const [name, config] of Object.entries(this.settings.mcpServers)) {
            await this.connectServer(name, config);
        }
    }

    /**
     * 単一サーバーに接続
     */
    private async connectServer(name: string, config: McpServerConfig): Promise<boolean> {
        // Ensure existing connection is closed before attempting to reconnect
        await this.disconnectServer(name);

        if (config.disabled) {
            this.connections.set(name, {
                client: null as unknown as Client,
                transport: null as unknown as StdioClientTransport,
                status: 'disabled',
                error: 'Server is disabled',
            });
            this.toolCache.set(name, []);
            console.log(`[MCP] Server ${name} is disabled, not connecting.`);
            return false;
        }

        try {
            console.log(`[MCP] Connecting to ${name}...`);

            const transport = new StdioClientTransport({
                command: config.command,
                args: config.args || [],
                env: { ...process.env, ...config.env } as Record<string, string>,
                // Set working directory to project root (parent of backend)
                cwd: path.resolve(process.cwd(), '..'),
            });

            const client = new Client({
                name: 'codec-chat',
                version: '1.0.0',
            }, {
                capabilities: {}
            });

            // Connect with timeout
            const timeoutMs = 15000; // 15 seconds timeout
            const connectPromise = client.connect(transport);

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Connection timed out after ${timeoutMs}ms`)), timeoutMs);
            });

            await Promise.race([connectPromise, timeoutPromise]);

            this.connections.set(name, {
                client,
                transport,
                status: 'connected',
            });

            // Cache tools
            try {
                const toolsResult = await client.listTools();
                const toolsWithServerName = toolsResult.tools.map(t => ({
                    name: t.name,
                    description: t.description,
                    inputSchema: t.inputSchema as Record<string, unknown>,
                    serverName: name
                }));
                this.toolCache.set(name, toolsWithServerName);
            } catch (e) {
                console.warn(`[MCP] Failed to list tools for ${name}:`, e);
                this.toolCache.set(name, []);
            }

            console.log(`[MCP] Connected to ${name}`);
            return true;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error(`[MCP] Failed to connect to ${name}:`, errorMsg);

            this.connections.set(name, {
                client: null as unknown as Client,
                transport: null as unknown as StdioClientTransport,
                status: 'error',
                error: errorMsg,
            });
            return false;
        }
    }

    /**
     * 単一サーバーを切断
     */
    private async disconnectServer(name: string): Promise<void> {
        const conn = this.connections.get(name);
        if (conn) {
            if (conn.transport) {
                try {
                    await conn.transport.close();
                    console.log(`[MCP] Disconnected from ${name}`);
                } catch (e) {
                    console.error(`[MCP] Error disconnecting ${name}:`, e);
                }
            }
            // Always clean up resources
            this.connections.delete(name);
            this.toolCache.delete(name);
        }
    }

    /**
     * サーバー一覧を取得
     */
    getServers(): McpServerInfo[] {
        const servers: McpServerInfo[] = [];
        for (const [name, config] of Object.entries(this.settings.mcpServers)) {
            const conn = this.connections.get(name);
            servers.push({
                name,
                config,
                status: conn?.status || (config.disabled ? 'disabled' : 'disconnected'),
                error: conn?.error,
                tools: this.toolCache.get(name) || [],
            });
        }
        return servers;
    }

    /**
     * サーバーを追加
     */
    async addServer(name: string, config: McpServerConfig): Promise<McpServerInfo> {
        this.settings.mcpServers[name] = config;
        this.saveSettings();

        // Modified: Connect only if not disabled
        if (!config.disabled) {
            await this.connectServer(name, config);
        } else {
            // If disabled, ensure it's marked as such in connections map
            this.connections.set(name, {
                client: null as unknown as Client,
                transport: null as unknown as StdioClientTransport,
                status: 'disabled',
                error: 'Server is disabled',
            });
            this.toolCache.set(name, []);
        }

        const conn = this.connections.get(name);
        return {
            name,
            config,
            status: conn?.status || (config.disabled ? 'disabled' : 'disconnected'),
            error: conn?.error,
            tools: this.toolCache.get(name) || [],
        };
    }

    /**
     * サーバーを削除
     */
    async removeServer(name: string): Promise<boolean> {
        await this.disconnectServer(name);
        delete this.settings.mcpServers[name];
        this.saveSettings();
        return true;
    }

    /**
     * 全サーバーから利用可能なツールを取得
     */
    async getAllTools(): Promise<McpTool[]> {
        const tools: McpTool[] = [];
        // Use cache instead of live fetch for performance and stability
        for (const serverTools of this.toolCache.values()) {
            tools.push(...serverTools);
        }
        return tools;
    }

    /**
     * ツールを実行
     */
    async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<McpToolResult> {
        const conn = this.connections.get(serverName);
        if (!conn || conn.status !== 'connected') {
            return {
                content: [{ type: 'text', text: `Error: Server ${serverName} is not connected` }],
                isError: true,
            };
        }

        try {
            const result = await conn.client.callTool({
                name: toolName,
                arguments: args,
            });

            return {
                content: result.content as McpToolResult['content'],
                isError: result.isError as boolean | undefined,
            };
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            return {
                content: [{ type: 'text', text: `Error calling tool: ${errorMsg}` }],
                isError: true,
            };
        }
    }

    /**
     * 接続済みサーバーがあるか
     */
    hasConnectedServers(): boolean {
        for (const conn of this.connections.values()) {
            if (conn.status === 'connected') return true;
        }
        return false;
    }

    /**
     * サーバーの有効/無効を切り替える
     */
    async toggleServer(name: string, disabled: boolean): Promise<McpServerInfo> {
        const config = this.settings.mcpServers[name];
        if (!config) throw new Error(`Server ${name} not found`);

        config.disabled = disabled;
        this.saveSettings();

        if (disabled) {
            await this.disconnectServer(name);
            this.connections.set(name, {
                client: null as unknown as Client,
                transport: null as unknown as StdioClientTransport,
                status: 'disabled',
                error: 'Server is disabled',
            });
            this.toolCache.set(name, []);
        } else {
            await this.connectServer(name, config);
        }

        const conn = this.connections.get(name);
        return {
            name,
            config,
            status: conn?.status || (config.disabled ? 'disabled' : 'disconnected'),
            error: conn?.error,
            tools: this.toolCache.get(name) || [],
        };
    }
}

// シングルトンインスタンス
export const mcpManager = new McpManager();
