import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu msg", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
  });

  test("msg delete retracts a message", async () => {
    const mock = await createMockServer([
      {
        method: "DELETE",
        path: "/api/messages/:chatId/:messageId",
        handler: (_req, res) => jsonResponse(res, { success: true }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["msg", "delete", "chat1", "msg42"]);
    expect(result.stdout).toContain("✅ Message msg42 deleted from chat chat1");
  });
});
