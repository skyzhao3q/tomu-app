import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { generateText, stepCountIs } from "ai";
import type { Provider } from "@tomu/core";
import { decrypt } from "./crypto.js";
import { getConfigDir, getConfig } from "./db.js";
import { createLLMProvider } from "./llm.js";
import { agentTools } from "./tools/index.js";
import { loadAgentDefinition } from "./subagents.js";

export interface Task {
  id: string;
  type: string;
  status: "running" | "completed" | "failed";
  prompt: string;
  result?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

const tasks = new Map<string, Task>();

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

function resolveProvider(): { provider: Provider; apiKey: string; modelId: string } {
  const config = getConfig();
  const providerId = config.default_provider_id;
  if (!providerId) {
    throw new Error("No default provider configured");
  }

  const providers = readProviders();
  const provider = providers.find((p) => p.id === providerId);
  if (!provider) {
    throw new Error("Default provider not found");
  }

  const apiKey = provider.api_key ? decrypt(provider.api_key) : "";
  const modelId = config.default_model_id || provider.models[0]?.id;
  if (!modelId) {
    throw new Error("No default model configured");
  }

  return { provider, apiKey, modelId };
}

export function spawnTask(type: string, prompt: string): string {
  const definition = loadAgentDefinition(type);
  const { provider, apiKey, modelId } = resolveProvider();

  const id = crypto.randomUUID();
  const task: Task = {
    id,
    type,
    status: "running",
    prompt,
    startedAt: new Date().toISOString(),
  };
  tasks.set(id, task);

  // Build tool subset based on allowed tools
  const toolSubset: Record<string, (typeof agentTools)[keyof typeof agentTools]> = {};
  for (const toolName of definition.allowedTools) {
    if (toolName in agentTools) {
      toolSubset[toolName] = agentTools[toolName as keyof typeof agentTools];
    }
  }

  const llm = createLLMProvider(provider, apiKey);

  // Fire and forget the background generation
  (async () => {
    try {
      const { text } = await generateText({
        model: llm(modelId),
        system: definition.systemPrompt,
        messages: [{ role: "user", content: prompt }],
        tools: toolSubset,
        stopWhen: stepCountIs(10),
      });

      task.status = "completed";
      task.result = text;
      task.completedAt = new Date().toISOString();
    } catch (e) {
      task.status = "failed";
      task.error = e instanceof Error ? e.message : String(e);
      task.completedAt = new Date().toISOString();
    }
  })();

  return id;
}

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}

export function listTasks(): Task[] {
  return Array.from(tasks.values());
}

export function deleteTask(id: string): boolean {
  return tasks.delete(id);
}
