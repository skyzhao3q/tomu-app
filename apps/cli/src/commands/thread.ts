import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson, truncate } from "../lib/formatter.js";

export function registerThread(program: Command): void {
  // `tomu threads [limit]` — shorthand list
  program
    .command("threads [limit]")
    .description("List threads (shorthand)")
    .option("--json", "Output raw JSON")
    .action(async (limit: string | undefined, opts: { json?: boolean }) => {
      const qs = limit ? `?limit=${limit}` : "";
      const data = await apiFetch<{
        threads: Array<{
          id: string;
          title: string;
          updatedAt?: string;
          updated_at?: string;
          parentId?: string;
        }>;
      }>("GET", `/threads${qs}`);

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      const threads = data.threads ?? [];
      if (threads.length === 0) {
        console.log("No threads.");
        return;
      }

      for (const t of threads) {
        const date = (t.updatedAt ?? t.updated_at ?? "").slice(0, 10);
        const parent = t.parentId ? ` (← ${t.parentId})` : "";
        console.log(`${t.id}  ${date}  ${truncate(t.title, 60)}${parent}`);
      }
    });

  // `tomu thread <subcommand>` — full management
  const thread = program.command("thread").description("Manage threads");

  thread
    .command("create <title>")
    .description("Create a new thread")
    .action(async (title: string) => {
      const data = await apiFetch<{ id: string; title: string }>("POST", "/threads", {
        title,
      });
      console.log(`✅ Created thread: ${data.id}  ${data.title}`);
    });

  thread
    .command("delete <id>")
    .description("Delete a thread")
    .action(async (id: string) => {
      await apiFetch("DELETE", `/threads/${id}`);
      console.log(`✅ Deleted thread ${id}`);
    });

  thread
    .command("search <query>")
    .description("Search threads")
    .option("--limit <n>", "Max results")
    .option("--json", "Output raw JSON")
    .action(async (query: string, opts: { limit?: string; json?: boolean }) => {
      const data = await apiFetch<{
        threads: Array<{ id: string; title: string; updatedAt?: string; updated_at?: string }>;
      }>("POST", "/threads/search", {
        query,
        limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
      });

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      const threads = data.threads ?? [];
      if (threads.length === 0) {
        console.log("No threads found.");
        return;
      }

      for (const t of threads) {
        const date = (t.updatedAt ?? t.updated_at ?? "").slice(0, 10);
        console.log(`${t.id}  ${date}  ${truncate(t.title, 60)}`);
      }
    });

  thread
    .command("messages <id> [limit]")
    .description("Show messages in a thread")
    .option("--json", "Output raw JSON")
    .action(async (id: string, limit: string | undefined, opts: { json?: boolean }) => {
      const qs = limit ? `?limit=${limit}` : "";
      const data = await apiFetch<{
        messages?: Array<{ role: string; content: string }>;
        thread?: { messages?: Array<{ role: string; content: string }> };
      }>("GET", `/threads/${id}${qs}`);

      const messages =
        (data as { messages?: Array<{ role: string; content: string }> }).messages ??
        data.thread?.messages ??
        [];

      if (opts.json) {
        console.log(formatJson(messages));
        return;
      }

      if (messages.length === 0) {
        console.log("No messages.");
        return;
      }

      for (const msg of messages) {
        console.log(`[${msg.role}] ${truncate(msg.content, 120)}`);
      }
    });

  thread
    .command("compact <id>")
    .description("Compact a thread (summarize old messages)")
    .action(async (id: string) => {
      await apiFetch("POST", `/threads/${id}/compact`);
      console.log(`✅ Thread ${id} compacted.`);
    });

  thread
    .command("switch <id>")
    .description("Switch to a thread")
    .option("--from <id>", "Previous thread ID")
    .action(async (id: string, opts: { from?: string }) => {
      await apiFetch("POST", `/threads/${id}/switch`, opts.from ? { from: opts.from } : {});
      console.log(`✅ Switched to thread ${id}`);
    });
}
