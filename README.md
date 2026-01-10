# CODEC Chat UI - Retro Sci-Fi AI Interface

レトロフューチャーな無線機（CODEC）をモチーフにした、没入型AIチャットインターフェースです。
ローカルLLM (Ollama) や、Gemini, Claude, OpenAI などの主要なAIモデルと会話ができ、**MCP (Model Context Protocol)** や **Agent Skills** といった高度なエージェント機能をサポートしています。

![Codec UI Screenshot](/frontend/public/og-image.png?raw=true)

## 特徴
- 🤖 **Multi-LLM Support**: Google Gemini, Anthropic Claude, OpenAI, そしてローカルの Ollama に完全対応。
- 🛠 **MCP (Model Context Protocol)**: Claude Desktop互換のMCPをサポート。Web検索、ファイル操作、GitHub連携など、AIの機能を無限に拡張可能。
- ⚡️ **Agent Skills**: `SKILL.md` (Markdown) で手順を定義するだけで、AIに複雑なタスクを自律的に実行させることが可能。
- 📟 **Retro Aesthetics**: 走査線、モノクロームグリーン、ドット絵による、没入感のあるレトロなUI体験。
- 🏠 **Local First**: Ollama + Docker で、プライバシーを守りながらローカル環境で動作。

## 機能ガイド

### ⚙️ MCP (Model Context Protocol)
**「MCP ON/OFF」** ボタンで切り替えます。
標準化されたプロトコル「MCP」を通じて、AIが外部ツールを安全に使用できます。
- 画面右下の設定ボタンから、接続するMCPサーバーを管理可能。
- ファイルシステム操作、ブラウザ制御、データベース接続など、エージェント的な振る舞いを実現します。

### ⚡️ Skills (スキルシステム)
AIに特定のタスク手順を教える「スキル」機能です。
`/skills` ディレクトリにMarkdownファイル (`SKILL.md`) を置くだけで、AIはその手順を理解し、実行できるようになります。
- 例: 文書作成、コードレビュー、データ分析などの定型業務を自動化。
- チャット欄で `/skill` と入力すると、利用可能なスキル一覧を確認できます。

### 👥 ペルソナ切替 (Frequency)
右側のパネルには、周波数（Frequency）ごとの通信チャンネルが表示されています。
クリックすることで、AIの口調や役割（ペルソナ）を瞬時に切り替えることができます。
- **140.85 (Tactical)**: 冷静沈着な現場のプロフェッショナル。
- **141.12 (Command)**: 的確な指示を与える指揮官タイプ。
- **141.80 (Science)**: 技術的な解説を得意とするエンジニアタイプ。

### 🧠 Thinking Mode (思考モード)
**「🧠 ON/OFF」** ボタンで切り替えます (対応モデル専用)。
DeepSeek-R1 や Qwen などの Chain of Thought（思考プロセス）に対応しており、AIが回答に至るまでの「思考のログ」を視覚化します。

## 必要条件
- **Docker Desktop**: 推奨（ワンコマンドで起動可能）
- または **Node.js**: v18以上（手動セットアップの場合）
- **Ollama**: ローカルLLMを使用する場合

## クイックスタート (Docker を使用) 🐳

Docker Desktopがインストールされていれば、以下のコマンドだけで起動できます。

```bash
# 1. リポジトリのクローン
git clone https://github.com/Itarizum-dev/ChatUI-Codec.git
cd ChatUI-Codec

# 2. 環境変数の設定
cp backend/.env.example backend/.env
# backend/.env を編集して、必要なAPIキー (Google, Anthropic等) を入力

# 3. ビルド＆起動
docker compose up --build
```

ブラウザで [http://localhost:3000](http://localhost:3000) にアクセスすると起動します。

### 停止方法
```bash
docker compose down
```

### Ollamaを使用する場合
Docker版でローカルOllamaを使用するには、**ホスト側（Mac/Windows/Linux）でOllamaを起動しておく**必要があります。
Docker Compose の設定により、自動的に `host.docker.internal` 経由でホストのOllamaに接続します。

---

## 手動セットアップ (Node.js を使用)

Dockerを使わない場合は、以下の手順でセットアップできます。

### 1. リポジトリのクローン
```bash
git clone https://github.com/Itarizum-dev/ChatUI-Codec.git
cd ChatUI-Codec
```

### 2. 環境変数の設定
BackendとFrontendそれぞれに設定ファイル (`.env`) を用意します。

**Backend (APIキーなど)**
```bash
cd backend
npm install
cp .env.example .env
# .envファイルを編集して、必要なAPIキー (Google, Anthropic等) を入力してください
```

**Frontend (UI設定)**
```bash
cd ../frontend
npm install
cp .env.example .env
# 基本的にそのままでOKです
```

### 3. アプリケーションの起動
BackendとFrontendを別々のターミナルで起動します。

**Terminal 1 (Backend)**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend)**
```bash
cd frontend
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) にアクセスすると起動します。

## 外部からのアクセス (ngrok)
友人に画面を見せたり、スマホからアクセスしたい場合は `ngrok` を使います。

1. [ngrokのインストールと認証](https://ngrok.com/download)を済ませます。
2. アプリ起動中に、新しいターミナルで以下を実行します：
   ```bash
   ngrok http 3000
   ```
3. 表示された `https://...` のURLにアクセスします。

## 🚀 ペルソナのセットアップ (初期化)

インストール直後は、AIアシスタント (SYSTEM) とあなた (ME) のみが表示されます。
スネークやオタコンなど、デフォルトのキャラクター達と会話するには、以下のコマンドでペルソナデータを有効化してください。

```bash
cp frontend/public/data/personas.sample.json frontend/public/data/personas.json
```

### カスタマイズについて
作成された `personas.json` を編集することで、キャラクターの設定を変更したり、新しいペルソナを追加したりできます（Git管理外のため、プライベートな設定も可能です）。
基本的にはアプリ上のエディタでカスタマイズすることをお勧めしますが、詳細な設定を行いたい場合は直接編集してください。

## ライセンス
MIT License
