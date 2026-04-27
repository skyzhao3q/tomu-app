import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { generateText, stepCountIs } from "ai";
import type { Provider } from "@tomu/core";
import { decrypt } from "./crypto.js";
import { getConfigDir, getConfig, sqlite } from "./db.js";
import { createLLMProvider } from "./llm.js";
import { agentTools } from "./tools/index.js";
import { loadAgentDefinition, getAgentDisplayName } from "./subagents.js";

// ---------------------------------------------------------------------------
// HandoffPacket — structured delegation payload
// ---------------------------------------------------------------------------

export interface HandoffPacket {
  goal: string;
  deliverable: string;
  constraints: string[];
  context?: string[];
  writeBack: "summary" | "artifact" | "decision" | "patch";
}

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

export interface AgentMission {
  id: string;
  thread_id: string;
  root_message_id: string;
  title: string;
  status: "active" | "completed" | "failed" | "paused";
  created_at: string;
  updated_at: string;
}

export interface AgentRun {
  id: string;
  mission_id: string;
  parent_run_id: string | null;
  agent_id: string;
  agent_name: string;
  status: "queued" | "running" | "completed" | "failed";
  input_summary: string;
  output_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentHandoff {
  id: string;
  mission_id: string;
  from_run_id: string | null;
  to_agent_id: string;
  to_agent_name: string;
  to_run_id: string | null;
  status: "created" | "accepted" | "completed" | "failed";
  packet: string; // JSON
  result_summary: string | null;
  created_at: string;
  updated_at: string;
}

// Legacy Task interface kept for API compatibility
export interface Task {
  id: string;
  type: string;
  status: "running" | "completed" | "failed";
  prompt: string;
  result?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
  // Extended fields
  mission_id?: string;
  run_id?: string;
  agent_id?: string;
  agent_name?: string;
  handoff?: HandoffPacket;
}

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

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
  if (!providerId) throw new Error("No default provider configured");

  const providers = readProviders();
  const provider = providers.find((p) => p.id === providerId);
  if (!provider) throw new Error("Default provider not found");

  const apiKey = provider.api_key ? decrypt(provider.api_key) : "";
  const modelId = config.default_model_id || provider.models[0]?.id;
  if (!modelId) throw new Error("No default model configured");

  return { provider, apiKey, modelId };
}

// ---------------------------------------------------------------------------
// Mission CRUD
// ---------------------------------------------------------------------------

export function createMission(
  threadId: string,
  rootMessageId: string,
  title: string,
): AgentMission {
  const now = new Date().toISOString();
  const mission: AgentMission = {
    id: crypto.randomUUID(),
    thread_id: threadId,
    root_message_id: rootMessageId,
    title,
    status: "active",
    created_at: now,
    updated_at: now,
  };
  sqlite
    .prepare(
      `INSERT INTO agent_missions (id, thread_id, root_message_id, title, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(mission.id, mission.thread_id, mission.root_message_id, mission.title, mission.status, mission.created_at, mission.updated_at);
  return mission;
}

export function getMission(id: string): AgentMission | undefined {
  return sqlite.prepare("SELECT * FROM agent_missions WHERE id = ?").get(id) as AgentMission | undefined;
}

export function getMissionsByThread(threadId: string): AgentMission[] {
  return sqlite
    .prepare("SELECT * FROM agent_missions WHERE thread_id = ? ORDER BY created_at DESC")
    .all(threadId) as AgentMission[];
}

function updateMissionStatus(id: string, status: AgentMission["status"]): void {
  sqlite
    .prepare("UPDATE agent_missions SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, new Date().toISOString(), id);
}

// ---------------------------------------------------------------------------
// Run CRUD
// ---------------------------------------------------------------------------

function createRun(
  missionId: string,
  agentId: string,
  agentName: string,
  inputSummary: string,
  parentRunId?: string,
): AgentRun {
  const now = new Date().toISOString();
  const run: AgentRun = {
    id: crypto.randomUUID(),
    mission_id: missionId,
    parent_run_id: parentRunId ?? null,
    agent_id: agentId,
    agent_name: agentName,
    status: "queued",
    input_summary: inputSummary,
    output_summary: null,
    created_at: now,
    updated_at: now,
  };
  sqlite
    .prepare(
      `INSERT INTO agent_runs (id, mission_id, parent_run_id, agent_id, agent_name, status, input_summary, output_summary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(run.id, run.mission_id, run.parent_run_id, run.agent_id, run.agent_name, run.status, run.input_summary, run.output_summary, run.created_at, run.updated_at);
  return run;
}

function updateRun(
  runId: string,
  status: AgentRun["status"],
  outputSummary?: string,
): void {
  sqlite
    .prepare(
      "UPDATE agent_runs SET status = ?, output_summary = ?, updated_at = ? WHERE id = ?",
    )
    .run(status, outputSummary ?? null, new Date().toISOString(), runId);
}

export function getRunsByMission(missionId: string): AgentRun[] {
  return sqlite
    .prepare("SELECT * FROM agent_runs WHERE mission_id = ? ORDER BY created_at ASC")
    .all(missionId) as AgentRun[];
}

// ---------------------------------------------------------------------------
// Handoff CRUD
// ---------------------------------------------------------------------------

function createHandoff(
  missionId: string,
  toAgentId: string,
  toAgentName: string,
  packet: HandoffPacket,
  fromRunId?: string,
): AgentHandoff {
  const now = new Date().toISOString();
  const handoff: AgentHandoff = {
    id: crypto.randomUUID(),
    mission_id: missionId,
    from_run_id: fromRunId ?? null,
    to_agent_id: toAgentId,
    to_agent_name: toAgentName,
    to_run_id: null,
    status: "created",
    packet: JSON.stringify(packet),
    result_summary: null,
    created_at: now,
    updated_at: now,
  };
  sqlite
    .prepare(
      `INSERT INTO agent_handoffs (id, mission_id, from_run_id, to_agent_id, to_agent_name, to_run_id, status, packet, result_summary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(handoff.id, handoff.mission_id, handoff.from_run_id, handoff.to_agent_id, handoff.to_agent_name, handoff.to_run_id, handoff.status, handoff.packet, handoff.result_summary, handoff.created_at, handoff.updated_at);
  return handoff;
}

function updateHandoff(
  handoffId: string,
  toRunId: string,
  status: AgentHandoff["status"],
  resultSummary?: string,
): void {
  sqlite
    .prepare(
      "UPDATE agent_handoffs SET to_run_id = ?, status = ?, result_summary = ?, updated_at = ? WHERE id = ?",
    )
    .run(toRunId, status, resultSummary ?? null, new Date().toISOString(), handoffId);
}

export function getHandoffsByMission(missionId: string): AgentHandoff[] {
  return sqlite
    .prepare("SELECT * FROM agent_handoffs WHERE mission_id = ? ORDER BY created_at ASC")
    .all(missionId) as AgentHandoff[];
}

// ---------------------------------------------------------------------------
// Legacy in-memory task map (for API compatibility during transition)
// Tasks are now also persisted to DB, but we keep this for fast lookups
// ---------------------------------------------------------------------------

const tasks = new Map<string, Task>();

// ---------------------------------------------------------------------------
// Core spawn logic
// ---------------------------------------------------------------------------

export interface SpawnOptions {
  /** Specialist agent ID (e.g. "product-manager", "developer"). Falls back to type. */
  agent_id?: string;
  /** Legacy subagent type (e.g. "coder", "plan"). Used when agent_id not given. */
  type?: string;
  prompt: string;
  /** Mission to attach this run to. If absent, a new standalone mission is created. */
  mission_id?: string;
  /** Run ID of the parent that is delegating to this agent */
  parent_run_id?: string;
  /** Handoff packet from the delegating agent */
  handoff?: HandoffPacket;
  /** Thread context for mission creation */
  thread_id?: string;
  /** Root message ID for mission creation */
  root_message_id?: string;
}

export function spawnTask(typeOrAgentId: string, prompt: string): string;
export function spawnTask(options: SpawnOptions): string;
export function spawnTask(
  typeOrOptionsOrAgentId: string | SpawnOptions,
  promptArg?: string,
): string {
  // Normalize arguments — support both legacy (type, prompt) and new options object
  let options: SpawnOptions;
  if (typeof typeOrOptionsOrAgentId === "string") {
    options = { type: typeOrOptionsOrAgentId, prompt: promptArg! };
  } else {
    options = typeOrOptionsOrAgentId;
  }

  // Resolve the effective agent type for loading the definition
  const effectiveType = options.agent_id ?? options.type ?? "general-purpose";
  const definition = loadAgentDefinition(effectiveType);
  const { provider, apiKey, modelId } = resolveProvider();

  const agentName = getAgentDisplayName(effectiveType);

  // Ensure a mission exists
  let missionId = options.mission_id;
  if (!missionId) {
    const threadId = options.thread_id ?? "standalone";
    const rootMsgId = options.root_message_id ?? crypto.randomUUID();
    const mission = createMission(threadId, rootMsgId, options.prompt.slice(0, 80));
    missionId = mission.id;
  }

  // Create the run record
  const run = createRun(
    missionId,
    effectiveType,
    agentName,
    options.prompt.slice(0, 500),
    options.parent_run_id,
  );

  // Create handoff record if this was a delegation
  let handoffId: string | undefined;
  if (options.handoff && options.parent_run_id) {
    const handoff = createHandoff(
      missionId,
      effectiveType,
      agentName,
      options.handoff,
      options.parent_run_id,
    );
    updateHandoff(handoff.id, run.id, "accepted");
    handoffId = handoff.id;
  }

  // Build legacy Task record for API compatibility
  const id = run.id;
  const task: Task = {
    id,
    type: effectiveType,
    status: "running",
    prompt: options.prompt,
    startedAt: run.created_at,
    mission_id: missionId,
    run_id: run.id,
    agent_id: effectiveType,
    agent_name: agentName,
    handoff: options.handoff,
  };
  tasks.set(id, task);

  // Build system prompt — inject handoff packet if present
  let systemPrompt = definition.systemPrompt;
  if (options.handoff) {
    const handoffBlock = [
      "",
      "---",
      "## HANDOFF CONTEXT",
      `**Goal:** ${options.handoff.goal}`,
      `**Deliverable:** ${options.handoff.deliverable}`,
      `**Constraints:** ${options.handoff.constraints.join("; ")}`,
      options.handoff.context?.length
        ? `**Context:** ${options.handoff.context.join("; ")}`
        : null,
      `**Write-back format:** ${options.handoff.writeBack}`,
      "---",
      "",
    ]
      .filter(Boolean)
      .join("\n");
    systemPrompt = handoffBlock + systemPrompt;
  }

  // Build tool subset
  const toolSubset: Record<string, (typeof agentTools)[keyof typeof agentTools]> = {};
  for (const toolName of definition.allowedTools) {
    if (toolName in agentTools) {
      toolSubset[toolName] = agentTools[toolName as keyof typeof agentTools];
    }
  }

  const llm = createLLMProvider(provider, apiKey);

  // Mark run as running
  updateRun(run.id, "running");

  // Fire-and-forget the background generation
  (async () => {
    try {
      const { text } = await generateText({
        model: llm(modelId),
        system: systemPrompt,
        messages: [{ role: "user", content: options.prompt }],
        tools: toolSubset,
        stopWhen: stepCountIs(20),
      });

      task.status = "completed";
      task.result = text;
      task.completedAt = new Date().toISOString();

      updateRun(run.id, "completed", text.slice(0, 1000));

      if (handoffId) {
        updateHandoff(handoffId, run.id, "completed", text.slice(0, 500));
      }

      // Check if all runs in the mission are done
      checkMissionCompletion(missionId!);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      task.status = "failed";
      task.error = errMsg;
      task.completedAt = new Date().toISOString();

      updateRun(run.id, "failed", errMsg.slice(0, 500));

      if (handoffId) {
        updateHandoff(handoffId, run.id, "failed", errMsg.slice(0, 500));
      }
    }
  })();

  return id;
}

function checkMissionCompletion(missionId: string): void {
  const runs = getRunsByMission(missionId);
  const allDone = runs.every((r) => r.status === "completed" || r.status === "failed");
  const anyFailed = runs.some((r) => r.status === "failed");
  if (allDone) {
    updateMissionStatus(missionId, anyFailed ? "failed" : "completed");
  }
}

// ---------------------------------------------------------------------------
// Public task accessors (legacy API)
// ---------------------------------------------------------------------------

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}

export function listTasks(): Task[] {
  return Array.from(tasks.values());
}

export function deleteTask(id: string): boolean {
  return tasks.delete(id);
}
