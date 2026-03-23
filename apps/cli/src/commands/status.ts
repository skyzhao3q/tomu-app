import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson } from "../lib/formatter.js";
import { ConnectionError } from "../lib/errors.js";

export function registerStatus(program: Command): void {
  program
    .command("status")
    .alias("health")
    .description("Check if API server is running")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        const data = await apiFetch<{
          status: string;
          version?: string;
          uptime?: number;
        }>("GET", "/health");

        if (opts.json) {
          console.log(formatJson(data));
          return;
        }

        console.log("✅ API Server is running");
        if (data.version) console.log(`   Version: ${data.version}`);
        if (data.uptime !== undefined)
          console.log(`   Uptime: ${Math.floor(data.uptime)}s`);
      } catch (e) {
        if (e instanceof ConnectionError) {
          console.error("❌ API Server is not running or unreachable.");
          process.exit(1);
        }
        throw e;
      }
    });
}
