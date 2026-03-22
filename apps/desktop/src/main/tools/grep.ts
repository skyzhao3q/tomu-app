import { execSync } from "node:child_process";

interface GrepArgs {
  pattern: string;
  path?: string;
  glob?: string;
  output_mode?: "content" | "files_with_matches" | "count";
}

export async function executeGrep({ pattern, path: searchPath, glob: fileGlob, output_mode }: GrepArgs): Promise<string> {
  const cwd = searchPath || process.cwd();
  const args = ["rg", "--no-heading", "--color=never"];

  if (output_mode === "files_with_matches" || !output_mode) {
    args.push("--files-with-matches");
  } else if (output_mode === "count") {
    args.push("--count");
  } else {
    args.push("--line-number");
  }

  if (fileGlob) args.push("--glob", fileGlob);
  args.push("-m", "50");
  args.push("--", pattern, cwd);

  try {
    const result = execSync(args.join(" "), {
      encoding: "utf-8",
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });
    return result.trim() || "No matches found";
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number };
    if (e.status === 1) return "No matches found";
    return `Error: ${e.stdout || String(err)}`;
  }
}
