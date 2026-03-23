import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu provider", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("provider list shows table", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/providers",
        handler: (_req, res) =>
          jsonResponse(res, [
            { id: "p1", name: "Anthropic", type: "anthropic" },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["provider", "list"]);
    expect(result.stdout).toContain("Anthropic");
    expect(result.stdout).toContain("anthropic");
  });

  test("provider list empty shows message", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/providers",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["provider", "list"]);
    expect(result.stdout).toContain("No providers configured.");
  });

  test("provider list --json outputs JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/providers",
        handler: (_req, res) =>
          jsonResponse(res, [{ id: "p1", name: "Anthropic", type: "anthropic" }]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["provider", "list", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("Anthropic");
  });

  test("provider add creates provider", async () => {
    let receivedBody = "";
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/providers",
        handler: (_req, res, body) => {
          receivedBody = body;
          jsonResponse(res, { id: "p1", name: "Anthropic" }, 201);
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "provider",
      "add",
      "--name",
      "Anthropic",
      "--type",
      "anthropic",
      "--api-key",
      "sk-test",
    ]);
    expect(result.stdout).toContain('✅ Provider "Anthropic" added');
    const body = JSON.parse(receivedBody);
    expect(body.name).toBe("Anthropic");
    expect(body.api_key).toBe("sk-test");
  });

  test("provider delete succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "DELETE",
        path: "/api/providers/:id",
        handler: (_req, res) => {
          res.writeHead(204);
          res.end();
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["provider", "delete", "p1"]);
    expect(result.stdout).toContain("✅ Provider p1 deleted.");
  });

  test("provider test success", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/providers/:id/test",
        handler: (_req, res) => jsonResponse(res, { success: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["provider", "test", "p1"]);
    expect(result.stdout).toContain("✅ Connection successful.");
  });

  test("provider test failure", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/providers/:id/test",
        handler: (_req, res) =>
          jsonResponse(res, { success: false, error: "Invalid key" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["provider", "test", "p1"]);
    expect(result.stderr).toContain("❌ Connection failed: Invalid key");
  });

  test("provider models lists models", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/providers/:id/models/fetch",
        handler: (_req, res) =>
          jsonResponse(res, [
            { id: "claude-3", name: "Claude 3" },
            { id: "gpt-4", name: "GPT-4" },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["provider", "models", "p1"]);
    expect(result.stdout).toContain("Claude 3");
    expect(result.stdout).toContain("GPT-4");
  });
});
