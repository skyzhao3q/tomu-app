import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson } from "../lib/formatter.js";

export function registerUsage(program: Command): void {
  const usage = program
    .command("usage")
    .description("Show API usage statistics");

  usage
    .command("show", { isDefault: true })
    .description("Show usage statistics")
    .option("--days <n>", "Number of days to show", "30")
    .option("--json", "Output raw JSON")
    .action(async (opts: { days: string; json?: boolean }) => {
      const days = parseInt(opts.days, 10);
      const data = await apiFetch<{
        total_input_tokens: number;
        total_output_tokens: number;
        total_requests: number;
        by_day: Array<{
          date: string;
          input_tokens: number;
          output_tokens: number;
          requests: number;
        }>;
        by_model: Array<{
          model_id: string;
          provider_id: string;
          input_tokens: number;
          output_tokens: number;
          requests: number;
        }>;
      }>("GET", `/usage${days !== 30 ? `?days=${days}` : ""}`);

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      console.log(`Usage (last ${days} days):`);
      console.log(`  Requests: ${data.total_requests}`);
      console.log(`  Input tokens: ${data.total_input_tokens}`);
      console.log(`  Output tokens: ${data.total_output_tokens}`);

      if (data.by_model && data.by_model.length > 0) {
        console.log("\nBy model:");
        for (const m of data.by_model) {
          console.log(
            `  ${m.model_id}: ${m.requests} requests (${m.input_tokens} in / ${m.output_tokens} out)`,
          );
        }
      }
    });

  usage
    .command("summary")
    .description("Show usage summary")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<{
        total_input_tokens: number;
        total_output_tokens: number;
        total_requests: number;
      }>("GET", "/usage/summary");

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      console.log("Usage Summary:");
      console.log(`  Total requests: ${data.total_requests}`);
      console.log(`  Total input tokens: ${data.total_input_tokens}`);
      console.log(`  Total output tokens: ${data.total_output_tokens}`);
    });
}
