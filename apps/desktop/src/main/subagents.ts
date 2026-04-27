import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentProfile, listAgentProfiles } from "./agents.js";

const ALLOWED_TOOLS: Record<string, string[]> = {
  // Legacy general-purpose types
  coder: ["Bash", "Read", "Write", "Edit", "Glob", "Grep"],
  explore: ["Read", "Glob", "Grep", "Bash"],
  plan: ["Read", "Glob", "Grep"],
  "general-purpose": ["Bash", "Read", "Write", "Edit", "Glob", "Grep"],
  "statusline-setup": ["Read", "Glob", "Grep"],
  "tomu-guide": ["Read", "Glob", "Grep"],
  "tomu-operator": ["Read", "Glob", "Grep"],
  // Specialist crew — can delegate via Task/TaskOutput
  "product-manager": ["Read", "Glob", "Grep", "Task", "TaskOutput"],
  designer: ["Read", "Glob", "Grep", "Task", "TaskOutput"],
  developer: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "Task", "TaskOutput"],
  researcher: ["Read", "Glob", "Grep"],
  operator: ["Bash", "Read", "Write"],
};

// Human-readable display names
const AGENT_DISPLAY_NAMES: Record<string, string> = {
  coder: "Coder",
  explore: "Explorer",
  plan: "Planner",
  "general-purpose": "General Agent",
  "statusline-setup": "Setup",
  "tomu-guide": "Guide",
  "tomu-operator": "Operator",
  "product-manager": "Product Manager",
  designer: "Designer",
  developer: "Developer",
  researcher: "Researcher",
  operator: "Operator",
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
  // DB-first: look up the agent profile, fall back to .md file
  const profile = getAgentProfile(type);
  if (profile) {
    // Profile.id lookup takes priority (specialist agents have their own ALLOWED_TOOLS entry)
    const allowedTools =
      ALLOWED_TOOLS[profile.id] ??
      ALLOWED_TOOLS[profile.executionMode] ??
      ALLOWED_TOOLS[type] ??
      ["Read", "Glob", "Grep"];
    return { type, systemPrompt: profile.prompt, allowedTools };
  }

  // .md fallback (legacy agent types not yet in DB)
  const dir = getSubagentsDir();
  const filePath = path.join(dir, `${type}.md`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Unknown sub-agent type: ${type}`);
  }

  const systemPrompt = fs.readFileSync(filePath, "utf-8");
  const allowedTools = ALLOWED_TOOLS[type] ?? ["Read", "Glob", "Grep"];

  return { type, systemPrompt, allowedTools };
}

export function getAgentDisplayName(type: string): string {
  return AGENT_DISPLAY_NAMES[type] ?? type;
}

export function listAgentTypes(): string[] {
  try {
    const profiles = listAgentProfiles();
    if (profiles.length > 0) {
      return profiles.filter((p) => p.enabled).map((p) => p.id);
    }
  } catch {
    // DB not ready yet — fall through to .md fallback
  }

  // .md fallback when DB is empty or unavailable
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
