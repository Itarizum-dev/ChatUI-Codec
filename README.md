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
