import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson, formatTable } from "../lib/formatter.js";

export function registerProvider(program: Command): void {
  const provider = program
    .command("provider")
    .description("Manage AI providers");

  provider
    .command("list")
    .description("List configured providers")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<
        Array<{ id: string; name: string; type: string }>
      >("GET", "/providers");

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      if (data.length === 0) {
        console.log("No providers configured.");
        return;
      }

      console.log(
        formatTable(data, [
          { key: "id", label: "ID" },
          { key: "name", label: "Name" },
          { key: "type", label: "Type" },
        ]),
      );
    });

  provider
    .command("add")
    .description("Add a new provider")
    .requiredOption("--name <name>", "Provider name")
    .requiredOption("--type <type>", "Provider type (openai, anthropic, etc.)")
    .requiredOption("--api-key <key>", "API key")
    .option("--base-url <url>", "Custom base URL")
    .action(
      async (opts: {
        name: string;
        type: string;
        apiKey: string;
        baseUrl?: string;
      }) => {
        const data = await apiFetch<{ id: string; name: string }>(
          "POST",
          "/providers",
          {
            name: opts.name,
            type: opts.type,
            api_key: opts.apiKey,
            base_url: opts.baseUrl,
          },
        );
        console.log(`✅ Provider "${data.name}" added (ID: ${data.id})`);
      },
    );

  provider
    .command("delete <id>")
    .description("Delete a provider")
    .action(async (id: string) => {
      await apiFetch("DELETE", `/providers/${id}`);
      console.log(`✅ Provider ${id} deleted.`);
    });

  provider
    .command("test <id>")
    .description("Test provider connection")
    .action(async (id: string) => {
      const data = await apiFetch<{ success: boolean; error?: string }>(
        "POST",
        `/providers/${id}/test`,
      );
      if (data.success) {
        console.log("✅ Connection successful.");
      } else {
        console.error(`❌ Connection failed: ${data.error ?? "unknown error"}`);
        process.exit(1);
      }
    });

  provider
    .command("models <id>")
    .description("Fetch available models for a provider")
    .action(async (id: string) => {
      const data = await apiFetch<Array<{ id: string; name?: string }>>(
        "POST",
        `/providers/${id}/models/fetch`,
      );
      if (data.length === 0) {
        console.log("No models found.");
        return;
      }
      console.log(
        formatTable(
          data.map((m) => ({ id: m.id, name: m.name ?? m.id })),
          [
            { key: "id", label: "ID" },
            { key: "name", label: "Name" },
          ],
        ),
      );
    });

  // `tomu providers [id] [action]` — shorthand: list providers, or list models for a provider
  program
    .command("providers [id] [action]")
    .description("List providers (shorthand), or list models: providers <id> models")
    .option("--json", "Output raw JSON")
    .action(async (id: string | undefined, action: string | undefined, opts: { json?: boolean }) => {
      if (id && action === "models") {
        const data = await apiFetch<Array<{ id: string; name?: string }>>(
          "POST",
          `/providers/${id}/models/fetch`,
        );
        if (opts.json) {
          console.log(formatJson(data));
          return;
        }
        if (data.length === 0) {
          console.log("No models found.");
          return;
        }
        console.log(
          formatTable(
            data.map((m) => ({ id: m.id, name: m.name ?? m.id })),
            [
              { key: "id", label: "ID" },
              { key: "name", label: "Name" },
            ],
          ),
        );
        return;
      }

      const data = await apiFetch<Array<{ id: string; name: string; type: string }>>(
        "GET",
        "/providers",
      );
      if (opts.json) {
        console.log(formatJson(data));
        return;
      }
      if (data.length === 0) {
        console.log("No providers configured.");
        return;
      }
      console.log(
        formatTable(data, [
          { key: "id", label: "ID" },
          { key: "name", label: "Name" },
          { key: "type", label: "Type" },
        ]),
      );
    });
}
