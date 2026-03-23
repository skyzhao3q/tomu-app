import type { Command } from "commander";
import { readFileSync } from "fs";
import { apiFetch } from "../api.js";
import { formatJson } from "../lib/formatter.js";

export function registerExport(program: Command): void {
  program
    .command("export [type]")
    .description(
      "Export data. Without type: unified export to timestamped file. With type (threads|memories|settings): export to stdout or --output file.",
    )
    .option("--output <file>", "Write to file instead of stdout")
    .action(async (type: string | undefined, opts: { output?: string }) => {
      // Unified export (Alma style): no type arg
      if (!type) {
        const [threads, memories, settings] = await Promise.all([
          apiFetch("GET", "/export/threads"),
          apiFetch("GET", "/export/memories"),
          apiFetch("GET", "/export/settings"),
        ]);

        const bundle = { threads, memories, settings };
        const json = formatJson(bundle);

        const date = new Date().toISOString().slice(0, 10);
        const outFile = opts.output ?? `tomu-export-${date}.json`;
        const { writeFileSync } = await import("fs");
        writeFileSync(outFile, json, "utf-8");
        console.log(`✅ Exported to ${outFile}`);
        return;
      }

      // Type-specific export
      const validTypes = ["threads", "memories", "settings"];
      if (!validTypes.includes(type)) {
        console.error(
          `❌ Invalid export type: ${type}. Must be one of: ${validTypes.join(", ")}`,
        );
        process.exit(1);
      }

      const data = await apiFetch("GET", `/export/${type}`);
      const json = formatJson(data);

      if (opts.output) {
        const { writeFileSync } = await import("fs");
        writeFileSync(opts.output, json, "utf-8");
        console.log(`✅ Exported ${type} to ${opts.output}`);
      } else {
        console.log(json);
      }
    });

  program
    .command("import [type]")
    .description(
      "Import data. Without type: import from unified bundle file. With type (threads|memories): import specific type.",
    )
    .option("--file <path>", "Input file path (required)")
    .action(async (type: string | undefined, opts: { file?: string }) => {
      if (!opts.file) {
        console.error("❌ --file <path> is required.");
        process.exit(1);
      }

      // Validate type before touching the filesystem
      if (type) {
        const validTypes = ["threads", "memories"];
        if (!validTypes.includes(type)) {
          console.error(
            `❌ Invalid import type: ${type}. Must be one of: ${validTypes.join(", ")}`,
          );
          process.exit(1);
        }
      }

      const content = readFileSync(opts.file, "utf-8");
      const data = JSON.parse(content) as Record<string, unknown>;

      if (!type) {
        // Unified import (Alma style): no type arg
        await apiFetch("POST", "/import/bundle", data);
        console.log(`✅ Imported from ${opts.file}`);
        return;
      }

      await apiFetch("POST", `/import/${type}`, data);
      console.log(`✅ Imported ${type} from ${opts.file}`);
    });
}
