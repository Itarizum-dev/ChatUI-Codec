# CODEC Version History

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
