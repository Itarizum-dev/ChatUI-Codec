---
description: featureブランチをmainにマージしてGitHubにプッシュする
---

# Git Merge & Push ワークフロー

featureブランチの作業が完了したら、以下の手順でmainにマージしてGitHubにプッシュします。

## 前提条件
- featureブランチで作業が完了していること
- コミット済みであること
- タグ付け済みであること（必要な場合）

## 手順

### 1. 現在のブランチを確認
```bash
git branch
git status
```
- 未コミットの変更がないか確認

### 2. mainブランチに切り替え
```bash
git checkout main
```

### 3. mainを最新に更新（チーム開発時）
```bash
git pull origin main
```

### 4. featureブランチをマージ
```bash
git merge feature/ブランチ名 -m "Merge feature/ブランチ名: 説明"
```
- コンフリクトがあれば解決してコミット

### 5. GitHubにプッシュ
```bash
git push origin main
```

### 6. タグもプッシュ（バージョンタグがある場合）
```bash
git push --tags
```

### 7. （オプション）featureブランチを削除
```bash
# ローカル
git branch -d feature/ブランチ名

# リモート
git push origin --delete feature/ブランチ名
```

## 一括実行例

```bash
# featureブランチからmainにマージしてプッシュ
git checkout main && \
git merge feature/persona-permissions -m "Merge feature/persona-permissions: v1.10.0" && \
git push origin main && \
git push --tags
```

## トラブルシューティング

### マージコンフリクト
```bash
# コンフリクトを確認
git status

# 手動で解決後
git add .
git commit -m "Resolve merge conflicts"
```

### プッシュが拒否された
```bash
# リモートの変更を取り込んでから再プッシュ
git pull --rebase origin main
git push origin main
```
