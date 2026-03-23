import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson } from "../lib/formatter.js";

export function registerHeartbeat(program: Command): void {
  const heartbeat = program
    .command("heartbeat")
    .description("Manage heartbeat agent");

  // Default action: show status
  heartbeat.action(async () => {
    const data = await apiFetch<{ enabled: boolean; interval?: number; status?: string }>(
      "GET",
      "/heartbeat",
    );
    console.log(`Heartbeat: ${data.enabled ? "enabled" : "disabled"}`);
    if (data.interval !== undefined) console.log(`Interval: ${data.interval}m`);
    if (data.status) console.log(`Status: ${data.status}`);
  });

  heartbeat
    .command("status")
    .description("Show heartbeat agent status")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<{ enabled: boolean; interval?: number; status?: string }>(
        "GET",
        "/heartbeat",
      );
      if (opts.json) {
        console.log(formatJson(data));
        return;
      }
      console.log(`Heartbeat: ${data.enabled ? "enabled" : "disabled"}`);
      if (data.interval !== undefined) console.log(`Interval: ${data.interval}m`);
      if (data.status) console.log(`Status: ${data.status}`);
    });

  heartbeat
    .command("config")
    .description("Show heartbeat configuration")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<Record<string, unknown>>("GET", "/heartbeat/config");
      if (opts.json) {
        console.log(formatJson(data));
        return;
      }
      for (const [key, value] of Object.entries(data)) {
        console.log(`${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
      }
    });

  heartbeat
    .command("enable")
    .description("Enable heartbeat")
    .action(async () => {
      await apiFetch("POST", "/heartbeat/enable");
      console.log("✅ Heartbeat enabled.");
    });

  heartbeat
    .command("disable")
    .description("Disable heartbeat")
    .action(async () => {
      await apiFetch("POST", "/heartbeat/disable");
      console.log("✅ Heartbeat disabled.");
    });

  heartbeat
    .command("interval <minutes>")
    .description("Set heartbeat interval in minutes")
    .action(async (minutes: string) => {
      const interval = parseInt(minutes, 10);
      await apiFetch("POST", "/heartbeat/interval", { interval });
      console.log(`✅ Heartbeat interval set to ${interval}m.`);
    });

  heartbeat
    .command("patrol <action>")
    .description("Group chat proactive patrol (enable|disable|config)")
    .option("--json", "Output raw JSON")
    .action(async (action: string, opts: { json?: boolean }) => {
      const data = await apiFetch<Record<string, unknown>>("POST", "/heartbeat/patrol", { action });
      if (opts.json) {
        console.log(formatJson(data));
        return;
      }
      console.log(`✅ Patrol ${action} applied.`);
    });
}
