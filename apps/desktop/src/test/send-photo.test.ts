import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";

vi.mock("../main/db.js", () => ({
  getConfigDir: vi.fn(),
  sqlite: {
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(),
    }),
  },
}));

vi.mock("../main/crypto.js", () => ({
  decrypt: vi.fn((s: string) => s),
}));

import threadsRouter from "../main/routes/threads.js";
import { getConfigDir, sqlite } from "../main/db.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const testConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), "tomu-test-send-photo-"));

// Minimal fake JPEG: just the 4-byte SOI + APP0 marker
const FAKE_JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
const FAKE_PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47]);

const tmpJpeg = path.join(testConfigDir, "test-input.jpg");
const tmpPng = path.join(testConfigDir, "test-input.png");

function getHistoryPath(threadId: string): string {
  return path.join(testConfigDir, "workspaces", "default", ".tomu-snapshots", threadId, "history.json");
}

function readHistory(threadId: string): { messages: unknown[] } {
  return JSON.parse(fs.readFileSync(getHistoryPath(threadId), "utf-8")) as { messages: unknown[] };
}

let app: Express;

beforeEach(() => {
  vi.mocked(getConfigDir).mockReturnValue(testConfigDir);
  // Reset the sqlite mock so each test has fresh stubs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked((sqlite as any).prepare).mockReturnValue({
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
  });

  fs.writeFileSync(tmpJpeg, FAKE_JPEG);
  fs.writeFileSync(tmpPng, FAKE_PNG);

  app = express();
  app.use(express.json());
  app.use("/api", threadsRouter);
});

afterEach(() => {
  // Clean up snapshot dirs created during tests
  const snapshotsDir = path.join(testConfigDir, "workspaces", "default", ".tomu-snapshots");
  if (fs.existsSync(snapshotsDir)) {
    fs.rmSync(snapshotsDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// POST /api/threads/:id/send-photo
// ---------------------------------------------------------------------------

describe("POST /api/threads/:id/send-photo", () => {
  test("returns 400 when filePath not provided", async () => {
    const res = await request(app)
      .post("/api/threads/thread-1/send-photo")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("returns 400 when file does not exist", async () => {
    const res = await request(app)
      .post("/api/threads/thread-1/send-photo")
      .send({ filePath: "/tmp/nonexistent-tomu-test-12345.jpg" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("creates image message in history.json with JPEG data URI", async () => {
    const threadId = "thread-send-jpeg";
    const res = await request(app)
      .post(`/api/threads/${threadId}/send-photo`)
      .send({ filePath: tmpJpeg });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.messageId).toBe("string");

    const history = readHistory(threadId);
    expect(history.messages).toHaveLength(1);

    const msg = history.messages[0] as {
      id: string;
      role: string;
      content: Array<{ type: string; image_url: string }>;
    };
    expect(msg.role).toBe("assistant");
    expect(Array.isArray(msg.content)).toBe(true);
    expect(msg.content[0].type).toBe("image");
    expect(msg.content[0].image_url).toMatch(/^data:image\/jpeg;base64,/);
    expect(msg.id).toBe(res.body.messageId);
  });

  test("detects PNG mime type correctly", async () => {
    const threadId = "thread-send-png";
    const res = await request(app)
      .post(`/api/threads/${threadId}/send-photo`)
      .send({ filePath: tmpPng });

    expect(res.status).toBe(200);

    const history = readHistory(threadId);
    const msg = history.messages[0] as {
      content: Array<{ type: string; image_url: string }>;
    };
    expect(msg.content[0].image_url).toMatch(/^data:image\/png;base64,/);
  });

  test("updates thread updated_at in sqlite", async () => {
    const threadId = "thread-sqlite-update";
    await request(app)
      .post(`/api/threads/${threadId}/send-photo`)
      .send({ filePath: tmpJpeg });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((sqlite as any).prepare).toHaveBeenCalledWith(
      "UPDATE threads SET updated_at = ? WHERE id = ?",
    );
  });
});

// ---------------------------------------------------------------------------
// GET /api/threads/:id/messages (with image messages)
// ---------------------------------------------------------------------------

describe("GET /api/threads/:id/messages", () => {
  test("returns messages array including image messages", async () => {
    const threadId = "thread-get-messages";
    const now = new Date().toISOString();

    // Configure sqlite mock to return a thread row for this test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked((sqlite as any).prepare).mockReturnValue({
      run: vi.fn(),
      get: vi.fn().mockReturnValue({ id: threadId, title: "Test", created_at: now, updated_at: now }),
      all: vi.fn(),
    });

    // First send a photo so history.json exists with an image message
    await request(app)
      .post(`/api/threads/${threadId}/send-photo`)
      .send({ filePath: tmpJpeg });

    // Then GET messages
    const res = await request(app).get(`/api/threads/${threadId}/messages`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);

    const msg = res.body[0] as { role: string; content: Array<{ type: string }> };
    expect(msg.role).toBe("assistant");
    expect(msg.content[0].type).toBe("image");
  });
});
