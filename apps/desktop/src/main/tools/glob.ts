import fg from "fast-glob";

interface GlobArgs {
  pattern: string;
  path?: string;
}

export async function executeGlob({ pattern, path: searchPath }: GlobArgs): Promise<string> {
  try {
    const cwd = searchPath || process.cwd();
    const entries = await fg(pattern, {
      cwd,
      absolute: true,
      dot: false,
      ignore: ["**/node_modules/**", "**/.git/**"],
      stats: true,
    });

    if (entries.length === 0) {
      return "No files found";
    }

    entries.sort((a, b) => {
      const aTime = a.stats?.mtimeMs ?? 0;
      const bTime = b.stats?.mtimeMs ?? 0;
      return bTime - aTime;
    });

    const paths = entries.map((e) => e.path);
    return paths.length > 100
      ? `Found ${paths.length} files (showing first 100):\n${paths.slice(0, 100).join("\n")}`
      : paths.join("\n");
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
