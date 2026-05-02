# tomu CLI

tomu CLI (`tomu`) is a terminal interface for the tomu AI agent. It acts as a thin wrapper over the tomu API server (default: `http://localhost:33001`) and provides access to all major features — threads, memory, providers, skills, people, tasks, and more — directly from the command line.

## Prerequisites

The tomu desktop app (or API server) must be running before using CLI commands that communicate with the API.

```
TOMU_API_URL=http://localhost:33001   # default, override as needed
```

To check server connectivity:

```
tomu status
```

## Quick start

```sh
# Check server status
tomu status

# List and search threads
tomu threads
tomu thread search "project kickoff"

# Chat (streaming)
tomu chat send "Summarize the last meeting" --thread <id>

# Memory
tomu memory add "The API rate limit is 100 req/min"
tomu memory search "rate limit"

# Config (supports dot-notation)
tomu config get default_provider_id
tomu config set default_model_id claude-sonnet-4-6
```

## Global options

| Option | Description |
|--------|-------------|
| `--json` | Output raw JSON (available on most commands) |
| `--help` | Show help for any command |
| `--version` | Show Commander version |

Set `TOMU_API_URL` to point at a non-default server.

---

## Command reference

### `tomu status`

Check API server health.

```
tomu status [--json]
```

---

### `tomu version`

Display CLI version.

```
tomu version
```

---

### `tomu config`

Manage application settings. Supports dot-notation for nested keys when settings contain nested objects; current core keys include `default_provider_id`, `default_model_id`, `embedding_provider_id`, `embedding_model_id`, `agent_max_iterations`, `agents_enabled`, and `agents_allow_delegation`.

| Subcommand | Description |
|-----------|-------------|
| `config list [--json]` | List all settings |
| `config get <key>` | Get a setting value (e.g. `default_model_id`) |
| `config set <key> <value>` | Set a setting value (type-coerced: `true`/`false`/numbers) |

---

### `tomu model`

Shorthand for setting the active AI model.

| Subcommand | Description |
|-----------|-------------|
| `model set <provider:model>` | Set `chat.defaultModel` (e.g. `anthropic:claude-sonnet-4-6`) |

---

### `tomu provider`

Manage AI providers (API keys, base URLs).

| Subcommand | Description |
|-----------|-------------|
| `provider list [--json]` | List configured providers |
| `provider add --name <n> --type <t> --api-key <k> [--base-url <u>]` | Add a provider |
| `provider delete <id>` | Remove a provider |
| `provider test <id>` | Test provider connectivity |
| `provider models <id>` | Fetch available models from provider |

---

### `tomu threads` / `tomu thread`

`tomu threads` is a shorthand list; `tomu thread` provides full management.

```
tomu threads [limit] [--json]
```

Outputs one line per thread: `id  date  title`

| Subcommand | Description |
|-----------|-------------|
| `thread create <title>` | Create a new thread |
| `thread delete <id>` | Delete a thread |
| `thread search <query> [--limit <n>] [--json]` | Full-text search |
| `thread messages <id> [limit] [--json]` | Show messages in a thread |
| `thread compact <id>` | Compact thread (summarize old messages) |
| `thread switch <id> [--from <id>]` | Switch active thread |

`tomu chat` is a legacy alias with list/history/new/delete/search/send subcommands (still supported).

---

### `tomu memory`

Manage the RAG memory store.

| Subcommand | Description |
|-----------|-------------|
| `memory list [--limit <n>] [--type <t>] [--json]` | List memories |
| `memory stats [--json]` | Show total count, by-type breakdown, DB size |
| `memory search <query> [--json]` | Semantic search; displays score as `(85%)` |
| `memory add <content> [--type <t>]` | Add a memory (positional arg; `--content` also accepted) |
| `memory delete <id>` | Delete a memory |
| `memory rebuild` | Rebuild embeddings |
| `memory cleanup` | Remove orphaned memories |
| `memory grep <keyword>` | Full-text grep on local archived thread files (`~/.config/tomu/workspaces/default/threads/`) |
| `memory archive` | Trigger server-side thread archiving |

---

### `tomu people`

Manage person profiles.

| Subcommand | Description |
|-----------|-------------|
| `people list [--json]` | List all profiles |
| `people show <name> [--json]` | Show a profile's details |
| `people add --name <n> [--notes <t>] [--relationship <r>]` | Add a person |
| `people append <name> <text>` | Append text to notes |
| `people update <name> [--notes <t>]` | Replace notes |
| `people delete <name>` | Delete a profile |
| `people dir` | Print the people data directory path |

---

### `tomu task`

Manage sub-agent tasks.

| Subcommand | Description |
|-----------|-------------|
| `task list [--json]` | List tasks |
| `task get <id> [--json]` | Show task details |
| `task create --type <t> --prompt <p>` | Create a task |
| `task delete <id>` | Delete a task |

---

### `tomu soul` / `tomu user`

Manage AI personality and user profile files stored locally.

| Subcommand | Description |
|-----------|-------------|
| `soul` / `soul show` | Print `SOUL.md` to stdout |
| `soul edit` | Open `SOUL.md` in `$EDITOR` (falls back to `vi`) |
| `soul set <content>` | Write content to `SOUL.md` |
| `soul append-trait <description>` | Append a trait to `## Evolved Traits` section (max 15, oldest removed) |
| `user` | Open `USER.md` in `$EDITOR` |

Files are stored at `~/.config/tomu/SOUL.md` and `~/.config/tomu/USER.md`.

---

### `tomu skill`

Manage skills (agent capability extensions).

| Subcommand | Description |
|-----------|-------------|
| `skill list [--json]` | List installed skills |
| `skill toggle <id>` | Enable / disable a skill |
| `skill install <source>` | Install from git URL or `owner/repo@skill` (skills.sh format; falls back to `git clone`) |
| `skill uninstall <name>` | Remove local directory and API entry |
| `skill update` | Update all skills via `bunx`/`npx skills update` |

---

### `tomu mcp`

Manage MCP (Model Context Protocol) servers.

| Subcommand | Description |
|-----------|-------------|
| `mcp list [--json]` | List configured MCP servers |
| `mcp add --name <n> --command <cmd> [--args <a>] [--env <e>]` | Add a server |
| `mcp remove <name>` | Remove a server |

---

### `tomu plugin`

Manage plugins.

| Subcommand | Description |
|-----------|-------------|
| `plugin list [--json]` | List installed plugins |
| `plugin install --source <s>` | Install a plugin |
| `plugin remove <name>` | Remove a plugin |

---

### `tomu usage`

View token/API usage statistics.

| Subcommand | Description |
|-----------|-------------|
| `usage [--days <n>] [--json]` | Full stats (by day, by model) |
| `usage summary [--json]` | Summary totals |

---

### `tomu export` / `tomu import`

#### Unified export (no type argument)

```
tomu export [--output <file>]
```

Fetches threads + memories + settings in one bundle and saves to `tomu-export-YYYY-MM-DD.json` (or `--output` path).

#### Type-specific export

```
tomu export <threads|memories|settings> [--output <file>]
```

Prints JSON to stdout or writes to `--output`.

#### Import

```
tomu import [--file <path>]                    # unified bundle
tomu import <threads|memories> --file <path>   # type-specific
```

---

## Extended commands

These commands are implemented in `apps/cli/src/commands`.

### `tomu cron`

Manage scheduled jobs.

| Subcommand | Description |
|-----------|-------------|
| `cron list [--json]` | List jobs |
| `cron add <name> <type> <schedule>` | Add a job |
| `cron remove <id>` | Remove a job |
| `cron run <id>` | Run immediately |
| `cron enable <id>` / `cron disable <id>` | Toggle a job |
| `cron history <id> [--json]` | Show run history |

### `tomu workspace`

| Subcommand | Description |
|-----------|-------------|
| `workspace list [--json]` | List workspaces |
| `workspace set <id> <path>` | Set or update a workspace path |

### Messaging and media

| Command | Description |
|---------|-------------|
| `dm <userId> <message>` | Send a direct message via `/api/dm` |
| `msg delete <chatId> <messageId>` | Delete a message |
| `send photo <filePath> [caption] [--thread <threadId>]` | Attach a photo to a thread |
| `voices [--json]` | List voices |
| `image models [--json]` | List image models |
| `image generate <prompt> [--model <model>] [--reference <url>] [--json]` | Generate an image |
| `image edit <prompt> [--model <model>] [--input <url>] [--json]` | Edit an image |
| `sing generate <description> [--json]` | Generate a song |
| `sing config <apiKey>` | Configure song generation |

### Browser automation

| Command | Description |
|---------|-------------|
| `browser status [--json]` | Check browser relay status |
| `browser tabs [--json]` | List tabs |
| `browser open [url]` | Open a tab |
| `browser goto <tabId> <url>` | Navigate a tab |
| `browser click <tabId> <selector>` | Click an element |
| `browser type <tabId> <selector> <text> [--enter]` | Type into an element |
| `browser screenshot [tabId]` | Capture a screenshot |
| `browser read <tabId>` / `browser read-dom <tabId>` | Read page text or DOM |
| `browser eval <tabId> <code> [--json]` | Evaluate JavaScript |
| `browser scroll <tabId> <direction> [amount]` | Scroll |
| `browser back <tabId>` / `browser forward <tabId>` | Navigate history |

### State and maintenance

| Command | Description |
|---------|-------------|
| `emotion status [--json]` | Show current emotion state |
| `emotion set-base <mood> <energy> <valence> <description>` | Set base emotion |
| `emotion set-context <chatId> <mood> <valence> <trigger>` | Set per-chat context |
| `emotion get [chatId]` | Get emotion state |
| `heartbeat status/config [--json]` | Show heartbeat state/config |
| `heartbeat enable/disable` | Toggle heartbeat |
| `heartbeat interval <minutes>` | Set interval |
| `heartbeat patrol <action> [--json]` | Trigger patrol action |
| `update check [--json]` | Check for updates |
| `update download` | Download update |
| `update install` | Install update |

Alma-reference commands such as `group`, `sleep`, `wake`, `rest`, `tts`, `video`, `discord`, `feishu`, `travel`, and `selfie` are not registered by the current `tomu` CLI.

---

## Related

- [Chat & AI Agent](chat-and-ai-agent.md)
- [Memory](memory.md)
- [Skills](skills.md)
- [Settings](../settings/README.md)
- [CLI source](../../apps/cli/src/)
- [CLI spec](../app-spec/tomu-cli-design/SPEC.md)
