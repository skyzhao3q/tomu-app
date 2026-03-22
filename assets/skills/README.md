# SKILL.md Format Specification

Skills are tomu's extensible capability system. Each skill is a Markdown file with YAML frontmatter that defines metadata, plus a Markdown body that serves as the dynamic prompt injected into the AI's context when the skill is activated.

## File Location

Skills are stored at:
```
~/.config/tomu/skills/<skill-name>/SKILL.md
```

Each skill lives in its own directory. Optional companion scripts (bash, python, etc.) can be placed alongside the SKILL.md file.

## YAML Frontmatter

```yaml
---
name: <skill-name>
description: <one-line description of what the skill does>
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - WebSearch
  - WebFetch
  # ... list of native tools this skill is allowed to use
---
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier for the skill (kebab-case) |
| `description` | Yes | Short description shown in skill listings and used for semantic search |
| `allowed-tools` | Yes | Array of native tool names this skill may invoke |

## Markdown Body

The body after the frontmatter `---` is the skill's prompt. When the skill is activated (via the `Skill` tool or `/skill-name` command), this entire body is injected into the AI's context as instructions.

The body typically includes:
- **Purpose**: What the skill does
- **Workflow**: Step-by-step instructions for the AI
- **Commands**: CLI commands or API calls to execute
- **Rules**: Constraints and edge cases
- **Examples**: Sample inputs/outputs

## Dynamic Prompt Injection

When a user triggers a skill:
1. tomu loads the SKILL.md file
2. The YAML frontmatter configures which tools are available
3. The Markdown body is injected into the current conversation context
4. The AI follows the instructions in the body, using only the allowed tools

## Example

```markdown
---
name: screenshot
description: Take a screenshot of the Mac screen
allowed-tools:
  - Bash
  - Read
---

Take a screenshot using the macOS `screencapture` command.

## Steps
1. Run `screencapture -x /tmp/screenshot.png` to capture the screen silently
2. Confirm the file was created
3. Send the screenshot to the user

## Notes
- Use `-x` flag to suppress the shutter sound
- The file is saved to /tmp for easy cleanup
```
