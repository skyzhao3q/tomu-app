import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu usage", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("usage shows full stats", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/usage",
        handler: (_req, res) =>
          jsonResponse(res, {
            total_input_tokens: 1000,
            total_output_tokens: 500,
            total_requests: 10,
            by_day: [],
            by_model: [
              { model_id: "claude-3", provider_id: "p1", input_tokens: 1000, output_tokens: 500, requests: 10 },
            ],
          }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["usage"]);
    expect(result.stdout).toContain("Requests: 10");
    expect(result.stdout).toContain("Input tokens: 1000");
    expect(result.stdout).toContain("Output tokens: 500");
    expect(result.stdout).toContain("claude-3");
  });

  test("usage --days 7 passes parameter", async () => {
    let requestUrl = "";
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/usage",
        handler: (req, res) => {
          requestUrl = req.url ?? "";
          jsonResponse(res, {
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_requests: 0,
            by_day: [],
            by_model: [],
          });
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    await runCommand(createProgram(), ["usage", "--days", "7"]);
    expect(requestUrl).toContain("days=7");
  });

  test("usage --json outputs JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/usage",
        handler: (_req, res) =>
          jsonResponse(res, {
            total_input_tokens: 100,
            total_output_tokens: 50,
            total_requests: 5,
            by_day: [],
            by_model: [],
          }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["usage", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.total_requests).toBe(5);
  });

  test("usage summary shows summary", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/usage/summary",
        handler: (_req, res) =>
          jsonResponse(res, {
            total_input_tokens: 5000,
            total_output_tokens: 2500,
            total_requests: 50,
          }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["usage", "summary"]);
    expect(result.stdout).toContain("Usage Summary:");
    expect(result.stdout).toContain("Total requests: 50");
  });

  test("usage summary --json", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/usage/summary",
        handler: (_req, res) =>
          jsonResponse(res, {
            total_input_tokens: 5000,
            total_output_tokens: 2500,
            total_requests: 50,
          }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["usage", "summary", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.total_requests).toBe(50);
  });
});
