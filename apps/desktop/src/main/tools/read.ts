import * as fs from "node:fs";

interface ReadArgs {
  file_path: string;
  offset?: number;
  limit?: number;
}

export async function executeRead({ file_path, offset, limit }: ReadArgs): Promise<string> {
  try {
    const content = fs.readFileSync(file_path, "utf-8");
    const lines = content.split("\n");
    const startLine = Math.max(1, offset || 1);
    const endLine = Math.min(lines.length, startLine + (limit || 2000) - 1);
    const selected = lines.slice(startLine - 1, endLine);

    const numbered = selected.map(
      (line, i) => `${String(startLine + i).padStart(6)}|${line}`,
    );

    const header =
      lines.length > endLine
        ? `[Lines ${startLine}-${endLine} of ${lines.length}]\n`
        : "";
    return header + numbered.join("\n");
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
