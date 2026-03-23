import { spawnSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";

export function openInEditor(filePath: string, template?: string): void {
  if (!existsSync(filePath)) {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, template ?? "", "utf-8");
  }

  const editor = process.env.EDITOR || "vi";
  const result = spawnSync(editor, [filePath], { stdio: "inherit" });

  if (result.error) {
    throw new Error(`Failed to open editor: ${result.error.message}`);
  }
}
