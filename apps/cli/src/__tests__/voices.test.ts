import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu voices", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("voices lists available voices", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/voices",
        handler: (_req, res) =>
          jsonResponse(res, [
            { id: "v1", name: "Alloy", language: "en-US" },
            { id: "v2", name: "Echo", language: "en-US" },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["voices"]);
    expect(result.stdout).toContain("Alloy");
    expect(result.stdout).toContain("Echo");
    expect(result.stdout).toContain("en-US");
  });

  test("voices empty shows message", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/voices",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["voices"]);
    expect(result.stdout).toContain("No voices available.");
  });

  test("voices --json outputs raw JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/voices",
        handler: (_req, res) =>
          jsonResponse(res, [{ id: "v1", name: "Alloy", language: "en-US" }]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["voices", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed[0].id).toBe("v1");
  });
});
