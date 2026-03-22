import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { Provider } from "@tomu/core";

export function createLLMProvider(
  provider: Provider,
  decryptedKey: string,
) {
  switch (provider.type) {
    case "openai":
    case "custom":
      return createOpenAI({
        apiKey: decryptedKey,
        baseURL: provider.base_url || undefined,
      });
    case "anthropic":
      return createAnthropic({ apiKey: decryptedKey });
    case "ollama":
      return createOpenAI({
        apiKey: "ollama",
        baseURL: provider.base_url || "http://localhost:11434/v1",
      });
    case "openrouter":
      return createOpenAI({
        apiKey: decryptedKey,
        baseURL: "https://openrouter.ai/api/v1",
      });
    case "gemini":
      return createGoogleGenerativeAI({ apiKey: decryptedKey });
  }
}
