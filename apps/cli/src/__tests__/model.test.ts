import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu model", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("models lists available models", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/models",
        handler: (_req, res) =>
          jsonResponse(res, [
            { id: "claude-sonnet-4-6", name: "Claude Sonnet", provider: "anthropic" },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["models"]);
    expect(result.stdout).toContain("claude-sonnet-4-6");
    expect(result.stdout).toContain("Claude Sonnet");
    expect(result.stdout).toContain("anthropic");
  });

  test("models empty shows message", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/models",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["models"]);
    expect(result.stdout).toContain("No models available.");
  });

  test("models --json outputs raw JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/models",
        handler: (_req, res) =>
          jsonResponse(res, [{ id: "gpt-4", name: "GPT-4", provider: "openai" }]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["models", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed[0].id).toBe("gpt-4");
  });

  test("model set updates default model", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/settings",
        handler: (_req, res) => jsonResponse(res, { chat: { defaultModel: "old-model" } }),
      },
      {
        method: "PUT",
        path: "/api/settings",
        handler: (_req, res) => jsonResponse(res, {}),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "model",
      "set",
      "anthropic:claude-sonnet-4-6",
    ]);
    expect(result.stdout).toContain("✅ Default model set to anthropic:claude-sonnet-4-6");
  });
});
