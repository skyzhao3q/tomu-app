import * as fs from "node:fs";
import * as path from "node:path";

interface WriteArgs {
  file_path: string;
  content: string;
}

export async function executeWrite({ file_path, content }: WriteArgs): Promise<string> {
  try {
    fs.mkdirSync(path.dirname(file_path), { recursive: true });
    fs.writeFileSync(file_path, content, "utf-8");
    const lines = content.split("\n").length;
    return `Wrote ${lines} lines to ${file_path}`;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
