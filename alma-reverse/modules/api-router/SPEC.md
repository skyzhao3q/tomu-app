# Module: API Router (Deep Specification)

このドキュメントは、Protan (Alma) のバックエンド（Express Server）において、クライアントからのすべての通信を受け付け、ルーティングと入力のバリデーションを行う **API Router** モジュールの完全な設計書です。

## 1. 機能概要 (Overview)
API Router は、Express.js アプリケーションのインスタンスにエンドポイントをバインドし、HTTPリクエストを受け取ります。
リクエストボディやパスパラメータを解析し、後続のビジネスロジック（Service / Controller）に処理を委譲します。

## 2. ルーティング定義 (Routes Mapping)
ソースコードから抽出された、URLパスと対応するハンドラー（コントローラーメソッド）の完全なマッピングです。

| Handler Method | Routes (Method + Path) |
| :--- | :--- |
| `getProviders` | `GET /api/providers` |
| `createProvider` | `POST /api/providers` |
| `updateProvider` | `PUT /api/providers/:id` |
| `deleteProvider` | `DELETE /api/providers/:id` |
| `testProvider` | `POST /api/providers/:id/test` |
| `authenticatePluginProvider` | `POST /api/providers/:id/authenticate` |
| `logoutPluginProvider` | `POST /api/providers/:id/logout` |
| `getProviderAccounts` | `GET /api/providers/:id/accounts` |
| `removeProviderAccount` | `DELETE /api/providers/:id/accounts/:accountId` |
| `refreshProviderQuotas` | `POST /api/providers/:id/refresh-quotas` |
| `getThreads` | `GET /api/threads` |
| `getThread` | `GET /api/threads/:id` |
| `createThread` | `POST /api/threads` |
| `updateThread` | `PUT /api/threads/:id` |
| `deleteThread` | `DELETE /api/threads/:id` |
| `branchThread` | `POST /api/threads/:id/branch` |
| `activateThread` | `POST /api/threads/:id/activate` |
| `switchThread` | `POST /api/threads/:id/switch` |
| `compactThread` | `POST /api/threads/:id/compact` |
| `getMessages` | `GET /api/threads/:threadId/messages` |
| `getSubagentMessages` | `GET /api/threads/:threadId/subagent-messages` |
| `getThreadAgentCrew` | `GET /api/threads/:threadId/agent-crew` |
| `getThreadContextUsage` | `GET /api/threads/:threadId/context-usage` |
| `getThreadFileWrites` | `GET /api/threads/:threadId/file-writes` |
| `getThreadDiffStats` | `GET /api/threads/:threadId/diff-stats` |
| `switchMessageVersion` | `POST /api/messages/:messageId/switch-version` |
| `deleteMessage` | `DELETE /api/messages/:messageId` |
| `rollbackToMessage` | `POST /api/messages/:messageId/rollback` |
| `searchThreads` | `GET /api/search/threads` |
| `getSettings` | `GET /api/settings` |
| `updateSettings` | `PUT /api/settings` |
| `resetSettings` | `POST /api/settings/reset` |
| `testProxy` | `POST /api/settings/test-proxy` |
| `testTelegram` | `POST /api/settings/test-telegram` |
| `detectTelegramUsers` | `POST /api/settings/detect-telegram-users` |
| `getToolModel` | `GET /api/tool-model` |
| `getMemoryToolModelEndpoint` | `GET /api/tool-model/memory` |
| `testToolModel` | `POST /api/tool-model/test` |
| `getModels` | `GET /api/models` |
| `getProviderModels` | `GET /api/providers/:id/models` |
| `fetchProviderModels` | `POST /api/providers/:id/models/fetch` |
| `updateProviderModels` | `PUT /api/providers/:id/models` |
| `getACPCommands` | `GET /api/threads/:threadId/providers/:providerId/acp-commands` |
| `chatCompletions` | `POST /api/chat/completions` |
| `handleResponsesApi` | `POST /proxy/:providerId/v1/responses`, `POST /proxy/:providerId/responses` |
| `handleAnthropicApi` | `POST /anthropic-proxy/:providerId/v1/messages` |
| `getMemories` | `GET /api/memories` |
| `getMemoryServiceStatus` | `GET /api/memories/status` |
| `getMemoryStats` | `GET /api/memories/stats` |
| `getStoredEmbeddingModel` | `GET /api/memories/embedding-model` |
| `getRebuildProgress` | `GET /api/memories/rebuild-progress` |
| `getMemory` | `GET /api/memories/:id` |
| `createMemory` | `POST /api/memories` |
| `searchMemories` | `POST /api/memories/search` |
| `rebuildMemoryEmbeddings` | `POST /api/memories/rebuild` |
| `cancelRebuild` | `POST /api/memories/cancel-rebuild` |
| `updateMemory` | `PUT /api/memories/:id` |
| `deleteMemory_` | `DELETE /api/memories/:id` |
| `clearMemories` | `DELETE /api/memories` |
| `getLocalEmbeddingModels` | `GET /api/local-embeddings/models` |
| `downloadLocalEmbeddingModel` | `POST /api/local-embeddings/download` |
| `deleteLocalEmbeddingModel` | `DELETE /api/local-embeddings/models/:modelId` |
| `getLocalEmbeddingProgress` | `GET /api/local-embeddings/progress` |
| `getPeople` | `GET /api/people` |
| `getPerson` | `GET /api/people/:name` |
| `putPerson` | `PUT /api/people/:name` |
| `deletePersonAvatar` | `DELETE /api/people/:name/avatar` |
| `deletePerson` | `DELETE /api/people/:name` |
| `getPersonAvatar` | `GET /api/people/:name/avatar` |
| `uploadPersonAvatar` | `POST /api/people/:name/avatar` |
| `getGalleryImages` | `GET /api/gallery/images` |
| `getGalleryImageById` | `GET /api/gallery/images/:id` |
| `getAgents` | `GET /api/agents` |
| `getAgentTaskDetail` | `GET /api/agents/tasks/:taskId` |
| `resumeAgentTask` | `POST /api/agents/tasks/:taskId/resume` |
| `getPromptApps` | `GET /api/prompt-apps` |
| `createPromptApp` | `POST /api/prompt-apps` |
| `reorderPromptApps` | `PUT /api/prompt-apps/reorder` |
| `getPromptApp` | `GET /api/prompt-apps/:id` |
| `updatePromptApp` | `PUT /api/prompt-apps/:id` |
| `deletePromptApp` | `DELETE /api/prompt-apps/:id` |
| `getPromptAppExecutions` | `GET /api/prompt-apps/:id/executions` |
| `executePromptApp` | `POST /api/prompt-apps/:id/execute` |
| `getPrompts` | `GET /api/prompts` |
| `createPrompt` | `POST /api/prompts` |
| `reorderPrompts` | `PUT /api/prompts/reorder` |
| `getPrompt` | `GET /api/prompts/:id` |
| `updatePrompt` | `PUT /api/prompts/:id` |
| `deletePrompt` | `DELETE /api/prompts/:id` |
| `getPromptAppExecution` | `GET /api/prompt-app-executions/:id` |
| `deletePromptAppExecution` | `DELETE /api/prompt-app-executions/:id` |
| `getCustomThemes` | `GET /api/custom-themes` |
| `getCustomTheme` | `GET /api/custom-themes/:id` |
| `createCustomTheme` | `POST /api/custom-themes` |
| `updateCustomTheme` | `PUT /api/custom-themes/:id` |
| `deleteCustomTheme` | `DELETE /api/custom-themes/:id` |
| `getThreadLabels` | `GET /api/thread-labels` |
| `createThreadLabel` | `POST /api/thread-labels` |
| `reorderThreadLabels` | `PUT /api/thread-labels/reorder` |
| `getThreadLabel` | `GET /api/thread-labels/:id` |
| `updateThreadLabel` | `PUT /api/thread-labels/:id` |
| `deleteThreadLabel` | `DELETE /api/thread-labels/:id` |
| `getMCPServers` | `GET /api/mcp-servers` |
| `getMCPServer` | `GET /api/mcp-servers/:id` |
| `createMCPServer` | `POST /api/mcp-servers` |
| `updateMCPServer` | `PUT /api/mcp-servers/:id` |
| `deleteMCPServer` | `DELETE /api/mcp-servers/:id` |
| `getMCPMarketplace` | `GET /api/mcp-marketplace` |
| `getMCPClientStatus` | `GET /api/mcp-client/status` |
| `getMCPClientTools` | `GET /api/mcp-client/tools` |
| `getMCPClientResources` | `GET /api/mcp-client/resources` |
| `getMCPServerResources` | `GET /api/mcp-client/resources/:serverName` |
| `getMCPResourceTemplates` | `GET /api/mcp-client/resource-templates` |
| `readMCPResource` | `POST /api/mcp-client/resources/read` |
| `subscribeMCPResource` | `POST /api/mcp-client/resources/subscribe` |
| `unsubscribeMCPResource` | `DELETE /api/mcp-client/resources/subscribe` |
| `refreshMCPClient` | `POST /api/mcp-client/refresh` |
| `reconnectMCPServer` | `POST /api/mcp-client/reconnect/:name` |
| `getMCPOAuthStatus` | `GET /api/mcp-servers/:id/oauth/status` |
| `revokeMCPOAuth` | `DELETE /api/mcp-servers/:id/oauth` |
| `getSkills` | `GET /api/skills` |
| `getSkill` | `GET /api/skills/:id` |
| `updateSkill` | `PUT /api/skills/:id` |
| `deleteSkill` | `DELETE /api/skills/:id` |
| `refreshSkills` | `POST /api/skills/refresh` |
| `getSkillsPath` | `GET /api/skills-path` |
| `getPlugins` | `GET /api/plugins` |
| `installPlugin` | `POST /api/plugins` |
| `refreshPlugins` | `POST /api/plugins/refresh` |
| `checkPluginUpdates` | `GET /api/plugins/updates` |
| `getPluginsPath` | `GET /api/plugins-path` |
| `getPlugin` | `GET /api/plugins/:id` |
| `uninstallPlugin` | `DELETE /api/plugins/:id` |
| `enablePlugin` | `POST /api/plugins/:id/enable` |
| `disablePlugin` | `POST /api/plugins/:id/disable` |
| `getPluginSettings` | `GET /api/plugins/:id/settings` |
| `updatePluginSettings` | `PUT /api/plugins/:id/settings` |
| `getPluginPermissions` | `GET /api/plugins/:id/permissions` |
| `updatePluginPermissions` | `PUT /api/plugins/:id/permissions` |
| `updatePlugin` | `POST /api/plugins/:id/update` |
| `getPluginThemes` | `GET /api/plugin-themes` |
| `getPluginTheme` | `GET /api/plugin-themes/:id` |
| `applyPluginTheme` | `POST /api/plugin-themes/:id/apply` |
| `clearPluginTheme` | `POST /api/plugin-themes/clear` |
| `getHooksConfig` | `GET /api/hooks` |
| `updateHooksConfig` | `PUT /api/hooks` |
| `getHooksConfigPath` | `GET /api/hooks/path` |
| `reloadHooks` | `POST /api/hooks/reload` |
| `getWorkspaces` | `GET /api/workspaces` |
| `createWorkspace` | `POST /api/workspaces` |
| `getWorkspaceFiles` | `GET /api/workspaces/:id/files` |
| `getWorkspaceFileContent` | `GET /api/workspaces/:id/files/{*filePath}` |
| `getWorkspaceFileBinary` | `GET /api/workspaces/:id/files-binary/{*filePath}` |
| `touchWorkspaceFile` | `POST /api/workspaces/:id/files/touch` |
| `createWorkspaceDirectory` | `POST /api/workspaces/:id/files/mkdir` |
| `renameWorkspaceFile` | `POST /api/workspaces/:id/files/rename` |
| `copyWorkspaceFile` | `POST /api/workspaces/:id/files/copy` |
| `moveWorkspaceFile` | `POST /api/workspaces/:id/files/move` |
| `deleteWorkspaceFile` | `DELETE /api/workspaces/:id/files/{*filePath}` |
| `startPreviewServer` | `POST /api/workspaces/:id/preview/start` |
| `stopPreviewServer` | `POST /api/workspaces/:id/preview/stop` |
| `getPreviewServerStatus` | `GET /api/workspaces/:id/preview/status` |
| `detectProjectType` | `GET /api/workspaces/:id/preview/detect` |
| `getPreviewHtmlFiles` | `GET /api/workspaces/:id/preview/html-files` |
| `getGitStatus` | `GET /api/workspaces/:id/git/status` |
| `checkIsGitRepo` | `GET /api/workspaces/:id/git/is-repo` |
| `initGitRepo` | `POST /api/workspaces/:id/git/init` |
| `stageFiles` | `POST /api/workspaces/:id/git/stage` |
| `unstageFiles` | `POST /api/workspaces/:id/git/unstage` |
| `stageAllFiles` | `POST /api/workspaces/:id/git/stage-all` |
| `unstageAllFiles` | `POST /api/workspaces/:id/git/unstage-all` |
| `discardChanges` | `POST /api/workspaces/:id/git/discard` |
| `getGitDiff` | `GET /api/workspaces/:id/git/diff` |
| `getGitDiffStats` | `GET /api/workspaces/:id/git/diff-stats` |
| `createGitCommit` | `POST /api/workspaces/:id/git/commit` |
| `getGitLog` | `GET /api/workspaces/:id/git/log` |
| `getGitCommitDetail` | `GET /api/workspaces/:id/git/commit/:hash` |
| `getGitBranches` | `GET /api/workspaces/:id/git/branches` |
| `checkoutGitBranch` | `POST /api/workspaces/:id/git/checkout` |
| `createGitBranch` | `POST /api/workspaces/:id/git/create-branch` |
| `deleteGitBranch` | `DELETE /api/workspaces/:id/git/branch` |
| `getGitRemotes` | `GET /api/workspaces/:id/git/remotes` |
| `gitPush` | `POST /api/workspaces/:id/git/push` |
| `gitPull` | `POST /api/workspaces/:id/git/pull` |
| `gitFetch` | `POST /api/workspaces/:id/git/fetch` |
| `getGitStashes` | `GET /api/workspaces/:id/git/stash` |
| `gitStashPush` | `POST /api/workspaces/:id/git/stash/push` |
| `gitStashPop` | `POST /api/workspaces/:id/git/stash/pop` |
| `gitStashApply` | `POST /api/workspaces/:id/git/stash/apply` |
| `gitStashDrop` | `POST /api/workspaces/:id/git/stash/drop` |
| `generateCommitMessage` | `POST /api/workspaces/:id/git/generate-commit-message` |
| `getGitWorktrees` | `GET /api/workspaces/:id/git/worktrees` |
| `createGitWorktree` | `POST /api/workspaces/:id/git/worktrees` |
| `deleteGitWorktree` | `DELETE /api/workspaces/:id/git/worktrees` |
| `getGitHubStatus` | `GET /api/github/status` |
| `getWorkspacePR` | `GET /api/workspaces/:id/github/pr` |
| `createWorkspacePR` | `POST /api/workspaces/:id/github/pr` |
| `mergeWorkspacePR` | `POST /api/workspaces/:id/github/pr/merge` |
| `closeWorkspacePR` | `POST /api/workspaces/:id/github/pr/close` |
| `refreshWorkspacePRStatus` | `GET /api/workspaces/:id/github/pr/refresh` |
| `getCILogs` | `GET /api/workspaces/:id/github/ci-logs` |
| `getRebaseStatus` | `GET /api/workspaces/:id/git/rebase/status` |
| `startRebase` | `POST /api/workspaces/:id/git/rebase` |
| `continueRebase` | `POST /api/workspaces/:id/git/rebase/continue` |
| `abortRebase` | `POST /api/workspaces/:id/git/rebase/abort` |
| `getConflicts` | `GET /api/workspaces/:id/git/conflicts` |
| `resolveConflict` | `POST /api/workspaces/:id/git/conflicts/resolve` |
| `resolveConflictWithAI` | `POST /api/workspaces/:id/git/conflicts/resolve-ai` |
| `resolveAllConflictsWithAI` | `POST /api/workspaces/:id/git/conflicts/resolve-all-ai` |
| `cleanupWorktreeAfterMerge` | `POST /api/workspaces/:id/worktree/cleanup` |
| `getWorktrunkStatus` | `GET /api/worktrunk/status` |
| `installWorktrunkRoute` | `POST /api/worktrunk/install` |
| `getWorkspace` | `GET /api/workspaces/:id` |
| `updateWorkspace` | `PUT /api/workspaces/:id` |
| `deleteWorkspace` | `DELETE /api/workspaces/:id` |
| `createTerminal` | `POST /api/terminal/create` |
| `killTerminal` | `DELETE /api/terminal/:id` |
| `getTerminalSessions` | `GET /api/terminal/sessions` |
| `getWhisperModels` | `GET /api/whisper/models` |
| `downloadWhisperModel` | `POST /api/whisper/models/:modelId/download` |
| `deleteWhisperModel` | `DELETE /api/whisper/models/:modelId` |
| `getBunStatus` | `GET /api/bun/status` |
| `installBun` | `POST /api/bun/install` |
| `executeBunCode` | `POST /api/bun/execute` |
| `getBunExecution` | `GET /api/bun/executions/:id` |
| `cancelBunExecution` | `DELETE /api/bun/executions/:id` |
| `exportAllData` | `GET /api/data/export` |
| `importAllData` | `POST /api/data/import` |
| `getCloudSyncState` | `GET /api/cloud-sync/state` |
| `enableCloudSync` | `POST /api/cloud-sync/enable` |
| `disableCloudSync` | `POST /api/cloud-sync/disable` |
| `pushCloudSyncSnapshot` | `POST /api/cloud-sync/push-snapshot` |
| `getUsageStats` | `GET /api/usage/stats` |
| `getUsageMigrationStatus` | `GET /api/usage/migration-status` |
| `startUsageMigration` | `POST /api/usage/start-migration` |
| `sendVoiceApi` | `POST /api/voice/send` |
| `setReactionApi` | `POST /api/reaction/set` |
| `getTodosApi` | `GET /api/todos` |
| `writeTodosApi` | `POST /api/todos` |
| `getPlanModeApi` | `GET /api/plan-mode` |
| `enterPlanModeApi` | `POST /api/plan-mode/enter` |
| `exitPlanModeApi` | `POST /api/plan-mode/exit` |

## 3. DataFlow (データフローの深掘り)
主要なエンドポイントについて、Router層からService層へどのようにデータが流れるかを解説します。

### 3.1 Chat Proxy Flow (`handleResponsesApi` / `handleAnthropicApi`)
1. **Input**: `req.body` (OpenAI format messages), `req.params.providerId`
2. **Routing**: `/proxy/:providerId/v1/responses` または `/anthropic-proxy/.../messages`
3. **Validation & Auth**: `providerId` を元に DBから APIキー と `baseURL` を取得（存在しなければ 401 又は 404 を返す）。
4. **Forwarding**: リクエストボディの `model` などを補完した後、後続の Proxy モジュール（`ai()` や `Yr()`）に `req`, `res`, `credentials` をそのまま引き渡す。ストリーミング応答 (SSE) は Express の `res` オブジェクトを使って直接クライアントにパイプされる。

### 3.2 Resource Creation Flow (`createThread`, `createProvider` 等)
1. **Input**: `req.body` (例: `{ title: "..." }`)
2. **Delegation**: DBや永続化を担う Service クラス（例: `zn.createThread()`）を呼び出す。
3. **Output**: 作成されたエンティティを JSON で返す。エラー時は `try-catch` で捕捉し、500 Internal Server Error または 400 Bad Request を適切にフォーマットして返す。

## 4. DataModel (API 入出力スキーマ)
Router層で処理される主要なデータの型定義（推測）です。

- **Chat Request**: `{ model: string, messages: Array<{role: string, content: string}>, stream: boolean }`
- **Provider Payload**: `{ name: string, type: 'openai'|'anthropic'|..., apiKey: string, baseURL?: string }`
- **Skill/Plugin Action**: URLパラメータ (`:id`) と空のBody (例: `POST /api/plugins/:id/enable`)

## 5. UI Components (フロントエンドとの関係)
このモジュールと密接に通信するフロントエンドの React コンポーネント群です。

- **`ChatArea` / `MessageList`**: メッセージ送信時やスレッド切り替え時に `/api/chat/*` や `/api/threads/*` を連続して呼び出す。
- **`SettingsModal`**: 各種設定タブ（General, Memory, Providers, Skills, Plugins）を開いた際や保存ボタンを押した際に、各リソースの CRUD エンドポイントを叩く。
- **`Sidebar` / `ThreadList`**: アプリ起動時に `/api/threads` を叩いて履歴一覧を描画する。

- **`ArtifactPanel` / `WidgetRenderer`**: AIが生成したウィジェットの描画時や、ボタンクリック時（`send-prompt`）に裏側でチャット送信（`/api/chat/completions`）をトリガーする。
- **`ProviderSettings`**: ユーザーが設定画面でプロバイダーを追加・編集する際、`/api/providers` へ POST/PUT を送る。また、「Test Connection」ボタンを押すと `/api/providers/:id/test` を呼び出す。
- **`MemorySettings`**: `sqlite-vec` のベクトル検索データベースの状態（stats）を取得したり、手動で再構築（rebuild）するために `/api/memories/*` エンドポイントと通信する。
- **`Global Search Modal` (`ThreadSearchModal`)**: ユーザーが過去の会話を検索しようとした時、`/api/search/threads?q=...` に対して GET リクエストを送り、検索結果をリアルタイムで表示する。

## 6. CLI Commands (ターミナルとの関係)
フロントエンド（React）だけでなく、CLI (`alma` コマンド) もこの API Router に強く依存しています。

- **`alma config get/set`**: `/api/settings` への GET/PUT。
- **`alma provider add`**: `/api/providers` への POST。
- **`alma memory search`**: `/api/memories/search` への POST。
- **`alma chat list`**: `/api/threads` への GET。

これにより、**GUI から操作しても、ターミナルから操作しても、全く同じビジネスロジックが走り、同じ状態（State）が維持される**設計になっています。
