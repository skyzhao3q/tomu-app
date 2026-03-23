import { describe, test, expect, afterEach, vi } from "vitest";
import { runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

// Mock the editor module
vi.mock("../lib/editor.js", () => ({
  openInEditor: vi.fn(),
}));

// Mock fs to avoid touching real files
vi.mock("fs", async (importOriginal) => {
  const orig = await importOriginal<typeof import("fs")>();
  return {
    ...orig,
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn((path: unknown) => {
      if (typeof path === "string" && path.endsWith("SOUL.md")) return "# SOUL content";
      return orig.readFileSync(path as string);
    }),
    writeFileSync: vi.fn(),
  };
});

describe("tomu soul / tomu user", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("soul shows SOUL.md content", async () => {
    const result = await runCommand(createProgram(), ["soul"]);
    expect(result.stdout).toContain("SOUL content");
    expect(result.exitCode).toBe(0);
  });

  test("soul edit opens SOUL.md in editor", async () => {
    const { openInEditor } = await import("../lib/editor.js");
    const result = await runCommand(createProgram(), ["soul", "edit"]);
    expect(openInEditor).toHaveBeenCalledWith(
      expect.stringContaining("SOUL.md"),
      expect.any(String),
    );
    expect(result.exitCode).toBe(0);
  });

  test("user opens USER.md in editor", async () => {
    const { openInEditor } = await import("../lib/editor.js");
    const result = await runCommand(createProgram(), ["user"]);
    expect(openInEditor).toHaveBeenCalledWith(
      expect.stringContaining("USER.md"),
      expect.any(String),
    );
    expect(result.exitCode).toBe(0);
  });
});
