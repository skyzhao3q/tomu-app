import { z } from "zod";

export const VectorMemorySchema = z.object({
  memory_id: z.string(),
  content: z.string(),
  type: z.enum(["message", "note", "temporary"]),
  /** Float32Array — validated at runtime as an instanceof check */
  embedding: z.instanceof(Float32Array),
  metadata: z.record(z.unknown()),
});
