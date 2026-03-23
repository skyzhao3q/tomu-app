import type { Command } from "commander";
import { apiFetch } from "../api.js";

export function registerMsg(program: Command): void {
  const msg = program.command("msg").description("Manage messages");

  msg
    .command("delete <chatId> <messageId>")
    .description("Delete (retract) a message")
    .action(async (chatId: string, messageId: string) => {
      await apiFetch("DELETE", `/messages/${chatId}/${messageId}`);
      console.log(`✅ Message ${messageId} deleted from chat ${chatId}`);
    });
}
