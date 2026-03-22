---
name: thread-management
description: Manage chat threads — create, list, switch, delete, and search conversations. Use when users want to organize their chats.
allowed-tools:
  - Bash
---

# Thread Management Skill

Manage tomu chat threads via the `tomu` CLI.

## Commands

```bash
# List recent threads (default 20)
tomu threads [limit]

# Show thread details
tomu thread info <thread-id>

# Create a new thread
tomu thread create <title> [--model providerId:modelName]

# Delete a thread
tomu thread delete <thread-id>

# Read thread messages
tomu thread messages <thread-id> [--limit 20]

# Switch current chat to a different thread
tomu thread switch <thread-id>

# Search across threads (via API)
curl -s "http://localhost:23001/api/threads/search?q=QUERY&limit=10"
```

## Tips

- Use `tomu threads` for a quick overview
- Use `tomu thread switch <id>` to switch the current Telegram/Discord chat to a different thread (the TOMU_THREAD_ID env is automatically set)
- When creating threads for the user, give them descriptive titles
- Always confirm before deleting threads
