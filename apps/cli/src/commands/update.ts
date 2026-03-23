import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson } from "../lib/formatter.js";

export function registerUpdate(program: Command): void {
  const update = program.command("update").description("Check and install updates");

  // Default action: check for updates
  update.action(async () => {
    const data = await apiFetch<{ current: string; latest?: string; updateAvailable?: boolean }>(
      "GET",
      "/update/check",
    );
    if (data.updateAvailable) {
      console.log(`Update available: ${data.current} → ${data.latest}`);
    } else {
      console.log(`✅ Already up to date (${data.current})`);
    }
  });

  update
    .command("check")
    .description("Check for updates")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<{ current: string; latest?: string; updateAvailable?: boolean }>(
        "GET",
        "/update/check",
      );
      if (opts.json) {
        console.log(formatJson(data));
        return;
      }
      if (data.updateAvailable) {
        console.log(`Update available: ${data.current} → ${data.latest}`);
      } else {
        console.log(`✅ Already up to date (${data.current})`);
      }
    });

  update
    .command("download")
    .description("Download latest update")
    .action(async () => {
      console.log("Downloading update...");
      const data = await apiFetch<{ status: string; path?: string }>("POST", "/update/download");
      console.log(`✅ ${data.status}`);
    });

  update
    .command("install")
    .description("Install downloaded update")
    .action(async () => {
      console.log("Installing update...");
      const data = await apiFetch<{ status: string }>("POST", "/update/install");
      console.log(`✅ ${data.status}`);
    });
}
