import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import matter from "gray-matter";
import { getConfigDir } from "./db.js";
import { searchMemories } from "./memory.js";

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

async function buildRagLayer(userMessage: string): Promise<string> {
  try {
    const results = await searchMemories(userMessage, 5);
    if (results.length === 0) return "";

    const items = results
      .filter((r) => r.similarity > 0.3)
      .map((r) => `- ${r.content}`);

    if (items.length === 0) return "";
    return `## RELEVANT MEMORIES\n${items.join("\n")}`;
  } catch {
    return "";
  }
}

function buildPeopleLayer(userMessage: string): string {
  const peopleDir = path.join(getConfigDir(), "people");
  if (!fs.existsSync(peopleDir)) return "";

  try {
    const files = fs.readdirSync(peopleDir).filter((f) => f.endsWith(".md"));
    const messageLower = userMessage.toLowerCase();
    const matched: string[] = [];

    for (const file of files) {
      const raw = fs.readFileSync(path.join(peopleDir, file), "utf-8");
      const { data, content } = matter(raw);
      const name = (data.name as string) || file.replace(".md", "");

      if (messageLower.includes(name.toLowerCase())) {
        const parts = [`### ${name}`];
        if (data.relationship) parts.push(`Relationship: ${data.relationship}`);
        if (data.tags && Array.isArray(data.tags)) parts.push(`Tags: ${data.tags.join(", ")}`);
        if (content.trim()) parts.push(content.trim());
        matched.push(parts.join("\n"));
      }
    }

    if (matched.length === 0) return "";
    return `## PERSON CONTEXT\n${matched.join("\n\n")}`;
  } catch {
    return "";
  }
}

function buildSkillsLayer(userMessage: string): string {
  const skillsDir = path.join(getConfigDir(), "skills");
  if (!fs.existsSync(skillsDir)) return "";

  let skills: Array<{ name: string; description: string; instructions: string }>;
  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    skills = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;

      const raw = fs.readFileSync(skillPath, "utf-8");
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!fmMatch) continue;

      const frontmatter = fmMatch[1];
      const body = fmMatch[2].trim();

      const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
      const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

      skills.push({
        name: nameMatch ? nameMatch[1].trim() : entry.name,
        description: descMatch ? descMatch[1].trim() : "",
        instructions: body,
      });
    }
  } catch {
    return "";
  }

  if (skills.length === 0) return "";

  // Simple keyword matching: split user message into words, score by overlap
  const words = userMessage
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) return "";

  const scored = skills.map((skill) => {
    const haystack = `${skill.name} ${skill.description}`.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (haystack.includes(word)) score++;
    }
    return { skill, score };
  });

  const top = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  if (top.length === 0) return "";

  const sections = top.map(
    (s) => `### ${s.skill.name}\n${s.skill.instructions}`,
  );

  return `## ACTIVE SKILLS\n${sections.join("\n\n")}`;
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
    buildBaseInstructions(),          // 1. Base instructions (highest priority)
    buildSoulLayer(),                 // 2. SOUL.md
    buildUserLayer(),                 // 3. USER.md
    buildMemoryLayer(),               // 4. Long-term memory
    await buildRagLayer(userMessage), // 5. RAG results
    buildPeopleLayer(userMessage),    // 6. Person context
    buildSkillsLayer(userMessage),    // 7. Active skills
    buildToolSchemasLayer(),          // 8. Tool schemas
    buildSystemInfoLayer(),           // 9. System info
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
