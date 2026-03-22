import { z } from "zod";

export const SkillManifestSchema = z.object({
  name: z.string(),
  description: z.string(),
  "allowed-tools": z.array(z.string()),
});

export const SkillSchema = z.object({
  id: z.string(),
  manifest: SkillManifestSchema,
  instructions: z.string(),
});
