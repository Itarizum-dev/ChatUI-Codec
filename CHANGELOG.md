# CODEC Version History

## v0.7.1 - Ollama Environment Variable Support (2025-12-18)
- **Backend**: Ollama接続エンドポイントを環境変数化（`OLLAMA_HOST`）し、ローカル実行とdevcontainerの両方に対応
  - デフォルト: `localhost:11434`（ローカル実行時）
  - devcontainer: `host.docker.internal:11434`（.envで設定）
- **Config**: `.env.example`に`OLLAMA_HOST`変数を追加し、使用例とコメントを記載
- **Docs**: `README.md`にdevcontainer使用時のOllama設定手順を追記
- **Fix**: ハードコードされていた`host.docker.internal:11434`を削除し、環境に応じた柔軟な設定を実現

## v0.7.0 - GitHub Private Repository & Env Setup (2025-12-18)
- **Git**: GitHubの非公開リポジトリ (`Itarizum-dev/ChatUI-Codec`) での管理を開始
- **Docs**: 初回セットアップ用の `.env.example` を追加し、README に環境変数設定手順を追記

## v0.6.1 - Stability & IME Fix (2025-12-15)
- **Backend**: OllamaなどのLLM応答待ち時にKeep-Alive Ping (15秒毎) とタイムアウト (5分) を導入し、接続切れを防止
- **Frontend**: 日本語入力 (IME) 確定時のEnterキーによる意図しないメッセージ送信を修正

## v0.6.0 - MCP Integration (2025-12-14)
- **MCP Support**: Claude Desktop互換のModel Context Protocol (MCP) を導入
  - ヘッダーにMCPトグル（ON/OFF）と設定ボタン（⚙）を追加
  - MCPサーバーの追加・削除用モーダルUI
  - ツール実行中のステータス表示（🔧 Calling... / ✓ done）
  - **Quick Add: Filesystem** - ディレクトリパスを入力してワンクリックでファイルシステムサーバーを追加
- **Backend**: `McpManager` によるStdioサーバー管理とツール実行
  - `/api/mcp/servers` (GET/POST/DELETE) APIエンドポイント
  - Claude/Gemini/Ollamaでのツール実行対応（モデル依存）
  - **Stability**: サーバー接続時のタイムアウト処理(15秒)を追加し、無限ロードを防止
  - **Debug**: ツール実行時の詳細ログ出力を追加（引数・戻り値の確認用）
  - **Fix**: Gemini API向けにツール定義のJSON Schemaから `$schema` 等の不要フィールドを削除
  - **Feature**: OllamaでのMCPツール実行をサポート（OpenAI互換APIを使用）
  - **Feature**: MCPサーバー個別のON/OFF切り替え機能を追加
  - **Fix**: Settings Modalでツール一覧取得時に発生していたエラー(`Cannot read properties of undefined`)を修正（`tools`プロパティの欠落に対応）
- **Config**: `backend/data/mcp-settings.json` で設定を永続化

## v0.5.0 - Context & UI Awareness (2025-12-14)
- **Context Awareness**: Backend now prepends character names (e.g., `[SNAKE]:`) to the conversation history sent to the LLM, ensuring better roleplay continuity.
- **Character Icons**: Added visual avatars next to chat messages. "Me" icon is on the left, character icons on the right.
- **UI Alignment**: Swapped chat layout (User Left, Character Right) to match standard messaging apps while retaining the Codec aesthetic.
- **Visual Polish**: Improved icon brightness for the user and restored full-width message bars for the classic "Metal Gear" look.

## v0.4.0 - Architecture & Streaming (2025-12-13)
- **Architecture**: フロントエンドとバックエンドの完全分離
    - Frontend: Next.js (Port 3000)
    - Backend: Express (Port 3001)
- **Feature**: ストリーミング通信 (NDJSON) の実装によるリアルタイム応答
- **UX**: ストリーミング中のカーソル点滅エフェクトと待機メッセージ改善
- **Security**: 環境変数の厳格な分離 (`frontend/.env` からAPIキーを削除)
- **Dev**: `.gitignore` の統合と整理

## v0.3.0 - UI Overhaul & Cancel Feature (2025-12-13)
- **Feature**: 送信キャンセル機能の実装（クライアント＆サーバー連携）
- **UI**: Markdownテーブルのスタイル改善（Code風デザイン）
- **UI**: メッセージの左右配置による話者区別（ME:左 / Character:右）
- **UI**: キャラクターリストの右パネル配置とポートレートサイズ調整
- **System**: Ollama接続設定の適正化（Host接続対応）

## v0.2.1 - Gemini 2.5 Flash Fix (2025-12-13)
- **Bug Fix**: Gemini 2.5 Flashモデル名を修正 (`gemini-2.0-flash-exp` → `gemini-2.5-flash`)
- **Character**: 新キャラクター「Me」（敵兵ポートレート）を追加
- **UI**: 左側キャラクター表示の調整

## v0.2.0 - UI Redesign & Features (2025-12-12)
- **UI Redesign**: Authentic Metal Gear 2 Codec interface
  - Dual-portrait layout
  - Simplified frequency display
  - "Config" modal for independent Character and LLM selection
- **Character Portraits**: Added custom 8-bit MSX2 pixel art for Snake, Colonel, and Otacon
- **Providers**: Added Google Gemini Pro support
- **Experience**: Enhanced CRT effects and green monochrome filters

## v0.1.0 - Initial Setup (2024-12-12)
- Next.js 14 project structure with TypeScript
- Dev Container configuration for Node.js 20
- MGS2 Codec-inspired UI design with CRT effects
- Multi-LLM provider support (Ollama, Claude)
- Character personas (Snake, Colonel, Otacon) with frequency-based selection
- Chat API route with token tracking and latency measurement
- Debug panel for performance metrics
