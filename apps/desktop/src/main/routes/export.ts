import { Router, type Router as RouterType } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { Message } from "@tomu/core";
import { maskApiKey } from "../crypto.js";
import { getConfig, getConfigDir, sqlite } from "../db.js";

const router: RouterType = Router();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThreadRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MemoryRow {
  id: string;
  content: string;
  type: string;
  metadata: string | null;
  thread_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ProviderStore {
  providers: Array<{
    id: string;
    name: string;
    type: string;
    api_key?: string;
    base_url?: string;
    [key: string]: unknown;
  }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSnapshotsDir(): string {
  return path.join(
    getConfigDir(),
    "workspaces",
    "default",
    ".tomu-snapshots",
  );
}

function readMessages(threadId: string): Message[] {
  const historyPath = path.join(getSnapshotsDir(), threadId, "history.json");
  try {
    const raw = fs.readFileSync(historyPath, "utf-8");
    const data = JSON.parse(raw) as { messages: Message[] };
    return data.messages;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Export routes
// ---------------------------------------------------------------------------

// Export all threads
router.get("/export/threads", (_req, res) => {
  const threads = sqlite
    .prepare("SELECT * FROM threads ORDER BY updated_at DESC")
    .all() as ThreadRow[];

  const result = threads.map((thread) => ({
    ...thread,
    messages: readMessages(thread.id),
  }));

  res.json({ threads: result });
});

// Export all memories
router.get("/export/memories", (_req, res) => {
  const memories = sqlite
    .prepare("SELECT id, content, type, metadata, thread_id, created_at, updated_at FROM memory_vectors ORDER BY created_at DESC")
    .all() as MemoryRow[];

  const result = memories.map((m) => ({
    ...m,
    metadata: m.metadata ? JSON.parse(m.metadata) : null,
  }));

  res.json({ memories: result });
});

// Export settings with masked API keys
router.get("/export/settings", (_req, res) => {
  const config = getConfig();

  // Read providers and mask API keys
  let providers: ProviderStore["providers"] = [];
  try {
    const raw = fs.readFileSync(
      path.join(getConfigDir(), "providers.json"),
      "utf-8",
    );
    const store = JSON.parse(raw) as ProviderStore;
    providers = store.providers.map((p) => ({
      ...p,
      api_key: p.api_key ? maskApiKey(p.api_key) : undefined,
    }));
  } catch {
    // No providers file
  }

  res.json({ config, providers });
});

// ---------------------------------------------------------------------------
// Import routes
// ---------------------------------------------------------------------------

// Import threads
router.post("/import/threads", (req, res) => {
  const { threads } = req.body as {
    threads?: Array<{
      id?: string;
      title: string;
      created_at: string;
      updated_at: string;
      messages: Message[];
    }>;
  };

  if (!threads || !Array.isArray(threads)) {
    res.status(400).json({ error: "threads array is required" });
    return;
  }

  let imported = 0;

  const insertThread = sqlite.prepare(
    "INSERT OR IGNORE INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
  );

  for (const thread of threads) {
    // Always generate a fresh UUID — never trust user-supplied IDs for filesystem paths
    const id = crypto.randomUUID();

    insertThread.run(id, thread.title, thread.created_at, thread.updated_at);

    if (thread.messages && thread.messages.length > 0) {
      const dir = path.join(getSnapshotsDir(), id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, "history.json"),
        JSON.stringify({ messages: thread.messages }, null, 2),
        "utf-8",
      );
    }

    imported++;
  }

  res.json({ imported });
});

// Import memories
router.post("/import/memories", (req, res) => {
  const { memories } = req.body as {
    memories?: Array<{
      id?: string;
      content: string;
      type: string;
      metadata?: Record<string, unknown> | null;
      thread_id?: string | null;
      created_at?: string;
      updated_at?: string;
    }>;
  };

  if (!memories || !Array.isArray(memories)) {
    res.status(400).json({ error: "memories array is required" });
    return;
  }

  let imported = 0;
  const now = new Date().toISOString();

  const insertMemory = sqlite.prepare(
    "INSERT OR IGNORE INTO memories (id, content, type, metadata, thread_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  for (const memory of memories) {
    const id = memory.id || crypto.randomUUID();
    const metadata = memory.metadata ? JSON.stringify(memory.metadata) : null;

    insertMemory.run(
      id,
      memory.content,
      memory.type,
      metadata,
      memory.thread_id || null,
      memory.created_at || now,
      memory.updated_at || now,
    );

    imported++;
  }

  res.json({ imported });
});

export default router;
