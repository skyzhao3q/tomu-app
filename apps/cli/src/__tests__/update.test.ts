import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu update", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("update (default) shows up to date", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/update/check",
        handler: (_req, res) =>
          jsonResponse(res, { current: "1.0.0", updateAvailable: false }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["update"]);
    expect(result.stdout).toContain("✅ Already up to date (1.0.0)");
  });

  test("update (default) shows available update", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/update/check",
        handler: (_req, res) =>
          jsonResponse(res, { current: "1.0.0", latest: "1.1.0", updateAvailable: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["update"]);
    expect(result.stdout).toContain("Update available: 1.0.0 → 1.1.0");
  });

  test("update check shows up to date", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/update/check",
        handler: (_req, res) =>
          jsonResponse(res, { current: "1.2.0", updateAvailable: false }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["update", "check"]);
    expect(result.stdout).toContain("✅ Already up to date (1.2.0)");
  });

  test("update check --json outputs raw JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/update/check",
        handler: (_req, res) =>
          jsonResponse(res, { current: "1.0.0", latest: "1.1.0", updateAvailable: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["update", "check", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.current).toBe("1.0.0");
    expect(parsed.updateAvailable).toBe(true);
  });

  test("update download succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/update/download",
        handler: (_req, res) =>
          jsonResponse(res, { status: "Downloaded v1.1.0" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["update", "download"]);
    expect(result.stdout).toContain("Downloading update...");
    expect(result.stdout).toContain("✅ Downloaded v1.1.0");
  });

  test("update install succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/update/install",
        handler: (_req, res) =>
          jsonResponse(res, { status: "Installed v1.1.0 successfully" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["update", "install"]);
    expect(result.stdout).toContain("Installing update...");
    expect(result.stdout).toContain("✅ Installed v1.1.0 successfully");
  });
});
