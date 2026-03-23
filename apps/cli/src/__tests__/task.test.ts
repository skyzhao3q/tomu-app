import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu task", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("task list shows table", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/tasks",
        handler: (_req, res) =>
          jsonResponse(res, [
            { id: "t1", subagent_type: "research", status: "running", created_at: "2025-01-01" },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["task", "list"]);
    expect(result.stdout).toContain("research");
    expect(result.stdout).toContain("running");
  });

  test("task list empty", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/tasks",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["task", "list"]);
    expect(result.stdout).toContain("No tasks found.");
  });

  test("task get shows detail", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/tasks/:id",
        handler: (_req, res) =>
          jsonResponse(res, {
            id: "t1",
            subagent_type: "research",
            prompt: "Find info",
            status: "completed",
            result: "Found it",
          }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["task", "get", "t1"]);
    expect(result.stdout).toContain("Task: t1");
    expect(result.stdout).toContain("Status: completed");
    expect(result.stdout).toContain("Result: Found it");
  });

  test("task get 404", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/tasks/:id",
        handler: (_req, res) => {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "Not found" }));
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["task", "get", "bad"]);
    expect(result.exitCode).not.toBe(0);
  });

  test("task create succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/tasks",
        handler: (_req, res) => jsonResponse(res, { id: "t-new" }, 201),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "task",
      "create",
      "--type",
      "research",
      "--prompt",
      "Find something",
    ]);
    expect(result.stdout).toContain("✅ Task created (ID: t-new)");
  });

  test("task delete succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "DELETE",
        path: "/api/tasks/:id",
        handler: (_req, res) => {
          res.writeHead(204);
          res.end();
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["task", "delete", "t1"]);
    expect(result.stdout).toContain("✅ Task t1 deleted.");
  });
});
