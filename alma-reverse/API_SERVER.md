# Alma (Protan) Local API Server Documentation

このドキュメントは、メインプロセス内で稼働している Express.js ベースのローカル API サーバー (`http://localhost:23001`) のエンドポイント一覧と解説です。全部で 300 以上のルートが存在します。

## 🚀 Architecture Overview
- **Framework**: Express.js
- **Port**: `23001` (ALMA_API_URL: `http://localhost:23001`)
- **Role**: CLI (ターミナルコマンド) と GUI (React フロントエンド) の両方から呼び出され、OSのネイティブ機能やAIモデルの呼び出し、SQLiteデータベースの読み書きを行う「バックエンドハブ」。

### Chat & Threads (チャット・会話履歴)

| Method | Endpoint | Description (Inferred) |
| :--- | :--- | :--- |
| `DELETE` | `/api/threads/:id` | |
| `GET` | `/api/threads` | |
| `GET` | `/api/threads/:id` | |
| `GET` | `/api/threads/:threadId/agent-crew` | |
| `GET` | `/api/threads/:threadId/context-usage` | |
| `GET` | `/api/threads/:threadId/diff-stats` | |
| `GET` | `/api/threads/:threadId/file-writes` | |
| `GET` | `/api/threads/:threadId/messages` | |
| `GET` | `/api/threads/:threadId/providers/:providerId/acp-commands` | |
| `GET` | `/api/threads/:threadId/subagent-messages` | |
| `POST` | `/api/chat/:chatId/send-audio` | |
| `POST` | `/api/chat/:chatId/send-document` | |
| `POST` | `/api/chat/:chatId/send-photo` | |
| `POST` | `/api/chat/:chatId/send-video` | |
| `POST` | `/api/chat/:chatId/send-voice` | |
| ... | *(and 10 more routes)* | |

### Workspaces & Files (ワークスペース・ファイル操作)

| Method | Endpoint | Description (Inferred) |
| :--- | :--- | :--- |
| `DELETE` | `/api/workspaces/:id` | |
| `DELETE` | `/api/workspaces/:id/files/{*filePath}` | |
| `DELETE` | `/api/workspaces/:id/git/branch` | |
| `DELETE` | `/api/workspaces/:id/git/worktrees` | |
| `GET` | `/api/workspaces` | |
| `GET` | `/api/workspaces/:id` | |
| `GET` | `/api/workspaces/:id/files` | |
| `GET` | `/api/workspaces/:id/files-binary/{*filePath}` | |
| `GET` | `/api/workspaces/:id/files/{*filePath}` | |
| `GET` | `/api/workspaces/:id/git/branches` | |
| `GET` | `/api/workspaces/:id/git/commit/:hash` | |
| `GET` | `/api/workspaces/:id/git/conflicts` | |
| `GET` | `/api/workspaces/:id/git/diff` | |
| `GET` | `/api/workspaces/:id/git/diff-stats` | |
| `GET` | `/api/workspaces/:id/git/is-repo` | |
| ... | *(and 49 more routes)* | |

### Agent Skills & Tools (スキル・外部ツール)

| Method | Endpoint | Description (Inferred) |
| :--- | :--- | :--- |
| `DELETE` | `/api/mcp-servers/:id` | |
| `DELETE` | `/api/mcp-servers/:id/oauth` | |
| `DELETE` | `/api/plugins/:id` | |
| `DELETE` | `/api/skills/:id` | |
| `GET` | `/api/mcp-servers` | |
| `GET` | `/api/mcp-servers/:id` | |
| `GET` | `/api/mcp-servers/:id/oauth/status` | |
| `GET` | `/api/plugins` | |
| `GET` | `/api/plugins-path` | |
| `GET` | `/api/plugins/:id` | |
| `GET` | `/api/plugins/:id/permissions` | |
| `GET` | `/api/plugins/:id/settings` | |
| `GET` | `/api/plugins/updates` | |
| `GET` | `/api/skills` | |
| `GET` | `/api/skills-path` | |
| ... | *(and 12 more routes)* | |

### Memory & Identity (記憶・自己認識)

| Method | Endpoint | Description (Inferred) |
| :--- | :--- | :--- |
| `DELETE` | `/api/memories` | |
| `DELETE` | `/api/memories/:id` | |
| `DELETE` | `/api/people/:name` | |
| `DELETE` | `/api/people/:name/avatar` | |
| `GET` | `/api/memories` | |
| `GET` | `/api/memories/:id` | |
| `GET` | `/api/memories/embedding-model` | |
| `GET` | `/api/memories/rebuild-progress` | |
| `GET` | `/api/memories/stats` | |
| `GET` | `/api/memories/status` | |
| `GET` | `/api/people` | |
| `GET` | `/api/people/:name` | |
| `GET` | `/api/people/:name/avatar` | |
| `GET` | `/api/settings` | |
| `POST` | `/api/memories` | |
| ... | *(and 11 more routes)* | |

### Browser & Auth (ブラウザ・認証)

| Method | Endpoint | Description (Inferred) |
| :--- | :--- | :--- |
| `GET` | `/api/chrome-relay/extension-path` | |
| `GET` | `/api/chrome-relay/status` | |
| `GET` | `/api/chrome-relay/token` | |
| `POST` | `/api/chrome-relay/back` | |
| `POST` | `/api/chrome-relay/click` | |
| `POST` | `/api/chrome-relay/detach` | |
| `POST` | `/api/chrome-relay/detach-all` | |
| `POST` | `/api/chrome-relay/eval` | |
| `POST` | `/api/chrome-relay/forward` | |
| `POST` | `/api/chrome-relay/launch-chrome` | |
| `POST` | `/api/chrome-relay/navigate` | |
| `POST` | `/api/chrome-relay/read` | |
| `POST` | `/api/chrome-relay/read-dom` | |
| `POST` | `/api/chrome-relay/screenshot` | |
| `POST` | `/api/chrome-relay/scroll` | |
| ... | *(and 5 more routes)* | |

### Providers & Models (AIモデル・プロバイダー)

| Method | Endpoint | Description (Inferred) |
| :--- | :--- | :--- |
| `DELETE` | `/api/providers/:id` | |
| `DELETE` | `/api/providers/:id/accounts/:accountId` | |
| `GET` | `/api/models` | |
| `GET` | `/api/providers` | |
| `GET` | `/api/providers/:id/accounts` | |
| `GET` | `/api/providers/:id/models` | |
| `POST` | `/api/providers` | |
| `POST` | `/api/providers/:id/authenticate` | |
| `POST` | `/api/providers/:id/logout` | |
| `POST` | `/api/providers/:id/models/fetch` | |
| `POST` | `/api/providers/:id/refresh-quotas` | |
| `POST` | `/api/providers/:id/test` | |
| `PUT` | `/api/providers/:id` | |
| `PUT` | `/api/providers/:id/models` | |

