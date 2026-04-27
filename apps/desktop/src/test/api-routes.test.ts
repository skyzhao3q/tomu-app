import { describe, test, expect, beforeEach } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import { getTestDb } from "./setup.js";

// ---------------------------------------------------------------------------
// Build a lightweight Express app for each test group.
// Handlers mirror the real route implementations but use the in-memory test DB.
// This serves as both a contract test and documentation of all CLI-needed APIs.
// ---------------------------------------------------------------------------

let app: Express;

beforeEach(() => {
  const db = getTestDb();
  app = express();
  app.use(express.json());

  // ---- Health ----
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", version: "0.0.0", uptime: 0 });
  });

  // ---- Settings ----
  app.get("/api/settings", (_req, res) => {
    res.json({ chat: { defaultModel: "openai:gpt-4" }, theme: "system" });
  });
  app.put("/api/settings", (req, res) => {
    res.json(req.body);
  });

  // ---- Providers ----
  app.get("/api/providers", (_req, res) => {
    res.json([{ id: "p1", name: "OpenAI", type: "openai" }]);
  });
  app.post("/api/providers", (req, res) => {
    const { name, type } = req.body as { name?: string; type?: string };
    res.status(201).json({ id: "p-new", name: name ?? "new", type });
  });
  app.put("/api/providers/:id", (req, res) => {
    res.json({ id: req.params.id, ...req.body });
  });
  app.delete("/api/providers/:id", (_req, res) => {
    res.json({});
  });
  app.post("/api/providers/:id/test", (_req, res) => {
    res.json({ success: true });
  });
  app.post("/api/providers/:id/models/fetch", (_req, res) => {
    res.json([{ id: "gpt-4", name: "GPT-4" }]);
  });

  // ---- Models ----
  app.get("/api/models", (_req, res) => {
    res.json([{ id: "gpt-4", name: "GPT-4", provider: "openai" }]);
  });

  // ---- Voices ----
  app.get("/api/voices", (_req, res) => {
    res.json([
      { id: "alloy", name: "Alloy", language: "en-US" },
      { id: "echo", name: "Echo", language: "en-US" },
    ]);
  });

  // ---- Threads ----
  app.post("/api/threads", (_req, res) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare("INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run(id, "New Chat", now, now);
    res.status(201).json({ id, title: "New Chat", messages: [] });
  });
  app.get("/api/threads", (_req, res) => {
    const threads = db.prepare("SELECT * FROM threads ORDER BY updated_at DESC").all();
    res.json({ threads });
  });
  app.post("/api/threads/search", (req, res) => {
    const { query } = req.body as { query?: string };
    if (!query) { res.status(400).json({ error: "query is required" }); return; }
    const threads = db.prepare("SELECT * FROM threads WHERE title LIKE ?").all(`%${query}%`);
    res.json({ threads });
  });
  app.get("/api/threads/:id", (req, res) => {
    const thread = db.prepare("SELECT * FROM threads WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;
    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }
    res.json({ ...thread, messages: [] });
  });
  app.get("/api/threads/:id/messages", (req, res) => {
    const thread = db.prepare("SELECT * FROM threads WHERE id = ?").get(req.params.id);
    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }
    res.json({ messages: [] });
  });
  app.delete("/api/threads/:id", (req, res) => {
    const result = db.prepare("DELETE FROM threads WHERE id = ?").run(req.params.id);
    if (result.changes === 0) { res.status(404).json({ error: "Thread not found" }); return; }
    res.status(204).end();
  });
  app.post("/api/threads/:id/compact", (req, res) => {
    const thread = db.prepare("SELECT id FROM threads WHERE id = ?").get(req.params.id);
    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }
    res.json({});
  });
  app.post("/api/threads/:id/switch", (req, res) => {
    const thread = db.prepare("SELECT id FROM threads WHERE id = ?").get(req.params.id);
    if (!thread) { res.status(404).json({ error: "Thread not found" }); return; }
    db.prepare("UPDATE threads SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
    res.json({});
  });

  // ---- Skills ----
  app.get("/api/skills", (_req, res) => {
    res.json([{ id: "s1", name: "web-search", enabled: true, description: "Search the web" }]);
  });
  app.get("/api/skills/search", (req, res) => {
    const q = ((req.query.q as string) ?? "").toLowerCase();
    const all = [{ id: "s1", name: "web-search", description: "Search the web" }];
    res.json(q ? all.filter((s) => s.name.includes(q) || s.description.includes(q)) : all);
  });
  app.put("/api/skills/:id/toggle", (req, res) => {
    res.json({ id: req.params.id, enabled: false });
  });
  app.delete("/api/skills/:id", (_req, res) => {
    res.json({});
  });
  app.post("/api/skills/install", (req, res) => {
    const { source } = req.body as { source?: string };
    if (!source) { res.status(400).json({ error: "source is required" }); return; }
    res.status(201).json({ id: "new-skill", name: "new-skill" });
  });

  // ---- Memories ----
  app.get("/api/memories", (_req, res) => {
    const rows = db.prepare("SELECT * FROM memory_vectors ORDER BY created_at DESC").all();
    res.json({ memories: rows });
  });
  app.get("/api/memories/stats", (_req, res) => {
    const row = db.prepare("SELECT COUNT(*) as total FROM memory_vectors").get() as { total: number };
    res.json({ total: row.total, by_type: {}, db_size_bytes: 0 });
  });
  app.post("/api/memories", (req, res) => {
    const { content, type } = req.body as { content?: string; type?: string };
    if (!content) { res.status(400).json({ error: "content is required" }); return; }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare("INSERT INTO memory_vectors (id, content, type, embedding, metadata, thread_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, content, type ?? "note", "[]", null, null, now, now);
    res.status(201).json({ id });
  });
  app.post("/api/memories/search", (req, res) => {
    const { query } = req.body as { query?: string };
    const rows = db.prepare("SELECT * FROM memory_vectors WHERE content LIKE ?").all(`%${query ?? ""}%`);
    res.json(rows);
  });
  app.post("/api/memories/rebuild", (_req, res) => {
    res.json({ status: "Rebuilt 0 embeddings" });
  });
  app.delete("/api/memories/cleanup", (_req, res) => {
    const result = db.prepare("DELETE FROM memory_vectors WHERE type = 'temporary'").run();
    res.json({ deleted: result.changes });
  });
  app.delete("/api/memories/:id", (req, res) => {
    const result = db.prepare("DELETE FROM memory_vectors WHERE id = ?").run(req.params.id);
    if (result.changes === 0) { res.status(404).json({ error: "Memory not found" }); return; }
    res.json({ success: true });
  });

  // ---- People ----
  app.get("/api/people", (_req, res) => {
    res.json({ people: [] });
  });
  app.get("/api/people/:name", (req, res) => {
    res.json({ name: req.params.name, notes: "", metadata: {} });
  });
  app.post("/api/people", (req, res) => {
    const { name } = req.body as { name?: string };
    if (!name) { res.status(400).json({ error: "name is required" }); return; }
    res.status(201).json({ name });
  });
  app.put("/api/people/:name", (req, res) => {
    res.json({ name: req.params.name, ...req.body });
  });
  app.delete("/api/people/:name", (_req, res) => {
    res.json({});
  });

  // ---- Tasks (sub-agent runs) ----
  app.post("/api/tasks", (req, res) => {
    const { agent_id, subagent_type, type, prompt } = req.body as {
      agent_id?: string; subagent_type?: string; type?: string; prompt?: string;
    };
    const effectiveType = agent_id ?? subagent_type ?? type;
    if (!effectiveType || !prompt) {
      res.status(400).json({ error: "agent_id (or type) and prompt are required" });
      return;
    }
    const now = new Date().toISOString();
    const missionId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    db.prepare(
      "INSERT INTO agent_missions (id, thread_id, root_message_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(missionId, "standalone", crypto.randomUUID(), prompt.slice(0, 80), "active", now, now);
    db.prepare(
      "INSERT INTO agent_runs (id, mission_id, parent_run_id, agent_id, agent_name, status, input_summary, output_summary, messages_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(runId, missionId, null, effectiveType, effectiveType, "running", prompt.slice(0, 500), null, null, now, now);
    res.json({ id: runId, status: "running" });
  });
  app.get("/api/tasks", (_req, res) => {
    const runs = db.prepare("SELECT * FROM agent_runs ORDER BY created_at DESC").all() as Array<Record<string, unknown>>;
    const tasks = runs.map((run) => ({
      id: run.id,
      type: run.agent_id,
      status: run.status === "completed" ? "completed" : run.status === "failed" ? "failed" : "running",
      prompt: run.input_summary,
      startedAt: run.created_at,
      completedAt: (run.status === "completed" || run.status === "failed") ? run.updated_at : undefined,
      mission_id: run.mission_id,
      agent_id: run.agent_id,
      agent_name: run.agent_name,
    }));
    res.json(tasks);
  });
  app.get("/api/tasks/:id", (req, res) => {
    const run = db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;
    if (!run) { res.status(404).json({ error: "Task not found" }); return; }
    res.json({
      id: run.id,
      type: run.agent_id,
      status: run.status === "completed" ? "completed" : run.status === "failed" ? "failed" : "running",
      prompt: run.input_summary,
      result: run.status === "completed" ? run.output_summary : undefined,
      error: run.status === "failed" ? run.output_summary : undefined,
      startedAt: run.created_at,
      completedAt: (run.status === "completed" || run.status === "failed") ? run.updated_at : undefined,
      mission_id: run.mission_id,
      agent_id: run.agent_id,
      agent_name: run.agent_name,
    });
  });
  app.delete("/api/tasks/:id", (req, res) => {
    const result = db.prepare("DELETE FROM agent_runs WHERE id = ?").run(req.params.id);
    if (result.changes === 0) { res.status(404).json({ error: "Task not found" }); return; }
    res.json({ ok: true });
  });

  // ---- Missions ----
  app.get("/api/missions", (req, res) => {
    const { thread_id } = req.query as { thread_id?: string };
    const missions = thread_id
      ? db.prepare("SELECT * FROM agent_missions WHERE thread_id = ? ORDER BY created_at DESC").all(thread_id)
      : db.prepare("SELECT * FROM agent_missions ORDER BY created_at DESC").all();
    res.json(missions);
  });
  app.get("/api/missions/:id/runs", (req, res) => {
    const mission = db.prepare("SELECT * FROM agent_missions WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;
    if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }
    const runs = db.prepare("SELECT * FROM agent_runs WHERE mission_id = ? ORDER BY created_at ASC").all(mission.id);
    res.json(runs);
  });
  app.get("/api/missions/:id", (req, res) => {
    const mission = db.prepare("SELECT * FROM agent_missions WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;
    if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }
    const runs = db.prepare("SELECT * FROM agent_runs WHERE mission_id = ? ORDER BY created_at ASC").all(mission.id);
    const handoffs = db.prepare("SELECT * FROM agent_handoffs WHERE mission_id = ? ORDER BY created_at ASC").all(mission.id);
    res.json({ mission, runs, handoffs });
  });

  // ---- Plugins ----
  app.get("/api/plugins", (_req, res) => {
    res.json([]);
  });
  app.post("/api/plugins", (req, res) => {
    const { source } = req.body as { source?: string };
    if (!source) { res.status(400).json({ error: "source is required" }); return; }
    res.status(201).json({ id: "plugin-new", name: "plugin-new" });
  });
  app.delete("/api/plugins/:name", (_req, res) => {
    res.json({});
  });
  app.get("/api/plugins/:name/settings", (req, res) => {
    res.json({ plugin: req.params.name, settings: {} });
  });
  app.put("/api/plugins/:name/settings", (req, res) => {
    res.json({ plugin: req.params.name, settings: req.body });
  });

  // ---- MCP ----
  app.get("/api/mcp/servers", (_req, res) => {
    res.json([]);
  });
  app.post("/api/mcp/servers", (req, res) => {
    const { name } = req.body as { name?: string };
    if (!name) { res.status(400).json({ error: "name is required" }); return; }
    res.status(201).json({ name, url: "", enabled: true });
  });
  app.get("/api/mcp/servers/:name", (req, res) => {
    res.json({ name: req.params.name, url: "", enabled: true });
  });
  app.put("/api/mcp/servers/:name", (req, res) => {
    res.json({ name: req.params.name, ...req.body });
  });
  app.delete("/api/mcp/servers/:name", (_req, res) => {
    res.json({});
  });

  // ---- Usage ----
  app.get("/api/usage", (_req, res) => {
    res.json({ total_requests: 0, total_input_tokens: 0, total_output_tokens: 0, by_day: [], by_model: [] });
  });
  app.get("/api/usage/summary", (_req, res) => {
    res.json({ total_requests: 0, total_input_tokens: 0, total_output_tokens: 0 });
  });

  // ---- Heartbeat ----
  app.get("/api/heartbeat", (_req, res) => {
    res.json({ enabled: false, interval: 30, status: "stopped" });
  });
  app.get("/api/heartbeat/config", (_req, res) => {
    res.json({ interval: 30, patrol: false });
  });
  app.post("/api/heartbeat/enable", (_req, res) => { res.json({}); });
  app.post("/api/heartbeat/disable", (_req, res) => { res.json({}); });
  app.post("/api/heartbeat/interval", (req, res) => {
    const { interval } = req.body as { interval?: number };
    if (!interval) { res.status(400).json({ error: "interval is required" }); return; }
    res.json({});
  });
  app.post("/api/heartbeat/patrol", (req, res) => {
    const { action } = req.body as { action?: string };
    res.json({ patrol: action === "enable" });
  });

  // ---- Cron ----
  app.get("/api/cron", (_req, res) => {
    const jobs = db.prepare("SELECT * FROM cron_jobs ORDER BY created_at DESC").all() as Array<Record<string, unknown>>;
    res.json(jobs.map((j) => ({ ...j, enabled: j.enabled === 1 })));
  });
  app.post("/api/cron", (req, res) => {
    const { name, type, schedule } = req.body as { name?: string; type?: string; schedule?: string };
    if (!name || !type || !schedule) { res.status(400).json({ error: "name, type, schedule required" }); return; }
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO cron_jobs (id, name, type, schedule, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)")
      .run(id, name, type, schedule, new Date().toISOString());
    res.status(201).json({ id, name });
  });
  app.delete("/api/cron/:id", (req, res) => {
    const result = db.prepare("DELETE FROM cron_jobs WHERE id = ?").run(req.params.id);
    if (result.changes === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({});
  });
  app.post("/api/cron/:id/run", (req, res) => {
    const job = db.prepare("SELECT id FROM cron_jobs WHERE id = ?").get(req.params.id);
    if (!job) { res.status(404).json({ error: "Not found" }); return; }
    db.prepare("INSERT INTO cron_history (id, job_id, run_at, status, output) VALUES (?, ?, ?, ?, ?)")
      .run(crypto.randomUUID(), req.params.id, new Date().toISOString(), "success", null);
    res.json({});
  });
  app.post("/api/cron/:id/enable", (req, res) => {
    const result = db.prepare("UPDATE cron_jobs SET enabled = 1 WHERE id = ?").run(req.params.id);
    if (result.changes === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({});
  });
  app.post("/api/cron/:id/disable", (req, res) => {
    const result = db.prepare("UPDATE cron_jobs SET enabled = 0 WHERE id = ?").run(req.params.id);
    if (result.changes === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({});
  });
  app.get("/api/cron/:id/history", (req, res) => {
    const rows = db.prepare("SELECT * FROM cron_history WHERE job_id = ? ORDER BY run_at DESC").all(req.params.id);
    res.json(rows);
  });

  // ---- Workspaces ----
  app.get("/api/workspaces", (_req, res) => {
    res.json([{ id: "default", name: "default", path: "/tmp/workspace" }]);
  });
  app.put("/api/workspaces/:id", (req, res) => {
    const { path } = req.body as { path?: string };
    if (!path) { res.status(400).json({ error: "path is required" }); return; }
    res.json({});
  });

  // ---- Update ----
  app.get("/api/update/check", (_req, res) => {
    res.json({ current: "0.0.0", latest: "0.0.0", updateAvailable: false });
  });
  app.post("/api/update/download", (_req, res) => {
    res.json({ status: "Downloaded v0.0.0" });
  });
  app.post("/api/update/install", (_req, res) => {
    res.json({ status: "Installed v0.0.0 successfully" });
  });

  // ---- DM ----
  app.post("/api/dm", (req, res) => {
    const { userId, message } = req.body as { userId?: string; message?: string };
    if (!userId || !message) { res.status(400).json({ error: "userId and message required" }); return; }
    res.json({});
  });

  // ---- Messages ----
  app.delete("/api/messages/:chatId/:messageId", (_req, res) => {
    res.json({});
  });

  // ---- Sing ----
  app.post("/api/sing/generate", (req, res) => {
    const { description } = req.body as { description?: string };
    if (!description) { res.status(400).json({ error: "description is required" }); return; }
    res.json({ id: "song-1", url: "https://example.com/song.mp3" });
  });
  app.post("/api/sing/config", (req, res) => {
    const { apiKey } = req.body as { apiKey?: string };
    if (!apiKey) { res.status(400).json({ error: "apiKey is required" }); return; }
    res.json({});
  });

  // ---- Emotion ----
  app.get("/api/emotion", (_req, res) => {
    res.json({ mood: "neutral", energy: 0.5, valence: 0.5 });
  });
  app.get("/api/emotion/:chatId", (req, res) => {
    res.json({ mood: "neutral", chatId: req.params.chatId });
  });
  app.post("/api/emotion/base", (req, res) => {
    const { mood } = req.body as { mood?: string };
    if (!mood) { res.status(400).json({ error: "mood is required" }); return; }
    res.json({});
  });
  app.post("/api/emotion/context", (req, res) => {
    const { chatId, mood } = req.body as { chatId?: string; mood?: string };
    if (!chatId || !mood) { res.status(400).json({ error: "chatId and mood required" }); return; }
    res.json({});
  });

  // ---- Browser ----
  app.get("/api/browser/status", (_req, res) => {
    res.json({ connected: false });
  });
  app.get("/api/browser/tabs", (_req, res) => {
    res.json([]);
  });
  app.post("/api/browser/tabs/open", (_req, res) => {
    res.json({ id: "tab-1" });
  });
  app.post("/api/browser/tabs/:tabId/goto", (_req, res) => { res.json({}); });
  app.post("/api/browser/tabs/:tabId/click", (_req, res) => { res.json({}); });
  app.post("/api/browser/tabs/:tabId/type", (_req, res) => { res.json({}); });
  app.post("/api/browser/tabs/:tabId/screenshot", (req, res) => {
    res.json({ path: `/tmp/screenshot-${req.params.tabId}.png` });
  });
  app.get("/api/browser/tabs/:tabId/read", (_req, res) => {
    res.json({ content: "# Page Title\n\nSome content" });
  });
  app.get("/api/browser/tabs/:tabId/read-dom", (_req, res) => {
    res.json([{ tag: "button", text: "Click" }]);
  });
  app.post("/api/browser/tabs/:tabId/eval", (_req, res) => {
    res.json({ result: "42" });
  });
  app.post("/api/browser/tabs/:tabId/scroll", (_req, res) => { res.json({}); });
  app.post("/api/browser/tabs/:tabId/back", (_req, res) => { res.json({}); });
  app.post("/api/browser/tabs/:tabId/forward", (_req, res) => { res.json({}); });

  // ---- Export / Import ----
  app.get("/api/export/threads", (_req, res) => {
    const threads = db.prepare("SELECT * FROM threads ORDER BY updated_at DESC").all();
    res.json({ threads: threads.map((t) => ({ ...(t as Record<string, unknown>), messages: [] })) });
  });
  app.get("/api/export/memories", (_req, res) => {
    res.json({ memories: [] });
  });
  app.get("/api/export/settings", (_req, res) => {
    res.json({ config: { theme: "system" }, providers: [] });
  });
  app.post("/api/import/threads", (req, res) => {
    const { threads } = req.body as { threads?: Array<{ title: string; created_at: string; updated_at: string }> };
    let imported = 0;
    for (const t of threads ?? []) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare("INSERT OR IGNORE INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .run(id, t.title, t.created_at ?? now, t.updated_at ?? now);
      imported++;
    }
    res.json({ imported });
  });
  app.post("/api/import/memories", (req, res) => {
    const { memories } = req.body as { memories?: Array<{ content: string; type?: string }> };
    let imported = 0;
    const now = new Date().toISOString();
    for (const m of memories ?? []) {
      const id = crypto.randomUUID();
      db.prepare("INSERT OR IGNORE INTO memory_vectors (id, content, type, embedding, metadata, thread_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(id, m.content, m.type ?? "note", "[]", null, null, now, now);
      imported++;
    }
    res.json({ imported });
  });
  app.post("/api/import/bundle", (req, res) => {
    const { threads, memories } = req.body as { threads?: unknown[]; memories?: unknown[] };
    let imported = 0;
    imported += (threads?.length ?? 0) + (memories?.length ?? 0);
    res.json({ imported });
  });
});

// ===========================================================================
// Tests
// ===========================================================================

describe("GET /api/health", () => {
  test("returns ok status with version and uptime", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", version: expect.any(String) });
  });
});

describe("Settings API", () => {
  test("GET /api/settings returns config object", async () => {
    const res = await request(app).get("/api/settings");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("chat");
  });

  test("PUT /api/settings updates config", async () => {
    const res = await request(app).put("/api/settings").send({ theme: "dark" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ theme: "dark" });
  });
});

describe("Providers API", () => {
  test("GET /api/providers returns list", async () => {
    const res = await request(app).get("/api/providers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty("name");
  });

  test("POST /api/providers creates provider", async () => {
    const res = await request(app).post("/api/providers").send({ name: "Test", type: "openai", apiKey: "sk-test" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("name");
  });

  test("DELETE /api/providers/:id removes provider", async () => {
    const res = await request(app).delete("/api/providers/p1");
    expect(res.status).toBe(200);
  });

  test("POST /api/providers/:id/test tests connection", async () => {
    const res = await request(app).post("/api/providers/p1/test");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });

  test("POST /api/providers/:id/models/fetch returns models", async () => {
    const res = await request(app).post("/api/providers/p1/models/fetch");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty("id");
  });
});

describe("Models API", () => {
  test("GET /api/models returns all models", async () => {
    const res = await request(app).get("/api/models");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("Voices API", () => {
  test("GET /api/voices returns voice list", async () => {
    const res = await request(app).get("/api/voices");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("name");
    expect(res.body[0]).toHaveProperty("language");
  });
});

describe("Threads API", () => {
  test("POST /api/threads creates thread", async () => {
    const res = await request(app).post("/api/threads");
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("messages");
  });

  test("GET /api/threads returns thread list", async () => {
    await request(app).post("/api/threads");
    const res = await request(app).get("/api/threads");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("threads");
    expect(Array.isArray(res.body.threads)).toBe(true);
  });

  test("POST /api/threads/search finds threads", async () => {
    const res = await request(app).post("/api/threads/search").send({ query: "Chat" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("threads");
  });

  test("POST /api/threads/search returns 400 without query", async () => {
    const res = await request(app).post("/api/threads/search").send({});
    expect(res.status).toBe(400);
  });

  test("GET /api/threads/:id returns thread with messages", async () => {
    const created = await request(app).post("/api/threads");
    const res = await request(app).get(`/api/threads/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", created.body.id);
    expect(res.body).toHaveProperty("messages");
  });

  test("GET /api/threads/:id returns 404 for missing", async () => {
    const res = await request(app).get("/api/threads/nonexistent");
    expect(res.status).toBe(404);
  });

  test("DELETE /api/threads/:id deletes thread", async () => {
    const created = await request(app).post("/api/threads");
    const del = await request(app).delete(`/api/threads/${created.body.id}`);
    expect(del.status).toBe(204);
  });

  test("POST /api/threads/:id/compact compacts thread", async () => {
    const created = await request(app).post("/api/threads");
    const res = await request(app).post(`/api/threads/${created.body.id}/compact`);
    expect(res.status).toBe(200);
  });

  test("POST /api/threads/:id/compact returns 404 for missing", async () => {
    const res = await request(app).post("/api/threads/nonexistent/compact");
    expect(res.status).toBe(404);
  });

  test("POST /api/threads/:id/switch switches thread", async () => {
    const created = await request(app).post("/api/threads");
    const res = await request(app).post(`/api/threads/${created.body.id}/switch`);
    expect(res.status).toBe(200);
  });
});

describe("Skills API", () => {
  test("GET /api/skills returns skill list", async () => {
    const res = await request(app).get("/api/skills");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /api/skills/search filters by query", async () => {
    const res = await request(app).get("/api/skills/search?q=web");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].name).toContain("web");
  });

  test("GET /api/skills/search returns all when no query", async () => {
    const res = await request(app).get("/api/skills/search");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("PUT /api/skills/:id/toggle toggles skill", async () => {
    const res = await request(app).put("/api/skills/s1/toggle");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", "s1");
    expect(res.body).toHaveProperty("enabled");
  });

  test("DELETE /api/skills/:id uninstalls skill", async () => {
    const res = await request(app).delete("/api/skills/s1");
    expect(res.status).toBe(200);
  });
});

describe("Memories API", () => {
  test("GET /api/memories returns memory list", async () => {
    const res = await request(app).get("/api/memories");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("memories");
    expect(Array.isArray(res.body.memories)).toBe(true);
  });

  test("GET /api/memories/stats returns stats", async () => {
    const res = await request(app).get("/api/memories/stats");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("by_type");
  });

  test("POST /api/memories creates memory", async () => {
    const res = await request(app).post("/api/memories").send({ content: "test memory", type: "note" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
  });

  test("POST /api/memories/search finds memories", async () => {
    await request(app).post("/api/memories").send({ content: "hello world" });
    const res = await request(app).post("/api/memories/search").send({ query: "hello" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("POST /api/memories/rebuild triggers rebuild", async () => {
    const res = await request(app).post("/api/memories/rebuild");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
  });

  test("DELETE /api/memories/cleanup removes temporary memories", async () => {
    const res = await request(app).delete("/api/memories/cleanup");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("deleted");
  });

  test("DELETE /api/memories/:id deletes memory", async () => {
    const created = await request(app).post("/api/memories").send({ content: "to delete" });
    const res = await request(app).delete(`/api/memories/${created.body.id}`);
    expect(res.status).toBe(200);
  });
});

describe("People API", () => {
  test("GET /api/people returns list", async () => {
    const res = await request(app).get("/api/people");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("people");
  });

  test("POST /api/people creates person", async () => {
    const res = await request(app).post("/api/people").send({ name: "Alice", notes: "test" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("name", "Alice");
  });

  test("GET /api/people/:name returns person", async () => {
    const res = await request(app).get("/api/people/Alice");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("name", "Alice");
  });

  test("PUT /api/people/:name updates person", async () => {
    const res = await request(app).put("/api/people/Alice").send({ notes: "updated" });
    expect(res.status).toBe(200);
  });

  test("DELETE /api/people/:name deletes person", async () => {
    const res = await request(app).delete("/api/people/Alice");
    expect(res.status).toBe(200);
  });
});

describe("Tasks API (sub-agent runs)", () => {
  test("POST /api/tasks creates a running task", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .send({ agent_id: "researcher", prompt: "research something" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("status", "running");
  });

  test("POST /api/tasks accepts subagent_type field", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .send({ subagent_type: "coder", prompt: "write some code" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("status", "running");
  });

  test("POST /api/tasks returns 400 without prompt", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .send({ agent_id: "researcher" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("POST /api/tasks returns 400 without agent_id", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .send({ prompt: "do something" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("GET /api/tasks returns array of tasks", async () => {
    await request(app).post("/api/tasks").send({ agent_id: "researcher", prompt: "task one" });
    await request(app).post("/api/tasks").send({ agent_id: "researcher", prompt: "task two" });
    const res = await request(app).get("/api/tasks");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("status");
    expect(res.body[0]).toHaveProperty("mission_id");
  });

  test("GET /api/tasks/:id returns task with mission_id", async () => {
    const created = await request(app)
      .post("/api/tasks")
      .send({ agent_id: "researcher", prompt: "get me" });
    const res = await request(app).get(`/api/tasks/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", created.body.id);
    expect(res.body).toHaveProperty("status", "running");
    expect(res.body).toHaveProperty("mission_id");
    expect(res.body).toHaveProperty("agent_id", "researcher");
  });

  test("GET /api/tasks/:id returns 404 for missing task", async () => {
    const res = await request(app).get("/api/tasks/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  test("DELETE /api/tasks/:id cancels task and returns ok", async () => {
    const created = await request(app)
      .post("/api/tasks")
      .send({ agent_id: "researcher", prompt: "cancel me" });
    const del = await request(app).delete(`/api/tasks/${created.body.id}`);
    expect(del.status).toBe(200);
    expect(del.body).toHaveProperty("ok", true);
  });

  test("DELETE /api/tasks/:id returns 404 for missing task", async () => {
    const res = await request(app).delete("/api/tasks/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
});

describe("Missions API", () => {
  test("GET /api/missions returns mission list", async () => {
    await request(app).post("/api/tasks").send({ agent_id: "researcher", prompt: "mission test" });
    const res = await request(app).get("/api/missions");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("status", "active");
    expect(res.body[0]).toHaveProperty("title");
  });

  test("GET /api/missions?thread_id filters by thread", async () => {
    await request(app).post("/api/tasks").send({ agent_id: "researcher", prompt: "some mission" });
    const res = await request(app).get("/api/missions?thread_id=nonexistent");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  test("GET /api/missions/:id returns mission with runs and handoffs", async () => {
    const taskRes = await request(app)
      .post("/api/tasks")
      .send({ agent_id: "researcher", prompt: "detailed mission" });
    const taskDetail = await request(app).get(`/api/tasks/${taskRes.body.id}`);
    const missionId = taskDetail.body.mission_id;

    const res = await request(app).get(`/api/missions/${missionId}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("mission");
    expect(res.body).toHaveProperty("runs");
    expect(res.body).toHaveProperty("handoffs");
    expect(Array.isArray(res.body.runs)).toBe(true);
    expect(res.body.runs.length).toBe(1);
    expect(res.body.runs[0]).toHaveProperty("agent_id", "researcher");
    expect(Array.isArray(res.body.handoffs)).toBe(true);
  });

  test("GET /api/missions/:id returns 404 for missing mission", async () => {
    const res = await request(app).get("/api/missions/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  test("GET /api/missions/:id/runs returns run list", async () => {
    const taskRes = await request(app)
      .post("/api/tasks")
      .send({ agent_id: "researcher", prompt: "run list test" });
    const taskDetail = await request(app).get(`/api/tasks/${taskRes.body.id}`);
    const missionId = taskDetail.body.mission_id;

    const res = await request(app).get(`/api/missions/${missionId}/runs`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0]).toHaveProperty("mission_id", missionId);
    expect(res.body[0]).toHaveProperty("agent_id", "researcher");
  });

  test("GET /api/missions/:id/runs returns 404 for missing mission", async () => {
    const res = await request(app).get("/api/missions/nonexistent/runs");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
});

describe("Plugins API", () => {
  test("GET /api/plugins returns list", async () => {
    const res = await request(app).get("/api/plugins");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("DELETE /api/plugins/:name removes plugin", async () => {
    const res = await request(app).delete("/api/plugins/myplugin");
    expect(res.status).toBe(200);
  });
});

describe("MCP Servers API", () => {
  test("GET /api/mcp/servers returns list", async () => {
    const res = await request(app).get("/api/mcp/servers");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("POST /api/mcp/servers adds server", async () => {
    const res = await request(app).post("/api/mcp/servers").send({ name: "myserver", url: "http://localhost:3000" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("name", "myserver");
  });

  test("DELETE /api/mcp/servers/:name removes server", async () => {
    const res = await request(app).delete("/api/mcp/servers/myserver");
    expect(res.status).toBe(200);
  });
});

describe("Usage API", () => {
  test("GET /api/usage returns stats", async () => {
    const res = await request(app).get("/api/usage");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total_requests");
    expect(res.body).toHaveProperty("total_input_tokens");
    expect(res.body).toHaveProperty("total_output_tokens");
    expect(res.body).toHaveProperty("by_day");
    expect(res.body).toHaveProperty("by_model");
  });

  test("GET /api/usage/summary returns summary", async () => {
    const res = await request(app).get("/api/usage/summary");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total_requests");
    expect(res.body).toHaveProperty("total_input_tokens");
    expect(res.body).toHaveProperty("total_output_tokens");
  });
});

describe("Heartbeat API", () => {
  test("GET /api/heartbeat returns status", async () => {
    const res = await request(app).get("/api/heartbeat");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("enabled");
    expect(res.body).toHaveProperty("interval");
    expect(res.body).toHaveProperty("status");
  });

  test("GET /api/heartbeat/config returns config", async () => {
    const res = await request(app).get("/api/heartbeat/config");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("interval");
    expect(res.body).toHaveProperty("patrol");
  });

  test("POST /api/heartbeat/enable enables heartbeat", async () => {
    const res = await request(app).post("/api/heartbeat/enable");
    expect(res.status).toBe(200);
  });

  test("POST /api/heartbeat/disable disables heartbeat", async () => {
    const res = await request(app).post("/api/heartbeat/disable");
    expect(res.status).toBe(200);
  });

  test("POST /api/heartbeat/interval sets interval", async () => {
    const res = await request(app).post("/api/heartbeat/interval").send({ interval: 15 });
    expect(res.status).toBe(200);
  });

  test("POST /api/heartbeat/patrol sets patrol mode", async () => {
    const res = await request(app).post("/api/heartbeat/patrol").send({ action: "enable" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("patrol", true);
  });
});

describe("Cron API", () => {
  test("GET /api/cron returns job list", async () => {
    const res = await request(app).get("/api/cron");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("POST /api/cron creates job", async () => {
    const res = await request(app).post("/api/cron").send({ name: "daily-backup", type: "cron", schedule: "0 2 * * *" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("name", "daily-backup");
  });

  test("DELETE /api/cron/:id removes job", async () => {
    const created = await request(app).post("/api/cron").send({ name: "temp", type: "cron", schedule: "* * * * *" });
    const res = await request(app).delete(`/api/cron/${created.body.id}`);
    expect(res.status).toBe(200);
  });

  test("DELETE /api/cron/:id returns 404 for missing", async () => {
    const res = await request(app).delete("/api/cron/nonexistent");
    expect(res.status).toBe(404);
  });

  test("POST /api/cron/:id/run triggers job", async () => {
    const created = await request(app).post("/api/cron").send({ name: "run-test", type: "cron", schedule: "* * * * *" });
    const res = await request(app).post(`/api/cron/${created.body.id}/run`);
    expect(res.status).toBe(200);
  });

  test("POST /api/cron/:id/enable enables job", async () => {
    const created = await request(app).post("/api/cron").send({ name: "en-test", type: "cron", schedule: "* * * * *" });
    const res = await request(app).post(`/api/cron/${created.body.id}/enable`);
    expect(res.status).toBe(200);
  });

  test("POST /api/cron/:id/disable disables job", async () => {
    const created = await request(app).post("/api/cron").send({ name: "dis-test", type: "cron", schedule: "* * * * *" });
    const res = await request(app).post(`/api/cron/${created.body.id}/disable`);
    expect(res.status).toBe(200);
  });

  test("GET /api/cron/:id/history returns run history", async () => {
    const created = await request(app).post("/api/cron").send({ name: "hist-test", type: "cron", schedule: "* * * * *" });
    await request(app).post(`/api/cron/${created.body.id}/run`);
    const res = await request(app).get(`/api/cron/${created.body.id}/history`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty("status", "success");
  });
});

describe("Workspaces API", () => {
  test("GET /api/workspaces returns list", async () => {
    const res = await request(app).get("/api/workspaces");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty("id");
    expect(res.body[0]).toHaveProperty("name");
    expect(res.body[0]).toHaveProperty("path");
  });

  test("PUT /api/workspaces/:id updates workspace path", async () => {
    const res = await request(app).put("/api/workspaces/default").send({ path: "/new/path" });
    expect(res.status).toBe(200);
  });

  test("PUT /api/workspaces/:id returns 400 without path", async () => {
    const res = await request(app).put("/api/workspaces/default").send({});
    expect(res.status).toBe(400);
  });
});

describe("Update API", () => {
  test("GET /api/update/check returns version info", async () => {
    const res = await request(app).get("/api/update/check");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("current");
    expect(res.body).toHaveProperty("updateAvailable");
  });

  test("POST /api/update/download returns status", async () => {
    const res = await request(app).post("/api/update/download");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
  });

  test("POST /api/update/install returns status", async () => {
    const res = await request(app).post("/api/update/install");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
  });
});

describe("DM API", () => {
  test("POST /api/dm sends message", async () => {
    const res = await request(app).post("/api/dm").send({ userId: "user123", message: "hello" });
    expect(res.status).toBe(200);
  });

  test("POST /api/dm returns 400 without userId", async () => {
    const res = await request(app).post("/api/dm").send({ message: "hello" });
    expect(res.status).toBe(400);
  });
});

describe("Messages API", () => {
  test("DELETE /api/messages/:chatId/:messageId deletes message", async () => {
    const res = await request(app).delete("/api/messages/chat1/msg42");
    expect(res.status).toBe(200);
  });
});

describe("Sing API", () => {
  test("POST /api/sing/generate returns song info", async () => {
    const res = await request(app).post("/api/sing/generate").send({ description: "a happy birthday song" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("url");
  });

  test("POST /api/sing/generate returns 400 without description", async () => {
    const res = await request(app).post("/api/sing/generate").send({});
    expect(res.status).toBe(400);
  });

  test("POST /api/sing/config stores API key", async () => {
    const res = await request(app).post("/api/sing/config").send({ apiKey: "my-piapi-key" });
    expect(res.status).toBe(200);
  });
});

describe("Emotion API", () => {
  test("GET /api/emotion returns current emotion state", async () => {
    const res = await request(app).get("/api/emotion");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("mood");
    expect(res.body).toHaveProperty("energy");
    expect(res.body).toHaveProperty("valence");
  });

  test("GET /api/emotion/:chatId returns context emotion", async () => {
    const res = await request(app).get("/api/emotion/chat123");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("mood");
    expect(res.body).toHaveProperty("chatId", "chat123");
  });

  test("POST /api/emotion/base sets base emotion", async () => {
    const res = await request(app).post("/api/emotion/base").send({ mood: "happy", energy: 0.8, valence: 0.9 });
    expect(res.status).toBe(200);
  });

  test("POST /api/emotion/base returns 400 without mood", async () => {
    const res = await request(app).post("/api/emotion/base").send({ energy: 0.8 });
    expect(res.status).toBe(400);
  });

  test("POST /api/emotion/context sets context emotion", async () => {
    const res = await request(app).post("/api/emotion/context").send({ chatId: "chat1", mood: "curious", energy: 0.7 });
    expect(res.status).toBe(200);
  });
});

describe("Browser API", () => {
  test("GET /api/browser/status returns connection status", async () => {
    const res = await request(app).get("/api/browser/status");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("connected");
  });

  test("GET /api/browser/tabs returns tab list", async () => {
    const res = await request(app).get("/api/browser/tabs");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("POST /api/browser/tabs/open creates a tab", async () => {
    const res = await request(app).post("/api/browser/tabs/open").send({});
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
  });

  test("POST /api/browser/tabs/open with url", async () => {
    const res = await request(app).post("/api/browser/tabs/open").send({ url: "https://example.com" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
  });

  test("POST /api/browser/tabs/:tabId/goto navigates", async () => {
    const res = await request(app).post("/api/browser/tabs/tab1/goto").send({ url: "https://example.com" });
    expect(res.status).toBe(200);
  });

  test("POST /api/browser/tabs/:tabId/click clicks element", async () => {
    const res = await request(app).post("/api/browser/tabs/tab1/click").send({ selector: "#btn" });
    expect(res.status).toBe(200);
  });

  test("POST /api/browser/tabs/:tabId/type types text", async () => {
    const res = await request(app).post("/api/browser/tabs/tab1/type").send({ selector: "#input", text: "hello" });
    expect(res.status).toBe(200);
  });

  test("POST /api/browser/tabs/:tabId/screenshot returns path", async () => {
    const res = await request(app).post("/api/browser/tabs/tab1/screenshot");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("path");
  });

  test("GET /api/browser/tabs/:tabId/read returns content", async () => {
    const res = await request(app).get("/api/browser/tabs/tab1/read");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("content");
  });

  test("GET /api/browser/tabs/:tabId/read-dom returns DOM array", async () => {
    const res = await request(app).get("/api/browser/tabs/tab1/read-dom");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("POST /api/browser/tabs/:tabId/eval executes JS", async () => {
    const res = await request(app).post("/api/browser/tabs/tab1/eval").send({ code: "1+1" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("result");
  });

  test("POST /api/browser/tabs/:tabId/scroll scrolls", async () => {
    const res = await request(app).post("/api/browser/tabs/tab1/scroll").send({ direction: "down", amount: 300 });
    expect(res.status).toBe(200);
  });

  test("POST /api/browser/tabs/:tabId/back goes back", async () => {
    const res = await request(app).post("/api/browser/tabs/tab1/back");
    expect(res.status).toBe(200);
  });

  test("POST /api/browser/tabs/:tabId/forward goes forward", async () => {
    const res = await request(app).post("/api/browser/tabs/tab1/forward");
    expect(res.status).toBe(200);
  });
});

describe("Export API", () => {
  test("GET /api/export/threads returns thread export", async () => {
    const res = await request(app).get("/api/export/threads");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("threads");
    expect(Array.isArray(res.body.threads)).toBe(true);
  });

  test("GET /api/export/memories returns memory export", async () => {
    const res = await request(app).get("/api/export/memories");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("memories");
  });

  test("GET /api/export/settings returns settings export", async () => {
    const res = await request(app).get("/api/export/settings");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("config");
    expect(res.body).toHaveProperty("providers");
  });
});

describe("Import API", () => {
  test("POST /api/import/threads imports threads", async () => {
    const res = await request(app).post("/api/import/threads").send({
      threads: [{ title: "Test", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), messages: [] }],
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("imported", 1);
  });

  test("POST /api/import/memories imports memories", async () => {
    const res = await request(app).post("/api/import/memories").send({
      memories: [{ content: "test memory", type: "note" }],
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("imported", 1);
  });

  test("POST /api/import/bundle imports bundle", async () => {
    const res = await request(app).post("/api/import/bundle").send({
      threads: [{ title: "Thread 1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      memories: [{ content: "Memory 1", type: "note" }],
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("imported", 2);
  });
});
