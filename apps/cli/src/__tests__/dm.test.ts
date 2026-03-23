import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu dm", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("dm sends message to user", async () => {
    let requestBody = "";
    const mock = await createMockServer([
      {
        method: "POST",
        path: "/api/dm",
        handler: (_req, res, body) => {
          requestBody = body;
          jsonResponse(res, { success: true });
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["dm", "user123", "Hello there"]);
    expect(result.stdout).toContain("✅ DM sent to user123");
    const parsed = JSON.parse(requestBody);
    expect(parsed.userId).toBe("user123");
    expect(parsed.message).toBe("Hello there");
  });
});
