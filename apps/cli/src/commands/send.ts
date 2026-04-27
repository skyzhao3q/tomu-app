import * as fs from "node:fs";
import type { Command } from "commander";
import { apiFetch } from "../api.js";

export function registerSend(program: Command): void {
  const send = program.command("send").description("Send files to a thread or chat");

  send
    .command("photo <filePath> [caption]")
    .description("Send a photo/image to the current thread")
    .option("--thread <threadId>", "Target thread ID (defaults to TOMU_THREAD_ID env var)")
    .action(async (filePath: string, caption: string | undefined, opts: { thread?: string }) => {
      const threadId = opts.thread || process.env.TOMU_THREAD_ID;
      if (!threadId) {
        console.error("❌ No thread target. Pass --thread <id> or set TOMU_THREAD_ID env var.");
        process.exit(1);
      }
      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
      }

      const result = await apiFetch<{ ok: boolean; messageId?: string }>(
        "POST",
        `/threads/${threadId}/send-photo`,
        { filePath, caption },
      );

      if (result?.ok) {
        console.log(`✅ Sent photo to thread ${threadId}`);
      }
    });
}
