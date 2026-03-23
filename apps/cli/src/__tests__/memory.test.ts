import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu memory", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("memory list shows table", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/memories",
        handler: (_req, res) =>
          jsonResponse(res, {
            memories: [
              { id: "m1", content: "Remember this", type: "note", created_at: "2025-01-01" },
            ],
          }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["memory", "list"]);
    expect(result.stdout).toContain("Remember this");
    expect(result.stdout).toContain("note");
  });

  test("memory list with --type and --limit passes query params", async () => {
    let requestUrl = "";
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/memories",
        handler: (req, res) => {
          requestUrl = req.url ?? "";
          jsonResponse(res, { memories: [] });
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    await runCommand(createProgram(), ["memory", "list", "--type", "note", "--limit", "10"]);
    expect(requestUrl).toContain("type=note");
    expect(requestUrl).toContain("limit=10");
  });

  test("memory stats shows statistics", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/memories/stats",
        handler: (_req, res) =>
          jsonResponse(res, { total: 42, by_type: { note: 30, fact: 12 }, db_size_bytes: 10240 }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["memory", "stats"]);
    expect(result.stdout).toContain("Total memories: 42");
    expect(result.stdout).toContain("note: 30");
    expect(result.stdout).toContain("fact: 12");
    expect(result.stdout).toContain("10.0 KB");
  });

  test("memory search shows results with SPEC output", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/memories/search",
        handler: (_req, res) =>
          jsonResponse(res, [
            { id: "m1", content: "Test memory", type: "note", score: 0.9 },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["memory", "search", "test query"]);
    expect(result.stdout).toContain('🔍 Searching memory for: "test query"...');
    expect(result.stdout).toContain("[1] ID: m1");
    expect(result.stdout).toContain("Test memory");
  });

  test("memory search no results", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/memories/search",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["memory", "search", "nothing"]);
    expect(result.stdout).toContain("No memories found.");
  });

  test("memory add creates memory", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/memories",
        handler: (_req, res) => jsonResponse(res, { id: "m-new" }, 201),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "memory",
      "add",
      "--content",
      "Test content",
      "--type",
      "note",
    ]);
    expect(result.stdout).toContain("✅ Memory added (ID: m-new)");
  });

  test("memory delete succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "DELETE",
        path: "/api/memories/:id",
        handler: (_req, res) => jsonResponse(res, { success: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["memory", "delete", "m1"]);
    expect(result.stdout).toContain("✅ Memory m1 deleted.");
  });

  test("memory rebuild", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/memories/rebuild",
        handler: (_req, res) => jsonResponse(res, { status: "Rebuilt 42 embeddings" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["memory", "rebuild"]);
    expect(result.stdout).toContain("Rebuilding embeddings...");
    expect(result.stdout).toContain("✅ Rebuilt 42 embeddings");
  });

  test("memory cleanup", async () => {
    const mock = await createMockServer([
      {
        method: "DELETE",
        path: "/api/memories/cleanup",
        handler: (_req, res) => jsonResponse(res, { deleted: 5 }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["memory", "cleanup"]);
    expect(result.stdout).toContain("✅ Cleaned up 5 memories.");
  });
});
