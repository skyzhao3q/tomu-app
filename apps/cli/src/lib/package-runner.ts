import { execSync } from "child_process";

/**
 * Detect whether `bun` or `npx` is available and return the appropriate runner.
 * Prefer `bun` if available, fall back to `npx`.
 */
export function getPackageRunner(): "bunx" | "npx" {
  try {
    execSync("bun --version", { stdio: "ignore" });
    return "bunx";
  } catch {
    return "npx";
  }
}
