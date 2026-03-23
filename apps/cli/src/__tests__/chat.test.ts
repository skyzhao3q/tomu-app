import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu chat", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("chat list shows threads table", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/threads",
        handler: (_req, res) =>
          jsonResponse(res, [
            { id: "t1", title: "Hello", created_at: "2025-01-01", updated_at: "2025-01-02" },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["chat", "list"]);
    expect(result.stdout).toContain("Hello");
    expect(result.stdout).toContain("t1");
  });

  test("chat list empty shows message", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/threads",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["chat", "list"]);
    expect(result.stdout).toContain("No chat threads.");
  });

  test("chat history shows thread detail", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/threads/:id",
        handler: (_req, res) =>
          jsonResponse(res, {
            id: "t1",
            title: "Hello",
            messages: [
              { role: "user", content: "Hi" },
              { role: "assistant", content: "Hello!" },
            ],
          }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["chat", "history", "t1"]);
    expect(result.stdout).toContain("Thread: Hello");
    expect(result.stdout).toContain("👤 User");
    expect(result.stdout).toContain("Hi");
    expect(result.stdout).toContain("🤖 Assistant");
    expect(result.stdout).toContain("Hello!");
  });

  test("chat history 404 throws error", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/threads/:id",
        handler: (_req, res) => {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "Not found" }));
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["chat", "history", "bad"]);
    expect(result.exitCode).not.toBe(0);
  });

  test("chat new creates thread", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/threads",
        handler: (_req, res) =>
          jsonResponse(res, { id: "t-new", title: "New Chat" }, 201),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["chat", "new"]);
    expect(result.stdout).toContain("✅ New thread created: t-new");
  });

  test("chat delete succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "DELETE",
        path: "/api/threads/:id",
        handler: (_req, res) => {
          res.writeHead(204);
          res.end();
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["chat", "delete", "t1"]);
    expect(result.stdout).toContain("✅ Thread t1 deleted.");
  });

  test("chat search shows results", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/threads/search",
        handler: (_req, res) =>
          jsonResponse(res, [
            { thread_id: "t1", snippet: "found text", rank: 1 },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["chat", "search", "test"]);
    expect(result.stdout).toContain("found text");
  });

  test("chat search with --limit passes parameter", async () => {
    let receivedBody = "";
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/threads/search",
        handler: (_req, res, body) => {
          receivedBody = body;
          jsonResponse(res, []);
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    await runCommand(createProgram(), ["chat", "search", "test", "--limit", "5"]);
    expect(JSON.parse(receivedBody).limit).toBe(5);
  });

  test("chat send --json returns structured output", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/chat/completions",
        handler: (_req, res) =>
          jsonResponse(res, {
            choices: [{ message: { role: "assistant", content: "Hi!" } }],
          }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "chat",
      "send",
      "Hello",
      "--json",
    ]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.choices[0].message.content).toBe("Hi!");
  });
});
