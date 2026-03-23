import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson, formatTable } from "../lib/formatter.js";
import { setNestedValue } from "../lib/config-path.js";

export function registerModel(program: Command): void {
  const model = program.command("model").description("Manage AI model settings");

  model
    .command("set <provider:model>")
    .description("Set the default model (e.g. anthropic:claude-sonnet-4-6)")
    .action(async (providerModel: string) => {
      const current = await apiFetch<Record<string, unknown>>("GET", "/settings");
      setNestedValue(current, "chat.defaultModel", providerModel);
      await apiFetch("PUT", "/settings", current);
      console.log(`✅ Default model set to ${providerModel}`);
    });

  // `tomu models` — list all available models
  program
    .command("models")
    .description("List all available models")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<Array<{ id: string; name?: string; provider?: string }>>(
        "GET",
        "/models",
      );
      if (opts.json) {
        console.log(formatJson(data));
        return;
      }
      if (data.length === 0) {
        console.log("No models available.");
        return;
      }
      console.log(
        formatTable(
          data.map((m) => ({ id: m.id, name: m.name ?? m.id, provider: m.provider ?? "" })),
          [
            { key: "id", label: "ID" },
            { key: "name", label: "Name" },
            { key: "provider", label: "Provider" },
          ],
        ),
      );
    });
}
