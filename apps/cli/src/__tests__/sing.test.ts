import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu sing", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("sing generate creates a song", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/sing/generate",
        handler: (_req, res) =>
          jsonResponse(res, { id: "song-1", url: "https://example.com/song.mp3" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["sing", "generate", "a happy birthday song"]);
    expect(result.stdout).toContain("✅ Song generated: https://example.com/song.mp3");
  });

  test("sing generate --json outputs raw JSON", async () => {
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/sing/generate",
        handler: (_req, res) =>
          jsonResponse(res, { id: "song-2", url: "https://example.com/song2.mp3" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["sing", "generate", "test song", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.id).toBe("song-2");
  });

  test("sing config sets API key", async () => {
    let requestBody = "";
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/sing/config",
        handler: (_req, res, body) => {
          requestBody = body;
          jsonResponse(res, { success: true });
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["sing", "config", "my-api-key-123"]);
    expect(result.stdout).toContain("✅ PiAPI API key configured.");
    const parsed = JSON.parse(requestBody);
    expect(parsed.apiKey).toBe("my-api-key-123");
  });
});
