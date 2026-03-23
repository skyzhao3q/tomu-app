import type { Command } from "commander";
import { apiFetch } from "../api.js";
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
}
