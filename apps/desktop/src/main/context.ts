import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { getConfigDir } from "./db.js";

const MAX_SYSTEM_TOKENS = 8000;
const CHARS_PER_TOKEN = 4;
const MAX_SYSTEM_CHARS = MAX_SYSTEM_TOKENS * CHARS_PER_TOKEN;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFileIfExists(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function parseUserName(userMd: string): string {
  const match = userMd.match(/^name:\s*(.+)$/m);
  return match ? match[1].trim() : "User";
}

function getAssetsDir(): string {
  // Walk up from this file to the project root to find assets/
  // In dev: apps/desktop/src/main/context.ts -> ../../../../assets
  // Use process.cwd() as fallback (should be project root)
  const fromCwd = path.resolve(process.cwd(), "assets", "prompts");
  if (fs.existsSync(fromCwd)) return fromCwd;

  // Try relative to this file via import.meta.url
  const thisDir = path.dirname(new URL(import.meta.url).pathname);
  const fromFile = path.resolve(thisDir, "..", "..", "..", "..", "assets", "prompts");
  if (fs.existsSync(fromFile)) return fromFile;

  return fromCwd; // fallback
}

// ---------------------------------------------------------------------------
// Layer builders
// ---------------------------------------------------------------------------

function buildBaseInstructions(): string {
  const configDir = getConfigDir();
  const userMd = readFileIfExists(path.join(configDir, "USER.md"));
  const ownerName = parseUserName(userMd) || "User";

  const promptsDir = getAssetsDir();
  let base = readFileIfExists(path.join(promptsDir, "base-instructions.md"));
  if (!base) return "";

  base = base
    .replace(/\$\{ownerName\}/g, ownerName)
    .replace(/\$\{osName\}/g, os.type())
    .replace(/\$\{platform\}/g, `${os.platform()} ${os.arch()}`)
    .replace(/\$\{systemDetails\}/g, ` Current time: ${new Date().toLocaleString()}`);

  return base;
}

function buildSoulLayer(): string {
  const content = readFileIfExists(path.join(getConfigDir(), "SOUL.md"));
  return content ? `## SOUL\n${content}` : "";
}

function buildUserLayer(): string {
  const content = readFileIfExists(path.join(getConfigDir(), "USER.md"));
  return content ? `## USER PROFILE\n${content}` : "";
}

function buildMemoryLayer(): string {
  const configDir = getConfigDir();
  const parts: string[] = [];

  const mainMemory = readFileIfExists(path.join(configDir, "MEMORY.md"));
  if (mainMemory) parts.push(mainMemory);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayNote = readFileIfExists(path.join(configDir, "memory", `${todayStr}.md`));
  if (todayNote) parts.push(todayNote);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const yesterdayNote = readFileIfExists(path.join(configDir, "memory", `${yesterdayStr}.md`));
  if (yesterdayNote) parts.push(yesterdayNote);

  return parts.length > 0 ? `## MEMORIES\n${parts.join("\n\n")}` : "";
}

function buildRagLayer(_userMessage: string): string {
  // TODO: RAG search
  return "";
}

function buildSkillsLayer(): string {
  // TODO: skill matching
  return "";
}

function buildToolSchemasLayer(): string {
  return [
    "## Available Tools",
    "You have access to the following tools. Call them by name when needed:",
    "- **Bash**: Execute shell commands (system commands, git, npm, scripts)",
    "- **Read**: Read file contents with line numbers",
    "- **Write**: Create or overwrite files (creates parent directories automatically)",
    "- **Edit**: Search and replace text in files",
    "- **Glob**: Find files by glob pattern (e.g. `**/*.ts`)",
    "- **Grep**: Search file contents with regex patterns",
  ].join("\n");
}

function buildSystemInfoLayer(): string {
  return [
    `## SYSTEM INFO`,
    `Date: ${new Date().toLocaleString()}`,
    `OS: ${os.type()} ${os.release()} (${os.platform()} ${os.arch()})`,
    `Node: ${process.version}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function buildSystemPrompt(userMessage: string): Promise<string> {
  // Layers ordered by priority (highest first)
  const layers = [
    buildBaseInstructions(),   // 1. Base instructions (highest priority)
    buildSoulLayer(),          // 2. SOUL.md
    buildUserLayer(),          // 3. USER.md
    buildMemoryLayer(),        // 4. Long-term memory
    buildRagLayer(userMessage),// 5. RAG results (stub)
    buildSkillsLayer(),        // 6. Active skills (stub)
    buildToolSchemasLayer(),   // 7. Tool schemas (stub)
    buildSystemInfoLayer(),    // 8. System info
  ];

  // Token management: truncate lower-priority layers if over budget
  let totalChars = 0;
  const included: string[] = [];

  for (const layer of layers) {
    if (!layer) continue;
    if (totalChars + layer.length > MAX_SYSTEM_CHARS) {
      // Truncate this layer to fit remaining budget
      const remaining = MAX_SYSTEM_CHARS - totalChars;
      if (remaining > 100) {
        included.push(layer.slice(0, remaining) + "\n[truncated]");
      }
      break;
    }
    included.push(layer);
    totalChars += layer.length;
  }

  return included.join("\n\n");
}
