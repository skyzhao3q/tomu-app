import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import type { Provider } from "@tomu/core";
import { decrypt } from "./crypto.js";
import { getConfigDir, getConfig, sqlite } from "./db.js";
import { createLLMProvider } from "./llm.js";
import { agentTools, createTaskTools } from "./tools/index.js";
import { loadAgentDefinition, getAgentDisplayName } from "./subagents.js";
import { getAgentProfile } from "./agents.js";

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
  messages_json: string | null;
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
  packet: string; // JSON-serialised HandoffPacket
  result_summary: string | null;
  created_at: string;
  updated_at: string;
}

// Legacy Task interface — kept for REST API and TaskOutput tool compatibility
export interface Task {
  id: string;
  type: string;
  status: "running" | "completed" | "failed";
  prompt: string;
  result?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
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
    .run(
      mission.id,
      mission.thread_id,
      mission.root_message_id,
      mission.title,
      mission.status,
      mission.created_at,
      mission.updated_at,
    );
  return mission;
}

export function getMission(id: string): AgentMission | undefined {
  return sqlite
    .prepare("SELECT * FROM agent_missions WHERE id = ?")
    .get(id) as AgentMission | undefined;
}

export function listMissions(): AgentMission[] {
  return sqlite
    .prepare("SELECT * FROM agent_missions ORDER BY created_at DESC")
    .all() as AgentMission[];
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
    messages_json: null,
    created_at: now,
    updated_at: now,
  };
  sqlite
    .prepare(
      `INSERT INTO agent_runs
         (id, mission_id, parent_run_id, agent_id, agent_name, status, input_summary, output_summary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      run.id,
      run.mission_id,
      run.parent_run_id,
      run.agent_id,
      run.agent_name,
      run.status,
      run.input_summary,
      run.output_summary,
      run.created_at,
      run.updated_at,
    );
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
      `INSERT INTO agent_handoffs
         (id, mission_id, from_run_id, to_agent_id, to_agent_name, to_run_id, status, packet, result_summary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      handoff.id,
      handoff.mission_id,
      handoff.from_run_id,
      handoff.to_agent_id,
      handoff.to_agent_name,
      handoff.to_run_id,
      handoff.status,
      handoff.packet,
      handoff.result_summary,
      handoff.created_at,
      handoff.updated_at,
    );
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
// In-memory task map — current session fast-access (full untruncated results)
// ---------------------------------------------------------------------------

const tasks = new Map<string, Task>();

// AbortController per active run — allows deleteTask to cancel in-flight LLM calls
const runControllers = new Map<string, AbortController>();

// ---------------------------------------------------------------------------
// executeRun — core AI generation loop with per-step checkpointing
// ---------------------------------------------------------------------------

async function executeRun(
  run: AgentRun,
  startingMessages: ModelMessage[],
  opts: {
    systemPrompt: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toolSubset: Record<string, any>;
    missionId: string;
    handoffId?: string;
  },
): Promise<void> {
  // Register in-memory task if not already present (e.g. resumed from DB)
  if (!tasks.has(run.id)) {
    tasks.set(run.id, {
      id: run.id,
      type: run.agent_id,
      status: "running",
      prompt: run.input_summary,
      startedAt: run.created_at,
      mission_id: run.mission_id,
      run_id: run.id,
      agent_id: run.agent_id,
      agent_name: run.agent_name,
    });
  }
  const task = tasks.get(run.id)!;

  const accumulated: ModelMessage[] = [...startingMessages];

  const controller = new AbortController();
  runControllers.set(run.id, controller);

  try {
    const { provider, apiKey, modelId } = resolveProvider();
    const llm = createLLMProvider(provider, apiKey);

    const { text } = await generateText({
      model: llm(modelId),
      system: opts.systemPrompt,
      messages: startingMessages,
      tools: opts.toolSubset,
      stopWhen: stepCountIs(20),
      abortSignal: controller.signal,
      onStepFinish({ response }) {
        accumulated.push(...response.messages);
        sqlite
          .prepare(
            "UPDATE agent_runs SET messages_json = ?, updated_at = ? WHERE id = ?",
          )
          .run(JSON.stringify(accumulated), new Date().toISOString(), run.id);
      },
    });

    task.status = "completed";
    task.result = text;
    task.completedAt = new Date().toISOString();

    updateRun(run.id, "completed", text.slice(0, 1000));
    if (opts.handoffId) updateHandoff(opts.handoffId, run.id, "completed", text.slice(0, 500));
    checkMissionCompletion(opts.missionId);
  } catch (e) {
    // Run was intentionally stopped via deleteTask — don't record failure or complete the mission
    if (e instanceof Error && e.name === "AbortError") {
      return;
    }
    const errMsg = e instanceof Error ? e.message : String(e);
    task.status = "failed";
    task.error = errMsg;
    task.completedAt = new Date().toISOString();

    updateRun(run.id, "failed", errMsg.slice(0, 500));
    if (opts.handoffId) updateHandoff(opts.handoffId, run.id, "failed", errMsg.slice(0, 500));
  } finally {
    runControllers.delete(run.id);
  }
}

// ---------------------------------------------------------------------------
// SpawnOptions
// ---------------------------------------------------------------------------

export interface SpawnOptions {
  /** Specialist agent ID (e.g. "product-manager", "developer"). Takes precedence over type. */
  agent_id?: string;
  /** Legacy subagent type (e.g. "coder", "plan"). Used when agent_id is absent. */
  type?: string;
  prompt: string;
  /** Mission to attach this run to. Auto-creates a new standalone mission if absent. */
  mission_id?: string;
  /** Run ID of the parent agent delegating to this one. */
  parent_run_id?: string;
  /** Structured handoff packet from the delegating agent. */
  handoff?: HandoffPacket;
  /** Thread context — stored on auto-created mission. */
  thread_id?: string;
  /** Root message ID for mission creation. */
  root_message_id?: string;
}

// ---------------------------------------------------------------------------
// spawnTask — overloaded for legacy (type, prompt) and new (SpawnOptions) call styles
// ---------------------------------------------------------------------------

export function spawnTask(type: string, prompt: string): string;
export function spawnTask(options: SpawnOptions): string;
export function spawnTask(
  typeOrOptions: string | SpawnOptions,
  promptArg?: string,
): string {
  const options: SpawnOptions =
    typeof typeOrOptions === "string"
      ? { type: typeOrOptions, prompt: promptArg! }
      : typeOrOptions;

  const effectiveType = options.agent_id ?? options.type ?? "general-purpose";
  const definition = loadAgentDefinition(effectiveType);
  const agentName = getAgentDisplayName(effectiveType);

  // Ensure a mission exists
  let missionId = options.mission_id;
  if (!missionId) {
    const threadId = options.thread_id ?? "standalone";
    const rootMsgId = options.root_message_id ?? crypto.randomUUID();
    const mission = createMission(threadId, rootMsgId, options.prompt.slice(0, 80));
    missionId = mission.id;
  }

  // Create the DB run record
  const run = createRun(
    missionId,
    effectiveType,
    agentName,
    options.prompt.slice(0, 500),
    options.parent_run_id,
  );

  // Record handoff if this was a structured delegation
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

  // Build legacy Task for in-memory fast access
  const task: Task = {
    id: run.id,
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
  tasks.set(run.id, task);

  // Build system prompt — inject handoff block at the top if present
  let systemPrompt = definition.systemPrompt;
  if (options.handoff) {
    const lines = [
      "",
      "---",
      "## HANDOFF CONTEXT",
      `**Goal:** ${options.handoff.goal}`,
      `**Deliverable:** ${options.handoff.deliverable}`,
      `**Constraints:** ${options.handoff.constraints.join("; ")}`,
    ];
    if (options.handoff.context?.length) {
      lines.push(`**Context:** ${options.handoff.context.join("; ")}`);
    }
    lines.push(`**Write-back format:** ${options.handoff.writeBack}`, "---", "");
    systemPrompt = lines.join("\n") + systemPrompt;
  }

  // Inject DELEGATION AUTHORIZATION block when allowed
  const config = getConfig() as Record<string, unknown>;
  const allowDelegation = (config["agents_allow_delegation"] as boolean | undefined) ?? true;
  if (allowDelegation) {
    const profile = getAgentProfile(effectiveType);
    if (profile?.delegatesTo.length) {
      const authLines = profile.delegatesTo
        .map((id) => getAgentProfile(id))
        .filter((p): p is NonNullable<typeof p> => p != null && p.enabled)
        .map((p) => `- ${p.id}: ${p.summary}`);
      if (authLines.length) {
        const delegationBlock = [
          "",
          "# DELEGATION AUTHORIZATION",
          "You are authorized to delegate sub-tasks to the following agents:",
          ...authLines,
          "",
        ].join("\n");
        systemPrompt = delegationBlock + systemPrompt;
      }
    }
  }

  // Build tool subset: merge base agent tools with context-aware task tools
  // createTaskTools injects missionId/runId so subagent Task calls inherit the mission
  const contextualTaskTools = createTaskTools({
    missionId,
    runId: run.id,
    threadId: options.thread_id,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allAvailableTools: Record<string, any> = { ...agentTools, ...contextualTaskTools };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolSubset: Record<string, any> = {};
  for (const toolName of definition.allowedTools) {
    if (toolName in allAvailableTools) {
      toolSubset[toolName] = allAvailableTools[toolName];
    }
  }

  // Remove Task/TaskOutput tools when delegation is globally disabled
  if (!allowDelegation) {
    delete toolSubset["Task"];
    delete toolSubset["TaskOutput"];
  }

  updateRun(run.id, "running");

  // Fire-and-forget via executeRun (checkpoints messages_json on each step)
  void executeRun(run, [{ role: "user", content: options.prompt }], {
    systemPrompt,
    toolSubset,
    missionId: missionId!,
    handoffId,
  });

  return run.id;
}

function checkMissionCompletion(missionId: string): void {
  const runs = getRunsByMission(missionId);
  const allDone = runs.every((r) => r.status === "completed" || r.status === "failed");
  if (allDone) {
    const anyFailed = runs.some((r) => r.status === "failed");
    updateMissionStatus(missionId, anyFailed ? "failed" : "completed");
  }
}

// ---------------------------------------------------------------------------
// Map DB AgentRun to legacy Task shape
// ---------------------------------------------------------------------------

function runToTask(run: AgentRun): Task {
  const isDone = run.status === "completed" || run.status === "failed";
  return {
    id: run.id,
    type: run.agent_id,
    status:
      run.status === "completed"
        ? "completed"
        : run.status === "failed"
          ? "failed"
          : "running",
    prompt: run.input_summary,
    result: run.status === "completed" ? (run.output_summary ?? undefined) : undefined,
    error: run.status === "failed" ? (run.output_summary ?? undefined) : undefined,
    startedAt: run.created_at,
    completedAt: isDone ? run.updated_at : undefined,
    mission_id: run.mission_id,
    run_id: run.id,
    agent_id: run.agent_id,
    agent_name: run.agent_name,
  };
}

// ---------------------------------------------------------------------------
// Public task accessors
// ---------------------------------------------------------------------------

export function getTask(id: string): Task | undefined {
  // In-memory takes precedence: has full untruncated result for current session
  const memTask = tasks.get(id);
  if (memTask) return memTask;
  const run = sqlite
    .prepare("SELECT * FROM agent_runs WHERE id = ?")
    .get(id) as AgentRun | undefined;
  return run ? runToTask(run) : undefined;
}

export function listTasks(): Task[] {
  const dbRuns = sqlite
    .prepare("SELECT * FROM agent_runs ORDER BY created_at DESC")
    .all() as AgentRun[];
  // Prefer in-memory data for current session (untruncated results)
  return dbRuns.map((run) => tasks.get(run.id) ?? runToTask(run));
}

export function deleteTask(id: string): boolean {
  runControllers.get(id)?.abort();
  runControllers.delete(id);
  tasks.delete(id);
  const result = sqlite.prepare("DELETE FROM agent_runs WHERE id = ?").run(id);
  return result.changes > 0;
}

// ---------------------------------------------------------------------------
// resumeStaleRuns — called at startup to re-execute interrupted runs
// ---------------------------------------------------------------------------

export function resumeStaleRuns(): number {
  const staleRuns = sqlite
    .prepare(
      `SELECT ar.*, am.thread_id
       FROM agent_runs ar
       JOIN agent_missions am ON ar.mission_id = am.id
       WHERE ar.status = 'running'`,
    )
    .all() as (AgentRun & { thread_id: string })[];

  let resumed = 0;
  for (const run of staleRuns) {
    // Skip if already active in this process (shouldn't happen at startup, but guard anyway)
    if (tasks.has(run.id)) continue;

    if (!run.messages_json) {
      updateRun(run.id, "failed", "Interrupted before first checkpoint — cannot resume");
      continue;
    }

    try {
      const definition = loadAgentDefinition(run.agent_id);
      const contextualTaskTools = createTaskTools({
        missionId: run.mission_id,
        runId: run.id,
        threadId: run.thread_id,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allAvailableTools: Record<string, any> = { ...agentTools, ...contextualTaskTools };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolSubset: Record<string, any> = {};
      for (const toolName of definition.allowedTools) {
        if (toolName in allAvailableTools) toolSubset[toolName] = allAvailableTools[toolName];
      }

      const messages = JSON.parse(run.messages_json) as ModelMessage[];
      console.log(
        `[resume] Resuming run ${run.id} (${run.agent_name}) from ${messages.length} messages`,
      );
      resumed++;

      void executeRun(run, messages, {
        systemPrompt: definition.systemPrompt,
        toolSubset,
        missionId: run.mission_id,
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      updateRun(run.id, "failed", `Resume failed: ${errMsg.slice(0, 500)}`);
    }
  }
  return resumed;
}
