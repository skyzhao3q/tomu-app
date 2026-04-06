import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { sqlite, getConfig, saveConfig } from "./db.js";
import type { AgentProfile } from "@tomu/core";

// ---------------------------------------------------------------------------
// DB row type
// ---------------------------------------------------------------------------

interface AgentProfileRow {
  id: string;
  name: string;
  category: string;
  execution_mode: string;
  enabled: number;
  built_in: number;
  color: string;
  summary: string;
  focus: string; // JSON array
  delegates_to: string; // JSON array
  prompt: string;
  model: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Row ↔ Profile conversion
// ---------------------------------------------------------------------------

function rowToProfile(row: AgentProfileRow): AgentProfile {
  return {
    id: row.id,
    name: row.name,
    category: row.category as AgentProfile["category"],
    executionMode: row.execution_mode as AgentProfile["executionMode"],
    enabled: row.enabled === 1,
    builtIn: row.built_in === 1,
    color: row.color,
    summary: row.summary,
    focus: JSON.parse(row.focus) as string[],
    delegatesTo: JSON.parse(row.delegates_to) as string[],
    prompt: row.prompt,
    model: row.model ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Subagents directory (mirrors logic in subagents.ts to avoid circular dep)
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getSubagentsDir(): string {
  return path.resolve(__dirname, "..", "..", "..", "..", "assets", "prompts", "subagents");
}

// ---------------------------------------------------------------------------
// Built-in agent seed data
// ---------------------------------------------------------------------------

interface SeedMeta {
  name: string;
  category: AgentProfile["category"];
  executionMode: AgentProfile["executionMode"];
  color: string;
  summary: string;
  focus: string[];
  delegatesTo: string[];
}

const BUILT_IN_META: Record<string, SeedMeta> = {
  "product-manager": {
    name: "Product Manager",
    category: "product",
    executionMode: "general-purpose",
    color: "#6366f1",
    summary: "Breaks down goals into requirements, manages execution, delegates to specialists",
    focus: ["Requirements", "Planning", "Delegation", "Scoping", "Acceptance"],
    delegatesTo: ["designer", "developer", "researcher", "operator"],
  },
  designer: {
    name: "Designer",
    category: "design",
    executionMode: "plan",
    color: "#ec4899",
    summary: "Designs UX/UI flows, component hierarchies, and interaction states",
    focus: ["UX/UI", "Components", "Interaction States", "Accessibility", "Design Spec"],
    delegatesTo: [],
  },
  developer: {
    name: "Developer",
    category: "engineering",
    executionMode: "coder",
    color: "#22c55e",
    summary: "Implements code, writes tests, edits files, and runs shell commands",
    focus: ["Implementation", "Code", "Testing", "Bash", "File Editing"],
    delegatesTo: [],
  },
  researcher: {
    name: "Researcher",
    category: "research",
    executionMode: "explore",
    color: "#f59e0b",
    summary: "Analyzes codebases, researches topics, and produces structured reports",
    focus: ["Research", "Analysis", "Reports", "Information Gathering"],
    delegatesTo: [],
  },
  operator: {
    name: "Operator",
    category: "operations",
    executionMode: "tomu-operator",
    color: "#14b8a6",
    summary: "Handles system operations, bash commands, and file management tasks",
    focus: ["System Ops", "Bash", "File Management"],
    delegatesTo: [],
  },
};

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

export function seedBuiltInAgents(): void {
  const count = (
    sqlite.prepare("SELECT COUNT(*) as n FROM agent_profiles").get() as { n: number }
  ).n;
  if (count > 0) return;

  const dir = getSubagentsDir();
  const now = new Date().toISOString();

  for (const [id, meta] of Object.entries(BUILT_IN_META)) {
    const mdPath = path.join(dir, `${id}.md`);
    const prompt = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, "utf-8") : "";

    sqlite
      .prepare(
        `INSERT INTO agent_profiles
           (id, name, category, execution_mode, enabled, built_in, color, summary, focus, delegates_to, prompt, model, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      )
      .run(
        id,
        meta.name,
        meta.category,
        meta.executionMode,
        meta.color,
        meta.summary,
        JSON.stringify(meta.focus),
        JSON.stringify(meta.delegatesTo),
        prompt,
        now,
        now,
      );
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export function listAgentProfiles(): AgentProfile[] {
  const rows = sqlite
    .prepare("SELECT * FROM agent_profiles ORDER BY created_at ASC")
    .all() as AgentProfileRow[];
  return rows.map(rowToProfile);
}

export function getAgentProfile(id: string): AgentProfile | undefined {
  const row = sqlite
    .prepare("SELECT * FROM agent_profiles WHERE id = ?")
    .get(id) as AgentProfileRow | undefined;
  return row ? rowToProfile(row) : undefined;
}

export function createAgentProfile(data: Omit<AgentProfile, "builtIn">): AgentProfile {
  const now = new Date().toISOString();
  const id = data.id || crypto.randomUUID().slice(0, 8);

  sqlite
    .prepare(
      `INSERT INTO agent_profiles
         (id, name, category, execution_mode, enabled, built_in, color, summary, focus, delegates_to, prompt, model, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      data.name,
      data.category,
      data.executionMode,
      data.enabled ? 1 : 0,
      data.color,
      data.summary,
      JSON.stringify(data.focus),
      JSON.stringify(data.delegatesTo),
      data.prompt,
      data.model ?? null,
      now,
      now,
    );

  return getAgentProfile(id)!;
}

export function updateAgentProfile(id: string, patch: Partial<AgentProfile>): AgentProfile {
  const existing = getAgentProfile(id);
  if (!existing) throw new Error(`Agent profile not found: ${id}`);

  // Built-in agents cannot change id or executionMode
  if (existing.builtIn) {
    if (patch.id !== undefined && patch.id !== id) {
      throw Object.assign(new Error("Cannot change the ID of a built-in agent"), {
        status: 403,
      });
    }
    if (patch.executionMode !== undefined && patch.executionMode !== existing.executionMode) {
      throw Object.assign(new Error("Cannot change the execution mode of a built-in agent"), {
        status: 403,
      });
    }
  }

  const now = new Date().toISOString();
  const merged = { ...existing, ...patch };

  sqlite
    .prepare(
      `UPDATE agent_profiles SET
         name = ?,
         category = ?,
         execution_mode = ?,
         enabled = ?,
         color = ?,
         summary = ?,
         focus = ?,
         delegates_to = ?,
         prompt = ?,
         model = ?,
         updated_at = ?
       WHERE id = ?`,
    )
    .run(
      merged.name,
      merged.category,
      merged.executionMode,
      merged.enabled ? 1 : 0,
      merged.color,
      merged.summary,
      JSON.stringify(merged.focus),
      JSON.stringify(merged.delegatesTo),
      merged.prompt,
      merged.model ?? null,
      now,
      id,
    );

  return getAgentProfile(id)!;
}

export function deleteAgentProfile(id: string): boolean {
  const existing = getAgentProfile(id);
  if (!existing) return false;
  if (existing.builtIn) {
    throw Object.assign(new Error("Cannot delete a built-in agent"), { status: 403 });
  }
  const result = sqlite.prepare("DELETE FROM agent_profiles WHERE id = ?").run(id);
  return result.changes > 0;
}

export function resetAgentProfile(id: string): AgentProfile {
  const existing = getAgentProfile(id);
  if (!existing) throw new Error(`Agent profile not found: ${id}`);
  if (!existing.builtIn) {
    throw Object.assign(new Error("Reset is only available for built-in agents"), { status: 403 });
  }

  const dir = getSubagentsDir();
  const mdPath = path.join(dir, `${id}.md`);
  if (!fs.existsSync(mdPath)) {
    throw new Error(`Prompt file not found for agent: ${id}`);
  }
  const prompt = fs.readFileSync(mdPath, "utf-8");
  return updateAgentProfile(id, { prompt });
}

// ---------------------------------------------------------------------------
// Global agents config (stored in config.json)
// ---------------------------------------------------------------------------

export function getAgentsGlobalConfig(): { enabled: boolean; allowSubagentDelegation: boolean } {
  const config = getConfig() as Record<string, unknown>;
  return {
    enabled: (config["agents_enabled"] as boolean | undefined) ?? true,
    allowSubagentDelegation: (config["agents_allow_delegation"] as boolean | undefined) ?? true,
  };
}

export function setAgentsGlobalConfig(patch: {
  enabled?: boolean;
  allowSubagentDelegation?: boolean;
}): void {
  const config = getConfig() as Record<string, unknown>;
  if (patch.enabled !== undefined) config["agents_enabled"] = patch.enabled;
  if (patch.allowSubagentDelegation !== undefined)
    config["agents_allow_delegation"] = patch.allowSubagentDelegation;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveConfig(config as any);
}
