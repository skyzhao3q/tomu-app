import { Router, type Router as RouterType } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { generateText } from "ai";
import type { Provider, Message } from "@tomu/core";
import { decrypt } from "../crypto.js";
import { getConfigDir, sqlite } from "../db.js";
import { createLLMProvider } from "../llm.js";

const router: RouterType = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ThreadRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

function getSnapshotsDir(): string {
  return path.join(
    getConfigDir(),
    "workspaces",
    "default",
    ".tomu-snapshots",
  );
}

function getHistoryPath(threadId: string): string {
  return path.join(getSnapshotsDir(), threadId, "history.json");
}

function readMessages(threadId: string): Message[] {
  try {
    const raw = fs.readFileSync(getHistoryPath(threadId), "utf-8");
    const data = JSON.parse(raw) as { messages: Message[] };
    return data.messages;
  } catch {
    return [];
  }
}

function writeMessages(threadId: string, messages: Message[]): void {
  const dir = path.join(getSnapshotsDir(), threadId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    getHistoryPath(threadId),
    JSON.stringify({ messages }, null, 2),
    "utf-8",
  );
}

function readProviders(): Provider[] {
  try {
    const raw = fs.readFileSync(
      path.join(getConfigDir(), "providers.json"),
      "utf-8",
    );
    const store = JSON.parse(raw) as { providers: Provider[] };
    return store.providers;
  } catch {
    return [];
  }
}

function readTitlePrompt(): string {
  // Try cwd first, then relative to this file
  const fromCwd = path.resolve(
    process.cwd(),
    "assets",
    "prompts",
    "hidden",
    "thread-title.md",
  );
  try {
    return fs.readFileSync(fromCwd, "utf-8");
  } catch {
    const thisDir = path.dirname(new URL(import.meta.url).pathname);
    const fromFile = path.resolve(
      thisDir,
      "..",
      "..",
      "..",
      "..",
      "assets",
      "prompts",
      "hidden",
      "thread-title.md",
    );
    try {
      return fs.readFileSync(fromFile, "utf-8");
    } catch {
      return "Generate a short title (3-8 words) for this conversation. Output only the title.";
    }
  }
}

function exportThreadToMarkdown(thread: ThreadRow, messages: Message[]): void {
  const threadsDir = path.join(getConfigDir(), "threads");
  fs.mkdirSync(threadsDir, { recursive: true });

  const dateStr = thread.created_at.slice(0, 10);
  const safeTitle = thread.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff -]/g, "").slice(0, 60);
  const filename = `${dateStr}_${safeTitle}.md`;

  const lines: string[] = [
    `# ${thread.title}`,
    `Date: ${thread.created_at}`,
    "",
    "---",
    "",
  ];

  for (const msg of messages) {
    const role = msg.role === "user" ? "User" : "tomu";
    const content = typeof msg.content === "string"
      ? msg.content
      : msg.content.map((b) => b.text || "").join("");
    lines.push(`**${role}**: ${content}`, "", "---", "");
  }

  fs.writeFileSync(path.join(threadsDir, filename), lines.join("\n"), "utf-8");
}

// ---------------------------------------------------------------------------
// Auto-title (background)
// ---------------------------------------------------------------------------

export function triggerAutoTitle(
  threadId: string,
  userContent: string,
  assistantContent: string,
): void {
  const providers = readProviders();
  if (providers.length === 0) return;

  // Use first available provider
  const provider = providers[0];
  const apiKey = provider.api_key ? decrypt(provider.api_key) : "";
  const modelId = provider.models[0]?.id || (provider.type === "gemini" ? "gemini-2.0-flash" : undefined);
  if (!modelId) return;

  const titlePrompt = readTitlePrompt();

  const llmProvider = createLLMProvider(provider, apiKey);
  generateText({
    model: llmProvider(modelId),
    system: titlePrompt,
    messages: [
      { role: "user" as const, content: userContent },
      { role: "assistant" as const, content: assistantContent },
    ],
  })
    .then((result) => {
      const title = result.text.trim().replace(/^["']|["']$/g, "");
      if (title) {
        sqlite
          .prepare("UPDATE threads SET title = ?, updated_at = ? WHERE id = ?")
          .run(title, new Date().toISOString(), threadId);
      }
    })
    .catch((err) => {
      console.error("Auto-title generation failed:", err);
    });
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Create new thread
router.post("/threads", (_req, res) => {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  sqlite
    .prepare(
      "INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    )
    .run(id, "New Chat", now, now);

  res.status(201).json({
    id,
    title: "New Chat",
    created_at: now,
    updated_at: now,
    messages: [],
  });
});

// List all threads
router.get("/threads", (_req, res) => {
  const threads = sqlite
    .prepare("SELECT * FROM threads ORDER BY updated_at DESC")
    .all() as ThreadRow[];
  res.json(threads);
});

// Get thread with messages
router.get("/threads/:id", (req, res) => {
  const thread = sqlite
    .prepare("SELECT * FROM threads WHERE id = ?")
    .get(req.params.id) as ThreadRow | undefined;

  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }

  const messages = readMessages(thread.id);
  res.json({ ...thread, messages });
});

// Get messages for a thread
router.get("/threads/:id/messages", (req, res) => {
  const thread = sqlite
    .prepare("SELECT * FROM threads WHERE id = ?")
    .get(req.params.id) as ThreadRow | undefined;

  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }

  const messages = readMessages(thread.id);
  res.json(messages);
});

// Delete thread
router.delete("/threads/:id", (req, res) => {
  const thread = sqlite
    .prepare("SELECT * FROM threads WHERE id = ?")
    .get(req.params.id) as ThreadRow | undefined;

  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }

  // Export before deleting
  const messages = readMessages(thread.id);
  if (messages.length > 0) {
    exportThreadToMarkdown(thread, messages);
  }

  // Remove history file
  const historyDir = path.join(getSnapshotsDir(), thread.id);
  fs.rmSync(historyDir, { recursive: true, force: true });

  // Remove from DB
  sqlite.prepare("DELETE FROM threads WHERE id = ?").run(thread.id);
  res.status(204).end();
});

// Append message to thread
router.post("/threads/:id/messages", (req, res) => {
  const thread = sqlite
    .prepare("SELECT * FROM threads WHERE id = ?")
    .get(req.params.id) as ThreadRow | undefined;

  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }

  const { role, content } = req.body as { role: string; content: string };
  if (!role || !content) {
    res.status(400).json({ error: "role and content are required" });
    return;
  }

  const message: Message = {
    id: crypto.randomUUID(),
    role: role as Message["role"],
    content,
    timestamp: new Date().toISOString(),
  };

  const messages = readMessages(thread.id);
  messages.push(message);
  writeMessages(thread.id, messages);

  // Update thread timestamp
  sqlite
    .prepare("UPDATE threads SET updated_at = ? WHERE id = ?")
    .run(message.timestamp, thread.id);

  res.status(201).json(message);
});

export default router;
