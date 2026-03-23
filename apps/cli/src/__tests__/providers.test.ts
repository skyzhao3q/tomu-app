import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu providers shorthand", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("providers lists all providers", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/providers",
        handler: (_req, res) =>
          jsonResponse(res, [
            { id: "p1", name: "OpenAI", type: "openai" },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["providers"]);
    expect(result.stdout).toContain("OpenAI");
    expect(result.stdout).toContain("openai");
  });

  test("providers empty shows message", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/providers",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["providers"]);
    expect(result.stdout).toContain("No providers configured.");
  });

  test("providers --json outputs raw JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/providers",
        handler: (_req, res) =>
          jsonResponse(res, [{ id: "p1", name: "OpenAI", type: "openai" }]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["providers", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed[0].id).toBe("p1");
  });

  test("providers <id> models lists models for provider", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/providers/:id/models/fetch",
        handler: (_req, res) =>
          jsonResponse(res, [
            { id: "gpt-4", name: "GPT-4" },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["providers", "p1", "models"]);
    expect(result.stdout).toContain("gpt-4");
    expect(result.stdout).toContain("GPT-4");
  });

  test("providers <id> models empty shows message", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/providers/:id/models/fetch",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["providers", "p1", "models"]);
    expect(result.stdout).toContain("No models found.");
  });
});
