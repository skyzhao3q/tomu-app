import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson, formatTable } from "../lib/formatter.js";

export function registerVoices(program: Command): void {
  program
    .command("voices")
    .description("List available TTS voices")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<Array<{ id: string; name: string; language?: string }>>(
        "GET",
        "/voices",
      );

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      if (data.length === 0) {
        console.log("No voices available.");
        return;
      }

      console.log(
        formatTable(
          data.map((v) => ({ id: v.id, name: v.name, language: v.language ?? "" })),
          [
            { key: "id", label: "ID" },
            { key: "name", label: "Name" },
            { key: "language", label: "Language" },
          ],
        ),
      );
    });
}
