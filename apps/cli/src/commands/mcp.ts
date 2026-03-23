import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson, formatTable } from "../lib/formatter.js";

export function registerMcp(program: Command): void {
  const mcp = program.command("mcp").description("Manage MCP servers");

  mcp
    .command("list")
    .description("List MCP servers")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<
        Array<{ name: string; command: string; args: string[] }>
      >("GET", "/mcp/servers");

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      if (data.length === 0) {
        console.log("No MCP servers configured.");
        return;
      }

      console.log(
        formatTable(
          data.map((s) => ({ ...s, args: s.args.join(" ") })),
          [
            { key: "name", label: "Name" },
            { key: "command", label: "Command" },
            { key: "args", label: "Args" },
          ],
        ),
      );
    });

  mcp
    .command("add")
    .description("Add an MCP server")
    .requiredOption("--name <name>", "Server name")
    .requiredOption("--command <cmd>", "Server command")
    .option("--args <args>", "Command arguments (comma-separated)")
    .option("--env <env>", "Environment variables (KEY=VAL,KEY=VAL)")
    .action(
      async (opts: {
        name: string;
        command: string;
        args?: string;
        env?: string;
      }) => {
        const args = opts.args ? opts.args.split(",") : [];
        const env: Record<string, string> = {};
        if (opts.env) {
          for (const pair of opts.env.split(",")) {
            const [k, v] = pair.split("=");
            if (k && v) env[k] = v;
          }
        }

        await apiFetch("POST", "/mcp/servers", {
          name: opts.name,
          command: opts.command,
          args,
          env,
        });
        console.log(`✅ MCP server "${opts.name}" added.`);
      },
    );

  mcp
    .command("remove <name>")
    .description("Remove an MCP server")
    .action(async (name: string) => {
      await apiFetch("DELETE", `/mcp/servers/${encodeURIComponent(name)}`);
      console.log(`✅ MCP server "${name}" removed.`);
    });
}
