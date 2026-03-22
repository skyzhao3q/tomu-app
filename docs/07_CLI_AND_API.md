# tomu - CLI・API リファレンス設計書

Status: Draft v1
Date: 2026-03-22

---

## 1. CLI (ターミナルコマンド)

### 1.1 概要

`tomu` コマンドは Bun で実行されるターミナル CLI で、GUI を起動せずにバックエンド API と直接対話する。
裏側では `http://localhost:23001/api/*` を HTTP リクエストで呼び出している。

### 1.2 コマンド一覧

| コマンド | 説明 |
|:---------|:-----|
| `tomu` | デフォルト: チャットを開始 |
| `tomu chat` | 対話型チャット |
| `tomu config list` | 設定一覧表示 |
| `tomu config set <key> <value>` | 設定値の変更 |
| `tomu providers` | AI プロバイダー一覧 |
| `tomu providers add` | プロバイダー追加 |
| `tomu providers test` | 接続テスト |
| `tomu skill list` | インストール済みスキル一覧 |
| `tomu skill install <user/repo>` | スキルインストール (GitHub) |
| `tomu skill uninstall <name>` | スキルアンインストール |
| `tomu skill search <query>` | コミュニティスキル検索 |
| `tomu skill update` | 全スキルの更新 |
| `tomu threads` | スレッド一覧 |
| `tomu threads search <query>` | スレッド検索 |
| `tomu memory list` | 記憶一覧 |
| `tomu memory search <query>` | ベクトル検索 |
| `tomu people list` | 人物プロファイル一覧 |
| `tomu people show <name>` | 人物詳細表示 |
| `tomu sleep` | 疲労度リセット (睡眠) |
| `tomu emotion` | 現在の感情状態確認 |
| `tomu status` | サーバー・エージェント状態 |

### 1.3 CLI → API マッピング

| CLI コマンド | HTTP リクエスト |
|:-------------|:---------------|
| `tomu chat "message"` | `POST /api/chat/completions` |
| `tomu providers` | `GET /api/providers` |
| `tomu providers add` | `POST /api/providers` |
| `tomu skill list` | `GET /api/skills` |
| `tomu skill install x/y` | `POST /api/skills` |
| `tomu threads` | `GET /api/threads` |
| `tomu memory search q` | `POST /api/memories/search` |
| `tomu people list` | `GET /api/people` |
| `tomu config list` | `GET /api/settings` |

---

## 2. API エンドポイント完全一覧

### 2.1 Chat & Threads

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| POST | `/api/chat/completions` | メインチャット (コンテキスト合成 + エージェントループ) |
| POST | `/api/chat/:chatId/send-audio` | 音声メッセージ送信 |
| POST | `/api/chat/:chatId/send-document` | ドキュメント送信 |
| POST | `/api/chat/:chatId/send-photo` | 画像送信 |
| POST | `/api/chat/:chatId/send-video` | 動画送信 |
| POST | `/api/chat/:chatId/send-voice` | 音声ファイル送信 |
| GET | `/api/threads` | スレッド一覧 |
| POST | `/api/threads` | 新規スレッド作成 |
| GET | `/api/threads/:id` | スレッド詳細 |
| DELETE | `/api/threads/:id` | スレッド削除 |
| GET | `/api/threads/:threadId/messages` | メッセージ履歴 |
| GET | `/api/threads/:threadId/agent-crew` | サブエージェント状態 |
| GET | `/api/threads/:threadId/context-usage` | コンテキスト使用量 |
| GET | `/api/threads/:threadId/diff-stats` | 差分統計 |
| GET | `/api/threads/:threadId/file-writes` | ファイル書き込み履歴 |
| GET | `/api/threads/:threadId/subagent-messages` | サブエージェントメッセージ |

### 2.2 LLM Proxy

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| POST | `/proxy/:providerId/v1/messages` | Anthropic 形式プロキシ |
| POST | `/proxy/:providerId/v1/responses` | OpenAI 形式プロキシ |

### 2.3 Providers & Models

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/providers` | プロバイダー一覧 |
| POST | `/api/providers` | プロバイダー追加 |
| PUT | `/api/providers/:id` | プロバイダー更新 |
| DELETE | `/api/providers/:id` | プロバイダー削除 |
| POST | `/api/providers/:id/test` | 接続テスト |
| GET | `/api/providers/:id/models` | モデル一覧 |
| POST | `/api/providers/:id/models/fetch` | モデルフェッチ |
| PUT | `/api/providers/:id/models` | モデル設定更新 |
| POST | `/api/providers/:id/authenticate` | 認証 |
| POST | `/api/providers/:id/logout` | ログアウト |
| GET | `/api/providers/:id/accounts` | アカウント一覧 |
| DELETE | `/api/providers/:id/accounts/:accountId` | アカウント削除 |
| POST | `/api/providers/:id/refresh-quotas` | クォータ更新 |
| GET | `/api/models` | 全モデル統合一覧 |

### 2.4 Memory & Identity

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/memories` | メモリ一覧 |
| POST | `/api/memories` | メモリ追加 |
| GET | `/api/memories/:id` | メモリ詳細 |
| DELETE | `/api/memories/:id` | メモリ削除 |
| DELETE | `/api/memories` | メモリ一括削除 |
| POST | `/api/memories/search` | ベクトル類似度検索 |
| GET | `/api/memories/stats` | メモリ統計 |
| GET | `/api/memories/status` | メモリシステム状態 |
| GET | `/api/memories/embedding-model` | 埋め込みモデル情報 |
| GET | `/api/memories/rebuild-progress` | インデックス再構築進捗 |
| GET | `/api/people` | 人物一覧 |
| GET | `/api/people/:name` | 人物詳細 |
| POST | `/api/people` | 人物追加 |
| PUT | `/api/people/:name` | 人物更新 |
| DELETE | `/api/people/:name` | 人物削除 |
| GET | `/api/people/:name/avatar` | アバター取得 |
| DELETE | `/api/people/:name/avatar` | アバター削除 |
| GET | `/api/settings` | アプリ設定取得 |
| PUT | `/api/settings` | アプリ設定更新 |

### 2.5 Workspaces & Files

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/workspaces` | ワークスペース一覧 |
| GET | `/api/workspaces/:id` | ワークスペース詳細 |
| DELETE | `/api/workspaces/:id` | ワークスペース削除 |
| GET | `/api/workspaces/:id/files` | ファイルツリー |
| GET | `/api/workspaces/:id/files/{*path}` | ファイル内容取得 |
| GET | `/api/workspaces/:id/files-binary/{*path}` | バイナリファイル取得 |
| DELETE | `/api/workspaces/:id/files/{*path}` | ファイル削除 |
| GET | `/api/workspaces/:id/git/branches` | Git ブランチ一覧 |
| GET | `/api/workspaces/:id/git/diff` | Git 差分 |
| GET | `/api/workspaces/:id/git/diff-stats` | Git 差分統計 |
| GET | `/api/workspaces/:id/git/is-repo` | Git リポジトリ判定 |
| GET | `/api/workspaces/:id/git/commit/:hash` | コミット詳細 |
| GET | `/api/workspaces/:id/git/conflicts` | コンフリクト一覧 |
| DELETE | `/api/workspaces/:id/git/branch` | ブランチ削除 |
| DELETE | `/api/workspaces/:id/git/worktrees` | Worktree 削除 |

### 2.6 Skills, Plugins, MCP

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/skills` | スキル一覧 |
| POST | `/api/skills` | スキルインストール |
| DELETE | `/api/skills/:id` | スキル削除 |
| GET | `/api/skills-path` | スキルディレクトリパス |
| POST | `/api/skills/refresh` | メタデータ再読み込み |
| GET | `/api/plugins` | プラグイン一覧 |
| POST | `/api/plugins` | プラグインインストール |
| GET | `/api/plugins/:id` | プラグイン詳細 |
| DELETE | `/api/plugins/:id` | プラグイン削除 |
| POST | `/api/plugins/:id/enable` | 有効化 |
| POST | `/api/plugins/:id/disable` | 無効化 |
| GET/PUT | `/api/plugins/:id/settings` | 設定 |
| GET/PUT | `/api/plugins/:id/permissions` | 権限 |
| POST | `/api/plugins/:id/update` | 更新 |
| GET | `/api/plugins/updates` | 更新可能一覧 |
| GET | `/api/plugins-path` | プラグインディレクトリパス |
| GET | `/api/mcp-servers` | MCP サーバー一覧 |
| POST | `/api/mcp-servers` | MCP サーバー追加 |
| GET | `/api/mcp-servers/:id` | MCP サーバー詳細 |
| DELETE | `/api/mcp-servers/:id` | MCP サーバー削除 |
| GET | `/api/mcp-servers/:id/oauth/status` | OAuth 状態 |
| DELETE | `/api/mcp-servers/:id/oauth` | OAuth トークン削除 |

### 2.7 Sub-Agent Tasks

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/agents/tasks/:taskId` | タスク状態取得 |
| POST | `/api/agents/tasks/:taskId/resume` | タスク再開 |

### 2.8 Browser Automation (Chrome Relay)

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/chrome-relay/status` | Chrome 接続状態 |
| GET | `/api/chrome-relay/token` | 認証トークン |
| GET | `/api/chrome-relay/extension-path` | 拡張機能パス |
| POST | `/api/chrome-relay/launch-chrome` | Chrome 起動 |
| POST | `/api/chrome-relay/navigate` | URL ナビゲーション |
| POST | `/api/chrome-relay/click` | 要素クリック |
| POST | `/api/chrome-relay/read` | ページ内容読み取り |
| POST | `/api/chrome-relay/read-dom` | DOM 読み取り |
| POST | `/api/chrome-relay/screenshot` | スクリーンショット |
| POST | `/api/chrome-relay/scroll` | スクロール |
| POST | `/api/chrome-relay/eval` | JS 評価 |
| POST | `/api/chrome-relay/back` | ブラウザバック |
| POST | `/api/chrome-relay/forward` | ブラウザフォワード |
| POST | `/api/chrome-relay/detach` | タブ切断 |
| POST | `/api/chrome-relay/detach-all` | 全タブ切断 |
