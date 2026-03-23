import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson, formatTable } from "../lib/formatter.js";

export function registerTask(program: Command): void {
  const task = program.command("task").description("Manage sub-agent tasks");

  task
    .command("list")
    .description("List tasks")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<
        Array<{ id: string; subagent_type?: string; status?: string; created_at?: string }>
      >("GET", "/tasks");

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      if (data.length === 0) {
        console.log("No tasks found.");
        return;
      }

      console.log(
        formatTable(data, [
          { key: "id", label: "ID" },
          { key: "subagent_type", label: "Type" },
          { key: "status", label: "Status" },
          { key: "created_at", label: "Created" },
        ]),
      );
    });

  task
    .command("get <id>")
    .description("Get task details")
    .option("--json", "Output raw JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      const data = await apiFetch<{
        id: string;
        subagent_type: string;
        prompt: string;
        status: string;
        result?: string;
      }>("GET", `/tasks/${id}`);

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      console.log(`Task: ${data.id}`);
      console.log(`Type: ${data.subagent_type}`);
      console.log(`Status: ${data.status}`);
      console.log(`Prompt: ${data.prompt}`);
      if (data.result) console.log(`Result: ${data.result}`);
    });

  task
    .command("create")
    .description("Create a new task")
    .requiredOption("--type <type>", "Sub-agent type")
    .requiredOption("--prompt <prompt>", "Task prompt")
    .action(async (opts: { type: string; prompt: string }) => {
      const data = await apiFetch<{ id: string }>("POST", "/tasks", {
        subagent_type: opts.type,
        prompt: opts.prompt,
      });
      console.log(`✅ Task created (ID: ${data.id})`);
    });

  task
    .command("delete <id>")
    .description("Delete a task")
    .action(async (id: string) => {
      await apiFetch("DELETE", `/tasks/${id}`);
      console.log(`✅ Task ${id} deleted.`);
    });
}
