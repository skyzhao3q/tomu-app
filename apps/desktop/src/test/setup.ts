import { beforeEach } from "vitest";
import Database, { type Database as DatabaseType } from "better-sqlite3";

// ---------------------------------------------------------------------------
// In-memory SQLite database for tests
// ---------------------------------------------------------------------------

let sqlite: DatabaseType;

export function getTestDb(): DatabaseType {
  return sqlite;
}

export function resetTestDb(): void {
  sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");

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


  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS cron_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      schedule TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cron_history (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      run_at TEXT NOT NULL,
      status TEXT NOT NULL,
      output TEXT
    );
  `);

  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      thread_id UNINDEXED,
      message_id UNINDEXED,
      role UNINDEXED,
      content,
      tokenize='porter unicode61'
    );
  `);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetTestDb();
});
