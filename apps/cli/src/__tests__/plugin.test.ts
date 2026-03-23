import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu plugin", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("plugin list shows table", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/plugins",
        handler: (_req, res) =>
          jsonResponse(res, [
            { name: "web-search", version: "1.0.0", description: "Web search plugin", enabled: true },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["plugin", "list"]);
    expect(result.stdout).toContain("web-search");
    expect(result.stdout).toContain("1.0.0");
  });

  test("plugin list empty", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/plugins",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["plugin", "list"]);
    expect(result.stdout).toContain("No plugins installed.");
  });

  test("plugin install succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/plugins",
        handler: (_req, res) => {
          res.writeHead(201);
          res.end();
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "plugin",
      "install",
      "--source",
      "https://example.com/plugin.git",
    ]);
    expect(result.stdout).toContain("✅ Plugin installed");
  });

  test("plugin remove succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "DELETE",
        path: "/api/plugins/:name",
        handler: (_req, res) => {
          res.writeHead(204);
          res.end();
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["plugin", "remove", "web-search"]);
    expect(result.stdout).toContain('✅ Plugin "web-search" removed.');
  });
});
