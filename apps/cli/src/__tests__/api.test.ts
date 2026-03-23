import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse } from "./helpers.js";
import { apiFetch } from "../api.js";

describe("apiFetch", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  function setApiUrl(port: number) {
    vi.stubEnv("TOMU_API_URL", `http://localhost:${port}`);
  }

  test("GET request returns JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/health",
        handler: (_req, res) =>
          jsonResponse(res, { status: "ok", uptime: 123 }),
      },
    ]);
    close = mock.close;
    setApiUrl(mock.port);

    const data = await apiFetch<{ status: string; uptime: number }>("GET", "/health");
    expect(data).toEqual({ status: "ok", uptime: 123 });
  });

  test("POST request sends JSON body", async () => {
    let receivedBody = "";
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/memories/search",
        handler: (_req, res, body) => {
          receivedBody = body;
          jsonResponse(res, [{ id: "1", content: "hello" }]);
        },
      },
    ]);
    close = mock.close;
    setApiUrl(mock.port);

    const data = await apiFetch("POST", "/memories/search", { query: "test" });
    expect(JSON.parse(receivedBody)).toEqual({ query: "test" });
    expect(data).toEqual([{ id: "1", content: "hello" }]);
  });

  test("PUT request sends JSON body", async () => {
    let receivedMethod = "";
    const mock = await createMockServer([
      {
        method: "PUT",
        path: "/api/settings",
        handler: (req, res) => {
          receivedMethod = req.method ?? "";
          jsonResponse(res, { theme: "dark" });
        },
      },
    ]);
    close = mock.close;
    setApiUrl(mock.port);

    await apiFetch("PUT", "/settings", { theme: "dark" });
    expect(receivedMethod).toBe("PUT");
  });

  test("DELETE with 204 returns undefined", async () => {
    const mock = await createMockServer([
      {
        method: "DELETE",
        path: "/api/threads/:id",
        handler: (_req, res) => {
          res.writeHead(204);
          res.end();
        },
      },
    ]);
    close = mock.close;
    setApiUrl(mock.port);

    const result = await apiFetch("DELETE", "/threads/abc");
    expect(result).toBeUndefined();
  });

  test("4xx/5xx throws ApiError", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/providers",
        handler: (_req, res) => {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "Not found" }));
        },
      },
    ]);
    close = mock.close;
    setApiUrl(mock.port);

    try {
      await apiFetch("GET", "/providers");
      expect.unreachable("should have thrown");
    } catch (e: unknown) {
      expect((e as { name: string }).name).toBe("ApiError");
      expect((e as { status: number }).status).toBe(404);
    }
  });

  test("connection refused throws ConnectionError", async () => {
    vi.stubEnv("TOMU_API_URL", "http://localhost:19999");
    await expect(apiFetch("GET", "/health")).rejects.toThrow(
      "API Server is not running or unreachable.",
    );
  });

  test("TOMU_API_URL changes base URL", async () => {
    let hitCustomServer = false;
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/health",
        handler: (_req, res) => {
          hitCustomServer = true;
          jsonResponse(res, { status: "ok" });
        },
      },
    ]);
    close = mock.close;
    setApiUrl(mock.port);

    await apiFetch("GET", "/health");
    expect(hitCustomServer).toBe(true);
  });
});
