import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu workspace", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("workspace list shows workspaces", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/workspaces",
        handler: (_req, res) =>
          jsonResponse(res, [
            { id: "w1", name: "default", path: "/home/user/projects" },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["workspace", "list"]);
    expect(result.stdout).toContain("default");
    expect(result.stdout).toContain("/home/user/projects");
  });

  test("workspace list empty shows message", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/workspaces",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["workspace", "list"]);
    expect(result.stdout).toContain("No workspaces.");
  });

  test("workspace list --json outputs raw JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/workspaces",
        handler: (_req, res) =>
          jsonResponse(res, [{ id: "w1", name: "default", path: "/tmp" }]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["workspace", "list", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed[0].id).toBe("w1");
  });

  test("workspace set updates path", async () => {
    const mock = await createMockServer([
      {
        method: "PUT",
        path: "/api/workspaces/:id",
        handler: (_req, res) => jsonResponse(res, { success: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "workspace",
      "set",
      "w1",
      "/new/path",
    ]);
    expect(result.stdout).toContain("✅ Workspace w1 path set to /new/path");
  });
});
