import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// memories
// ---------------------------------------------------------------------------
export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  type: text("type", { enum: ["message", "note", "temporary"] }).notNull(),
  /** JSON-serialised metadata object */
  metadata: text("metadata"),
  thread_id: text("thread_id"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

// ---------------------------------------------------------------------------
// usage_logs
// ---------------------------------------------------------------------------
export const usageLogs = sqliteTable("usage_logs", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  message_id: text("message_id"),
  input_tokens: integer("input_tokens").notNull(),
  output_tokens: integer("output_tokens").notNull(),
  cached_input_tokens: integer("cached_input_tokens"),
  reasoning_tokens: integer("reasoning_tokens"),
  total_tokens: integer("total_tokens").notNull(),
  timestamp: text("timestamp").notNull(),
});

// ---------------------------------------------------------------------------
// plugins
// ---------------------------------------------------------------------------
export const plugins = sqliteTable("plugins", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  description: text("description"),
  author: text("author"),
  main: text("main").notNull(),
  /** 0 = disabled, 1 = enabled */
  enabled: integer("enabled").notNull().default(1),
  /** JSON-serialised settings object */
  settings: text("settings"),
  install_url: text("install_url"),
});

// ---------------------------------------------------------------------------
// plugin_permissions
// ---------------------------------------------------------------------------
export const pluginPermissions = sqliteTable("plugin_permissions", {
  id: text("id").primaryKey(),
  plugin_id: text("plugin_id").notNull(),
  permission: text("permission").notNull(),
});

// ---------------------------------------------------------------------------
// plugin_settings
// ---------------------------------------------------------------------------
export const pluginSettings = sqliteTable("plugin_settings", {
  id: text("id").primaryKey(),
  plugin_id: text("plugin_id").notNull(),
  /** JSON-serialised settings object */
  settings: text("settings"),
});

// ---------------------------------------------------------------------------
// mcp_servers
// ---------------------------------------------------------------------------
export const mcpServers = sqliteTable("mcp_servers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  /** JSON-serialised config object */
  config: text("config"),
  /** 0 = disabled, 1 = enabled */
  enabled: integer("enabled").notNull().default(1),
});

// ---------------------------------------------------------------------------
// mcp_oauth_tokens
// ---------------------------------------------------------------------------
export const mcpOauthTokens = sqliteTable("mcp_oauth_tokens", {
  id: text("id").primaryKey(),
  server_id: text("server_id").notNull(),
  /** Encrypted token string */
  token: text("token").notNull(),
});

// ---------------------------------------------------------------------------
// agent_missions
// ---------------------------------------------------------------------------
export const agentMissions = sqliteTable("agent_missions", {
  id: text("id").primaryKey(),
  thread_id: text("thread_id").notNull(),
  root_message_id: text("root_message_id").notNull(),
  title: text("title").notNull(),
  status: text("status", { enum: ["active", "completed", "failed", "paused"] })
    .notNull()
    .default("active"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

// ---------------------------------------------------------------------------
// agent_runs
// ---------------------------------------------------------------------------
export const agentRuns = sqliteTable("agent_runs", {
  id: text("id").primaryKey(),
  mission_id: text("mission_id")
    .notNull()
    .references(() => agentMissions.id, { onDelete: "cascade" }),
  parent_run_id: text("parent_run_id"),
  agent_id: text("agent_id").notNull(),
  agent_name: text("agent_name").notNull(),
  status: text("status", { enum: ["queued", "running", "completed", "failed"] })
    .notNull()
    .default("queued"),
  input_summary: text("input_summary").notNull(),
  output_summary: text("output_summary"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

// ---------------------------------------------------------------------------
// agent_handoffs
// ---------------------------------------------------------------------------
export const agentHandoffs = sqliteTable("agent_handoffs", {
  id: text("id").primaryKey(),
  mission_id: text("mission_id")
    .notNull()
    .references(() => agentMissions.id, { onDelete: "cascade" }),
  from_run_id: text("from_run_id"),
  to_agent_id: text("to_agent_id").notNull(),
  to_agent_name: text("to_agent_name").notNull(),
  to_run_id: text("to_run_id"),
  status: text("status", { enum: ["created", "accepted", "completed", "failed"] })
    .notNull()
    .default("created"),
  /** JSON-serialised HandoffPacket */
  packet: text("packet").notNull(),
  result_summary: text("result_summary"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

// ---------------------------------------------------------------------------
// Virtual tables (cannot be defined in Drizzle)
//
// memory_embeddings — sqlite-vec virtual table for vector similarity search.
// messages_fts      — FTS5 virtual table for full-text search over messages.
//
// These must be created via raw SQL migrations:
//
//   CREATE VIRTUAL TABLE memory_embeddings USING vec0(
//     memory_id TEXT PRIMARY KEY,
//     embedding FLOAT[1536]
//   );
//
//   CREATE VIRTUAL TABLE messages_fts USING fts5(
//     content,
//     thread_id UNINDEXED
//   );
// ---------------------------------------------------------------------------
