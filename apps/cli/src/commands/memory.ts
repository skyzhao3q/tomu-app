import type { Command } from "commander";
import { apiFetch } from "../api.js";
import { formatJson, formatTable, truncate } from "../lib/formatter.js";

export function registerMemory(program: Command): void {
  const memory = program.command("memory").description("Manage memory (RAG)");

  memory
    .command("list")
    .description("List memories")
    .option("--limit <n>", "Max results")
    .option("--type <type>", "Filter by type")
    .option("--json", "Output raw JSON")
    .action(async (opts: { limit?: string; type?: string; json?: boolean }) => {
      const params = new URLSearchParams();
      if (opts.limit) params.set("limit", opts.limit);
      if (opts.type) params.set("type", opts.type);
      const qs = params.toString();

      const data = await apiFetch<{
        memories: Array<{
          id: string;
          content: string;
          type: string;
          created_at: string;
        }>;
      }>("GET", `/memories${qs ? `?${qs}` : ""}`);

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      if (!data.memories || data.memories.length === 0) {
        console.log("No memories found.");
        return;
      }

      console.log(
        formatTable(
          data.memories.map((m) => ({
            ...m,
            content: truncate(m.content, 40),
          })),
          [
            { key: "id", label: "ID" },
            { key: "content", label: "Content", width: 40 },
            { key: "type", label: "Type" },
            { key: "created_at", label: "Created" },
          ],
        ),
      );
    });

  memory
    .command("stats")
    .description("Show memory statistics")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<{
        total?: number;
        count?: number;
        by_type?: Record<string, number>;
        types?: Record<string, number>;
        db_size_bytes?: number;
      }>("GET", "/memories/stats");

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      const total = data.total ?? data.count ?? 0;
      const byType = data.by_type ?? data.types ?? {};

      console.log(`Total memories: ${total}`);
      if (Object.keys(byType).length > 0) {
        console.log("By type:");
        for (const [type, count] of Object.entries(byType)) {
          console.log(`  ${type}: ${count}`);
        }
      }
      if (data.db_size_bytes !== undefined) {
        console.log(`Database size: ${(data.db_size_bytes / 1024).toFixed(1)} KB`);
      }
    });

  memory
    .command("search <query>")
    .description("Search memories")
    .option("--json", "Output raw JSON")
    .action(async (query: string, opts: { json?: boolean }) => {
      console.log(`🔍 Searching memory for: "${query}"...`);
      const data = await apiFetch<
        Array<{ id: string; content: string; type: string; score?: number }>
      >("POST", "/memories/search", { query });

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      if (data.length === 0) {
        console.log("No memories found.");
        return;
      }

      data.forEach((mem, index) => {
        const score =
          mem.score !== undefined ? ` (${Math.round(mem.score * 100)}%)` : "";
        console.log(`\n[${index + 1}] ID: ${mem.id}${score}`);
        console.log(`${mem.content}`);
      });
    });

  memory
    .command("add [content]")
    .description("Add a new memory")
    .option("--content <text>", "Memory content (alternative to positional arg)")
    .option("--type <type>", "Memory type", "note")
    .action(async (positional: string | undefined, opts: { content?: string; type: string }) => {
      const content = positional ?? opts.content;
      if (!content) {
        console.error("❌ Content required. Usage: memory add <content>");
        process.exit(1);
      }
      const data = await apiFetch<{ id: string }>("POST", "/memories", {
        content,
        type: opts.type,
      });
      console.log(`✅ Memory added (ID: ${data.id})`);
    });

  memory
    .command("delete <id>")
    .description("Delete a memory")
    .action(async (id: string) => {
      await apiFetch("DELETE", `/memories/${id}`);
      console.log(`✅ Memory ${id} deleted.`);
    });

  memory
    .command("rebuild")
    .description("Rebuild embeddings")
    .action(async () => {
      console.log("Rebuilding embeddings...");
      const data = await apiFetch<{ status: string }>(
        "POST",
        "/memories/rebuild",
      );
      console.log(`✅ ${data.status}`);
    });

  memory
    .command("cleanup")
    .description("Clean up orphaned memories")
    .action(async () => {
      const data = await apiFetch<{ deleted: number }>(
        "DELETE",
        "/memories/cleanup",
      );
      console.log(`✅ Cleaned up ${data.deleted} memories.`);
    });

  memory
    .command("grep <keyword>")
    .description("Search archived thread files locally")
    .action((keyword: string) => {
      const { readdirSync, readFileSync, existsSync } = require("fs") as typeof import("fs");
      const { join } = require("path") as typeof import("path");
      const { homedir } = require("os") as typeof import("os");

      const archiveDir = join(
        homedir(),
        ".config",
        "tomu",
        "workspaces",
        "default",
        "threads",
      );

      if (!existsSync(archiveDir)) {
        console.log("No local thread archive found.");
        return;
      }

      const files = readdirSync(archiveDir).filter((f) => f.endsWith(".md"));
      if (files.length === 0) {
        console.log("No archived threads.");
        return;
      }

      const lc = keyword.toLowerCase();
      let found = 0;
      for (const file of files) {
        const content = readFileSync(join(archiveDir, file), "utf-8");
        const lines = content.split("\n");
        const matches = lines.filter((l) => l.toLowerCase().includes(lc));
        if (matches.length > 0) {
          console.log(`\n📄 ${file}:`);
          matches.forEach((l) => console.log(`  ${l.trim()}`));
          found += matches.length;
        }
      }

      if (found === 0) {
        console.log(`No matches for "${keyword}".`);
      }
    });

  memory
    .command("archive")
    .description("Trigger thread archiving")
    .action(async () => {
      const data = await apiFetch<{ archived?: number; status?: string }>(
        "POST",
        "/threads/archive",
      );
      const count = data.archived ?? 0;
      console.log(`✅ Archived ${count} threads.`);
    });
}
