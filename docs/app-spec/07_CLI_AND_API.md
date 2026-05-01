# tomu - CLI and API Reference

Status: Draft v3
Date: 2026-05-01
Source of truth reviewed: `apps/cli/src`, `apps/desktop/src/main/routes`, `apps/viewer/src/lib/api.ts`

---

## 1. Runtime Defaults

The desktop backend is an Express API mounted under `/api`.

| Context | Default |
|:--|:--|
| CLI API base | `TOMU_API_URL` or `http://localhost:33001` |
| Express server direct default | `PORT` or `33002` |
| Electron production server port | `EXPRESS_PORT` or `33001` |
| Vite viewer dev port | `VITE_PORT` or `55174` |

The CLI is implemented with TypeScript, `tsx`, and Commander.js. It is a thin HTTP client over the local API server and adds formatting/error handling only.

---

## 2. CLI Commands

Top-level commands are registered in `apps/cli/src/index.ts`.

| Command | Implemented subcommands / usage |
|:--|:--|
| `tomu status` | `status [--json]` |
| `tomu version` | `version` |
| `tomu config` | `list [--json]`, `get <key>`, `set <key> <value>` |
| `tomu provider` | `list [--json]`, `add`, `delete <id>`, `test <id>`, `models <id>`, `providers [id] [action] [--json]` |
| `tomu model` | `set <provider:model>`, `models [--json]` |
| `tomu chat` | `list`, `history <id>`, `new`, `delete <id>`, `search <query>`, `send <message>` |
| `tomu threads` | `threads [limit] [--json]` |
| `tomu thread` | `create <title>`, `delete <id>`, `search <query>`, `messages <id>`, `compact <id>`, `switch <id>` |
| `tomu memory` | `list`, `stats`, `search`, `add`, `delete`, `rebuild`, `cleanup`, `grep`, `archive` |
| `tomu people` | `list`, `show`, `add`, `append`, `update`, `delete`, `dir` |
| `tomu skill` | `list`, `toggle`, `install`, `uninstall`, `update`, `search`, `find` |
| `tomu task` | `list`, `get <id>`, `create`, `delete <id>` |
| `tomu mcp` | `list`, `add`, `remove <name>` |
| `tomu plugin` | `list`, `install`, `remove <name>` |
| `tomu usage` | `show`, `summary` |
| `tomu export` / `tomu import` | unified or type-specific export/import |
| `tomu soul` / `tomu user` | `soul`, `soul show`, `soul edit`, `soul set`, `soul append-trait`, `user` |
| `tomu voices` | list voices |
| `tomu image` | `models`, `generate <prompt>`, `edit <prompt>` |
| `tomu heartbeat` | `status`, `config`, `enable`, `disable`, `interval <minutes>`, `patrol <action>` |
| `tomu cron` | `list`, `add <name> <type> <schedule>`, `remove <id>`, `run <id>`, `enable <id>`, `disable <id>`, `history <id>` |
| `tomu workspace` | `list`, `set <id> <path>` |
| `tomu update` | `check`, `download`, `install` |
| `tomu dm` | `dm <userId> <message>` |
| `tomu msg` | `delete <chatId> <messageId>` |
| `tomu sing` | `generate <description>`, `config <apiKey>` |
| `tomu emotion` | `status`, `set-base`, `set-context`, `get [chatId]` |
| `tomu browser` | `status`, `tabs`, `open`, `goto`, `click`, `type`, `screenshot`, `read`, `read-dom`, `eval`, `scroll`, `back`, `forward` |
| `tomu send` | `photo <filePath> [caption]` |

Deprecated/Alma-reference commands such as `group`, `sleep`, `wake`, `rest`, `tts`, `video`, `discord`, `feishu`, `travel`, and `selfie` are not registered by the current `apps/cli` entrypoint.

---

## 3. CLI to API Mapping

Representative mappings:

| CLI | API |
|:--|:--|
| `tomu status` | `GET /api/health` |
| `tomu config list/get/set` | `GET/PUT /api/settings` |
| `tomu provider list/add/delete/test/models` | `/api/providers`, `/api/providers/:id/test`, `/api/providers/:id/models/fetch` |
| `tomu model models` | `GET /api/models` |
| `tomu chat send` | `POST /api/chat/completions` |
| `tomu threads`, `tomu thread *` | `/api/threads`, `/api/threads/:id/messages`, `/api/threads/search` |
| `tomu memory *` | `/api/memories`, `/api/memories/stats`, `/api/memories/search`, `/api/memories/rebuild`, `/api/memories/cleanup` |
| `tomu people *` | `/api/people`, `/api/people/:name` |
| `tomu skill *` | `/api/skills`, `/api/skills/install`, `/api/skills/:id/toggle`, `/api/skills/search` |
| `tomu task *` | `/api/tasks`, `/api/tasks/:id`, `/api/missions` |
| `tomu mcp *` | `/api/mcp/servers`, `/api/mcp/servers/:name` |
| `tomu plugin *` | `/api/plugins`, `/api/plugins/:name`, `/api/plugins/:name/settings` |
| `tomu usage *` | `/api/usage`, `/api/usage/summary` |
| `tomu export/import *` | `/api/export/*`, `/api/import/*` |
| `tomu image *` | `/api/image/models`, `/api/image/generate`, `/api/image/edit` |
| `tomu browser *` | `/api/browser/*` |

---

## 4. Current API Endpoints

All routes below are mounted under `/api`.

### 4.1 Health and Settings

| Method | Endpoint |
|:--|:--|
| GET | `/health` |
| GET | `/settings` |
| PUT | `/settings` |
| GET | `/settings/agents` |
| PUT | `/settings/agents` |
| GET | `/settings/agents/profiles/:id` |
| POST | `/settings/agents/profiles` |
| PUT | `/settings/agents/profiles/:id` |
| DELETE | `/settings/agents/profiles/:id` |
| POST | `/settings/agents/profiles/:id/reset` |

### 4.2 Providers, Models, Chat

| Method | Endpoint |
|:--|:--|
| GET | `/providers` |
| POST | `/providers` |
| PUT | `/providers/:id` |
| DELETE | `/providers/:id` |
| POST | `/providers/:id/test` |
| POST | `/providers/:id/models/fetch` |
| GET | `/models` |
| POST | `/chat/completions` |

Provider proxy endpoints documented in older specs (`/proxy/*`, `/anthropic-proxy/*`) are not registered in the current Express route index.

### 4.3 Threads and Messages

| Method | Endpoint |
|:--|:--|
| POST | `/threads/search` |
| GET | `/threads` |
| POST | `/threads` |
| GET | `/threads/:id` |
| DELETE | `/threads/:id` |
| GET | `/threads/:id/messages` |
| POST | `/threads/:id/messages` |
| POST | `/threads/:id/compact` |
| POST | `/threads/:id/switch` |
| POST | `/threads/:threadId/send-photo` |
| DELETE | `/messages/:chatId/:messageId` |

### 4.4 Memory, People, Skills

| Method | Endpoint |
|:--|:--|
| GET | `/memories` |
| POST | `/memories` |
| GET | `/memories/stats` |
| POST | `/memories/search` |
| POST | `/memories/rebuild` |
| DELETE | `/memories/cleanup` |
| DELETE | `/memories/:id` |
| GET | `/people` |
| POST | `/people` |
| GET | `/people/:name` |
| PUT | `/people/:name` |
| DELETE | `/people/:name` |
| GET | `/skills` |
| GET | `/skills/search` |
| GET | `/skills/:id` |
| DELETE | `/skills/:id` |
| POST | `/skills/install` |
| PUT | `/skills/:id/toggle` |

### 4.5 Agents, Tasks, Missions

| Method | Endpoint |
|:--|:--|
| POST | `/tasks` |
| GET | `/tasks` |
| GET | `/tasks/:id` |
| DELETE | `/tasks/:id` |
| GET | `/missions` |
| GET | `/missions/:id` |
| GET | `/missions/:id/runs` |

Task routes use `/api/tasks`; older `/api/agents/tasks/:taskId` routes are not registered.

### 4.6 Plugins and MCP

| Method | Endpoint |
|:--|:--|
| GET | `/plugins` |
| POST | `/plugins` |
| DELETE | `/plugins/:name` |
| GET | `/plugins/:name/settings` |
| PUT | `/plugins/:name/settings` |
| GET | `/mcp/servers` |
| POST | `/mcp/servers` |
| GET | `/mcp/servers/:name` |
| PUT | `/mcp/servers/:name` |
| DELETE | `/mcp/servers/:name` |

### 4.7 Usage, Export, Import

| Method | Endpoint |
|:--|:--|
| GET | `/usage` |
| GET | `/usage/summary` |
| GET | `/export/threads` |
| GET | `/export/memories` |
| GET | `/export/settings` |
| POST | `/import/threads` |
| POST | `/import/memories` |
| POST | `/import/bundle` |

### 4.8 Media, Browser, Misc

| Method | Endpoint |
|:--|:--|
| GET | `/voices` |
| GET | `/image/models` |
| POST | `/image/generate` |
| POST | `/image/edit` |
| GET | `/generated-images/:filename` |
| POST | `/sing/generate` |
| POST | `/sing/config` |
| GET | `/browser/status` |
| GET | `/browser/tabs` |
| POST | `/browser/tabs/open` |
| POST | `/browser/tabs/:tabId/goto` |
| POST | `/browser/tabs/:tabId/click` |
| POST | `/browser/tabs/:tabId/type` |
| POST | `/browser/tabs/:tabId/screenshot` |
| GET | `/browser/tabs/:tabId/read` |
| GET | `/browser/tabs/:tabId/read-dom` |
| POST | `/browser/tabs/:tabId/eval` |
| POST | `/browser/tabs/:tabId/scroll` |
| POST | `/browser/tabs/:tabId/back` |
| POST | `/browser/tabs/:tabId/forward` |
| POST | `/dm` |
| GET | `/emotion` |
| GET | `/emotion/:chatId` |
| POST | `/emotion/base` |
| POST | `/emotion/context` |
| GET | `/heartbeat` |
| GET | `/heartbeat/config` |
| POST | `/heartbeat/enable` |
| POST | `/heartbeat/disable` |
| POST | `/heartbeat/interval` |
| POST | `/heartbeat/patrol` |
| GET | `/cron` |
| POST | `/cron` |
| DELETE | `/cron/:id` |
| POST | `/cron/:id/run` |
| POST | `/cron/:id/enable` |
| POST | `/cron/:id/disable` |
| GET | `/cron/:id/history` |
| GET | `/workspaces` |
| PUT | `/workspaces/:id` |
| GET | `/update/check` |
| POST | `/update/download` |
| POST | `/update/install` |

---

## 5. Response and Streaming Notes

- `POST /api/chat/completions` streams Server-Sent Events when `stream: true`; the viewer consumes the raw `fetch` response.
- The CLI wraps connection failures and non-2xx responses as `ConnectionError` / `ApiError`.
- `201` and `204` responses may be empty; CLI parsing handles empty bodies.
