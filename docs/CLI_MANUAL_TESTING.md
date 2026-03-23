# tomu CLI 手動テスト手順

Date: 2026-03-23

---

## 概要

`apps/cli` は Commander.js ベースのターミナル CLI で、`apps/desktop` の Express バックエンド (`localhost:33001`) に HTTP で接続する。

---

## Step 1: 依存関係のインストール（初回のみ）

```bash
pnpm install
```

---

## Step 2: バックエンドサーバーを起動

```bash
pnpm dev:server
```

→ `tomu server listening on http://localhost:33001` と表示されれば OK

---

## Step 3: CLI を使う（別ターミナルで）

```bash
pnpm tomu status
pnpm tomu config list
pnpm tomu memory list
```

---

## コマンドリファレンス

すべてのコマンドに `--json` フラグを付けると JSON 形式で出力される。

| コマンド | 説明 |
|---------|------|
| `pnpm tomu status` | サーバー起動確認 |
| `pnpm tomu config list/get/set` | 設定管理 |
| `pnpm tomu provider list/set` | AI プロバイダー |
| `pnpm tomu chat` | チャット |
| `pnpm tomu memory list/add/delete` | メモリ管理 |
| `pnpm tomu skill list` | スキル一覧 |
| `pnpm tomu soul` | Soul 設定 |
| `pnpm tomu people list` | 人物一覧 |
| `pnpm tomu task list` | タスク一覧 |
| `pnpm tomu usage` | 使用量確認 |
| `pnpm tomu mcp list` | MCP サーバー |
| `pnpm tomu plugin list` | プラグイン |
| `pnpm tomu export` | データエクスポート |
| `pnpm tomu thread list` | スレッド一覧 |
| `pnpm tomu model list` | モデル一覧 |
| `pnpm tomu version` | バージョン確認 |

---

## 環境変数

| 変数名 | デフォルト | 説明 |
|--------|-----------|------|
| `TOMU_API_URL` | `http://localhost:33001` | バックエンド API の URL |

---

## トラブルシューティング

### `❌ API Server is not running or unreachable.`

→ `pnpm dev:server` でバックエンドを起動する。
