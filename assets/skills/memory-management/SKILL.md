---
name: memory-management
description: Search and manage tomu's memory and conversation history. Use when the user asks about past conversations, personal facts, preferences, or anything that requires recalling information ("do you know my...", "we talked about before...", "do you remember...", "help me find what we said about..."). Also used to store new memories and search through archived chat threads.
allowed-tools:
  - Bash
  - Read
  - Write
---

# Memory Management Skill

tomu has a built-in memory system with semantic search. Use the `tomu` CLI to interact with it.

## Commands

```bash
# List all memories
tomu memory list

# Semantic search
tomu memory search <query>

# Add a memory
tomu memory add <content>

# Delete a memory
tomu memory delete <id>

# View memory stats
tomu memory stats
```

## When to Use

- **User asks anything about the past** ("do you know what I like", "what did we discuss before", "what was that plan we talked about last time") → Search memories AND grep threads
- **User says "remember this"** → `tomu memory add "..."`
- **User asks "do you remember..."** → `tomu memory search "..."` + `tomu memory grep "..."`
- **User says "forget about..."** → Search and delete matching memories
- **Time-sensitive info** (projects, deadlines) → Store with appropriate context

## Search Strategy

When the user asks about past information, **always try both layers**:
1. `tomu memory search "<query>"` — semantic search for related concepts
2. `tomu memory grep "<keyword>"` — keyword search in conversation history

If one layer returns nothing, try the other. They complement each other.

## Conversation History Search

tomu automatically archives all threads as markdown files. You can search through past conversations:

```bash
# Keyword search through all archived conversations
tomu memory grep <keyword>

# Force re-archive all threads now
tomu memory archive
```

Thread archives are stored in the workspace's `threads/` directory as markdown files with YAML frontmatter (threadId, title, createdAt, updatedAt, model, messageCount). Archives are auto-updated every 5 minutes.

### Two-Layer Memory

1. **Vector Memory** (`tomu memory search`) — semantic search, finds conceptually related memories
2. **Conversation Archives** (`tomu memory grep`) — keyword search, finds exact words/phrases in past conversations

Use vector search when the user asks vague questions ("what did we discuss about React?"). Use grep when looking for specific terms, names, or code snippets.

## Group Chat History

tomu persists all group chat messages to log files. Search and browse them:

```bash
# List all known groups
tomu group list

# View recent history (default 50 messages)
tomu group history <chatId> [limit]

# Search across all group chats
tomu group search <keyword>
```

Log files are stored at `~/.config/tomu/groups/<chatId>_<date>.log`. Use this when you need to recall what was discussed in a group chat.

## People Profiles (Per-Person Memory)

For group chats, tomu maintains structured per-person profiles — more reliable than vector search for remembering who is who.

```bash
# List all known people
tomu people list

# View someone's profile
tomu people show <name>

# Set/overwrite profile
tomu people set <name> <content>

# Append to profile
tomu people append <name> <fact>

# Delete profile
tomu people delete <name>
```

**When to update profiles:**
- Someone shares personal info (job, hobbies, preferences)
- You learn their communication style or language preference
- They mention relationships with other people
- Any fact you'd want to remember next time you talk to them

Profiles are stored at `~/.config/tomu/people/<name>.md` and automatically loaded into group chat context.

## Tips

- Always confirm what you stored/deleted with the user
- Use `tomu memory search` to find related memories before adding duplicates
- Memories are automatically injected into conversations via semantic search — you don't need to manually recall them every time
- Use `tomu memory grep` to search through conversation history when vector search doesn't find what you need
- **For per-person facts, prefer `tomu people` over `tomu memory`** — structured and won't get mixed up
