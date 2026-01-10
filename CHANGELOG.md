# CODEC Version History

## v1.7.1 - Public Release Preparation (2026-01-11)
- **Feature**: ペルソナデータの外部化とカスタム対応
  - `personas.json` によるユーザー定義ペルソナの管理（Git除外）
  - `personas.sample.json` を同梱し、コピーして利用可能に
  - "ME"（ユーザー自身）のプロファイルもJSONで設定可能に
- **Content**: 新規ペルソナ "Monkey" の追加
  - サルゲッチュ風のユーモラスなサル（権利配慮済み）
  - リアルなピクセルアートポートレート（ヘルメット付き）
- **Refactor**: `usePersonas` フックのロジック改善
  - プロンプトの重複定義防止と、ファイル優先のロード順序

- **Feature**: ユーザープロファイル機能の実装
  - サイドバー「ME」セクションから自分のプロフィール（名前・コードネーム・画像）を編集可能に
  - ユーザー専用の簡略化されたペルソナエディタUI（システムプロンプト等の非表示）
  - 設定内容はLocalStorageに永続保存
- **UI**: 連絡先リストのフィルタリング
  - 連絡先リストに自分自身が表示されないように修正（自己通話の防止）
- **Refactor**: ペルソナ管理ロジックの統合
  - ユーザー情報も `Persona` 型として一元管理し、コードの見通しを改善

## v1.6.2 - Quality of Life Improvements (2026-01-10)
- **Feature**: `/skill` コマンドの実装
  - チャット欄に `/skill` と入力すると、利用可能なスキルファイル一覧を表（Table）形式で表示
- **UI**: ツールチップとボタン視認性の向上
  - Mobile Menu, Memory Editor等の主要ボタンにツールチップを追加
  - MCP設定ボタンのスタイルを調整し、ヘッダーの統一感を向上
- **Docker**: 接続安定性の向上
  - ベースイメージを`node:20-slim`に変更し、IPv4優先解決でMac/Docker環境のDNS問題を修正
  - ローカル(`localhost`)とDocker(`host.docker.internal`)でOllama接続先を自動判別
- **Debug**: Ollama接続失敗時に詳細なエラー原因をログ出力

## v1.6.1 - UI Fixes & Resilient LLM Selection (2026-01-10)
- **Fix**: オフライン判定時のLLM選択ロジックを改善
  - バックエンドがモデル一覧を返さない場合（オフライン等）でも、強制的にOllamaを選択可能にするフォールバックロジックを実装
  - モデルリストが空の場合、静的定義（`FALLBACK_PROVIDERS`）を表示するように修正
- **Fix**: ヘッダーのレイアウトと挙動を修正
  - 各ボタン（MCP, THINK, CONFIG）に説明用ツールチップを追加
  - ボタンのレスポンシブ配置（折り返し対応）を改善
  - LLM CONFIGボタン押下時に確実にモデル一覧を再取得 (`refreshModels()`) するよう修正
- **Backend**: Ollamaモデル取得時のタイムアウトを5秒から30秒に延長し、Docker環境での接続安定性を向上




## v1.6.0 - Persona Editor & UI Polish (2026-01-10)
- **Feature**: ペルソナエディタ機能の実装
  - コンタクトリストに追加された `[ MEMORY EDITOR ]` ボタンから起動
  - カスタムペルソナの新規作成、編集、削除、画像アップロード機能
  - Local Storageによるカスタムペルソナの永続化
- **UI**: 画像生成プロンプトヒント機能
  - エディタ内にコピー可能なプロンプト雛形（アニメ調・顔アップ）を表示
  - アップロードエリアの右側に配置し、スペースを有効活用
- **UI**: SYSTEMペルソナのデザイン改善
  - SYSTEMの画像（ポートレート）を削除
  - 画像なし時のフォールバックアイコンを、Skillsリストと統一感のあるデザイン（Codeフォント、背景色）に変更
- **Maintain**: コードベースの整理とLintエラー修正

## v1.5.0 - Skills & Tools Enhancement (2026-01-10)
- **Feature**: Anthropics公式スキル15個をインポート
  - algorithmic-art, brand-guidelines, canvas-design, doc-coauthoring, docx, frontend-design, internal-comms, mcp-builder, pdf, pptx, slack-gif-creator, theme-factory, web-artifacts-builder, webapp-testing, xlsx
- **Feature**: SYSTEMペルソナを追加
  - キャラクター設定なしの素のAIアシスタント
  - 周波数 000.00、専用ポートレート付き
- **Feature**: ファイルシステムビルトインツールを拡充（計8個）
  - `cat` (読み込み), `write` (書き込み), `append` (追記), `ls` (一覧)
  - `mkdir` (ディレクトリ作成), `stat` (情報取得), `exists` (存在確認), `cp` (コピー)

## v1.4.1 - Progressive Disclosure Cleanup (2026-01-10)
- **Refactor**: deprecated関数を削除し、Progressive Disclosure APIに完全移行
  - `fullSkillsCache` (未使用キャッシュ) を削除
  - `loadAllSkills()` @deprecated関数を削除
  - `getSkill()` @deprecated関数を削除
  - 未使用の `Skill` 型インポートを削除
- **Fix**: `skillCreator.validateSkill()` を `activateSkill()` API使用に更新
- **API**: SkillManagerはStage 1-3のProgressive Disclosure APIのみを公開
  - Stage 1: `discoverSkills()`, `getAvailableSkills()`
  - Stage 2: `activateSkill()`
  - Stage 3: `loadSkillResource()`

## v1.4.0 - Docker & Streaming Improvements (2026-01-10)
- **Refactor**: Dockerfile構成の簡略化・整理
  - Backend: 3ステージ→2ステージに削減（冗長なdepsステージを削除）
  - Frontend: 不要な`NEXT_PUBLIC_API_URL`ビルド引数を削除
  - docker-compose: 不要なランタイム環境変数を削除
- **Fix**: ローカル開発時のストリーミング通信を修正
  - `getBackendUrl()`関数を導入し、localhost時は直接バックエンドにアクセス
  - Docker/ngrok経由時はNext.jsリライト経由でルーティング
- **Cleanup**: `.devcontainer/`を削除（Docker Composeに移行済み）
- **Fix**: CSS `@import`警告を修正（`next/font/google`と重複していたため削除）

## v1.3.2 - Ngrok External Access Fix (2026-01-07)
- **Fix**: ngrok経由でのバックエンド接続問題を修正
  - `BACKEND_URL` を空文字列に固定し、すべてのAPIリクエストを相対パス（`/api/*`）経由に変更
  - これにより、ngrok等の外部アクセス時もNext.jsリライト経由でバックエンドに正しくルーティング
  - `docker-compose.yml` から `NEXT_PUBLIC_API_URL` ビルド引数を削除

## v1.3.1 - Docker Communication Fix (2026-01-07)
- **Fix**: Frontend→Backend間のコンテナ通信問題を修正
  - `INTERNAL_API_URL` をビルド引数として追加（Next.js rewriteのビルド時評価に対応）
  - `backend-debug.log` のファイル権限問題を修正（非rootユーザー対応）

## v1.3.0 - Docker Support (2026-01-06)
- **Feature**: Docker Compose によるワンコマンド起動をサポート
  - `docker compose up --build` でフロントエンド・バックエンドを一括起動
  - マルチステージビルドによる軽量イメージ（Next.js Standalone出力）
  - 非rootユーザーでのコンテナ実行（セキュリティ強化）
- **Config**: `.env.example` テンプレートを追加し、環境変数の設定を簡略化
- **Docs**: READMEに「Docker クイックスタート」セクションを追加

## v1.2.1 - Thinking Mode Improvements & IME Fix (2026-01-06)
- **Feature**: Ollama以外のプロバイダー（Anthropic, Google）でも `<think>` タグ解析によるThinkingモード表示をサポート
- **Fix**: Ollamaの一部モデルでツール利用時に400エラーが発生する場合、自動的にツールなしでリトライするロジックを追加
- **Fix**: 日本語IME入力中にEnterキーを押した際、意図せずメッセージが送信される問題を修正
- **UI**: Thinkingモードボタンのツールチップから「Ollama only」を削除し、全プロバイダーで有効化

## v1.2.0 - Mobile Responsiveness (2026-01-06)
- **UI**: モバイル対応（レスポンシブデザイン）の実装
  - スマートフォン等での表示を最適化 (`100dvh` 対応、ノッチ回避)
  - モバイル専用メニュー（LOGS, CONTACTS, SYSTEM）をヘッダーに追加
  - サイドパネルをモバイル表示時に非表示にし、メニューからのアクセスに変更
  - テーブル（表）の横スクロール対応

## v1.1.0 - External Access & Security (2026-01-05)
- **Feature**: 外部公開（External Access）機能のサポート
  - ngrokを使用した一時公開用のプロキシ設定 (`/api` proxy) を実装
  - ワークフローガイド `/ngrok_setup` を追加
- **Security**: `.gitignore` の強化 (ログファイル、設定ファイルの除外)

## v1.0.2 - Visual Readability Polish (2026-01-04)
- **UI**: 走査線（Scanline）エフェクトの不透明度を調整 (0.4 -> 0.2)
  - Wirelessな雰囲気を維持しつつ、テキストの視認性を向上

## v1.0.1 - Conversation Switch Sound (2026-01-04)
- **Audio**: 会話ログ切り替え時にも効果音（Start Sound）を再生するように変更
  - 周波数を合わせる操作感を向上

## v1.0.0 - Codec Conversation System (2026-01-04)
- **Feature**: 会話（周波数）タブ機能の実装
  - 複数の会話（LOGS）をサイドバーで管理可能に
  - `+ NEW FREQ` で新規会話作成、`×` ボタンで削除
  - 起動時に既存の会話履歴 `codec-history` を自動で新形式に移行
- **Feature**: AIによる会話タイトルの自動要約
  - 最初のメッセージ送信直後、AIがバックグラウンドで5単語以内のタイトルを生成
  - 生成までの間はメッセージ冒頭を仮タイトルとして表示
- **UI**: 左パネルのレイアウト改善
  - **ME - LOGS** パネルとして再構築
  - 会話リストが長くなった場合のスクロール対応（システム表示領域を圧迫しないよう調整）
  - 会話が3件以上ある場合の「SHOW ALL/COLLAPSE」展開機能
  - システムステータス（MUTE/VISUALIZER/HELP）をパネル下部に固定表示
- **System**: 会話データのLocal Storage永続化 (`codec-conversations`)

## v0.10.1 - Typing Sound Polish (2026-01-04)
- **Audio**: タイピング音（メッセージ受信音）の調整
  - 周波数を1500Hz（矩形波）に固定し、コール音との親和性を向上
  - 再生時間を0.03sに短縮し、より「データ通信」らしい鋭い音に変更
  - 再生頻度を調整

## v0.10.0 - Calling Screen Animation (2026-01-04)
- **Feature**: キャラクター切り替え時の「CALLING」画面演出
  - メタルギア風の点滅する「CALLING」テキストと周波数を表示
  - コール音再生中の1.5秒間、画面を占有して雰囲気を演出
  - 演出終了後にキャラクターが切り替わる仕様に変更

## v0.9.5 - Sound Refinement & Autoplay Fix (2026-01-04)
- **Audio**: Codecサウンドの調整
  - スタートアップ音 (`codec_open.mp3`) を短縮・調整（0.8s）
  - コール音 (`codec_call.mp3`) の「トゥルントゥルン」部分を単発で切り出し（1.4s）
  - `ffmpeg` を使用して音源を最適化
- **Fix**: ブラウザの自動再生ポリシー対応
  - 初期化オーバーレイを実装したが、ユーザー要望によりUI即時表示に戻し、スタートアップ音は一時的に無効化
  - コール音はキャラクター切り替え時に正常に再生されるよう調整
- **Feature**: `/help` コマンドの実装
  - コマンドリストを表示するシステムメッセージ機能を追加
  - サイドバーに `/HELP` ショートカットを追加

## v0.9.4 - Context Retention & Rendering Fixes (2025-12-31)
- **Fix**: AIが過去の会話履歴（特に自分自身の発言）を無視する問題を修正
  - バックエンドでの履歴構築ロジックを改善し、AI自身の発言を確実にコンテキストに含めるように修正
  - Gemini APIにおいて `system_instruction` を正しく使用するように変更し、ロールエラーを防止
  - 履歴構築時の `[Provider]:` プレフィックス重複バグを修正
- **Fix**: メッセージが表示されない/消える問題を修正
  - ReactMarkdownが `[ ]` をリンク構文として誤認識する問題をエスケープ処理で解決
  - Thinking/Content/Doneイベントのstate更新競合（Race Condition）を解消し、レンダリングを安定化
- **Debug**: バックエンドにファイルベースの詳細デバッグログ (`backend-debug.log`) を導入

## v0.9.3 - Thinking Mode for Ollama (2025-12-30)
- **Feature**: Ollama用Thinkingモード（推論過程表示）を実装
  - ヘッダーに「🧠 ON/OFF」トグルボタンを追加
  - Ollama APIに `think: true` パラメータを送信
  - 推論過程を折りたたみ式パネルで表示
  - パネルはクリックで展開/折りたたみ可能
- **Backend**: `thinking` フィールドをストリーミング対応
  - 非対応モデル検出時にエラーメッセージを返却
  - 対応モデル: qwen3, deepseek-r1, phi4-reasoning 等
- **UI**: 思考完了時にパネルを自動で折りたたむ機能

## v0.9.2 - Streaming Support for Gemini & Ollama (2025-12-29)
- **Feature**: Gemini APIでのストリーミング通信を実装
  - `generateContent` → `streamGenerateContent` (SSE) に変更
  - リアルタイムでトークンをフロントエンドに送信
  - Function Call対応を維持
- **Feature**: Ollama APIでのストリーミング通信を実装
  - `stream: false` → `stream: true` に変更
  - NDJSON形式のチャンク処理を実装
  - Tool Call対応を維持


## v0.6.5 - Native Cat Tool & Skill Reading (2025-12-27)
- **Feature**: AIがスキル定義ファイル (`SKILL.md`) を読み取るための `cat` ツールを実装
- **Backend**: MCPツールとは独立した、軽量なネイティブツールシステム (`builtinTools.ts`) を導入
  - コンテキスト効率化のため、`builtin__` プレフィックスを排除し `cat` として呼び出し可能に
- **SkillManager**: スキル一覧プロンプトに各スキルのファイルパス (`<location>`) を追加し、AIが正確にファイルを参照できるように改善
- **Support**: Anthropic (Claude), Google (Gemini), Ollama の全ハンドラでネイティブツールに対応

## v0.6.2 - Pre-Agent Skills Integration (2025-12-27)
- **Maintenance**: Agent Skills統合前の現状保存
- **Repo**: anthropics/skillsリポジトリからのSkill Creator統合準備
- **Docs**: 実装計画書とタスクリストの作成

## v0.8.2 - UI Visual Enhancements (2025-12-18)
- **UI**: 左上タイトルを「SNAKE」から「CODEC」に変更し、デザインを強調
- **UI**: 左パネル（ME）のポートレートを縮小し、空きスペースにオーディオビジュアライザーとシステムステータス（ENCRYPTION/MUTE/SIGNAL）を追加して情報密度を向上
- **UI**: 右パネルのキャラクターリストアイコンを拡大（32px→50px）し、視認性とクリックしやすさを改善

## v0.8.1 - Dynamic Model ID Resolution Fix (2025-12-18)
- **Fix**: 動的に取得したモデルIDでのチャットが動作しない問題を修正
  - バックエンドでproviderIdから動的にプロバイダー設定を解決するロジックを追加
  - Gemini: `gemini-gemini-2.5-flash` 形式のIDを正しく処理
  - Ollama: `ollama-gpt-oss-20b` → `gpt-oss:20b` への変換を修正
- **Fix**: フロントエンドの接続タイムアウトを2秒→30秒に延長
  - Ollamaの初回モデルロード時のタイムアウトを防止

## v0.8.0 - Dynamic LLM Model Selection (2025-12-18)
- **Feature**: LLMモデル一覧を動的に取得する機能を追加
  - Ollama: ローカルにインストールされたモデルを自動検出
  - Gemini: 利用可能な全モデル（34+）を動的取得
  - Claude/OpenAI: APIキー設定時のみ表示（未設定時はスキップ）
- **Backend**: `/api/models` エンドポイントを追加
  - 各プロバイダーから並列でモデル一覧を取得
  - タイムアウト処理（5-10秒）で安定性を確保
- **Frontend**: モデル選択UIを動的化
  - プロバイダーごとにモデル数を表示
  - ローディング状態とスクロール対応

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
