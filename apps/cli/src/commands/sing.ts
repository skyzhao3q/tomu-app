import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson } from "../lib/formatter.js";

export function registerSing(program: Command): void {
  const sing = program.command("sing").description("Song generation commands");

  sing
    .command("generate <description>")
    .description("Generate a song (Suno via PiAPI)")
    .option("--json", "Output raw JSON")
    .action(async (description: string, opts: { json?: boolean }) => {
      if (!opts.json) console.log(`Generating song: "${description}"...`);
      const data = await apiFetch<{ id?: string; url?: string; status?: string }>(
        "POST",
        "/sing/generate",
        { description },
      );

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      const location = data.url ?? data.id ?? "pending";
      console.log(`✅ Song generated: ${location}`);
    });

  sing
    .command("config <apiKey>")
    .description("Configure PiAPI API key")
    .action(async (apiKey: string) => {
      await apiFetch("POST", "/sing/config", { apiKey });
      console.log("✅ PiAPI API key configured.");
    });
}
