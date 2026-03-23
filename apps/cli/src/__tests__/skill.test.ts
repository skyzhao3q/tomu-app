import { describe, test, expect, afterEach, vi } from "vitest";
import { createMockServer, jsonResponse, runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

// Mock child_process for skill install
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

describe("tomu skill", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  test("skill list shows table", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/skills",
        handler: (_req, res) =>
          jsonResponse(res, [
            { id: "s1", name: "web-search", enabled: true },
          ]),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["skill", "list"]);
    expect(result.stdout).toContain("web-search");
    expect(result.stdout).toContain("yes");
  });

  test("skill list empty shows message", async () => {
    const mock = await createMockServer([
      {
        method: "GET",
        path: "/api/skills",
        handler: (_req, res) => jsonResponse(res, []),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["skill", "list"]);
    expect(result.stdout).toContain("No skills installed.");
  });

  test("skill toggle shows new state", async () => {
    const mock = await createMockServer([
      {
        method: "PUT",
        path: "/api/skills/:id/toggle",
        handler: (_req, res) =>
          jsonResponse(res, { id: "s1", name: "web-search", enabled: false }),
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["skill", "toggle", "s1"]);
    expect(result.stdout).toContain('Skill "web-search" is now disabled.');
  });

  test("skill install success", async () => {
    const { execSync } = await import("child_process");
    (execSync as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    const result = await runCommand(createProgram(), [
      "skill",
      "install",
      "https://github.com/example/skill-test.git",
    ]);
    expect(result.stdout).toContain("📥 Installing skill from");
    expect(result.stdout).toContain("✅ Skill installed successfully.");
    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining("git clone --depth 1"),
      expect.any(Object),
    );
  });

  test("skill install failure", async () => {
    const { execSync } = await import("child_process");
    (execSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("git clone failed");
    });

    const result = await runCommand(createProgram(), [
      "skill",
      "install",
      "https://github.com/example/bad.git",
    ]);
    expect(result.stderr).toContain("❌ Installation failed.");
    expect(result.exitCode).toBe(1);
  });

  test("skill uninstall succeeds", async () => {
    const mock = await createMockServer([
      {
        method: "DELETE",
        path: "/api/skills/:id",
        handler: (_req, res) => {
          res.writeHead(204);
          res.end();
        },
      },
    ]);
    close = mock.close;
    vi.stubEnv("TOMU_API_URL", `http://localhost:${mock.port}`);

    const result = await runCommand(createProgram(), ["skill", "uninstall", "s1"]);
    expect(result.stdout).toContain("✅ Skill s1 uninstalled.");
  });
});
