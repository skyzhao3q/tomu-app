import type { z } from "zod";
import type {
  ContentBlockSchema,
  ToolCallSchema,
  MessageSchema,
  ThreadSchema,
  ModelSchema,
  ProviderSchema,
  SkillManifestSchema,
  SkillSchema,
  PersonSchema,
  VectorMemorySchema,
  SubAgentTypeSchema,
  SubAgentSchema,
  ConfigSchema,
  WorkspaceSchema,
  HandoffPacketSchema,
  AgentMissionSchema,
  AgentRunSchema,
  AgentHandoffSchema,
  AgentProfileSchema,
  AgentsConfigSchema,
} from "./schemas/index.js";

// Thread & messaging
export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Thread = z.infer<typeof ThreadSchema>;

// Providers & models
export type Model = z.infer<typeof ModelSchema>;
export type Provider = z.infer<typeof ProviderSchema>;

// Skills
export type SkillManifest = z.infer<typeof SkillManifestSchema>;
export type Skill = z.infer<typeof SkillSchema>;

// People
export type Person = z.infer<typeof PersonSchema>;

// Memory
export type VectorMemory = z.infer<typeof VectorMemorySchema>;

// Agents
export type SubAgentType = z.infer<typeof SubAgentTypeSchema>;
export type SubAgent = z.infer<typeof SubAgentSchema>;

// Config
export type Config = z.infer<typeof ConfigSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;

// Task orchestration
export type HandoffPacket = z.infer<typeof HandoffPacketSchema>;
export type AgentMission = z.infer<typeof AgentMissionSchema>;
export type AgentRun = z.infer<typeof AgentRunSchema>;
export type AgentHandoff = z.infer<typeof AgentHandoffSchema>;

// Agent profiles
export type AgentProfile = z.infer<typeof AgentProfileSchema>;
export type AgentsConfig = z.infer<typeof AgentsConfigSchema>;
