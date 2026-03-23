import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu config", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("config list shows key-value pairs", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/settings",
        handler: (_req, res) =>
          jsonResponse(res, { theme: "dark", language: "en" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["config", "list"]);
    expect(result.stdout).toContain("theme");
    expect(result.stdout).toContain("dark");
    expect(result.stdout).toContain("language");
  });

  test("config list --json outputs JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/settings",
        handler: (_req, res) =>
          jsonResponse(res, { theme: "dark" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["config", "list", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.theme).toBe("dark");
  });

  test("config get <key> shows value", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/settings",
        handler: (_req, res) =>
          jsonResponse(res, { theme: "dark", language: "en" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["config", "get", "theme"]);
    expect(result.stdout).toContain("dark");
  });

  test("config get <nonexistent> shows error", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/settings",
        handler: (_req, res) =>
          jsonResponse(res, { theme: "dark" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["config", "get", "nonexistent"]);
    expect(result.stderr).toContain("Key not found");
    expect(result.exitCode).toBe(1);
  });

  test("config set <key> <value> updates setting", async () => {
    let receivedBody = "";
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/settings",
        handler: (_req, res) => jsonResponse(res, {}),
      },
      {
        method: "PUT",
        path: "/api/settings",
        handler: (_req, res, body) => {
          receivedBody = body;
          jsonResponse(res, { theme: "dark" });
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["config", "set", "theme", "dark"]);
    expect(result.stdout).toContain("✅ Updated theme");
    expect(JSON.parse(receivedBody)).toMatchObject({ theme: "dark" });
  });
});
