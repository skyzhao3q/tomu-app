import { z } from "zod";

export const ContentBlockSchema = z.object({
  type: z.enum(["text", "image"]),
  text: z.string().optional(),
  image_url: z.string().optional(),
});

export const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** JSON-encoded arguments string */
  arguments: z.string(),
});

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(ContentBlockSchema)]),
  tool_calls: z.array(ToolCallSchema).optional(),
  tool_call_id: z.string().optional(),
  timestamp: z.string(),
});

export const ThreadSchema = z.object({
  thread_id: z.string().uuid(),
  title: z.string(),
  messages: z.array(MessageSchema),
  created_at: z.string(),
  updated_at: z.string(),
  workspace_id: z.string().optional(),
});
