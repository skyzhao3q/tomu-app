# tomu - CLI・API リファレンス設計書

Status: Draft v2
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
| `tomu soul` | 現在の SOUL.md 表示 |
| `tomu soul set` | SOUL.md の編集・更新 |
| `tomu user` | 現在の USER.md 表示 |
| `tomu user set` | USER.md の編集・更新 |
| `tomu cron list` | スケジュールタスク一覧 |
| `tomu cron add` | スケジュールタスク追加 |
| `tomu cron remove <id>` | スケジュールタスク削除 |
| `tomu cron run <id>` | スケジュールタスク即時実行 |
| `tomu cron history` | スケジュール実行履歴 |
| `tomu cron enable <id>` | スケジュールタスク有効化 |
| `tomu cron disable <id>` | スケジュールタスク無効化 |
| `tomu tts` | 音声/TTS 管理 |
| `tomu group list` | グループチャット一覧 |
| `tomu group send <groupId> "msg"` | グループにメッセージ送信 |
| `tomu group history <groupId>` | グループチャット履歴 |
| `tomu group search <query>` | グループ検索 |
| `tomu group context <groupId>` | グループコンテキスト表示 |
| `tomu dm <userId> "message"` | ダイレクトメッセージ送信 |
| `tomu msg delete <msgId>` | メッセージ削除 |
| `tomu msg react <msgId> <emoji>` | リアクション付与 |
| `tomu msg sticker <msgId> <sticker>` | スタンプ送信 |
| `tomu heartbeat status` | ハートビート状態確認 |
| `tomu heartbeat enable` | ハートビート有効化 |
| `tomu heartbeat disable` | ハートビート無効化 |
| `tomu heartbeat interval <sec>` | ハートビート間隔設定 |
| `tomu update check` | アップデート確認 |
| `tomu update download` | アップデートダウンロード |
| `tomu update install` | アップデート適用 |
| `tomu update status` | アップデート状態表示 |
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
| GET | `/api/threads` | スレッド一覧 |
| POST | `/api/threads` | 新規スレッド作成 |
| GET | `/api/threads/:id` | スレッド詳細 |
| PUT | `/api/threads/:id` | スレッド更新 |
| DELETE | `/api/threads/:id` | スレッド削除 |
| POST | `/api/threads/:id/branch` | スレッド分岐 |
| POST | `/api/threads/:id/activate` | スレッドアクティブ化 |
| POST | `/api/threads/:id/switch` | スレッド切り替え |
| POST | `/api/threads/:id/compact` | スレッド圧縮 |
| GET | `/api/threads/:threadId/messages` | メッセージ履歴 |
| GET | `/api/threads/:threadId/subagent-messages` | サブエージェントメッセージ |
| GET | `/api/threads/:threadId/agent-crew` | サブエージェント状態 |
| GET | `/api/threads/:threadId/context-usage` | コンテキスト使用量 |
| GET | `/api/threads/:threadId/file-writes` | ファイル書き込み履歴 |
| GET | `/api/threads/:threadId/diff-stats` | 差分統計 |
| POST | `/api/messages/:messageId/switch-version` | メッセージバージョン切り替え |
| DELETE | `/api/messages/:messageId` | メッセージ削除 |
| POST | `/api/messages/:messageId/rollback` | メッセージまでロールバック |
| GET | `/api/search/threads` | スレッド検索 |

### 2.2 LLM Proxy

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| POST | `/proxy/:providerId/v1/responses` | OpenAI Responses 形式プロキシ |
| POST | `/proxy/:providerId/responses` | OpenAI Responses 形式プロキシ (短縮) |
| POST | `/anthropic-proxy/:providerId/v1/messages` | Anthropic Messages 形式プロキシ |

### 2.3 Providers & Models

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/providers` | プロバイダー一覧 |
| POST | `/api/providers` | プロバイダー追加 |
| PUT | `/api/providers/:id` | プロバイダー更新 |
| DELETE | `/api/providers/:id` | プロバイダー削除 |
| POST | `/api/providers/:id/test` | 接続テスト |
| POST | `/api/providers/:id/authenticate` | プラグインプロバイダー認証 |
| POST | `/api/providers/:id/logout` | プラグインプロバイダーログアウト |
| GET | `/api/providers/:id/accounts` | アカウント一覧 |
| DELETE | `/api/providers/:id/accounts/:accountId` | アカウント削除 |
| POST | `/api/providers/:id/refresh-quotas` | クォータ更新 |
| GET | `/api/models` | 全モデル統合一覧 |
| GET | `/api/providers/:id/models` | プロバイダー別モデル一覧 |
| POST | `/api/providers/:id/models/fetch` | モデルリストフェッチ |
| PUT | `/api/providers/:id/models` | モデル設定更新 |
| GET | `/api/threads/:threadId/providers/:providerId/acp-commands` | ACP コマンド取得 |

### 2.4 Memory & RAG

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/memories` | メモリ一覧 |
| POST | `/api/memories` | メモリ追加 |
| GET | `/api/memories/:id` | メモリ詳細 |
| PUT | `/api/memories/:id` | メモリ更新 |
| DELETE | `/api/memories/:id` | メモリ削除 |
| DELETE | `/api/memories` | メモリ一括削除 |
| POST | `/api/memories/search` | ベクトル類似度検索 |
| GET | `/api/memories/stats` | メモリ統計 |
| GET | `/api/memories/status` | メモリサービス状態 |
| GET | `/api/memories/embedding-model` | 埋め込みモデル情報 |
| GET | `/api/memories/rebuild-progress` | インデックス再構築進捗 |
| POST | `/api/memories/rebuild` | メモリ埋め込み再構築 |
| POST | `/api/memories/cancel-rebuild` | 再構築キャンセル |
| GET | `/api/local-embeddings/models` | ローカル埋め込みモデル一覧 |
| POST | `/api/local-embeddings/download` | ローカル埋め込みモデルダウンロード |
| DELETE | `/api/local-embeddings/models/:modelId` | ローカル埋め込みモデル削除 |
| GET | `/api/local-embeddings/progress` | ダウンロード進捗 |

### 2.5 People & Profiles

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/people` | 人物一覧 |
| GET | `/api/people/:name` | 人物詳細 |
| PUT | `/api/people/:name` | 人物更新 |
| DELETE | `/api/people/:name` | 人物削除 |
| GET | `/api/people/:name/avatar` | アバター取得 |
| POST | `/api/people/:name/avatar` | アバターアップロード |
| DELETE | `/api/people/:name/avatar` | アバター削除 |
| GET | `/api/gallery/images` | ギャラリー画像一覧 |
| GET | `/api/gallery/images/:id` | ギャラリー画像詳細 |

### 2.6 Settings & Tool Model

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/settings` | アプリ設定取得 |
| PUT | `/api/settings` | アプリ設定更新 |
| POST | `/api/settings/reset` | 設定リセット |
| POST | `/api/settings/test-proxy` | プロキシ接続テスト |
| POST | `/api/settings/test-telegram` | Telegram 接続テスト |
| POST | `/api/settings/detect-telegram-users` | Telegram ユーザー検出 |
| GET | `/api/tool-model` | ツールモデル取得 |
| GET | `/api/tool-model/memory` | メモリツールモデルエンドポイント |
| POST | `/api/tool-model/test` | ツールモデルテスト |

### 2.7 Workspaces & Files

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/workspaces` | ワークスペース一覧 |
| POST | `/api/workspaces` | ワークスペース作成 |
| GET | `/api/workspaces/:id` | ワークスペース詳細 |
| PUT | `/api/workspaces/:id` | ワークスペース更新 |
| DELETE | `/api/workspaces/:id` | ワークスペース削除 |
| GET | `/api/workspaces/:id/files` | ファイルツリー |
| GET | `/api/workspaces/:id/files/{*filePath}` | ファイル内容取得 |
| GET | `/api/workspaces/:id/files-binary/{*filePath}` | バイナリファイル取得 |
| POST | `/api/workspaces/:id/files/touch` | ファイル作成 (touch) |
| POST | `/api/workspaces/:id/files/mkdir` | ディレクトリ作成 |
| POST | `/api/workspaces/:id/files/rename` | ファイル名変更 |
| POST | `/api/workspaces/:id/files/copy` | ファイルコピー |
| POST | `/api/workspaces/:id/files/move` | ファイル移動 |
| DELETE | `/api/workspaces/:id/files/{*filePath}` | ファイル削除 |
| POST | `/api/workspaces/:id/preview/start` | プレビューサーバー起動 |
| POST | `/api/workspaces/:id/preview/stop` | プレビューサーバー停止 |
| GET | `/api/workspaces/:id/preview/status` | プレビューサーバー状態 |
| GET | `/api/workspaces/:id/preview/detect` | プロジェクトタイプ検出 |
| GET | `/api/workspaces/:id/preview/html-files` | HTML ファイル一覧 |

### 2.8 Git Operations

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/workspaces/:id/git/status` | Git ステータス |
| GET | `/api/workspaces/:id/git/is-repo` | Git リポジトリ判定 |
| POST | `/api/workspaces/:id/git/init` | Git リポジトリ初期化 |
| POST | `/api/workspaces/:id/git/stage` | ファイルをステージ |
| POST | `/api/workspaces/:id/git/unstage` | ファイルをアンステージ |
| POST | `/api/workspaces/:id/git/stage-all` | 全ファイルをステージ |
| POST | `/api/workspaces/:id/git/unstage-all` | 全ファイルをアンステージ |
| POST | `/api/workspaces/:id/git/discard` | 変更を破棄 |
| GET | `/api/workspaces/:id/git/diff` | Git 差分 |
| GET | `/api/workspaces/:id/git/diff-stats` | Git 差分統計 |
| POST | `/api/workspaces/:id/git/commit` | コミット作成 |
| POST | `/api/workspaces/:id/git/generate-commit-message` | AI コミットメッセージ生成 |
| GET | `/api/workspaces/:id/git/log` | コミットログ |
| GET | `/api/workspaces/:id/git/commit/:hash` | コミット詳細 |
| GET | `/api/workspaces/:id/git/branches` | ブランチ一覧 |
| POST | `/api/workspaces/:id/git/checkout` | ブランチチェックアウト |
| POST | `/api/workspaces/:id/git/create-branch` | ブランチ作成 |
| DELETE | `/api/workspaces/:id/git/branch` | ブランチ削除 |
| GET | `/api/workspaces/:id/git/remotes` | リモート一覧 |
| POST | `/api/workspaces/:id/git/push` | プッシュ |
| POST | `/api/workspaces/:id/git/pull` | プル |
| POST | `/api/workspaces/:id/git/fetch` | フェッチ |
| GET | `/api/workspaces/:id/git/stash` | スタッシュ一覧 |
| POST | `/api/workspaces/:id/git/stash/push` | スタッシュ保存 |
| POST | `/api/workspaces/:id/git/stash/pop` | スタッシュ復元 (pop) |
| POST | `/api/workspaces/:id/git/stash/apply` | スタッシュ適用 (apply) |
| POST | `/api/workspaces/:id/git/stash/drop` | スタッシュ破棄 |
| GET | `/api/workspaces/:id/git/worktrees` | Worktree 一覧 |
| POST | `/api/workspaces/:id/git/worktrees` | Worktree 作成 |
| DELETE | `/api/workspaces/:id/git/worktrees` | Worktree 削除 |
| GET | `/api/workspaces/:id/git/rebase/status` | リベース状態 |
| POST | `/api/workspaces/:id/git/rebase` | リベース開始 |
| POST | `/api/workspaces/:id/git/rebase/continue` | リベース続行 |
| POST | `/api/workspaces/:id/git/rebase/abort` | リベース中止 |
| GET | `/api/workspaces/:id/git/conflicts` | コンフリクト一覧 |
| POST | `/api/workspaces/:id/git/conflicts/resolve` | コンフリクト手動解決 |
| POST | `/api/workspaces/:id/git/conflicts/resolve-ai` | コンフリクト AI 解決 |
| POST | `/api/workspaces/:id/git/conflicts/resolve-all-ai` | 全コンフリクト AI 一括解決 |
| POST | `/api/workspaces/:id/worktree/cleanup` | マージ後 Worktree クリーンアップ |
| GET | `/api/worktrunk/status` | Worktrunk 状態 |
| POST | `/api/worktrunk/install` | Worktrunk インストール |

### 2.9 GitHub Integration

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/github/status` | GitHub 接続状態 |
| GET | `/api/workspaces/:id/github/pr` | PR 情報取得 |
| POST | `/api/workspaces/:id/github/pr` | PR 作成 |
| POST | `/api/workspaces/:id/github/pr/merge` | PR マージ |
| POST | `/api/workspaces/:id/github/pr/close` | PR クローズ |
| GET | `/api/workspaces/:id/github/pr/refresh` | PR ステータスリフレッシュ |
| GET | `/api/workspaces/:id/github/ci-logs` | CI ログ取得 |

### 2.10 Skills & Plugins

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/skills` | スキル一覧 |
| GET | `/api/skills/:id` | スキル詳細 |
| PUT | `/api/skills/:id` | スキル更新 |
| DELETE | `/api/skills/:id` | スキル削除 |
| POST | `/api/skills/refresh` | スキルメタデータ再読み込み |
| GET | `/api/skills-path` | スキルディレクトリパス |
| GET | `/api/plugins` | プラグイン一覧 |
| POST | `/api/plugins` | プラグインインストール |
| POST | `/api/plugins/refresh` | プラグイン再読み込み |
| GET | `/api/plugins/updates` | 更新可能プラグイン一覧 |
| GET | `/api/plugins-path` | プラグインディレクトリパス |
| GET | `/api/plugins/:id` | プラグイン詳細 |
| DELETE | `/api/plugins/:id` | プラグインアンインストール |
| POST | `/api/plugins/:id/enable` | プラグイン有効化 |
| POST | `/api/plugins/:id/disable` | プラグイン無効化 |
| GET | `/api/plugins/:id/settings` | プラグイン設定取得 |
| PUT | `/api/plugins/:id/settings` | プラグイン設定更新 |
| GET | `/api/plugins/:id/permissions` | プラグイン権限取得 |
| PUT | `/api/plugins/:id/permissions` | プラグイン権限更新 |
| POST | `/api/plugins/:id/update` | プラグイン更新 |
| GET | `/api/plugin-themes` | プラグインテーマ一覧 |
| GET | `/api/plugin-themes/:id` | プラグインテーマ詳細 |
| POST | `/api/plugin-themes/:id/apply` | プラグインテーマ適用 |
| POST | `/api/plugin-themes/clear` | プラグインテーマクリア |
| GET | `/api/hooks` | Hooks 設定取得 |
| PUT | `/api/hooks` | Hooks 設定更新 |
| GET | `/api/hooks/path` | Hooks 設定ファイルパス |
| POST | `/api/hooks/reload` | Hooks 再読み込み |

### 2.11 MCP Servers

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/mcp-servers` | MCP サーバー一覧 |
| POST | `/api/mcp-servers` | MCP サーバー追加 |
| GET | `/api/mcp-servers/:id` | MCP サーバー詳細 |
| PUT | `/api/mcp-servers/:id` | MCP サーバー更新 |
| DELETE | `/api/mcp-servers/:id` | MCP サーバー削除 |
| GET | `/api/mcp-marketplace` | MCP マーケットプレイス |
| GET | `/api/mcp-client/status` | MCP クライアント状態 |
| GET | `/api/mcp-client/tools` | MCP クライアントツール一覧 |
| GET | `/api/mcp-client/resources` | MCP リソース一覧 |
| GET | `/api/mcp-client/resources/:serverName` | サーバー別 MCP リソース |
| GET | `/api/mcp-client/resource-templates` | MCP リソーステンプレート一覧 |
| POST | `/api/mcp-client/resources/read` | MCP リソース読み取り |
| POST | `/api/mcp-client/resources/subscribe` | MCP リソース購読 |
| DELETE | `/api/mcp-client/resources/subscribe` | MCP リソース購読解除 |
| POST | `/api/mcp-client/refresh` | MCP クライアントリフレッシュ |
| POST | `/api/mcp-client/reconnect/:name` | MCP サーバー再接続 |
| GET | `/api/mcp-servers/:id/oauth/status` | OAuth 状態 |
| DELETE | `/api/mcp-servers/:id/oauth` | OAuth トークン削除 |

### 2.12 Prompt Apps & Prompts

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/prompt-apps` | プロンプトアプリ一覧 |
| POST | `/api/prompt-apps` | プロンプトアプリ作成 |
| PUT | `/api/prompt-apps/reorder` | プロンプトアプリ並び替え |
| GET | `/api/prompt-apps/:id` | プロンプトアプリ詳細 |
| PUT | `/api/prompt-apps/:id` | プロンプトアプリ更新 |
| DELETE | `/api/prompt-apps/:id` | プロンプトアプリ削除 |
| GET | `/api/prompt-apps/:id/executions` | プロンプトアプリ実行履歴 |
| POST | `/api/prompt-apps/:id/execute` | プロンプトアプリ実行 |
| GET | `/api/prompt-app-executions/:id` | 実行詳細 |
| DELETE | `/api/prompt-app-executions/:id` | 実行履歴削除 |
| GET | `/api/prompts` | プロンプト一覧 |
| POST | `/api/prompts` | プロンプト作成 |
| PUT | `/api/prompts/reorder` | プロンプト並び替え |
| GET | `/api/prompts/:id` | プロンプト詳細 |
| PUT | `/api/prompts/:id` | プロンプト更新 |
| DELETE | `/api/prompts/:id` | プロンプト削除 |

### 2.13 Custom Themes & Thread Labels

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/custom-themes` | カスタムテーマ一覧 |
| GET | `/api/custom-themes/:id` | カスタムテーマ詳細 |
| POST | `/api/custom-themes` | カスタムテーマ作成 |
| PUT | `/api/custom-themes/:id` | カスタムテーマ更新 |
| DELETE | `/api/custom-themes/:id` | カスタムテーマ削除 |
| GET | `/api/thread-labels` | スレッドラベル一覧 |
| POST | `/api/thread-labels` | スレッドラベル作成 |
| PUT | `/api/thread-labels/reorder` | スレッドラベル並び替え |
| GET | `/api/thread-labels/:id` | スレッドラベル詳細 |
| PUT | `/api/thread-labels/:id` | スレッドラベル更新 |
| DELETE | `/api/thread-labels/:id` | スレッドラベル削除 |

### 2.14 Terminal & Runtime

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| POST | `/api/terminal/create` | ターミナルセッション作成 |
| DELETE | `/api/terminal/:id` | ターミナルセッション終了 |
| GET | `/api/terminal/sessions` | ターミナルセッション一覧 |
| GET | `/api/bun/status` | Bun ランタイム状態 |
| POST | `/api/bun/install` | Bun インストール |
| POST | `/api/bun/execute` | Bun コード実行 |
| GET | `/api/bun/executions/:id` | 実行結果取得 |
| DELETE | `/api/bun/executions/:id` | 実行キャンセル |
| GET | `/api/whisper/models` | Whisper モデル一覧 |
| POST | `/api/whisper/models/:modelId/download` | Whisper モデルダウンロード |
| DELETE | `/api/whisper/models/:modelId` | Whisper モデル削除 |

### 2.15 Data Management

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/data/export` | 全データエクスポート |
| POST | `/api/data/import` | 全データインポート |
| GET | `/api/cloud-sync/state` | クラウド同期状態 |
| POST | `/api/cloud-sync/enable` | クラウド同期有効化 |
| POST | `/api/cloud-sync/disable` | クラウド同期無効化 |
| POST | `/api/cloud-sync/push-snapshot` | クラウドスナップショット送信 |
| GET | `/api/usage/stats` | 利用統計 |
| GET | `/api/usage/migration-status` | 利用統計マイグレーション状態 |
| POST | `/api/usage/start-migration` | 利用統計マイグレーション開始 |

### 2.16 Agent Tasks

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| GET | `/api/agents` | エージェント一覧 |
| GET | `/api/agents/tasks/:taskId` | タスク状態取得 |
| POST | `/api/agents/tasks/:taskId/resume` | タスク再開 |

### 2.17 Voice & Reactions & Todos & Plan Mode

| Method | Endpoint | 説明 |
|:-------|:---------|:-----|
| POST | `/api/voice/send` | 音声メッセージ送信 |
| POST | `/api/reaction/set` | リアクション設定 |
| GET | `/api/todos` | Todo 一覧取得 |
| POST | `/api/todos` | Todo 書き込み |
| GET | `/api/plan-mode` | プランモード状態取得 |
| POST | `/api/plan-mode/enter` | プランモード開始 |
| POST | `/api/plan-mode/exit` | プランモード終了 |

### 2.18 Chrome Relay

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

---

## 3. DataFlow Examples

### 3.1 Chat Proxy Flow

`/proxy/:providerId/v1/responses` および `/anthropic-proxy/:providerId/v1/messages` は外部 AI プロバイダーへのプロキシルートである。

1. **入力**: クライアントが `req.body` (OpenAI/Anthropic 形式メッセージ) と `req.params.providerId` を送信
2. **認証解決**: `providerId` を元に DB から API キーと `baseURL` を取得 (存在しなければ 401/404)
3. **転送**: リクエストボディの `model` 等を補完した後、Proxy モジュールに `req`, `res`, `credentials` を引き渡す
4. **ストリーミング**: SSE 応答は Express の `res` オブジェクトを使ってクライアントに直接パイプされる

### 3.2 Resource Creation Flow

`createThread`, `createProvider`, `createMemory` 等のリソース作成エンドポイント共通のパターン。

1. **入力**: `req.body` (例: `{ title: "..." }`)
2. **委譲**: DB 永続化を担う Service クラス (例: `threadService.createThread()`) を呼び出す
3. **出力**: 作成されたエンティティを JSON で返す。エラー時は `try-catch` で捕捉し、500 Internal Server Error または 400 Bad Request を返す
