import * as fs from "node:fs";
import * as path from "node:path";
import { getConfigDir, sqlite } from "./db.js";

interface SearchResult {
  thread_id: string;
  message_id: string;
  snippet: string;
  rank: number;
}

export function indexMessage(
  threadId: string,
  messageId: string,
  role: string,
  content: string,
): void {
  sqlite
    .prepare(
      "INSERT INTO messages_fts (thread_id, message_id, role, content) VALUES (?, ?, ?, ?)",
    )
    .run(threadId, messageId, role, content);
}

export function searchMessages(
  query: string,
  limit = 20,
): SearchResult[] {
  const rows = sqlite
    .prepare(
      `SELECT thread_id, message_id, snippet(messages_fts, 3, '<mark>', '</mark>', '...', 64) AS snippet, rank
       FROM messages_fts
       WHERE messages_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
    )
    .all(query, limit) as SearchResult[];
  return rows;
}

export function reindexThread(threadId: string): void {
  deleteThreadIndex(threadId);

  const historyPath = path.join(
    getConfigDir(),
    "workspaces",
    "default",
    ".tomu-snapshots",
    threadId,
    "history.json",
  );

  try {
    const raw = fs.readFileSync(historyPath, "utf-8");
    const data = JSON.parse(raw) as {
      messages: Array<{ id: string; role: string; content: string | unknown }>;
    };

    for (const msg of data.messages) {
      const content =
        typeof msg.content === "string" ? msg.content : "";
      if (content) {
        indexMessage(threadId, msg.id, msg.role, content);
      }
    }
  } catch {
    // Thread history not found, nothing to reindex
  }
}

export function deleteThreadIndex(threadId: string): void {
  sqlite
    .prepare("DELETE FROM messages_fts WHERE thread_id = ?")
    .run(threadId);
}
