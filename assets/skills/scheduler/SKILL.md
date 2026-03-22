---
name: scheduler
description: Create, manage, and delete scheduled tasks (cron jobs) and configure heartbeat. Use when users ask for reminders, recurring tasks, daily summaries, periodic checks, or anything time-based. Also manages HEARTBEAT.md for periodic awareness checks.
allowed-tools:
  - Bash
  - Read
  - Write
---

# Scheduler Skill

You can schedule tasks and manage periodic heartbeat checks.

## Cron Jobs (Scheduled Tasks)

Use the `tomu cron` CLI to manage scheduled tasks.

```bash
# List all jobs
tomu cron list

# Add a one-shot reminder (fires once then auto-deletes)
# Format: tomu cron add <name> <at|every|cron> <schedule> [--mode main|isolated] [--prompt "..."] [--deliver-to CHAT_ID]
tomu cron add "Meeting reminder" at "20m" --mode main --prompt "Time for the meeting!"

# Add a recurring task with cron expression
tomu cron add "AI news digest" cron "0 9 * * *" --mode isolated --prompt "Search and summarize today's most important AI news, concise and clear" --deliver-to CHAT_ID

# Add an interval-based task
tomu cron add "Check emails" every "2h" --mode isolated --prompt "Check for important emails" --deliver-to CHAT_ID

# Update an existing job (change prompt, schedule, deliver-to, etc.)
tomu cron update <job-id> [--prompt "new prompt"] [--schedule "new schedule"] [--deliver-to CHAT_ID] [--name "new name"]

# Run a job immediately
tomu cron run <job-id>

# View run history
tomu cron history <job-id>

# Enable/disable
tomu cron enable <job-id>
tomu cron disable <job-id>

# Remove
tomu cron remove <job-id>
```

### Command Format
`tomu cron add <name> <type> <schedule> [options]`
- `<type>`: `at` (one-shot), `every` (interval), `cron` (cron expression)
- `<schedule>`: depends on type — "20m"/"2026-02-11T09:00:00" for at, "30m"/"2h" for every, "0 9 * * *" for cron
- `--mode main|isolated`: main injects into existing thread, isolated creates temp thread (default: isolated)
- `--prompt "..."`: the message/task for the AI to execute
- `--deliver-to CHAT_ID`: send result to Telegram (use user's chat ID from system context)
- `--thread-id ID`: which thread to inject into (for main mode)
- `--model MODEL`: model override for this job

## Heartbeat (Periodic Awareness)

Heartbeat is a periodic check-in where you "wake up" and look for things that need attention.

### Managing Heartbeat Config
```bash
tomu heartbeat status           # Check if enabled and current config
tomu heartbeat config           # Show current heartbeat config
tomu heartbeat enable           # Enable heartbeat
tomu heartbeat disable          # Disable heartbeat
tomu heartbeat interval 30      # Set interval to 30 minutes
tomu heartbeat patrol enable    # Enable group patrol
tomu heartbeat patrol disable   # Disable group patrol
tomu heartbeat patrol config    # Show patrol config
```

### Managing HEARTBEAT.md
The heartbeat reads `HEARTBEAT.md` from the workspace as your checklist. Edit it to change what you check on each heartbeat.

**File location:** `HEARTBEAT.md` in the active workspace root.

Example:
```markdown
# Heartbeat Checklist

- Check for unhandled important messages
- If the user hasn't interacted for over 4 hours, say hello
- Check the weather once every morning
```

If nothing needs attention, respond with `HEARTBEAT_OK` (this is suppressed, user won't see it).

## When to Use What

| User says | Action |
|-----------|--------|
| "Remind me about the meeting in 20 minutes" | `tomu cron add "Meeting reminder" at "20m" --prompt "Time for the meeting!" --deliver-to CHAT_ID` |
| "Summarize AI news for me every morning at 9am" | `tomu cron add "AI news" cron "0 1 * * *" --mode isolated --prompt "Search and summarize today's AI news" --deliver-to CHAT_ID` (Note: cron uses UTC, 9am GMT+8 = 1am UTC) |
| "Check emails every hour" | `tomu cron add "Check emails" every "1h" --mode isolated --prompt "Check emails" --deliver-to CHAT_ID` |
| "Stop sending me heartbeats" | `tomu heartbeat disable` |
| "Also check the weather during heartbeats" | Edit HEARTBEAT.md, add weather check item |
| "Cancel that daily news task" | `tomu cron list` → `tomu cron remove <id>` |
| "Also @ me for update reminders" | `tomu cron list` → `tomu cron update <id> --prompt "new prompt with @user"` |
| "Change the reminder to once per hour" | `tomu cron update <id> --schedule "1h"` |

## Important — deliver-to Target Selection (CRITICAL)
- `--deliver-to` determines WHERE the cron job result gets sent. Choose the RIGHT target:
  - If the task is about reminding/notifying a GROUP → use the GROUP's chatId (negative number like -1001886218691)
  - If the task is about reminding/notifying the USER personally → use the user's chatId
  - If the user says "remind in the group" / "send to the group" → deliver-to MUST be the group chatId, NOT the user's private chatId
  - If the user says "remind me" / "tell me" → deliver-to is the user's chatId
- Use `tomu group list` to find group chatIds if needed
- For isolated tasks that should send results somewhere, ALWAYS include `--deliver-to`
- Cron expressions use UTC unless otherwise noted — adjust for user's timezone
- One-shot `--at` jobs auto-delete after running
