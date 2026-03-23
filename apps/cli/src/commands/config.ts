import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson, formatTable } from "../lib/formatter.js";
import { getNestedValue, setNestedValue, parseValue } from "../lib/config-path.js";

export function registerConfig(program: Command): void {
  const config = program
    .command("config")
    .description("Manage application settings");

  config
    .command("list")
    .description("List all settings")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<Record<string, unknown>>("GET", "/settings");

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      const rows = Object.entries(data).map(([key, value]) => ({
        key,
        value: typeof value === "object" ? JSON.stringify(value) : String(value),
      }));
      console.log(
        formatTable(rows, [
          { key: "key", label: "Key" },
          { key: "value", label: "Value" },
        ]),
      );
    });

  config
    .command("get <key>")
    .description("Get a setting value (supports dot notation: chat.defaultModel)")
    .action(async (key: string) => {
      const data = await apiFetch<Record<string, unknown>>("GET", "/settings");
      const value = getNestedValue(data, key);
      if (value === undefined) {
        console.error(`❌ Key not found: ${key}`);
        process.exit(1);
      }
      console.log(typeof value === "object" ? JSON.stringify(value) : String(value));
    });

  config
    .command("set <key> <value>")
    .description("Set a setting value (supports dot notation: chat.defaultModel gpt-4)")
    .action(async (key: string, rawValue: string) => {
      const current = await apiFetch<Record<string, unknown>>("GET", "/settings");
      const parsed = parseValue(rawValue);
      setNestedValue(current, key, parsed);
      await apiFetch<Record<string, unknown>>("PUT", "/settings", current);
      console.log(`✅ Updated ${key} = ${rawValue}`);
    });
}
