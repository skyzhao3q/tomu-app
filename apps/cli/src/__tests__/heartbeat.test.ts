import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu heartbeat", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("heartbeat (default) shows status", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/heartbeat",
        handler: (_req, res) =>
          jsonResponse(res, { enabled: true, interval: 30, status: "running" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["heartbeat"]);
    expect(result.stdout).toContain("Heartbeat: enabled");
    expect(result.stdout).toContain("Interval: 30m");
    expect(result.stdout).toContain("Status: running");
  });

  test("heartbeat status shows status", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/heartbeat",
        handler: (_req, res) =>
          jsonResponse(res, { enabled: false }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["heartbeat", "status"]);
    expect(result.stdout).toContain("Heartbeat: disabled");
  });

  test("heartbeat status --json outputs raw JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/heartbeat",
        handler: (_req, res) =>
          jsonResponse(res, { enabled: true, interval: 15 }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["heartbeat", "status", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.enabled).toBe(true);
  });

  test("heartbeat config shows configuration", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/heartbeat/config",
        handler: (_req, res) =>
          jsonResponse(res, { interval: 30, patrol: false }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["heartbeat", "config"]);
    expect(result.stdout).toContain("interval: 30");
  });

  test("heartbeat enable succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/heartbeat/enable",
        handler: (_req, res) => jsonResponse(res, { status: "ok" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["heartbeat", "enable"]);
    expect(result.stdout).toContain("✅ Heartbeat enabled.");
  });

  test("heartbeat disable succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/heartbeat/disable",
        handler: (_req, res) => jsonResponse(res, { status: "ok" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["heartbeat", "disable"]);
    expect(result.stdout).toContain("✅ Heartbeat disabled.");
  });

  test("heartbeat interval sets interval", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/heartbeat/interval",
        handler: (_req, res) => jsonResponse(res, { interval: 15 }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["heartbeat", "interval", "15"]);
    expect(result.stdout).toContain("✅ Heartbeat interval set to 15m.");
  });

  test("heartbeat patrol applies action", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/heartbeat/patrol",
        handler: (_req, res) => jsonResponse(res, { status: "ok" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["heartbeat", "patrol", "enable"]);
    expect(result.stdout).toContain("✅ Patrol enable applied.");
  });
});
