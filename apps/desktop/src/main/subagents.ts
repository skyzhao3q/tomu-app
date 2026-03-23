import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_TOOLS: Record<string, string[]> = {
  coder: ["Bash", "Read", "Write", "Edit", "Glob", "Grep"],
  explore: ["Read", "Glob", "Grep", "Bash"],
  plan: ["Read", "Glob", "Grep"],
  "general-purpose": ["Bash", "Read", "Write", "Edit", "Glob", "Grep"],
  "statusline-setup": ["Read", "Glob", "Grep"],
  "tomu-guide": ["Read", "Glob", "Grep"],
  "tomu-operator": ["Read", "Glob", "Grep"],
};

export interface AgentDefinition {
  type: string;
  systemPrompt: string;
  allowedTools: string[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getSubagentsDir(): string {
  // Development: resolve from project root (src/main/ -> ../../assets)
  return path.resolve(__dirname, "..", "..", "..", "..", "assets", "prompts", "subagents");
}

export function loadAgentDefinition(type: string): AgentDefinition {
  const dir = getSubagentsDir();
  const filePath = path.join(dir, `${type}.md`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Unknown sub-agent type: ${type}`);
  }

  const systemPrompt = fs.readFileSync(filePath, "utf-8");
  const allowedTools = ALLOWED_TOOLS[type] ?? ["Read", "Glob", "Grep"];

  return { type, systemPrompt, allowedTools };
}

export function listAgentTypes(): string[] {
  const dir = getSubagentsDir();
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(/\.md$/, ""));
  } catch {
    return [];
  }
}
