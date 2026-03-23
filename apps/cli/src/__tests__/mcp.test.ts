import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu mcp", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("mcp list shows table", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/mcp/servers",
        handler: (_req, res) =>
          jsonResponse(res, [
            { name: "fetch", command: "npx", args: ["-y", "@anthropic/mcp-fetch"] },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["mcp", "list"]);
    expect(result.stdout).toContain("fetch");
    expect(result.stdout).toContain("npx");
  });

  test("mcp list empty", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/mcp/servers",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["mcp", "list"]);
    expect(result.stdout).toContain("No MCP servers configured.");
  });

  test("mcp add succeeds", async () => {
    let receivedBody = "";
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/mcp/servers",
        handler: (_req, res, body) => {
          receivedBody = body;
          res.writeHead(201);
          res.end();
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "mcp",
      "add",
      "--name",
      "test-server",
      "--command",
      "npx",
      "--args",
      "-y,@test/mcp",
    ]);
    expect(result.stdout).toContain('✅ MCP server "test-server" added.');
    const body = JSON.parse(receivedBody);
    expect(body.name).toBe("test-server");
    expect(body.args).toEqual(["-y", "@test/mcp"]);
  });

  test("mcp remove succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "DELETE",
        path: "/api/mcp/servers/:name",
        handler: (_req, res) => {
          res.writeHead(204);
          res.end();
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["mcp", "remove", "test-server"]);
    expect(result.stdout).toContain('✅ MCP server "test-server" removed.');
  });
});
