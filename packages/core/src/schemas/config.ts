import { z } from "zod";

export const ConfigSchema = z.object({
  theme: z.enum(["dark", "light", "system"]).default("system"),
  language: z.enum(["en", "ja", "zh"]).default("en"),
  default_provider_id: z.string().optional(),
  default_model_id: z.string().optional(),
  embedding_provider_id: z.string().optional(),
  embedding_model_id: z.string().optional(),
  agent_max_iterations: z.number().int().positive().default(25),
  agents_enabled: z.boolean().default(true),
  agents_allow_delegation: z.boolean().default(true),
});

export const WorkspaceSchema = z.object({
  id: z.string(),
  path: z.string(),
  history_file: z.string(),
});
