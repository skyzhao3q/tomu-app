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
tomu config get chat.defaultModel
tomu config set chat.defaultModel anthropic:claude-sonnet-4-6
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

Manage application settings. Supports dot-notation for nested keys (`chat.defaultModel`, `tts.auto`).

| Subcommand | Description |
|-----------|-------------|
| `config list [--json]` | List all settings |
| `config get <key>` | Get a setting value (e.g. `chat.defaultModel`) |
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

## Future extensions — Alma-compatible commands

The following commands exist in the Alma CLI reference implementation and are candidates for future addition to tomu. They are documented here to guide prioritization.

### Sprint C — API additions required

| Command | Description | API needed |
|---------|-------------|------------|
| `cron list/add/update/remove/run/enable/disable/history` | Cron job management | `POST/GET/PUT/DELETE /api/cron/jobs` |
| `workspace list/set/create/delete` | Workspace (context) management | `GET/POST/PUT /api/workspaces` |

### Messaging

| Command | Description |
|---------|-------------|
| `send photo <path> [--chat <id>] [--thread <id>] [caption]` | Send a photo to a chat or thread |
| `send file <path> [--chat <id>]` | Send a file as a document |
| `send audio <path> [--chat <id>]` | Send an audio file |
| `send video <path> [--chat <id>]` | Send a video file |
| `send voice <path> [--chat <id>]` | Send a voice message |
| `dm <chatId> <message>` | Send a direct message |
| `msg <chatId> <message>` | Send a message (alias for `dm`) |

### Media generation

| Command | Description |
|---------|-------------|
| `image <prompt> [--size <s>] [--style <s>]` | Generate an image with AI (DALL-E, Imagen, etc.) |
| `tts <text> [--voice <v>] [--speed <s>]` | Convert text to speech |
| `voices` | List available TTS voices |
| `sing <text> [--voice <v>] [--style <s>]` | Generate a singing voice |
| `video <prompt> [--duration <s>]` | Generate a short video clip |

### Platform integrations

| Command | Description |
|---------|-------------|
| `discord send <channel> <message>` | Send a message to a Discord channel |
| `discord list` | List recent Discord messages |
| `discord delete <id>` | Delete a Discord message |
| `feishu send <channel> <message>` | Send a Feishu (Lark) message |
| `feishu list` | List recent Feishu messages |

### Browser automation

| Command | Description |
|---------|-------------|
| `browser open <url>` | Open a URL in a headless browser |
| `browser screenshot [--output <file>]` | Take a screenshot of the current page |
| `browser click <selector>` | Click an element |
| `browser type <selector> <text>` | Type text into an input field |
| `browser scroll <up|down> [<px>]` | Scroll the page |
| `browser close` | Close the browser session |

### Identity & self-expression

| Command | Description |
|---------|-------------|
| `selfie take [--style <s>] [--prompt <p>]` | Generate a self-image (uses face reference) |
| `selfie list` | List generated self-images |
| `selfie show <id>` | Display a self-image |
| `selfie delete <id>` | Delete a self-image |
| `emotion set <emotion>` | Set the agent's current emotional state |
| `emotion show` | Show the current emotional state |

### Lifecycle management

| Command | Description |
|---------|-------------|
| `sleep [<seconds>]` | Transition agent to sleep state |
| `wake` | Wake the agent from sleep |
| `rest` | Transition agent to rest/low-power mode |
| `heartbeat` | Send a liveness heartbeat signal |

### Travel & maps

| Command | Description |
|---------|-------------|
| `travel plan <destination>` | Generate a travel itinerary |
| `travel route <from> <to>` | Get directions between two locations |
| `travel weather <location>` | Fetch weather information |

---

## Related

- [Chat & AI Agent](chat-and-ai-agent.md)
- [Memory](memory.md)
- [Skills](skills.md)
- [Settings](../settings/README.md)
- [CLI source](../../apps/cli/src/)
- [CLI spec](../app-spec/tomu-cli-design/SPEC.md)
