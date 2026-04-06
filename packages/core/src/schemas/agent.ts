import { z } from "zod";

export const SubAgentTypeSchema = z.enum([
  "general-purpose",
  "coder",
  "Explore",
  "Plan",
  "tomu-guide",
  "tomu-operator",
  "statusline-setup",
]);

export const SubAgentSchema = z.object({
  task_id: z.string(),
  subagent_type: SubAgentTypeSchema,
  system_prompt: z.string(),
  allowed_tools: z.array(z.string()),
  status: z.enum(["started", "running", "completed", "failed"]),
  output: z.string().nullable(),
  prompt: z.string(),
});

// ---------------------------------------------------------------------------
// Task orchestration schemas
// ---------------------------------------------------------------------------

export const HandoffPacketSchema = z.object({
  goal: z.string(),
  deliverable: z.string(),
  constraints: z.array(z.string()),
  context: z.array(z.string()).optional(),
  writeBack: z.enum(["summary", "artifact", "decision", "patch"]),
});

export const AgentMissionSchema = z.object({
  id: z.string(),
  thread_id: z.string(),
  root_message_id: z.string(),
  title: z.string(),
  status: z.enum(["active", "completed", "failed", "paused"]),
  created_at: z.string(),
  updated_at: z.string(),
});

export const AgentRunSchema = z.object({
  id: z.string(),
  mission_id: z.string(),
  parent_run_id: z.string().nullable(),
  agent_id: z.string(),
  agent_name: z.string(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  input_summary: z.string(),
  output_summary: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const AgentHandoffSchema = z.object({
  id: z.string(),
  mission_id: z.string(),
  from_run_id: z.string().nullable(),
  to_agent_id: z.string(),
  to_agent_name: z.string(),
  to_run_id: z.string().nullable(),
  status: z.enum(["created", "accepted", "completed", "failed"]),
  packet: z.string(),
  result_summary: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// ---------------------------------------------------------------------------
// Agent profile schemas (for the Agents Settings UI)
// ---------------------------------------------------------------------------

export const AgentProfileSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().max(30),
  category: z.enum(["design", "product", "engineering", "research", "operations", "custom"]),
  executionMode: z.enum([
    "general-purpose",
    "plan",
    "coder",
    "tomu-operator",
    "explore",
    "tomu-guide",
    "statusline-setup",
  ]),
  enabled: z.boolean(),
  builtIn: z.boolean(),
  color: z.string(),
  summary: z.string().max(100),
  focus: z.array(z.string()).max(5),
  delegatesTo: z.array(z.string()),
  prompt: z.string(),
  model: z.string().optional(),
});

export const AgentsConfigSchema = z.object({
  enabled: z.boolean(),
  allowSubagentDelegation: z.boolean(),
  profiles: z.array(AgentProfileSchema),
});
