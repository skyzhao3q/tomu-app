import type { Command } from "commander";
import { apiFetch } from "../api.js";

export function registerDm(program: Command): void {
  program
    .command("dm <userId> <message>")
    .description("Send a private DM to a Telegram user")
    .action(async (userId: string, message: string) => {
      await apiFetch("POST", "/dm", { userId, message });
      console.log(`✅ DM sent to ${userId}`);
    });
}
