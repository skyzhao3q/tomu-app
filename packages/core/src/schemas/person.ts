import { z } from "zod";

export const PersonSchema = z.object({
  name: z.string(),
  metadata: z.record(z.unknown()),
  notes: z.string(),
});
