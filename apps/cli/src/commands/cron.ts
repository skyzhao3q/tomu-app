import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson, formatTable } from "../lib/formatter.js";

export function registerCron(program: Command): void {
  const cron = program.command("cron").description("Manage cron jobs");

  cron
    .command("list")
    .description("List cron jobs")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<
        Array<{ id: string; name: string; type: string; schedule: string; enabled: boolean }>
      >("GET", "/cron");

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      if (data.length === 0) {
        console.log("No cron jobs.");
        return;
      }

      console.log(
        formatTable(
          data.map((j) => ({ ...j, enabled: j.enabled ? "yes" : "no" })),
          [
            { key: "id", label: "ID" },
            { key: "name", label: "Name" },
            { key: "type", label: "Type" },
            { key: "schedule", label: "Schedule" },
            { key: "enabled", label: "Enabled" },
          ],
        ),
      );
    });

  cron
    .command("add <name> <type> <schedule>")
    .description("Add a cron job (type: at|every|cron)")
    .action(async (name: string, type: string, schedule: string) => {
      const data = await apiFetch<{ id: string; name: string }>("POST", "/cron", {
        name,
        type,
        schedule,
      });
      console.log(`✅ Cron job "${data.name}" added (ID: ${data.id})`);
    });

  cron
    .command("remove <id>")
    .description("Remove a cron job")
    .action(async (id: string) => {
      await apiFetch("DELETE", `/cron/${id}`);
      console.log(`✅ Cron job ${id} removed.`);
    });

  cron
    .command("run <id>")
    .description("Run a cron job now")
    .action(async (id: string) => {
      await apiFetch("POST", `/cron/${id}/run`);
      console.log(`✅ Cron job ${id} triggered.`);
    });

  cron
    .command("enable <id>")
    .description("Enable a cron job")
    .action(async (id: string) => {
      await apiFetch("POST", `/cron/${id}/enable`);
      console.log(`✅ Cron job ${id} enabled.`);
    });

  cron
    .command("disable <id>")
    .description("Disable a cron job")
    .action(async (id: string) => {
      await apiFetch("POST", `/cron/${id}/disable`);
      console.log(`✅ Cron job ${id} disabled.`);
    });

  cron
    .command("history <id>")
    .description("Show cron job run history")
    .option("--json", "Output raw JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      const data = await apiFetch<
        Array<{ run_at: string; status: string; output?: string }>
      >("GET", `/cron/${id}/history`);

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      if (data.length === 0) {
        console.log("No history.");
        return;
      }

      for (const entry of data) {
        console.log(`${entry.run_at}  ${entry.status}${entry.output ? `  ${entry.output}` : ""}`);
      }
    });
}
