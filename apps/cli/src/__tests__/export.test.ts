import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu export/import", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("export threads outputs JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/export/threads",
        handler: (_req, res) =>
          jsonResponse(res, { threads: [{ id: "t1", title: "Test" }] }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["export", "threads"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.threads).toHaveLength(1);
  });

  test("export memories outputs JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/export/memories",
        handler: (_req, res) =>
          jsonResponse(res, { memories: [] }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["export", "memories"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.memories).toEqual([]);
  });

  test("export settings outputs JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/export/settings",
        handler: (_req, res) =>
          jsonResponse(res, { config: { theme: "dark" }, providers: [] }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["export", "settings"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.config.theme).toBe("dark");
  });

  test("export invalid type shows error", async () => {
    const result = await runCommand(createProgram(), ["export", "invalid"]);
    expect(result.stderr).toContain("Invalid export type");
    expect(result.exitCode).toBe(1);
  });

  test("export with --output writes to file", async () => {
    vi.mock("fs", async (importOriginal) => {
      const orig = await importOriginal<typeof import("fs")>();
      return {
        ...orig,
        writeFileSync: vi.fn(),
        readFileSync: orig.readFileSync,
      };
    });

    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/export/threads",
        handler: (_req, res) =>
          jsonResponse(res, { threads: [] }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "export",
      "threads",
      "--output",
      "/tmp/export.json",
    ]);
    expect(result.stdout).toContain("✅ Exported threads to /tmp/export.json");
  });

  test("import invalid type shows error", async () => {
    const result = await runCommand(createProgram(), [
      "import",
      "invalid",
      "--file",
      "/tmp/test.json",
    ]);
    expect(result.stderr).toContain("Invalid import type");
    expect(result.exitCode).toBe(1);
  });
});
