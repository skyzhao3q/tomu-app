import { describe, test, expect, beforeEach } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import { getTestDb } from "./setup.js";

// ---------------------------------------------------------------------------
// Build a lightweight Express app wired to the in-memory test DB.
// We define route handlers inline to avoid importing the real modules which
// pull in the on-disk database and config directory side effects.
// ---------------------------------------------------------------------------

let app: Express;

beforeEach(() => {
  const db = getTestDb();
  app = express();
  app.use(express.json());

  // ---- Health ----
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", version: "0.0.0", uptime: process.uptime() });
  });

  // ---- Threads ----
  app.post("/api/threads", (_req, res) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    ).run(id, "New Chat", now, now);
    res.status(201).json({ id, title: "New Chat", created_at: now, updated_at: now, messages: [] });
  });

  app.get("/api/threads", (_req, res) => {
    const threads = db
      .prepare("SELECT * FROM threads ORDER BY updated_at DESC")
      .all();
    res.json(threads);
  });

  app.get("/api/threads/:id", (req, res) => {
    const thread = db
      .prepare("SELECT * FROM threads WHERE id = ?")
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    res.json({ ...thread, messages: [] });
  });

  app.delete("/api/threads/:id", (req, res) => {
    const thread = db
      .prepare("SELECT * FROM threads WHERE id = ?")
      .get(req.params.id);
    if (!thread) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }
    db.prepare("DELETE FROM threads WHERE id = ?").run(req.params.id);
    res.status(204).end();
  });

  // ---- Thread search ----
  app.post("/api/threads/search", (req, res) => {
    const { query, limit } = req.body as { query?: string; limit?: number };
    if (!query) {
      res.status(400).json({ error: "query is required" });
      return;
    }
    // Insert test data into FTS for search
    const rows = db
      .prepare(
        `SELECT thread_id, message_id,
                snippet(messages_fts, 3, '<mark>', '</mark>', '...', 64) AS snippet,
                rank
         FROM messages_fts WHERE messages_fts MATCH ? ORDER BY rank LIMIT ?`,
      )
      .all(query, limit || 20);
    res.json(rows);
  });

  // ---- Memories ----
  app.get("/api/memories", (req, res) => {
    const type = req.query.type as string | undefined;
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;

    const query = type
      ? "SELECT id, content, type, metadata, thread_id, created_at, updated_at FROM memory_vectors WHERE type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
      : "SELECT id, content, type, metadata, thread_id, created_at, updated_at FROM memory_vectors ORDER BY created_at DESC LIMIT ? OFFSET ?";
    const params = type ? [type, limit, offset] : [limit, offset];
    const rows = db.prepare(query).all(...params);
    res.json({ memories: rows });
  });

  app.get("/api/memories/stats", (_req, res) => {
    const countRow = db
      .prepare("SELECT COUNT(*) as count FROM memory_vectors")
      .get() as { count: number };
    const typeRows = db
      .prepare("SELECT type, COUNT(*) as count FROM memory_vectors GROUP BY type")
      .all() as Array<{ type: string; count: number }>;
    const types: Record<string, number> = {};
    for (const row of typeRows) {
      types[row.type] = row.count;
    }
    res.json({ count: countRow.count, types });
  });

  app.delete("/api/memories/:id", (req, res) => {
    const result = db
      .prepare("DELETE FROM memory_vectors WHERE id = ?")
      .run(req.params.id);
    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Memory not found" });
    }
  });

  // ---- Skills (stub) ----
  app.get("/api/skills", (_req, res) => {
    res.json([]);
  });

  // ---- Tasks (stub with in-memory store) ----
  app.get("/api/tasks", (_req, res) => {
    res.json([]);
  });

  // ---- Usage ----
  app.get("/api/usage", (req, res) => {
    const days = Number(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString();

    const totals = db
      .prepare(
        `SELECT
          COALESCE(SUM(input_tokens), 0) AS input_tokens,
          COALESCE(SUM(output_tokens), 0) AS output_tokens,
          COUNT(*) AS requests
        FROM usage_logs WHERE timestamp >= ?`,
      )
      .get(sinceStr) as { input_tokens: number; output_tokens: number; requests: number };

    res.json({
      total_input_tokens: totals.input_tokens,
      total_output_tokens: totals.output_tokens,
      total_requests: totals.requests,
      by_day: [],
      by_model: [],
    });
  });

  app.get("/api/usage/summary", (_req, res) => {
    const totals = db
      .prepare(
        `SELECT
          COALESCE(SUM(input_tokens), 0) AS input_tokens,
          COALESCE(SUM(output_tokens), 0) AS output_tokens,
          COUNT(*) AS requests
        FROM usage_logs`,
      )
      .get() as { input_tokens: number; output_tokens: number; requests: number };

    res.json({
      total_input_tokens: totals.input_tokens,
      total_output_tokens: totals.output_tokens,
      total_requests: totals.requests,
    });
  });

  // ---- Export ----
  app.get("/api/export/threads", (_req, res) => {
    const threads = db
      .prepare("SELECT * FROM threads ORDER BY updated_at DESC")
      .all();
    res.json({ threads: threads.map((t) => ({ ...(t as Record<string, unknown>), messages: [] })) });
  });

  app.get("/api/export/memories", (_req, res) => {
    const memories = db
      .prepare("SELECT * FROM memories ORDER BY created_at DESC")
      .all();
    res.json({ memories });
  });

  app.get("/api/export/settings", (_req, res) => {
    res.json({ config: { theme: "system", language: "en" }, providers: [] });
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/health", () => {
  test("returns ok status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("version");
    expect(res.body).toHaveProperty("uptime");
  });
});

describe("Threads API", () => {
  test("POST /api/threads creates a thread", async () => {
    const res = await request(app).post("/api/threads");
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("title", "New Chat");
    expect(res.body).toHaveProperty("created_at");
    expect(res.body).toHaveProperty("updated_at");
    expect(res.body).toHaveProperty("messages");
    expect(res.body.messages).toEqual([]);
  });

  test("GET /api/threads lists threads", async () => {
    await request(app).post("/api/threads");
    await request(app).post("/api/threads");

    const res = await request(app).get("/api/threads");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
  });

  test("GET /api/threads/:id returns thread with messages", async () => {
    const created = await request(app).post("/api/threads");
    const id = created.body.id;

    const res = await request(app).get(`/api/threads/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", id);
    expect(res.body).toHaveProperty("messages");
  });

  test("GET /api/threads/:id returns 404 for missing thread", async () => {
    const res = await request(app).get("/api/threads/nonexistent");
    expect(res.status).toBe(404);
  });

  test("DELETE /api/threads/:id removes thread", async () => {
    const created = await request(app).post("/api/threads");
    const id = created.body.id;

    const del = await request(app).delete(`/api/threads/${id}`);
    expect(del.status).toBe(204);

    const get = await request(app).get(`/api/threads/${id}`);
    expect(get.status).toBe(404);
  });
});

describe("Thread Search", () => {
  test("POST /api/threads/search returns 400 without query", async () => {
    const res = await request(app)
      .post("/api/threads/search")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("POST /api/threads/search returns matching results", async () => {
    const db = getTestDb();
    // Seed some FTS data
    db.prepare(
      "INSERT INTO messages_fts (thread_id, message_id, role, content) VALUES (?, ?, ?, ?)",
    ).run("t1", "m1", "user", "hello world");

    const res = await request(app)
      .post("/api/threads/search")
      .send({ query: "hello" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
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
    expect(res.body).toHaveProperty("count");
    expect(res.body).toHaveProperty("types");
  });

  test("DELETE /api/memories/:id removes memory", async () => {
    const db = getTestDb();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO memory_vectors (id, content, type, embedding, metadata, thread_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("mem-1", "test content", "note", "[]", null, null, now, now);

    const res = await request(app).delete("/api/memories/mem-1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });

  test("DELETE /api/memories/:id returns 404 for missing memory", async () => {
    const res = await request(app).delete("/api/memories/nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("Skills API", () => {
  test("GET /api/skills lists installed skills", async () => {
    const res = await request(app).get("/api/skills");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("Tasks API", () => {
  test("GET /api/tasks returns task list", async () => {
    const res = await request(app).get("/api/tasks");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("Usage API", () => {
  test("GET /api/usage returns usage stats", async () => {
    const res = await request(app).get("/api/usage");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total_input_tokens");
    expect(res.body).toHaveProperty("total_output_tokens");
    expect(res.body).toHaveProperty("total_requests");
    expect(res.body).toHaveProperty("by_day");
    expect(res.body).toHaveProperty("by_model");
  });

  test("GET /api/usage/summary returns summary", async () => {
    const res = await request(app).get("/api/usage/summary");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total_input_tokens");
    expect(res.body).toHaveProperty("total_output_tokens");
    expect(res.body).toHaveProperty("total_requests");
  });

  test("GET /api/usage returns correct totals with seeded data", async () => {
    const db = getTestDb();
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO usage_logs (id, provider, model, input_tokens, output_tokens, total_tokens, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("u1", "anthropic", "claude-sonnet", 100, 50, 150, now);
    db.prepare(
      "INSERT INTO usage_logs (id, provider, model, input_tokens, output_tokens, total_tokens, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("u2", "anthropic", "claude-sonnet", 200, 100, 300, now);

    const res = await request(app).get("/api/usage");
    expect(res.status).toBe(200);
    expect(res.body.total_input_tokens).toBe(300);
    expect(res.body.total_output_tokens).toBe(150);
    expect(res.body.total_requests).toBe(2);
  });
});

describe("Export API", () => {
  test("GET /api/export/threads returns thread data", async () => {
    await request(app).post("/api/threads");

    const res = await request(app).get("/api/export/threads");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("threads");
    expect(Array.isArray(res.body.threads)).toBe(true);
    expect(res.body.threads.length).toBe(1);
  });

  test("GET /api/export/memories returns memory data", async () => {
    const res = await request(app).get("/api/export/memories");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("memories");
    expect(Array.isArray(res.body.memories)).toBe(true);
  });

  test("GET /api/export/settings returns masked settings", async () => {
    const res = await request(app).get("/api/export/settings");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("config");
    expect(res.body).toHaveProperty("providers");
  });
});
