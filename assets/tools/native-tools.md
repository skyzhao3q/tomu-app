# Native Tools

Native tools are hardcoded in TypeScript within the main process. They provide OS-level capabilities that serve as the AI's direct interface with the system.

## OS & Shell

| Tool | Description |
|------|-------------|
| `Bash` | Execute commands in a background shell (node-pty) |
| `BashOutput` | Retrieve logs from a running command |
| `KillShell` | Force-terminate a running shell |

## File System

| Tool | Description |
|------|-------------|
| `Read` | Read file contents (with pagination for large files) |
| `Write` | Create or overwrite a file |
| `Edit` | Search-and-replace within a file (sed-like) |
| `Glob` | Pattern-matching file search |
| `Grep` | Fast content search via ripgrep |

## Sub-Agents

| Tool | Description |
|------|-------------|
| `Task` | Delegate complex work (coding, research) to a specialized sub-agent (coder, explore, etc.) |
| `TaskOutput` | Retrieve progress or results from a delegated task |

## Web & Browser

| Tool | Description |
|------|-------------|
| `WebSearch` | Web search via Google etc. |
| `WebFetch` | Fetch a URL, render JS, and convert to Markdown |
| `BrowserOpen` | Open a URL in the headless/built-in browser |
| `BrowserClick` | Click an element in the browser DOM |
| `BrowserType` | Type text into a browser input |
| `BrowserScreenshot` | Take a screenshot of the current browser page |
| `ChromeRelay*` | Suite of tools for controlling the user's actual Chrome browser tabs |

## Visualization

| Tool | Description |
|------|-------------|
| `widgetRenderer` | Render interactive HTML/SVG widgets inline in the chat |
| `pieChart` | Draw a pie chart in the chat |
| `barChart` | Draw a bar chart in the chat |

## System

| Tool | Description |
|------|-------------|
| `AttemptCompletion` | Report task completion to the user (supports CLI demos) |
| `ToolSearch` | Semantic search over available tools |
| `Skill` | Hub tool for invoking bundled Skills |
