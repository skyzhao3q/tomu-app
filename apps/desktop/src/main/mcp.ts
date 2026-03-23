import * as crypto from "node:crypto";
import { sqlite } from "./db.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpServer {
  id: string;
  name: string;
  url: string;
  config: Record<string, unknown> | null;
  enabled: boolean;
}

interface McpServerRow {
  id: string;
  name: string;
  url: string;
  config: string | null;
  enabled: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToServer(row: McpServerRow): McpServer {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    config: row.config ? (JSON.parse(row.config) as Record<string, unknown>) : null,
    enabled: row.enabled === 1,
  };
}

// ---------------------------------------------------------------------------
// MCP server operations
// ---------------------------------------------------------------------------

export function listMcpServers(): McpServer[] {
  const rows = sqlite
    .prepare("SELECT * FROM mcp_servers ORDER BY name")
    .all() as McpServerRow[];

  return rows.map(rowToServer);
}

export function getMcpServer(name: string): McpServer | null {
  const row = sqlite
    .prepare("SELECT * FROM mcp_servers WHERE name = ?")
    .get(name) as McpServerRow | undefined;

  return row ? rowToServer(row) : null;
}

export function addMcpServer(
  name: string,
  url: string,
  config?: Record<string, unknown>,
): McpServer {
  const existing = sqlite
    .prepare("SELECT id FROM mcp_servers WHERE name = ?")
    .get(name) as { id: string } | undefined;

  if (existing) {
    throw new Error(`MCP server "${name}" already exists`);
  }

  const id = crypto.randomUUID();
  const configJson = config ? JSON.stringify(config) : null;

  sqlite
    .prepare(
      "INSERT INTO mcp_servers (id, name, url, config, enabled) VALUES (?, ?, ?, ?, 1)",
    )
    .run(id, name, url, configJson);

  return { id, name, url, config: config || null, enabled: true };
}

export function removeMcpServer(name: string): boolean {
  const result = sqlite
    .prepare("DELETE FROM mcp_servers WHERE name = ?")
    .run(name);

  // Clean up oauth tokens
  sqlite
    .prepare(
      "DELETE FROM mcp_oauth_tokens WHERE server_id IN (SELECT id FROM mcp_servers WHERE name = ?)",
    )
    .run(name);

  return result.changes > 0;
}

export function updateMcpServer(
  name: string,
  updates: Partial<{ url: string; config: Record<string, unknown>; enabled: boolean }>,
): McpServer | null {
  const server = getMcpServer(name);
  if (!server) return null;

  const newUrl = updates.url ?? server.url;
  const newConfig = updates.config !== undefined ? updates.config : server.config;
  const newEnabled = updates.enabled !== undefined ? updates.enabled : server.enabled;
  const configJson = newConfig ? JSON.stringify(newConfig) : null;

  sqlite
    .prepare("UPDATE mcp_servers SET url = ?, config = ?, enabled = ? WHERE name = ?")
    .run(newUrl, configJson, newEnabled ? 1 : 0, name);

  return { ...server, url: newUrl, config: newConfig, enabled: newEnabled };
}
