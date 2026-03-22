# Protan Local API Service Specification

Status: Draft v1 (Based on Alma v0.0.721 Reverse Engineering)

Purpose: Define the local Express.js service that orchestrates LLM proxies, context assembly, native tool execution, and sub-agent task management for the Protan desktop AI agent.

## 1. Problem Statement

Protan requires a long-running background service (Local API Hub) that bridges the gap between a stateless UI/CLI client and a stateful, OS-aware AI agent. 

When an AI agent operates on a user's local machine, it must overcome several operational problems:
- **Credential Security**: API keys for external LLMs (OpenAI, Anthropic) cannot be exposed to the client UI.
- **Context Awareness**: The agent needs seamless access to the user's local filesystem, identity (`SOUL.md`), and historical memory (`sqlite-vec`) before every LLM request.
- **Native Tool Execution**: LLMs return tool call intents (JSON), which must be intercepted and executed using native OS capabilities (e.g., spawning persistent `node-pty` shells) that browsers/UI cannot securely perform.
- **Asynchronous Agent Orchestration**: Multi-step operations like codebase refactoring must run as detached background processes (Sub-Agents) without blocking the primary chat interface.

This specification defines the architecture, data models, and agentic loop required to operate this daemon safely and reliably.

## 2. Goals and Non-Goals

### 2.1 Goals
- Host a RESTful API and WebSocket server on a local port (e.g., `23001`).
- Intercept and proxy all LLM API requests to inject dynamic context (RAG, Identity, Skills) automatically.
- Maintain persistent pseudo-terminal (`node-pty`) sessions for the agent.
- Manage local vector embeddings (`sqlite-vec`) for semantic memory search.
- Orchestrate background `Task` workers (Sub-Agents) and track their status via `TaskOutput`.
- Provide a unified interface for both the React GUI and the Bun CLI.

### 2.2 Non-Goals
- Exposing the API server to the public internet (this is strictly a localhost loopback service).
- Building a multi-tenant cloud database (all state is strictly single-tenant and stored locally).
- Managing UI rendering (the service only provides data and logic).

## 3. System Overview

### 3.1 Main Components

1. `API Router & Proxy`
   - Handles incoming HTTP requests from UI/CLI.
   - Proxies LLM completions (`/proxy/:provider/v1/...`).
2. `Context Synthesizer`
   - Reads `SOUL.md`, `USER.md`, and active `SKILL.md` files.
   - Queries the Vector Database for relevant memory context.
   - Assembles the final System Prompt.
3. `Tool Execution Engine`
   - Parses LLM `tool_calls`.
   - Executes Native Tools (`Bash`, `Read`, `Write`, `BrowserEval`).
   - Manages stateful `node-pty` instances.
4. `Sub-Agent Orchestrator`
   - Handles the `Task` tool.
   - Spawns isolated LLM loops with restricted tool permissions.
5. `Memory Manager`
   - Manages `sqlite-vec` databases for embeddings.
   - Manages static YAML/Markdown profiles for deterministic identities.
6. `Extension Manager`
   - Dynamically loads filesystem-based `Skills` (Markdown).
   - Manages sandboxed `Plugins` (JavaScript) and MCP server connections.

### 3.2 External Dependencies
- Node.js runtime environment.
- Local filesystem access (`~/.config/alma/` and workspace paths).
- `sqlite-vec` native extension for SQLite.
- `node-pty` for pseudo-terminal emulation.
- External LLM Provider APIs.

## 4. Core Domain Model

### 4.1 Entities

#### 4.1.1 Thread (Session)
A single conversation history.
- `thread_id` (string): Unique identifier.
- `title` (string): Auto-generated title.
- `messages` (list of objects): Standard LLM message format (role, content, tool_calls).

#### 4.1.2 Workspace
The isolated filesystem boundary for agent execution.
- `id` (string): E.g., `default` or `temp-xyz`.
- `path` (string): Absolute path to the workspace root.
- `history_file` (string): Path to `.alma-snapshots/history.json`.

#### 4.1.3 Vector Memory
A semantic fragment of past conversations.
- `memory_id` (string): Unique ID.
- `content` (string): The raw text data.
- `embedding` (Float[1536]): The vector representation.
- `metadata` (JSON): Context tags (thread_id, date, etc.).

#### 4.1.4 Skill
A prompt-injected capability extension.
- `id` (string): Skill directory name.
- `manifest` (YAML Frontmatter): Contains `name`, `description`, `allowed-tools`.
- `instructions` (string): Markdown body detailing how the agent should use the tools.

#### 4.1.5 Sub-Agent (Task Worker)
An autonomous background process targeting a specific goal.
- `task_id` (string): Unique ID.
- `subagent_type` (string): Enum (`coder`, `Explore`, `Plan`, `alma-guide`, etc.).
- `system_prompt` (string): Hardcoded instructions specific to the type.
- `allowed_tools` (list of strings): Restricted subset of Native Tools.
- `status` (string): `running`, `success`, `failed`.

## 5. Configuration and State Management

### 5.1 Storage Layout
The service relies on a strict filesystem layout acting as its primary database:
- `~/.config/alma/config.json`: Service routing, keys, and feature flags.
- `~/.config/alma/SOUL.md`: Agent identity rules.
- `~/.config/alma/USER.md`: User preferences.
- `~/.config/alma/skills/`: Installed skills.
- `~/.config/alma/plugins/`: Installed JS plugins.
- `~/.config/alma/people/`: Deterministic identity profiles.

### 5.2 Dynamic State
The orchestrator holds dynamic state in memory:
- `active_ptys` (map): PID and stream handles for running `Bash` terminals.
- `active_tasks` (map): Status and output buffers for background `Task` workers.
- `fatigue_level` (integer): Transient state affecting the agent's prompt based on continuous usage.

## 6. API Surface (Integration Layer)

The service exposes endpoints for client consumption.

### 6.1 Chat and Execution
- `POST /api/chat/completions`: Main entry point. Handles context synthesis, proxying, and the synchronous Tool Execution Loop.
- `POST /proxy/:providerId/v1/messages`: Passthrough for direct LLM calls.
- `POST /api/threads`: Create a new conversation context.

### 6.2 Orchestration and Polling
- `GET /api/agents/tasks/:taskId`: Returns the status of a background sub-agent (used by the `TaskOutput` tool).
- `POST /api/agents/tasks/:taskId/resume`: Restarts a suspended sub-agent.

### 6.3 Memory and Context
- `POST /api/memories/search`: Semantic search against `sqlite-vec`.
- `GET /api/people/:name`: Fetch deterministic profiles.

## 7. The Agentic Loop (Execution State Machine)

When `/api/chat/completions` is called, the service enters the Agentic Loop.

### 7.1 Phase 1: Context Assembly
Before hitting the LLM, the service constructs the system payload:
1. Load base instruction.
2. Inject `SOUL.md` and `USER.md`.
3. Embed dynamic RAG results from `sqlite-vec` based on the user's last message.
4. Inject relevant `SKILL.md` contents based on keyword/semantic matching.
5. Append tool JSON schemas (Native Tools).

### 7.2 Phase 2: Inference and Interception
1. Send request to LLM.
2. If LLM returns text -> return text to client (Loop Ends).
3. If LLM returns `tool_calls` -> Intercept response, do NOT return to client yet.

### 7.3 Phase 3: Tool Execution
For each `tool_call`:
- If `name == "Bash"`:
  - Retrieve or spawn `node-pty` instance for the workspace.
  - Write command to stdin.
  - Await command completion or timeout.
  - Capture stdout/stderr.
- If `name == "Read"`:
  - Read local file using `fs.readFileSync`.
- If `name == "Task"`:
  - Generate a `task_id`.
  - Spawn an asynchronous sub-agent worker.
  - Return `{"status": "started", "task_id": "..."}` immediately to the main loop.

### 7.4 Phase 4: Resolution
1. Append Tool Execution Results to the message history.
2. GOTO Phase 2 (Send history back to LLM to evaluate the tool results).

## 8. Sub-Agent Orchestration (Task Mechanism)

### 8.1 Isolation Rules
When a `Task` is spawned:
- It runs in an isolated `while` loop, completely detached from the main `/api/chat/completions` request.
- It receives a restricted set of tools (e.g., `alma-guide` cannot use `Bash` or `Write`).
- It is assigned a specialized System Prompt overriding `SOUL.md`.

### 8.2 Lifecycle
1. `Started`: Registered in `active_tasks`.
2. `Running`: Loop executes `LLM -> Tool -> Result -> LLM`.
3. `Completed`: LLM determines the goal is met and generates a summary. State is saved to memory.
4. `Reporting`: The Main Agent calls `TaskOutput(task_id, block: true)`. The service unblocks the call and returns the summary to the Main Agent.

## 9. Safety and Security Model

### 9.1 Filesystem Boundaries
- Native tools (`Read`, `Write`) validate target paths. The agent should primarily operate within `workspace.path`.
- **Note:** Protan's default posture is highly permissive to enable full OS automation. Safety relies on the user isolating sensitive data rather than strict sandboxing.

### 9.2 Process Isolation
- `node-pty` processes are bound to the lifecycle of the service.
- Infinite loops in `Bash` must be mitigated by a strict `timeout` parameter in the tool execution layer, forcefully sending `SIGINT` (Ctrl+C) if the process hangs.

### 9.3 Credential Protection
- Secrets are read from `config.json` by the service and injected into API headers.
- Secrets are NEVER sent to the React Renderer or CLI output.
- Tool outputs containing API keys (e.g., reading a `.env` file) must be redacted via a sanitization middleware before being appended to the LLM context.

## 10. Reference Algorithms (Language-Agnostic)

### 10.1 Context Synthesis Pipeline

```text
function build_system_prompt(user_message, workspace_id):
  base_prompt = load_hardcoded_instructions()
  identity = read_file("~/.config/alma/SOUL.md")
  user_prefs = read_file("~/.config/alma/USER.md")
  
  memory_context = vector_db.search(query=user_message, limit=5)
  skill_context = skill_manager.match_skills(user_message)
  
  sys_prompt = format(
    "{base}\n\nIDENTITY:\n{id}\n\nUSER:\n{prefs}\n\nMEMORIES:\n{mem}\n\nSKILLS:\n{skills}",
    base=base_prompt, id=identity, prefs=user_prefs, mem=memory_context, skills=skill_context
  )
  
  return sys_prompt
```

### 10.2 Synchronous Agentic Loop

```text
function run_agent_loop(messages, workspace_id):
  sys_prompt = build_system_prompt(messages.last(), workspace_id)
  tools = get_native_tools_schema()
  
  while true:
    response = llm_provider.create_completion(
      system=sys_prompt,
      messages=messages,
      tools=tools
    )
    
    if response.has_tool_calls():
      for call in response.tool_calls:
        if call.name == "TaskOutput":
            result = handle_task_output(call.args.task_id, call.args.block)
        else:
            result = execute_native_tool(call.name, call.args, workspace_id)
            
        messages.append(ToolResultMessage(call.id, result))
    else:
      messages.append(AssistantMessage(response.text))
      return response.text
```

### 10.3 Background Task Orchestration

```text
function execute_task_tool(args):
  task_id = generate_uuid()
  active_tasks[task_id] = { status: "started", output: null }
  
  spawn_background_worker(
    fn -> run_sub_agent(task_id, args.subagent_type, args.prompt)
  )
  
  return json({ "status": "started", "task_id": task_id })

function run_sub_agent(task_id, type, prompt):
  agent_def = get_subagent_definition(type) // Contains specific Lc (Prompt) and Dc (Tools)
  
  messages = [UserMessage(prompt)]
  
  while true:
    response = llm_provider.create_completion(
      system=agent_def.system_prompt,
      messages=messages,
      tools=agent_def.allowed_tools
    )
    
    if response.has_tool_calls():
      // Execute tools using sub-agent permissions
      ... 
    else:
      // Task complete
      active_tasks[task_id].status = "completed"
      active_tasks[task_id].output = response.text
      break
```
