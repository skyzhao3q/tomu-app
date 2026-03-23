import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu thread", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("threads lists recent threads", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/threads",
        handler: (_req, res) =>
          jsonResponse(res, {
            threads: [
              { id: "t1", title: "Hello world", updatedAt: "2025-01-01T00:00:00Z" },
            ],
          }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["threads"]);
    expect(result.stdout).toContain("t1");
    expect(result.stdout).toContain("Hello world");
  });

  test("threads with limit passes query param", async () => {
    let requestUrl = "";
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/threads",
        handler: (req, res) => {
          requestUrl = req.url ?? "";
          jsonResponse(res, { threads: [] });
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    await runCommand(createProgram(), ["threads", "5"]);
    expect(requestUrl).toContain("limit=5");
  });

  test("threads --json outputs raw JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/threads",
        handler: (_req, res) =>
          jsonResponse(res, { threads: [{ id: "t1", title: "Test", updatedAt: "2025-01-01" }] }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["threads", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.threads[0].id).toBe("t1");
  });

  test("thread create succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/threads",
        handler: (_req, res) => jsonResponse(res, { id: "t-new", title: "My Thread" }, 201),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["thread", "create", "My Thread"]);
    expect(result.stdout).toContain("✅ Created thread: t-new");
    expect(result.stdout).toContain("My Thread");
  });

  test("thread delete succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "DELETE",
        path: "/api/threads/:id",
        handler: (_req, res) => jsonResponse(res, { success: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["thread", "delete", "t1"]);
    expect(result.stdout).toContain("✅ Deleted thread t1");
  });

  test("thread search returns results", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/threads/search",
        handler: (_req, res) =>
          jsonResponse(res, {
            threads: [{ id: "t1", title: "Found thread", updatedAt: "2025-01-01" }],
          }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["thread", "search", "found"]);
    expect(result.stdout).toContain("t1");
    expect(result.stdout).toContain("Found thread");
  });

  test("thread search no results", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/threads/search",
        handler: (_req, res) => jsonResponse(res, { threads: [] }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["thread", "search", "nothing"]);
    expect(result.stdout).toContain("No threads found.");
  });

  test("thread compact succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/threads/:id/compact",
        handler: (_req, res) => jsonResponse(res, { status: "ok" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["thread", "compact", "t1"]);
    expect(result.stdout).toContain("✅ Thread t1 compacted.");
  });

  test("thread messages shows messages", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/threads/:id",
        handler: (_req, res) =>
          jsonResponse(res, {
            messages: [
              { role: "user", content: "Hello" },
              { role: "assistant", content: "Hi there" },
            ],
          }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["thread", "messages", "t1"]);
    expect(result.stdout).toContain("[user] Hello");
    expect(result.stdout).toContain("[assistant] Hi there");
  });

  test("thread messages empty", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/threads/:id",
        handler: (_req, res) => jsonResponse(res, { messages: [] }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["thread", "messages", "t1"]);
    expect(result.stdout).toContain("No messages.");
  });

  test("thread switch succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/threads/:id/switch",
        handler: (_req, res) => jsonResponse(res, { success: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["thread", "switch", "t2"]);
    expect(result.stdout).toContain("✅ Switched to thread t2");
  });
});
