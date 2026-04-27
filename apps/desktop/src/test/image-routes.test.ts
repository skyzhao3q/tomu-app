import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express, { type Express } from "express";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";

vi.mock("../main/db.js", () => ({
  getConfigDir: vi.fn(),
}));

vi.mock("../main/crypto.js", () => ({
  decrypt: vi.fn((s: string) => s),
}));

import imageRouter from "../main/routes/image.js";
import { getConfigDir } from "../main/db.js";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const testConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), "tomu-test-image-routes-"));

// Minimal 4-byte JPEG header encoded as base64
const FAKE_JPEG_B64 = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]).toString("base64");

const mockGeminiProvider = {
  id: "gemini-1",
  name: "Gemini",
  type: "gemini",
  api_key: "test-api-key",
  enabled: true,
  models: [],
};

function writeProviders(providers: unknown[]): void {
  fs.writeFileSync(
    path.join(testConfigDir, "providers.json"),
    JSON.stringify({ providers }),
  );
}

let app: Express;

beforeEach(() => {
  vi.mocked(getConfigDir).mockReturnValue(testConfigDir);
  try { fs.unlinkSync(path.join(testConfigDir, "providers.json")); } catch { /* no-op */ }
  app = express();
  app.use(express.json());
  app.use("/api", imageRouter);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// GET /api/image/models
// ---------------------------------------------------------------------------

describe("GET /api/image/models", () => {
  test("returns [] when no Gemini provider configured", async () => {
    const res = await request(app).get("/api/image/models");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("returns [] when provider is disabled", async () => {
    writeProviders([{ ...mockGeminiProvider, enabled: false }]);
    const res = await request(app).get("/api/image/models");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("returns models with best flag from Gemini API", async () => {
    writeProviders([mockGeminiProvider]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({
        models: [
          {
            name: "models/gemini-2.0-flash-exp-image-generation",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      }), { status: 200 }),
    ));

    const res = await request(app).get("/api/image/models");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("gemini-2.0-flash-exp-image-generation");
    expect(res.body[0].provider).toBe("gemini");
    expect(res.body[0].best).toBe(true);
  });

  test("returns 502 when Gemini API fails", async () => {
    writeProviders([mockGeminiProvider]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    ));

    const res = await request(app).get("/api/image/models");
    expect(res.status).toBe(502);
  });
});

// ---------------------------------------------------------------------------
// POST /api/image/generate
// ---------------------------------------------------------------------------

describe("POST /api/image/generate", () => {
  test("returns 400 when prompt is missing", async () => {
    const res = await request(app).post("/api/image/generate").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("prompt");
  });

  test("returns 503 when no Gemini provider configured", async () => {
    const res = await request(app)
      .post("/api/image/generate")
      .send({ prompt: "a sunset" });
    expect(res.status).toBe(503);
  });

  test("calls Gemini API and saves image to /tmp, returns path", async () => {
    writeProviders([mockGeminiProvider]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{ inlineData: { mimeType: "image/jpeg", data: FAKE_JPEG_B64 } }],
          },
        }],
      }), { status: 200 }),
    ));

    const res = await request(app)
      .post("/api/image/generate")
      .send({ prompt: "a sunset", model: "gemini-2.0-flash-exp-image-generation" });

    expect(res.status).toBe(200);
    expect(res.body.path).toMatch(/\/tmp\/tomu-gen-.*\.jpg$/);
    expect(fs.existsSync(res.body.path)).toBe(true);
    fs.rmSync(res.body.path, { force: true });
  });

  test("returns 502 when Gemini API returns error", async () => {
    writeProviders([mockGeminiProvider]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      new Response("Service Unavailable", { status: 503 }),
    ));

    const res = await request(app)
      .post("/api/image/generate")
      .send({ prompt: "a sunset", model: "gemini-2.0-flash-exp-image-generation" });

    expect(res.status).toBe(502);
    expect(res.body.error).toContain("Gemini API error");
  });

  test("uses specified model in Gemini API call URL", async () => {
    writeProviders([mockGeminiProvider]);
    let capturedUrl = "";
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{ inlineData: { mimeType: "image/jpeg", data: FAKE_JPEG_B64 } }],
          },
        }],
      }), { status: 200 }));
    }));

    const res = await request(app)
      .post("/api/image/generate")
      .send({ prompt: "a cat", model: "gemini-2.0-flash-exp-image-generation" });

    expect(capturedUrl).toContain("gemini-2.0-flash-exp-image-generation");
    if (res.body.path) fs.rmSync(res.body.path, { force: true });
  });
});

// ---------------------------------------------------------------------------
// POST /api/image/edit
// ---------------------------------------------------------------------------

describe("POST /api/image/edit", () => {
  test("returns 400 when prompt is missing", async () => {
    const res = await request(app).post("/api/image/edit").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("prompt");
  });

  test("saves edited image to /tmp and returns path", async () => {
    writeProviders([mockGeminiProvider]);
    // edit always fetches models first, then calls generateContent
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        models: [{
          name: "models/gemini-2.0-flash-exp-image-generation",
          supportedGenerationMethods: ["generateContent"],
        }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{ inlineData: { mimeType: "image/jpeg", data: FAKE_JPEG_B64 } }],
          },
        }],
      }), { status: 200 })),
    );

    const res = await request(app)
      .post("/api/image/edit")
      .send({ prompt: "add a rainbow" });

    expect(res.status).toBe(200);
    expect(res.body.path).toMatch(/\/tmp\/tomu-edit-.*\.jpg$/);
    expect(fs.existsSync(res.body.path)).toBe(true);
    fs.rmSync(res.body.path, { force: true });
  });

  test("handles input filePath in edit request", async () => {
    writeProviders([mockGeminiProvider]);
    // Create a real temp input image
    const inputFile = path.join(os.tmpdir(), "tomu-test-input.jpg");
    fs.writeFileSync(inputFile, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]));

    let capturedBody = "";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        models: [{
          name: "models/gemini-2.0-flash-exp-image-generation",
          supportedGenerationMethods: ["generateContent"],
        }],
      }), { status: 200 }))
      .mockImplementationOnce((_url: string, opts: { body?: string }) => {
        capturedBody = opts?.body ?? "";
        return Promise.resolve(new Response(JSON.stringify({
          candidates: [{
            content: {
              parts: [{ inlineData: { mimeType: "image/jpeg", data: FAKE_JPEG_B64 } }],
            },
          }],
        }), { status: 200 }));
      }),
    );

    const res = await request(app)
      .post("/api/image/edit")
      .send({ prompt: "add a rainbow", filePath: inputFile });

    expect(res.status).toBe(200);
    // The request body sent to Gemini should include the inlineData from the input file
    const parsed = JSON.parse(capturedBody) as { contents: Array<{ parts: unknown[] }> };
    expect(parsed.contents[0].parts.length).toBeGreaterThan(1);

    fs.rmSync(inputFile, { force: true });
    if (res.body.path) fs.rmSync(res.body.path, { force: true });
  });
});
