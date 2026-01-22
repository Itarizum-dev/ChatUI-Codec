---
description: セマンティックバージョニングとCHANGELOG管理
---

# バージョン管理ワークフロー

## セマンティックバージョニング

```
vX.Y.Z
 │ │ └─ パッチ: バグ修正・小さな改善
 │ └─── マイナー: 新機能追加
 └───── メジャー: 大きな機能追加・破壊的変更
```

### バージョン判断基準

| 変更内容 | バージョン | 例 |
|----------|-----------|-----|
| バグ修正、typo修正 | vX.Y.**Z** | v1.9.5 → v1.9.6 |
| 新機能追加 | vX.**Y**.0 | v1.9.6 → v1.10.0 |
| 破壊的変更、大規模リファクタ | **X**.0.0 | v1.10.0 → v2.0.0 |

## 保存時のフロー

### 1. 変更をコミット
```bash
git add -A
git commit -m "feat/fix/refactor: 変更内容の説明"
```

### 2. CHANGELOG.mdを更新
ファイル先頭に新しいエントリを追加:
```markdown
## [vX.Y.Z] - YYYY-MM-DD
- **Feature/Fix/Refactor**: 変更内容の説明
  - 詳細な変更点
```

### 3. CHANGELOGの変更もコミット
```bash
git add CHANGELOG.md
git commit --amend --no-edit
# または新規コミット
git commit -m "chore: update CHANGELOG for vX.Y.Z"
```

### 4. タグ付け
```bash
git tag vX.Y.Z -m "バージョンの説明"
```

### 5. リモートにプッシュ
```bash
git push origin main
git push --tags
```

## コミットメッセージ規約

```
feat:     新機能
fix:      バグ修正
refactor: リファクタリング
docs:     ドキュメント
chore:    雑務（ビルド、設定等）
style:    フォーマット変更
test:     テスト追加・修正
```

## 一括実行例

```bash
# バージョン番号を設定
VERSION="v1.10.1"
MESSAGE="機能の説明"

# コミット → タグ → プッシュ
git add -A && \
git commit -m "feat: ${MESSAGE}" && \
git tag ${VERSION} -m "${MESSAGE}" && \
git push origin main && \
git push --tags
```

## 注意事項

- タグは一度プッシュすると削除が面倒なので慎重に
- CHANGELOGは日本語でOK
- 破壊的変更は極力避ける（v2.0.0は慎重に）
