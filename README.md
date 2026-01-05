# CODEC Chat UI - Metal Gear Style AI Interface

Metal Gear Solid 2の無線画面（CODEC）を再現した、AIチャットインターフェースです。
ローカルLLM (Ollama) や、Gemini, Claude, OpenAI などの主要なAIモデルと会話ができます。

![Codec UI Screenshot](/frontend/public/og-image.png?raw=true)

## 特徴
- 📟 **Authentic Design**: MGS2の無線画面を忠実に再現したレトロで没入感のあるUI。
- 🏠 **Local First**: Ollamaをサポートし、ローカル環境でプライバシーを守りながらAIと会話可能。
- 🔗 **Multi-Provider**: Google Gemini, Anthropic Claude, OpenAI にも対応。
- 🛠 **MCP Support**: Model Context Protocol (MCP) をサポートし、外部ツールとの連携が可能。
- 🌍 **External Access**: ngrokを使用して、安全に外部からアクセス可能。

## 機能ガイド

### 👥 キャラクター (Frequency)
右側のパネルには、通信相手（周波数）が表示されています。クリックすることでAIのペルソナ（人格）を切り替えることができます。
- **140.85 (SNAKE)**: 伝説の傭兵。冷静沈着で軍事的な口調。
- **141.12 (COLONEL)**: キャンベル大佐。作戦指揮官としてアドバイスを提供。
- **141.80 (OTACON)**: ハル・エメリッヒ。技術・アニメ・科学オタク。フレンドリーな口調。

### ⚙️ MCP (Model Context Protocol)
**「MCP ON/OFF」** ボタンで切り替えます。
有効にすると、AIは外部ツール（Web検索、システム操作、ファイル読み書きなど）を使用できるようになります。
- 画面右下の設定ボタンから、接続するMCPサーバーを管理できます。
- 使用するには、対応したモデル（Claude 3.5 Sonnet推奨）が必要です。

### 🧠 Thinking Mode (思考モード)
**「🧠 ON/OFF」** ボタンで切り替えます (Ollama専用)。
ローカルLLM (DeepSeek-R1等) のChain of Thought（思考プロセス）を視覚化します。AIがどのように答えを導き出したのか、その思考の過程をログとして表示します。
※ LLMが `<think>` タグを出力する場合のみ有効です。

### ⚡️ Skills (スキルシステム)
AIに特定のタスクを教え込むことができます。
`/skills` ディレクトリにある `SKILL.md` に手順を記述することで、AIはその手順書を読み込み、複雑なタスクを自律的に実行できるようになります。

## 必要条件
- **Node.js**: v18以上
- **Ollama**: ローカルLLMを使用する場合 (推奨)

## セットアップ (インストール)

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
cp .env.example .env
# .envファイルを編集して、必要なAPIキー (Google, Anthropic等) を入力してください
```

**Frontend (UI設定)**
```bash
cd ../frontend
cp .env.example .env
# 基本的にそのままでOKです
```

### 3. アプリケーションの起動
BackendとFrontendを別々のターミナルで起動します。

**Terminal 1 (Backend)**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 (Frontend)**
```bash
cd frontend
npm install
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

## ライセンス
MIT License
