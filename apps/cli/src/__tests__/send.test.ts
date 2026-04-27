import { describe, test, expect, afterEach, beforeAll, afterAll, vi } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

const tmpFile = path.join(os.tmpdir(), "tomu-test-send-photo.jpg");

beforeAll(() => {
  fs.writeFileSync(tmpFile, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]));
});

afterAll(() => {
  fs.rmSync(tmpFile, { force: true });
});

describe("tomu send photo", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("sends photo via env TOMU_THREAD_ID", async () => {
    const threadId = "thread-abc-123";
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/threads/:id/send-photo",
        handler: (_req, res) => jsonResponse(res, { ok: true, messageId: "msg-1" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);
    vi.stubEnv("TOMU_THREAD_ID", threadId);

    const result = await runCommand(createProgram(), ["send", "photo", tmpFile]);
    expect(result.stdout).toContain(`✅ Sent photo to thread ${threadId}`);
    expect(result.exitCode).toBe(0);
  });

  test("sends photo with --thread flag", async () => {
    const threadId = "thread-flag-456";
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/threads/:id/send-photo",
        handler: (_req, res) => jsonResponse(res, { ok: true, messageId: "msg-2" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["send", "photo", tmpFile, "--thread", threadId]);
    expect(result.stdout).toContain(`✅ Sent photo to thread ${threadId}`);
    expect(result.exitCode).toBe(0);
  });

  test("sends correct filePath in request body", async () => {
    let capturedBody = "";
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/threads/:id/send-photo",
        handler: (_req, res, body) => {
          capturedBody = body;
          jsonResponse(res, { ok: true, messageId: "msg-3" });
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);
    vi.stubEnv("TOMU_THREAD_ID", "thread-xyz");

    await runCommand(createProgram(), ["send", "photo", tmpFile]);
    const parsed = JSON.parse(capturedBody);
    expect(parsed.filePath).toBe(tmpFile);
  });

  test("errors when no thread id", async () => {
    const result = await runCommand(createProgram(), ["send", "photo", tmpFile]);
    expect(result.stderr).toContain("❌ No thread target");
    expect(result.exitCode).toBe(1);
  });

  test("errors when file not found", async () => {
    vi.stubEnv("TOMU_THREAD_ID", "thread-abc");
    const result = await runCommand(createProgram(), ["send", "photo", "/tmp/nonexistent-tomu-test-file.jpg"]);
    expect(result.stderr).toContain("❌ File not found");
    expect(result.exitCode).toBe(1);
  });
});
