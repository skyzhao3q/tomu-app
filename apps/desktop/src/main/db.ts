import Database, { type Database as DatabaseType } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as schema from "@tomu/core";
import type { Config } from "@tomu/core";

// ---------------------------------------------------------------------------
// Config directory
// ---------------------------------------------------------------------------

const CONFIG_DIR = path.join(os.homedir(), ".config", "tomu");

export function getConfigDir(): string {
  return CONFIG_DIR;
}

function ensureDirectories(): void {
  const dirs = [
    CONFIG_DIR,
    path.join(CONFIG_DIR, "memory"),
    path.join(CONFIG_DIR, "people"),
    path.join(CONFIG_DIR, "threads"),
    path.join(CONFIG_DIR, "skills"),
    path.join(CONFIG_DIR, "plugins"),
    path.join(CONFIG_DIR, "workspaces"),
    path.join(CONFIG_DIR, "workspaces", "default", ".tomu-snapshots"),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Config file
// ---------------------------------------------------------------------------

const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG: Config = {
  theme: "system",
  language: "en",
  agent_max_iterations: 25,
  agents_enabled: true,
  agents_allow_delegation: true,
};

export function getConfig(): Config {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as Config;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Config): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Default files
// ---------------------------------------------------------------------------

const DEFAULT_SOUL_MD = `# tomu's Soul

## Personality
- Friendly and casual
- Direct and honest
- Has opinions and isn't afraid to share them
`;

const DEFAULT_USER_MD = `# User Profile

name: User
`;

function ensureDefaultFiles(): void {
  const soulPath = path.join(CONFIG_DIR, "SOUL.md");
  if (!fs.existsSync(soulPath)) {
    fs.writeFileSync(soulPath, DEFAULT_SOUL_MD, "utf-8");
  }
  const userPath = path.join(CONFIG_DIR, "USER.md");
  if (!fs.existsSync(userPath)) {
    fs.writeFileSync(userPath, DEFAULT_USER_MD, "utf-8");
  }
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

ensureDirectories();
ensureDefaultFiles();

if (!fs.existsSync(CONFIG_PATH)) {
  saveConfig(DEFAULT_CONFIG);
}

const DB_PATH = path.join(CONFIG_DIR, "db.sqlite");
const sqlite: DatabaseType = new Database(DB_PATH);

sqlite.pragma("journal_mode = WAL");

// Create tables matching the Drizzle schema
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('message', 'note', 'temporary')),
    metadata TEXT,
    thread_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS usage_logs (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    message_id TEXT,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cached_input_tokens INTEGER,
    reasoning_tokens INTEGER,
    total_tokens INTEGER NOT NULL,
    timestamp TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS plugins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT,
    author TEXT,
    main TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    settings TEXT,
    install_url TEXT
  );

  CREATE TABLE IF NOT EXISTS plugin_permissions (
    id TEXT PRIMARY KEY,
    plugin_id TEXT NOT NULL,
    permission TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS plugin_settings (
    id TEXT PRIMARY KEY,
    plugin_id TEXT NOT NULL,
    settings TEXT
  );

  CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    config TEXT,
    enabled INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
    id TEXT PRIMARY KEY,
    server_id TEXT NOT NULL,
    token TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Agent mission orchestration tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS agent_missions (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    root_message_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'failed', 'paused')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES agent_missions(id) ON DELETE CASCADE,
    parent_run_id TEXT,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'running', 'completed', 'failed')),
    input_summary TEXT NOT NULL,
    output_summary TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agent_handoffs (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL REFERENCES agent_missions(id) ON DELETE CASCADE,
    from_run_id TEXT,
    to_agent_id TEXT NOT NULL,
    to_agent_name TEXT NOT NULL,
    to_run_id TEXT,
    status TEXT NOT NULL DEFAULT 'created' CHECK(status IN ('created', 'accepted', 'completed', 'failed')),
    packet TEXT NOT NULL,
    result_summary TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_agent_missions_thread ON agent_missions(thread_id);
  CREATE INDEX IF NOT EXISTS idx_agent_runs_mission ON agent_runs(mission_id);
  CREATE INDEX IF NOT EXISTS idx_agent_handoffs_mission ON agent_handoffs(mission_id);
`);

// Agent profiles table (for Settings → Agents UI)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS agent_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    execution_mode TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    built_in INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#6B7280',
    summary TEXT NOT NULL DEFAULT '',
    focus TEXT NOT NULL DEFAULT '[]',
    delegates_to TEXT NOT NULL DEFAULT '[]',
    prompt TEXT NOT NULL DEFAULT '',
    model TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Migration: add model column to agent_profiles if missing
try {
  const cols = sqlite.pragma("table_info(agent_profiles)") as Array<{ name: string }>;
  if (cols.length > 0 && !cols.some((c) => c.name === "model")) {
    sqlite.exec("ALTER TABLE agent_profiles ADD COLUMN model TEXT");
  }
} catch {
  // Table not yet created — nothing to migrate
}

// Memory vectors table (embeddings stored as JSON text)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS memory_vectors (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('message', 'note', 'temporary')),
    embedding TEXT NOT NULL,
    metadata TEXT,
    thread_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Migration: add messages_json to agent_runs (for resume-on-restart)
try {
  const cols = sqlite.pragma("table_info(agent_runs)") as Array<{ name: string }>;
  if (cols.length > 0 && !cols.some((c) => c.name === "messages_json")) {
    sqlite.exec("ALTER TABLE agent_runs ADD COLUMN messages_json TEXT");
  }
} catch {
  // Table doesn't exist yet — nothing to migrate
}

// Migrate messages_fts if it is missing the message_id column (older schema)
try {
  const cols = sqlite.pragma("table_info(messages_fts)") as Array<{ name: string }>;
  const hasMessageId = cols.some((c) => c.name === "message_id");
  if (cols.length > 0 && !hasMessageId) {
    sqlite.exec("DROP TABLE messages_fts");
  }
} catch {
  // Table doesn't exist yet — nothing to migrate
}

sqlite.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    thread_id UNINDEXED,
    message_id UNINDEXED,
    role UNINDEXED,
    content,
    tokenize='porter unicode61'
  );
`);

// ---------------------------------------------------------------------------
// First-boot: copy bundled skills to config dir
// ---------------------------------------------------------------------------

function copyBundledSkills(): void {
  const skillsDir = path.join(CONFIG_DIR, "skills");
  // Only copy if the skills directory is empty
  try {
    const entries = fs.readdirSync(skillsDir);
    if (entries.length > 0) return;
  } catch {
    return;
  }

  // Find bundled skills relative to process.cwd()
  const bundledDir = path.resolve(process.cwd(), "assets", "skills");
  if (!fs.existsSync(bundledDir)) return;

  const skillFolders = fs.readdirSync(bundledDir, { withFileTypes: true });
  for (const folder of skillFolders) {
    if (!folder.isDirectory()) continue;
    const src = path.join(bundledDir, folder.name, "SKILL.md");
    if (!fs.existsSync(src)) continue;

    const destDir = path.join(skillsDir, folder.name);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, path.join(destDir, "SKILL.md"));
  }
}

copyBundledSkills();

export const db = drizzle(sqlite, { schema });
export { sqlite };
