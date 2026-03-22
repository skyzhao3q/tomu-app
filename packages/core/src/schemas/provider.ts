import { z } from "zod";

export const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider_id: z.string(),
  context_window: z.number().int().positive(),
  supports_tools: z.boolean(),
  supports_vision: z.boolean(),
});

export const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum([
    "openai",
    "anthropic",
    "gemini",
    "ollama",
    "openrouter",
    "custom",
  ]),
  api_key: z.string().optional(),
  base_url: z.string().optional(),
  enabled: z.boolean().default(true),
  models: z.array(ModelSchema).default([]),
});
