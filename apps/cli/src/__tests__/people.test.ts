import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu people", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("people list shows table", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/people",
        handler: (_req, res) =>
          jsonResponse(res, [{ name: "Alice", notes: "Friend" }]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["people", "list"]);
    expect(result.stdout).toContain("Alice");
    expect(result.stdout).toContain("Friend");
  });

  test("people add success", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/people",
        handler: (_req, res) => jsonResponse(res, { name: "Bob" }, 201),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "people",
      "add",
      "--name",
      "Bob",
      "--notes",
      "Colleague",
    ]);
    expect(result.stdout).toContain('✅ Added "Bob".');
  });

  test("people update success", async () => {
    const mock = await createMockServer([
      {
        method: "PUT",
        path: "/api/people/:name",
        handler: (_req, res) => jsonResponse(res, { name: "Alice" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "people",
      "update",
      "Alice",
      "--notes",
      "Updated",
    ]);
    expect(result.stdout).toContain('✅ Updated "Alice".');
  });

  test("people delete success", async () => {
    const mock = await createMockServer([
      {
        method: "DELETE",
        path: "/api/people/:name",
        handler: (_req, res) => {
          res.writeHead(204);
          res.end();
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["people", "delete", "Alice"]);
    expect(result.stdout).toContain('✅ Deleted "Alice".');
  });
});
