import * as crypto from "node:crypto";
import { sqlite } from "./db.js";
import { generateEmbedding } from "./embeddings.js";

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function storeMemory(
  content: string,
  type: "message" | "note" | "temporary",
  threadId?: string,
  metadata?: Record<string, unknown>,
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const embedding = await generateEmbedding(content);

  sqlite
    .prepare(
      `INSERT INTO memory_vectors (id, content, type, embedding, metadata, thread_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      content,
      type,
      JSON.stringify(embedding),
      metadata ? JSON.stringify(metadata) : null,
      threadId ?? null,
      now,
      now,
    );

  return id;
}

export interface MemorySearchResult {
  id: string;
  content: string;
  type: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
  thread_id: string | null;
  created_at: string;
}

export async function searchMemories(
  query: string,
  limit = 5,
): Promise<MemorySearchResult[]> {
  const queryEmbedding = await generateEmbedding(query);

  const rows = sqlite
    .prepare(
      "SELECT id, content, type, embedding, metadata, thread_id, created_at FROM memory_vectors",
    )
    .all() as Array<{
    id: string;
    content: string;
    type: string;
    embedding: string;
    metadata: string | null;
    thread_id: string | null;
    created_at: string;
  }>;

  const scored = rows.map((row) => {
    const emb = JSON.parse(row.embedding) as number[];
    return {
      id: row.id,
      content: row.content,
      type: row.type,
      similarity: cosineSimilarity(queryEmbedding, emb),
      metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
      thread_id: row.thread_id,
      created_at: row.created_at,
    };
  });

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, limit);
}

export function deleteMemory(id: string): boolean {
  const result = sqlite
    .prepare("DELETE FROM memory_vectors WHERE id = ?")
    .run(id);
  return result.changes > 0;
}

export function listMemories(
  limit = 50,
  offset = 0,
  type?: string,
): Array<{
  id: string;
  content: string;
  type: string;
  metadata: Record<string, unknown> | null;
  thread_id: string | null;
  created_at: string;
  updated_at: string;
}> {
  const query = type
    ? "SELECT id, content, type, metadata, thread_id, created_at, updated_at FROM memory_vectors WHERE type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
    : "SELECT id, content, type, metadata, thread_id, created_at, updated_at FROM memory_vectors ORDER BY created_at DESC LIMIT ? OFFSET ?";

  const params = type ? [type, limit, offset] : [limit, offset];

  const rows = sqlite.prepare(query).all(...params) as Array<{
    id: string;
    content: string;
    type: string;
    metadata: string | null;
    thread_id: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    ...row,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
  }));
}

export function getMemoryStats(): {
  total: number;
  by_type: Record<string, number>;
  db_size_bytes: number;
} {
  const countRow = sqlite
    .prepare("SELECT COUNT(*) as count FROM memory_vectors")
    .get() as { count: number };

  const typeRows = sqlite
    .prepare("SELECT type, COUNT(*) as count FROM memory_vectors GROUP BY type")
    .all() as Array<{ type: string; count: number }>;

  const by_type: Record<string, number> = {};
  for (const row of typeRows) {
    by_type[row.type] = row.count;
  }

  const pageCount = (sqlite.pragma("page_count") as Array<{ page_count: number }>)[0]?.page_count ?? 0;
  const pageSize = (sqlite.pragma("page_size") as Array<{ page_size: number }>)[0]?.page_size ?? 0;
  const db_size_bytes = pageCount * pageSize;

  return { total: countRow.count, by_type, db_size_bytes };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export function cleanupStaleMemories(): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const result = sqlite
    .prepare(
      "DELETE FROM memory_vectors WHERE type = 'temporary' AND created_at < ?",
    )
    .run(cutoff.toISOString());
  return result.changes;
}

// ---------------------------------------------------------------------------
// Rebuild embeddings
// ---------------------------------------------------------------------------

export async function rebuildAllEmbeddings(): Promise<number> {
  const rows = sqlite
    .prepare("SELECT id, content FROM memory_vectors")
    .all() as Array<{ id: string; content: string }>;

  const updateStmt = sqlite.prepare(
    "UPDATE memory_vectors SET embedding = ?, updated_at = ? WHERE id = ?",
  );

  let updated = 0;
  for (const row of rows) {
    const embedding = await generateEmbedding(row.content);
    updateStmt.run(JSON.stringify(embedding), new Date().toISOString(), row.id);
    updated++;
  }

  return updated;
}
