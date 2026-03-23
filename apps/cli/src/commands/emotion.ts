import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson } from "../lib/formatter.js";

export function registerEmotion(program: Command): void {
  const emotion = program.command("emotion").description("Manage emotion state");

  // Default action: show status
  emotion.action(async () => {
    const data = await apiFetch<{ mood: string; energy?: number; valence?: number }>(
      "GET",
      "/emotion",
    );
    console.log(`Mood: ${data.mood}`);
    if (data.energy !== undefined) console.log(`Energy: ${data.energy}`);
    if (data.valence !== undefined) console.log(`Valence: ${data.valence}`);
  });

  emotion
    .command("status")
    .description("Show current emotion state")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<{ mood: string; energy?: number; valence?: number }>(
        "GET",
        "/emotion",
      );
      if (opts.json) {
        console.log(formatJson(data));
        return;
      }
      console.log(`Mood: ${data.mood}`);
      if (data.energy !== undefined) console.log(`Energy: ${data.energy}`);
      if (data.valence !== undefined) console.log(`Valence: ${data.valence}`);
    });

  emotion
    .command("set-base <mood> <energy> <valence> <description>")
    .description("Set base emotion state")
    .action(async (mood: string, energy: string, valence: string, description: string) => {
      await apiFetch("POST", "/emotion/base", {
        mood,
        energy: parseFloat(energy),
        valence: parseFloat(valence),
        description,
      });
      console.log("✅ Base emotion updated.");
    });

  emotion
    .command("set-context <chatId> <mood> <valence> <trigger>")
    .description("Set context-specific emotion")
    .action(async (chatId: string, mood: string, valence: string, trigger: string) => {
      await apiFetch("POST", "/emotion/context", {
        chatId,
        mood,
        valence: parseFloat(valence),
        trigger,
      });
      console.log(`✅ Context emotion set for chat ${chatId}`);
    });

  emotion
    .command("get [chatId]")
    .description("Get blended emotion state (JSON)")
    .action(async (chatId: string | undefined) => {
      const endpoint = chatId ? `/emotion/${chatId}` : "/emotion";
      const data = await apiFetch<Record<string, unknown>>("GET", endpoint);
      console.log(formatJson(data));
    });
}
