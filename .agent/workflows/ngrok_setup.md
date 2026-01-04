---
description: ngrokを使ってローカル環境を外部に公開する方法
---

# Codec UI - ngrokを使った外部公開手順

このワークフローでは、ローカルのOllamaをそのまま使いながら、あなたのPCで動いているCodec UIをインターネット経由で友人に共有する方法を説明します。

## 事前準備
- [x] ngrokのインストール (`brew install ngrok/ngrok/ngrok`)
- [x] ngrokの認証 (`ngrok config add-authtoken <TOKEN>`)

## 手順

1. **アプリを起動する**
   通常通り、FrontendとBackendの両方を起動しておいてください。
   ```bash
   # ターミナル1 (Backend)
   cd backend && npm run dev
   
   # ターミナル2 (Frontend)
   cd frontend && npm run dev
   ```

2. **ngrokトンネルを開始する**
   新しいターミナルを開き、以下のコマンドを実行します。
   ```bash
   ngrok http 3000
   ```
   // turbo
   
3. **URLを共有する**
   - ターミナルに表示された `https://xxxx-xxxx.ngrok-free.app` というURLをコピーします。
   - これを友人や自分のスマホに送ります。
   - **重要**: 最初にアクセスした際、「Visit Site」という警告画面が出ることがあります。その場合はボタンを押して進んでください。

## トラブルシューティング
- **OFFLINEエラーが出る**: `frontend/.env` の `NEXT_PUBLIC_BACKEND_URL` が空になっているか確認してください。ここが空でないと、外部からの接続がブロックされます。
- **Mixed Contentエラー**: ngrok経由でアクセスする際は、必ず `https` のURLを使用してください。`http://localhost:3000` は自分専用です。
