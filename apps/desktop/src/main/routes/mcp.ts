import { Router, type Router as RouterType } from "express";
import {
  listMcpServers,
  getMcpServer,
  addMcpServer,
  removeMcpServer,
  updateMcpServer,
} from "../mcp.js";

const router: RouterType = Router();

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// List MCP servers
router.get("/mcp/servers", (_req, res) => {
  const servers = listMcpServers();
  res.json(servers);
});

// Add MCP server
router.post("/mcp/servers", (req, res) => {
  const { name, url, config } = req.body as {
    name?: string;
    url?: string;
    config?: Record<string, unknown>;
  };

  if (!name || !url) {
    res.status(400).json({ error: "name and url are required" });
    return;
  }

  try {
    const server = addMcpServer(name, url, config);
    res.status(201).json(server);
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
  res.json(server);
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
  res.json(server);
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
