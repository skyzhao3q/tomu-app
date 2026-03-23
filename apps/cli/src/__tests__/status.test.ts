import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu status", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("prints running status", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/health",
        handler: (_req, res) =>
          jsonResponse(res, { status: "ok", version: "1.0.0", uptime: 42 }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["status"]);
    expect(result.stdout).toContain("✅ API Server is running");
    expect(result.stdout).toContain("Version: 1.0.0");
    expect(result.stdout).toContain("Uptime: 42s");
  });

  test("--json outputs raw JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/health",
        handler: (_req, res) =>
          jsonResponse(res, { status: "ok", version: "1.0.0", uptime: 42 }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["status", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.status).toBe("ok");
  });

  test("server unreachable shows error", async () => {
    vi.stubEnv("TOMU_API_URL", "http://localhost:19999");
    const result = await runCommand(createProgram(), ["status"]);
    expect(result.stderr).toContain("❌ API Server is not running or unreachable.");
    expect(result.exitCode).toBe(1);
  });
});
