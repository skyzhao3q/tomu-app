# assets/ — Runtime Prompt & Skill Definitions

This directory contains all text assets that the tomu runtime loads, injects, and composes at runtime. Nothing here is documentation — every file is a **production artifact** consumed by code.

## Directory Structure

```
assets/
├── prompts/
│   ├── base-instructions.md        # The "constitution" — always first in system prompt
│   ├── hidden/                     # Background LLM task prompts (user never sees these)
│   │   ├── thread-title.md         # Auto-generate thread titles
│   │   ├── memory-extraction.md    # Extract memories from conversation
│   │   ├── memory-cleanup.md       # Prune stale temporary memories
│   │   └── git-commit.md           # Generate commit messages for coder agent
│   └── subagents/                  # System prompts for sub-agent types
│       ├── general-purpose.md
│       ├── coder.md
│       ├── explore.md
│       ├── plan.md
│       ├── tomu-guide.md
│       ├── tomu-operator.md
│       └── statusline-setup.md
├── tools/
│   ├── native-tools.md             # Reference catalog of all native tool names and descriptions
│   └── widget-readme.md            # Design guidelines injected before widgetRenderer calls
└── skills/
    ├── README.md                   # SKILL.md format specification
    └── <skill-name>/SKILL.md       # 30 skill definitions (see full list below)
```

---

## How Each Category Is Used

### 1. `prompts/base-instructions.md` — Base System Prompt

**What it is:** The immutable "constitution" that defines tomu's personality, rules, and behavioral constraints.

**When to load:** Every single LLM call in the main agentic loop. This is always the first segment of the assembled system prompt.

**How to use in code:**

```typescript
// In buildSystemPrompt() — Context Assembly phase
const baseInstructions = await readAsset('prompts/base-instructions.md');

// Template variable substitution
const rendered = baseInstructions
  .replace('${ownerName}', owner.name)
  .replace('${osName}', os.type())
  .replace('${platform}', os.platform())
  .replace('${systemDetails}', getSystemDetails());

systemPrompt.push({ role: 'system', content: rendered });
```

**Template variables in the file:**
| Variable | Description | Example value |
|----------|-------------|---------------|
| `${ownerName}` | Owner's display name from USER.md | `"Chris"` |
| `${osName}` | OS name | `"macOS"` |
| `${platform}` | Platform identifier | `"darwin"` |
| `${systemDetails}` | Runtime info (version, uptime, etc.) | `" v0.1.0 ..."` |

---

### 2. `prompts/hidden/` — Background LLM Task Prompts

**What they are:** System prompts for background LLM calls that run invisibly — the user never sees these conversations.

**When to load:** Each file is used by a specific background job. Load only the one you need.

**How to use in code:**

```typescript
// Thread title generation — called after first user message in a new thread
async function generateThreadTitle(firstMessage: string): Promise<string> {
  const prompt = await readAsset('prompts/hidden/thread-title.md');
  const result = await llm.complete({
    model: toolModel,  // use the cheaper "tool model", not the main model
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: firstMessage }
    ]
  });
  return result.text.trim();
}

// Memory extraction — called after each conversation turn
async function extractMemories(conversation: Message[]): Promise<MemoryOp[]> {
  const prompt = await readAsset('prompts/hidden/memory-extraction.md');
  const result = await llm.complete({
    model: toolModel,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: formatConversation(conversation) }
    ],
    responseFormat: 'json'
  });
  return JSON.parse(result.text);  // Returns [{ operation, content, durability }]
}

// Memory cleanup — called periodically to prune temporary memories
async function cleanupMemories(memories: TempMemory[], context: string): Promise<string[]> {
  const prompt = await readAsset('prompts/hidden/memory-cleanup.md');
  // ... similar pattern, returns array of memory IDs to delete
}

// Git commit message — called after coder agent modifies files
async function generateCommitMessage(diff: string): Promise<string> {
  const prompt = await readAsset('prompts/hidden/git-commit.md');
  // ... similar pattern, returns commit message string
}
```

| File | Trigger | LLM Response Format |
|------|---------|---------------------|
| `thread-title.md` | New thread created | Plain text (3-8 words) |
| `memory-extraction.md` | After conversation turn | JSON array of `{operation, content, durability}` |
| `memory-cleanup.md` | Periodic timer | JSON array of memory IDs to delete |
| `git-commit.md` | After coder agent edits files | Plain text (conventional commit format) |

---

### 3. `prompts/subagents/` — Sub-Agent System Prompts

**What they are:** System prompts that define the persona and capabilities of each sub-agent type spawned by the `Task` tool.

**When to load:** When the main agent calls the `Task` tool with a specific agent type.

**How to use in code:**

```typescript
// When the main agent calls Task({ type: 'coder', prompt: '...' })
async function spawnSubAgent(type: string, userPrompt: string) {
  const agentPrompt = await readAsset(`prompts/subagents/${type}.md`);
  const allowedTools = getToolsForAgentType(type);

  return runAgentLoop({
    messages: [
      { role: 'system', content: agentPrompt },
      { role: 'user', content: userPrompt }
    ],
    tools: allowedTools,
    // sub-agents do NOT get base-instructions.md — they are utility workers
  });
}
```

| Agent type | File | Purpose |
|------------|------|---------|
| `general-purpose` | `general-purpose.md` | Research, multi-step tasks |
| `coder` | `coder.md` | Write, fix, refactor code |
| `explore` | `explore.md` | Fast codebase exploration |
| `plan` | `plan.md` | Architecture and implementation planning |
| `tomu-guide` | `tomu-guide.md` | Answer questions about tomu using docs website |
| `tomu-operator` | `tomu-operator.md` | Read/modify tomu config via REST API |
| `statusline-setup` | `statusline-setup.md` | Configure status line display |

---

### 4. `tools/native-tools.md` — Native Tool Reference

**What it is:** A human-readable catalog of all native tools. Use this as the source of truth when implementing tool schemas.

**How to use in code:** This file is a **development reference**, not injected at runtime. Use it when:
- Implementing `getNativeToolSchemas()` to define JSON schemas for each tool
- Validating that a skill's `allowed-tools` list only references real tools
- Building the `ToolSearch` semantic index

---

### 5. `tools/widget-readme.md` — Widget Design Guidelines

**What it is:** CSS/HTML design rules and patterns injected into the AI context when it needs to render visual widgets.

**When to load:** When the AI calls `widgetReadme` (must happen once before any `widgetRenderer` call).

**How to use in code:**

```typescript
// widgetReadme tool handler
function handleWidgetReadme(params: { modules?: string[] }): string {
  const baseGuidelines = readAsset('tools/widget-readme.md');
  // Optionally append module-specific guidelines based on params.modules
  // (art, mockup, interactive, chart, diagram)
  return baseGuidelines;
}
```

---

### 6. `skills/<name>/SKILL.md` — Bundled Skill Definitions

**What they are:** Markdown files with YAML frontmatter that define extensible capabilities. Each skill is a prompt that tells the AI how to perform a specific task using available tools.

**When to load:** When the `Skill` tool matches a user request to a skill (via name or semantic search on `description`).

**How to use in code:**

```typescript
import yaml from 'yaml';

interface SkillDefinition {
  name: string;
  description: string;
  allowedTools: string[];
  prompt: string;
}

// Load and parse a SKILL.md
function loadSkill(skillName: string): SkillDefinition {
  const raw = readAsset(`skills/${skillName}/SKILL.md`);
  const [, frontmatter, ...body] = raw.split('---');
  const meta = yaml.parse(frontmatter);

  return {
    name: meta.name,
    description: meta.description,
    allowedTools: meta['allowed-tools'],
    prompt: body.join('---').trim()
  };
}

// Build a semantic search index for skill matching
function buildSkillIndex(): SearchIndex {
  const skills = glob('assets/skills/*/SKILL.md');
  return skills.map(path => {
    const skill = loadSkill(basename(dirname(path)));
    return { id: skill.name, text: skill.description, data: skill };
  });
}

// When the Skill tool is invoked
function handleSkillTool(skillName: string): ToolResult {
  const skill = loadSkill(skillName);

  // Inject the skill prompt into the current conversation context
  injectSystemMessage(skill.prompt);

  // Restrict available tools to only what the skill declares
  setAllowedTools(skill.allowedTools);

  return { status: 'activated', skill: skill.name };
}
```

**Skill deployment:** At build time or install, copy skill directories to `~/.config/tomu/skills/`. Users can also add custom skills by creating new directories there.

### Bundled Skills (30)

| Skill | Category |
|-------|----------|
| `memory-management` | Memory & identity |
| `self-management` | Memory & identity |
| `self-reflection` | Memory & identity |
| `selfie` | Memory & identity |
| `scheduler` | Planning & tasks |
| `todo` | Planning & tasks |
| `tasks` | Planning & tasks |
| `plan-mode` | Planning & tasks |
| `file-manager` | Utilities |
| `system-info` | Utilities |
| `screenshot` | Utilities |
| `send-file` | Utilities |
| `notebook` | Utilities |
| `web-search` | Information |
| `web-fetch` | Information |
| `browser` | Information |
| `travel` | Information |
| `thread-management` | Chat management |
| `reactions` | Chat management |
| `voice` | Creative & media |
| `image-gen` | Creative & media |
| `music-gen` | Creative & media |
| `music-listener` | Creative & media |
| `video-reader` | Creative & media |
| `telegram` | Platform integration |
| `discord` | Platform integration |
| `twitter-media` | Platform integration |
| `xiaohongshu-cli` | Platform integration |
| `skill-hub` | Skill management |
| `skill-search` | Skill management |

---

## System Prompt Assembly Order

At runtime, the main agentic loop assembles the full system prompt by concatenating layers in order (see `docs/08_SYSTEM_PROMPTS.md`):

```
1. base-instructions.md          ← assets/prompts/base-instructions.md (template-rendered)
2. SOUL.md                       ← ~/.config/tomu/SOUL.md (user-defined personality)
3. USER.md                       ← ~/.config/tomu/USER.md (owner profile)
4. Long-term Memory              ← MEMORY.md + Daily Notes
5. RAG Results                   ← sqlite-vec search results
6. Active Skill prompts          ← assets/skills/<matched>/SKILL.md body
7. Tool Schemas                  ← JSON schemas built from native-tools.md definitions
8. System Info                   ← OS, time, fatigue level
```

Hidden prompts and sub-agent prompts are **not** part of this assembly — they run in separate, isolated LLM sessions.

---

## Helper: `readAsset()`

All asset loading should go through a single function that resolves paths relative to the assets directory:

```typescript
import { readFile } from 'fs/promises';
import { join } from 'path';

const ASSETS_DIR = join(__dirname, '..', 'assets');

export async function readAsset(relativePath: string): Promise<string> {
  return readFile(join(ASSETS_DIR, relativePath), 'utf-8');
}
```
