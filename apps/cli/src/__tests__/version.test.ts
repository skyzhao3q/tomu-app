import { describe, test, expect } from "vitest";
import { runCommand } from "./helpers.js";
import { createProgram } from "../index.js";

describe("tomu version", () => {
  test("version prints version string", async () => {
    const result = await runCommand(createProgram(), ["version"]);
    expect(result.stdout).toMatch(/^tomu v\d+\.\d+\.\d+/);
    expect(result.exitCode).toBe(0);
  });
});
