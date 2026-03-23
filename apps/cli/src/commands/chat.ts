import type { Command } from "commander";
import { apiFetch, apiFetchRaw } from "../api.js";
import { formatJson, formatTable } from "../lib/formatter.js";
import { truncate } from "../lib/formatter.js";

export function registerChat(program: Command): void {
  const chat = program.command("chat").description("Manage chat threads");

  chat
    .command("list")
    .description("List chat threads")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<
        Array<{ id: string; title: string; created_at: string; updated_at: string }>
      >("GET", "/threads");

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      if (data.length === 0) {
        console.log("No chat threads.");
        return;
      }

      console.log(
        formatTable(data, [
          { key: "id", label: "ID" },
          { key: "title", label: "Title" },
          { key: "created_at", label: "Created" },
          { key: "updated_at", label: "Updated" },
        ]),
      );
    });

  chat
    .command("history <id>")
    .description("Show thread history")
    .option("--json", "Output raw JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      const data = await apiFetch<{
        id: string;
        title: string;
        messages: Array<{ role: string; content: string }>;
      }>("GET", `/threads/${id}`);

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      console.log(`Thread: ${data.title} (${data.id})`);
      console.log("─".repeat(40));
      if (!data.messages || data.messages.length === 0) {
        console.log("No messages.");
        return;
      }
      for (const msg of data.messages) {
        const role = msg.role === "user" ? "👤 User" : "🤖 Assistant";
        console.log(`\n${role}:`);
        console.log(msg.content);
      }
    });

  chat
    .command("new")
    .description("Create a new chat thread")
    .action(async () => {
      const data = await apiFetch<{ id: string; title: string }>(
        "POST",
        "/threads",
        {},
      );
      console.log(`✅ New thread created: ${data.id}`);
    });

  chat
    .command("delete <id>")
    .description("Delete a chat thread")
    .action(async (id: string) => {
      await apiFetch("DELETE", `/threads/${id}`);
      console.log(`✅ Thread ${id} deleted.`);
    });

  chat
    .command("search <query>")
    .description("Search chat threads")
    .option("--limit <n>", "Max results", "20")
    .option("--json", "Output raw JSON")
    .action(async (query: string, opts: { limit: string; json?: boolean }) => {
      const data = await apiFetch<
        Array<{ thread_id: string; title?: string; snippet: string; rank: number }>
      >("POST", "/threads/search", { query, limit: parseInt(opts.limit, 10) });

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      if (data.length === 0) {
        console.log("No results found.");
        return;
      }

      console.log(
        formatTable(
          data.map((r) => ({
            thread_id: r.thread_id,
            snippet: truncate(r.snippet, 60),
          })),
          [
            { key: "thread_id", label: "Thread ID" },
            { key: "snippet", label: "Snippet", width: 60 },
          ],
        ),
      );
    });

  chat
    .command("send <message>")
    .description("Send a message (SSE streaming)")
    .option("--thread <id>", "Thread ID")
    .option("--model <model>", "Model to use")
    .option("--json", "Output structured JSON")
    .action(
      async (
        message: string,
        opts: { thread?: string; model?: string; json?: boolean },
      ) => {
        const body: Record<string, unknown> = {
          messages: [{ role: "user", content: message }],
          stream: !opts.json,
        };
        if (opts.thread) body.thread_id = opts.thread;
        if (opts.model) body.model = opts.model;

        if (opts.json) {
          const data = await apiFetch("POST", "/chat/completions", body);
          console.log(formatJson(data));
          return;
        }

        // SSE streaming
        const response = await apiFetchRaw("POST", "/chat/completions", body);
        if (!response.ok) {
          console.error(`❌ Error: ${response.status} ${response.statusText}`);
          process.exit(1);
        }

        if (!response.body) {
          console.error("❌ No response body.");
          process.exit(1);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                process.stdout.write("\n");
                return;
              }
              try {
                const parsed = JSON.parse(data) as {
                  choices?: Array<{
                    delta?: { content?: string };
                  }>;
                };
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  process.stdout.write(content);
                }
              } catch {
                // skip malformed SSE
              }
            }
          }
        }
        process.stdout.write("\n");
      },
    );
}
