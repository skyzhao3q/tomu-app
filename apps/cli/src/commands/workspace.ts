import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson, formatTable } from "../lib/formatter.js";

export function registerWorkspace(program: Command): void {
  const workspace = program.command("workspace").description("Manage workspaces");

  workspace
    .command("list")
    .description("List workspaces")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<Array<{ id: string; name: string; path: string }>>(
        "GET",
        "/workspaces",
      );

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      if (data.length === 0) {
        console.log("No workspaces.");
        return;
      }

      console.log(
        formatTable(data, [
          { key: "id", label: "ID" },
          { key: "name", label: "Name" },
          { key: "path", label: "Path" },
        ]),
      );
    });

  workspace
    .command("set <id> <path>")
    .description("Update workspace path")
    .action(async (id: string, path: string) => {
      await apiFetch("PUT", `/workspaces/${id}`, { path });
      console.log(`✅ Workspace ${id} path set to ${path}`);
    });
}
