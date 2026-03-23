import { Router, type Router as RouterType } from "express";
import {
  listMcpServers,
  getMcpServer,
  addMcpServer,
  removeMcpServer,
  updateMcpServer,
  type McpServer,
} from "../mcp.js";

const router: RouterType = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Frontend expects { name, command, args, env } but backend stores { name, url, config }
function toMcpResponse(server: McpServer) {
  const cfg = server.config as { args?: string[]; env?: Record<string, string> } | null;
  return {
    name: server.name,
    command: server.url,
    args: cfg?.args || [],
    env: cfg?.env || {},
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// List MCP servers
router.get("/mcp/servers", (_req, res) => {
  const servers = listMcpServers().map(toMcpResponse);
  res.json(servers);
});

// Add MCP server
router.post("/mcp/servers", (req, res) => {
  const { name, command, args, env, url, config } = req.body as {
    name?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    config?: Record<string, unknown>;
  };

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  // Frontend sends { command, args, env }; backend stores as url + config
  const serverUrl = url || command || "";
  if (!serverUrl) {
    res.status(400).json({ error: "command or url is required" });
    return;
  }

  const serverConfig = config || (args || env ? { args, env } : undefined);

  try {
    const server = addMcpServer(name, serverUrl, serverConfig);
    res.status(201).json(toMcpResponse(server));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

// Get server details
router.get("/mcp/servers/:name", (req, res) => {
  const server = getMcpServer(req.params.name);
  if (!server) {
    res.status(404).json({ error: "MCP server not found" });
    return;
  }
  res.json(toMcpResponse(server));
});

// Update server
router.put("/mcp/servers/:name", (req, res) => {
  const updates = req.body as Partial<{
    url: string;
    config: Record<string, unknown>;
    enabled: boolean;
  }>;

  const server = updateMcpServer(req.params.name, updates);
  if (!server) {
    res.status(404).json({ error: "MCP server not found" });
    return;
  }
  res.json(toMcpResponse(server));
});

// Remove server
router.delete("/mcp/servers/:name", (req, res) => {
  const removed = removeMcpServer(req.params.name);
  if (!removed) {
    res.status(404).json({ error: "MCP server not found" });
    return;
  }
  res.status(204).end();
});

export default router;
