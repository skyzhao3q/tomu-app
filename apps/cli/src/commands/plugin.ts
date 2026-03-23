import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson, formatTable } from "../lib/formatter.js";

export function registerPlugin(program: Command): void {
  const plugin = program.command("plugin").description("Manage plugins");

  plugin
    .command("list")
    .description("List installed plugins")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<
        Array<{
          name: string;
          version: string;
          description: string;
          enabled: boolean;
        }>
      >("GET", "/plugins");

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      if (data.length === 0) {
        console.log("No plugins installed.");
        return;
      }

      console.log(
        formatTable(
          data.map((p) => ({ ...p, enabled: p.enabled ? "yes" : "no" })),
          [
            { key: "name", label: "Name" },
            { key: "version", label: "Version" },
            { key: "description", label: "Description", width: 40 },
            { key: "enabled", label: "Enabled" },
          ],
        ),
      );
    });

  plugin
    .command("install")
    .description("Install a plugin")
    .requiredOption("--source <source>", "Plugin source (URL or path)")
    .action(async (opts: { source: string }) => {
      await apiFetch("POST", "/plugins", { source: opts.source });
      console.log(`✅ Plugin installed from ${opts.source}.`);
    });

  plugin
    .command("remove <name>")
    .description("Remove a plugin")
    .action(async (name: string) => {
      await apiFetch("DELETE", `/plugins/${encodeURIComponent(name)}`);
      console.log(`✅ Plugin "${name}" removed.`);
    });
}
