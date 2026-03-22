import { execSync } from "node:child_process";

interface BashArgs {
  command: string;
  timeout?: number;
}

export async function executeBash({ command, timeout }: BashArgs): Promise<string> {
  const effectiveTimeout = Math.min(timeout || 120000, 120000);
  try {
    const result = execSync(command, {
      encoding: "utf-8",
      timeout: effectiveTimeout,
      maxBuffer: 1024 * 1024,
      shell: "/bin/zsh",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result || "(no output)";
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    const stdout = e.stdout || "";
    const stderr = e.stderr || "";
    const exitCode = e.status ?? 1;
    return `Exit code: ${exitCode}\n${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ""}`.trim();
  }
}
