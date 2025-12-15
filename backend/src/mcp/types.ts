/**
 * MCP (Model Context Protocol) 関連の型定義
 * Claude Desktop互換の設定形式を採用
 */

/** MCPサーバーの設定 */
export interface McpServerConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    disabled?: boolean;
}

/** MCP設定ファイルの形式 (Claude Desktop互換) */
export interface McpSettings {
    mcpServers: Record<string, McpServerConfig>;
}

/** MCPサーバーの接続状態 */
export type McpServerStatus = 'connected' | 'connecting' | 'disconnected' | 'error' | 'disabled';

/** MCPサーバーの情報 (API応答用) */
export interface McpServerInfo {
    name: string;
    config: McpServerConfig;
    status: McpServerStatus;
    error?: string;
    tools: { name: string; description?: string }[];
}

/** MCPツール定義 */
export interface McpTool {
    serverName: string;
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
}

/** ツール実行結果 */
export interface McpToolResult {
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
}
