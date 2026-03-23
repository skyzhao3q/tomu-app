import { embed } from "ai";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Provider } from "@tomu/core";
import { createLLMProvider } from "./llm.js";
import { decrypt } from "./crypto.js";
import { getConfigDir } from "./db.js";

function readProviders(): Provider[] {
  try {
    const raw = fs.readFileSync(
      path.join(getConfigDir(), "providers.json"),
      "utf-8",
    );
    const store = JSON.parse(raw) as { providers: Provider[] };
    return store.providers;
  } catch {
    return [];
  }
}

const EMBEDDING_MODELS: Record<string, string> = {
  gemini: "gemini-embedding-001",
  openai: "text-embedding-3-small",
};

export async function generateEmbedding(text: string): Promise<number[]> {
  const providers = readProviders().filter((p) => p.enabled !== false);

  // Prefer providers that have known embedding models
  const preferred = providers.find((p) => EMBEDDING_MODELS[p.type]);
  const provider = preferred || providers[0];

  if (!provider) {
    throw new Error("No AI provider configured for embeddings");
  }

  const apiKey = provider.api_key ? decrypt(provider.api_key) : "";
  const llm = createLLMProvider(provider, apiKey);
  const modelId = EMBEDDING_MODELS[provider.type] || "text-embedding-3-small";

  const { embedding } = await embed({
    model: llm.textEmbeddingModel(modelId),
    value: text,
  });

  return Array.from(embedding);
}
