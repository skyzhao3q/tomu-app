import { Router, type Router as RouterType } from "express";
import { streamText, generateText, stepCountIs } from "ai";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { Provider, Message } from "@tomu/core";
import { decrypt } from "../crypto.js";
import { getConfig, getConfigDir, sqlite } from "../db.js";
import { createLLMProvider } from "../llm.js";
import { buildSystemPrompt } from "../context.js";
import { triggerAutoTitle } from "./threads.js";
import { agentTools, taskTools, redactSecrets } from "../tools/index.js";
import { storeMemory } from "../memory.js";

const router: RouterType = Router();

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

// ---------------------------------------------------------------------------
// Auto memory extraction (fire-and-forget)
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT =
  "Extract key facts, decisions, or user preferences from this conversation that would be useful to remember for future conversations. Output a JSON array of strings. If nothing worth remembering, output [].";

function triggerMemoryExtraction(
  userContent: string,
  assistantContent: string,
  threadId: string,
  provider: Provider,
  apiKey: string,
  modelId: string,
): void {
  (async () => {
    try {
      const llm = createLLMProvider(provider, apiKey);
      const prompt = [
        EXTRACTION_PROMPT,
        "",
        "User: " + userContent,
        "",
        "Assistant: " + assistantContent,
      ].join("\n");

      const { text } = await generateText({
        model: llm(modelId),
        messages: [{ role: "user", content: prompt }],
      });

      // Parse the JSON array from the response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return;

      const facts = JSON.parse(jsonMatch[0]) as string[];
      if (!Array.isArray(facts) || facts.length === 0) return;

      for (const fact of facts) {
        if (typeof fact === "string" && fact.trim()) {
          await storeMemory(fact.trim(), "temporary", threadId);
        }
      }
    } catch (e) {
      console.warn("Memory extraction failed:", e instanceof Error ? e.message : e);
    }
  })();
}

// ---------------------------------------------------------------------------
// Thread helpers
// ---------------------------------------------------------------------------

function getSnapshotsDir(): string {
  return path.join(
    getConfigDir(),
    "workspaces",
    "default",
    ".tomu-snapshots",
  );
}

function getHistoryPath(threadId: string): string {
  return path.join(getSnapshotsDir(), threadId, "history.json");
}

function readMessages(threadId: string): Message[] {
  try {
    const raw = fs.readFileSync(getHistoryPath(threadId), "utf-8");
    const data = JSON.parse(raw) as { messages: Message[] };
    return data.messages;
  } catch {
    return [];
  }
}

function writeMessages(threadId: string, messages: Message[]): void {
  const dir = path.join(getSnapshotsDir(), threadId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    getHistoryPath(threadId),
    JSON.stringify({ messages }, null, 2),
    "utf-8",
  );
}

function createThread(): string {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  sqlite
    .prepare(
      "INSERT INTO threads (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    )
    .run(id, "New Chat", now, now);
  return id;
}

// ---------------------------------------------------------------------------
// Chat completions — Agentic Loop
// ---------------------------------------------------------------------------

router.post("/chat/completions", async (req, res) => {
  const { messages, model, provider_id, thread_id } = req.body as {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    provider_id?: string;
    thread_id?: string;
  };

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  // Resolve provider
  const config = getConfig();
  const targetProviderId = provider_id || config.default_provider_id;
  if (!targetProviderId) {
    res.status(400).json({ error: "No provider specified and no default configured" });
    return;
  }

  const providers = readProviders();
  const provider = providers.find((p) => p.id === targetProviderId);
  if (!provider) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }

  const apiKey = provider.api_key ? decrypt(provider.api_key) : "";
  const targetModel = model || config.default_model_id || provider.models[0]?.id;
  if (!targetModel) {
    res.status(400).json({ error: "No model specified and no default configured" });
    return;
  }

  // Resolve or create thread
  const activeThreadId = thread_id || createThread();

  // Load existing messages from thread if thread_id was provided
  let conversationMessages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  if (thread_id) {
    const existing = readMessages(thread_id);
    conversationMessages = existing.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: typeof m.content === "string" ? m.content : m.content.map((b) => b.text || "").join(""),
    }));
    // Append the new user message from the request
    const lastMsg = messages[messages.length - 1];
    if (lastMsg) {
      conversationMessages.push({
        role: lastMsg.role as "system" | "user" | "assistant",
        content: lastMsg.content,
      });
    }
  } else {
    conversationMessages = messages.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }));
  }

  // Get the latest user message for context building
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(lastUserMessage);

  // Persist the user message to history
  const userMsg = messages[messages.length - 1];
  if (userMsg && userMsg.role === "user") {
    const existingMessages = readMessages(activeThreadId);
    existingMessages.push({
      id: crypto.randomUUID(),
      role: "user",
      content: userMsg.content,
      timestamp: new Date().toISOString(),
    });
    writeMessages(activeThreadId, existingMessages);
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Abort support
  const abortController = new AbortController();
  req.on("close", () => abortController.abort());

  try {
    const llmProvider = createLLMProvider(provider, apiKey);

    const result = streamText({
      model: llmProvider(targetModel),
      system: systemPrompt,
      messages: conversationMessages,
      tools: { ...agentTools, ...taskTools },
      stopWhen: stepCountIs(25),
      abortSignal: abortController.signal,
    });

    let fullResponse = "";
    const toolCalls: Array<{ id: string; name: string; args: string; result: string }> = [];

    for await (const part of result.fullStream) {
      if (abortController.signal.aborted) break;

      switch (part.type) {
        case "text-delta": {
          fullResponse += part.text;
          res.write(
            `event: text_delta\ndata: ${JSON.stringify({ text: part.text })}\n\n`,
          );
          break;
        }
        case "tool-call": {
          const redactedArgs = redactSecrets(JSON.stringify(part.input));
          res.write(
            `event: tool_call_start\ndata: ${JSON.stringify({
              id: part.toolCallId,
              name: part.toolName,
              args: JSON.parse(redactedArgs),
            })}\n\n`,
          );
          break;
        }
        case "tool-result": {
          const output = part.output;
          const redactedResult =
            typeof output === "string"
              ? redactSecrets(output)
              : JSON.stringify(output);
          toolCalls.push({
            id: part.toolCallId,
            name: part.toolName,
            args: JSON.stringify(part.input),
            result: redactedResult,
          });
          res.write(
            `event: tool_call_result\ndata: ${JSON.stringify({
              id: part.toolCallId,
              name: part.toolName,
              result: redactedResult,
            })}\n\n`,
          );
          break;
        }
        case "error": {
          const errMsg =
            part.error instanceof Error
              ? part.error.message
              : String(part.error);
          res.write(
            `event: error\ndata: ${JSON.stringify({ error: errMsg })}\n\n`,
          );
          break;
        }
      }
    }

    // Persist all messages from the agentic loop to history
    if (fullResponse || toolCalls.length > 0) {
      const currentMessages = readMessages(activeThreadId);

      // Persist tool call/result pairs
      for (const tc of toolCalls) {
        currentMessages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          tool_calls: [{ id: tc.id, name: tc.name, arguments: tc.args }],
          timestamp: new Date().toISOString(),
        });
        currentMessages.push({
          id: crypto.randomUUID(),
          role: "tool",
          content: tc.result,
          tool_call_id: tc.id,
          timestamp: new Date().toISOString(),
        });
      }

      // Persist final assistant text
      if (fullResponse) {
        currentMessages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: fullResponse,
          timestamp: new Date().toISOString(),
        });
      }

      writeMessages(activeThreadId, currentMessages);

      // Update thread timestamp
      sqlite
        .prepare("UPDATE threads SET updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), activeThreadId);

      // Check if this is the first assistant response — trigger auto-title
      const allMessages = readMessages(activeThreadId);
      const assistantCount = allMessages.filter(
        (m) => m.role === "assistant" && m.content,
      ).length;
      if (assistantCount === 1) {
        triggerAutoTitle(activeThreadId, lastUserMessage, fullResponse);
      }

      // Trigger background memory extraction after a few exchanges
      const userMessageCount = allMessages.filter((m) => m.role === "user").length;
      if (userMessageCount >= 2 && fullResponse) {
        triggerMemoryExtraction(
          lastUserMessage,
          fullResponse,
          activeThreadId,
          provider,
          apiKey,
          targetModel,
        );
      }

      let usageData = {};
      try {
        const usage = await result.usage;
        const inputTokens = usage.inputTokens ?? 0;
        const outputTokens = usage.outputTokens ?? 0;
        const totalTokens = inputTokens + outputTokens;
        usageData = {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: totalTokens,
        };

        // Log usage to database
        sqlite
          .prepare(
            `INSERT INTO usage_logs (id, provider, model, message_id, input_tokens, output_tokens, total_tokens, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            crypto.randomUUID(),
            provider.type,
            targetModel,
            null,
            inputTokens,
            outputTokens,
            totalTokens,
            new Date().toISOString(),
          );
      } catch {
        // Some providers don't report usage
      }
      res.write(
        `event: completion\ndata: ${JSON.stringify({
          finish_reason: "stop",
          usage: usageData,
          thread_id: activeThreadId,
        })}\n\n`,
      );
    }
  } catch (e) {
    if (abortController.signal.aborted) {
      // Client disconnected, nothing to send
    } else {
      console.error("Chat completion error:", e);
      const message = e instanceof Error ? e.message : "Unknown error";
      res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
    }
  }

  res.end();
});

export default router;
