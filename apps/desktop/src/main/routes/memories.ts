import { Router, type Router as RouterType } from "express";
import {
  storeMemory,
  searchMemories,
  deleteMemory,
  listMemories,
  getMemoryStats,
} from "../memory.js";

const router: RouterType = Router();

// List memories
router.get("/memories", (req, res) => {
  const type = req.query.type as string | undefined;
  const limit = Number(req.query.limit) || 50;
  const offset = Number(req.query.offset) || 0;

  const memories = listMemories(limit, offset, type);
  res.json({ memories });
});

// Memory stats
router.get("/memories/stats", (_req, res) => {
  const stats = getMemoryStats();
  res.json(stats);
});

// Create memory
router.post("/memories", async (req, res) => {
  const { content, type, thread_id, metadata } = req.body as {
    content?: string;
    type?: "message" | "note" | "temporary";
    thread_id?: string;
    metadata?: Record<string, unknown>;
  };

  if (!content) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  try {
    const id = await storeMemory(content, type || "note", thread_id, metadata);
    res.status(201).json({ id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Search memories
router.post("/memories/search", async (req, res) => {
  const { query, limit } = req.body as { query?: string; limit?: number };

  if (!query) {
    res.status(400).json({ error: "query is required" });
    return;
  }

  try {
    const results = await searchMemories(query, limit || 5);
    res.json({ results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// Delete memory
router.delete("/memories/:id", (req, res) => {
  const deleted = deleteMemory(req.params.id);
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Memory not found" });
  }
});

export default router;
