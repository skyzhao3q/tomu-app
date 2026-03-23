import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu emotion", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("emotion (default) shows current state", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/emotion",
        handler: (_req, res) =>
          jsonResponse(res, { mood: "happy", energy: 0.8, valence: 0.9 }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["emotion"]);
    expect(result.stdout).toContain("Mood: happy");
    expect(result.stdout).toContain("Energy: 0.8");
    expect(result.stdout).toContain("Valence: 0.9");
  });

  test("emotion status shows current state", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/emotion",
        handler: (_req, res) =>
          jsonResponse(res, { mood: "calm" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["emotion", "status"]);
    expect(result.stdout).toContain("Mood: calm");
  });

  test("emotion status --json outputs raw JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/emotion",
        handler: (_req, res) =>
          jsonResponse(res, { mood: "excited", energy: 1.0, valence: 0.95 }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["emotion", "status", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.mood).toBe("excited");
  });

  test("emotion set-base updates base emotion", async () => {
    let requestBody = "";
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/emotion/base",
        handler: (_req, res, body) => {
          requestBody = body;
          jsonResponse(res, { success: true });
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "emotion",
      "set-base",
      "happy",
      "0.8",
      "0.9",
      "feeling great",
    ]);
    expect(result.stdout).toContain("✅ Base emotion updated.");
    const parsed = JSON.parse(requestBody);
    expect(parsed.mood).toBe("happy");
    expect(parsed.energy).toBe(0.8);
    expect(parsed.valence).toBe(0.9);
    expect(parsed.description).toBe("feeling great");
  });

  test("emotion set-context updates context emotion", async () => {
    let requestBody = "";
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/emotion/context",
        handler: (_req, res, body) => {
          requestBody = body;
          jsonResponse(res, { success: true });
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), [
      "emotion",
      "set-context",
      "chat42",
      "curious",
      "0.7",
      "user asked question",
    ]);
    expect(result.stdout).toContain("✅ Context emotion set for chat chat42");
    const parsed = JSON.parse(requestBody);
    expect(parsed.chatId).toBe("chat42");
    expect(parsed.mood).toBe("curious");
    expect(parsed.trigger).toBe("user asked question");
  });

  test("emotion get returns blended emotion JSON", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/emotion",
        handler: (_req, res) =>
          jsonResponse(res, { mood: "content", blended: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["emotion", "get"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.mood).toBe("content");
  });

  test("emotion get with chatId queries specific chat", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/emotion/:chatId",
        handler: (_req, res) =>
          jsonResponse(res, { mood: "playful", chatId: "chat99" }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["emotion", "get", "chat99"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.chatId).toBe("chat99");
  });
});
