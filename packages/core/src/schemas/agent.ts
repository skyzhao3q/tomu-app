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
