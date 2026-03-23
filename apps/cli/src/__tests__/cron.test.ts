import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu cron", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("cron list shows jobs", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/cron",
        handler: (_req, res) =>
          jsonResponse(res, [
            { id: "c1", name: "daily-backup", type: "cron", schedule: "0 2 * * *", enabled: true },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["cron", "list"]);
    expect(result.stdout).toContain("daily-backup");
    expect(result.stdout).toContain("0 2 * * *");
    expect(result.stdout).toContain("yes");
  });

  test("cron list empty shows message", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/cron",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["cron", "list"]);
    expect(result.stdout).toContain("No cron jobs.");
  });

  test("cron list --json outputs raw JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/cron",
        handler: (_req, res) =>
          jsonResponse(res, [{ id: "c1", name: "test", type: "every", schedule: "1h", enabled: true }]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["cron", "list", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed[0].id).toBe("c1");
  });

  test("cron add creates job", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/cron",
        handler: (_req, res) =>
          jsonResponse(res, { id: "c-new", name: "my-job" }, 201),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "cron",
      "add",
      "my-job",
      "cron",
      "0 * * * *",
    ]);
    expect(result.stdout).toContain('✅ Cron job "my-job" added (ID: c-new)');
  });

  test("cron remove deletes job", async () => {
    const mock = await createMockServer([
      {
        method: "DELETE",
        path: "/api/cron/:id",
        handler: (_req, res) => jsonResponse(res, { success: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["cron", "remove", "c1"]);
    expect(result.stdout).toContain("✅ Cron job c1 removed.");
  });

  test("cron run triggers job", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/cron/:id/run",
        handler: (_req, res) => jsonResponse(res, { status: "triggered" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["cron", "run", "c1"]);
    expect(result.stdout).toContain("✅ Cron job c1 triggered.");
  });

  test("cron enable enables job", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/cron/:id/enable",
        handler: (_req, res) => jsonResponse(res, { status: "ok" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["cron", "enable", "c1"]);
    expect(result.stdout).toContain("✅ Cron job c1 enabled.");
  });

  test("cron disable disables job", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/cron/:id/disable",
        handler: (_req, res) => jsonResponse(res, { status: "ok" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["cron", "disable", "c1"]);
    expect(result.stdout).toContain("✅ Cron job c1 disabled.");
  });

  test("cron history shows run history", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/cron/:id/history",
        handler: (_req, res) =>
          jsonResponse(res, [
            { run_at: "2025-01-01T02:00:00Z", status: "success" },
            { run_at: "2025-01-02T02:00:00Z", status: "failed", output: "timeout" },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["cron", "history", "c1"]);
    expect(result.stdout).toContain("success");
    expect(result.stdout).toContain("failed");
    expect(result.stdout).toContain("timeout");
  });

  test("cron history empty shows message", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/cron/:id/history",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["cron", "history", "c1"]);
    expect(result.stdout).toContain("No history.");
  });
});
