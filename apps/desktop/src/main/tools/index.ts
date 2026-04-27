import { tool } from "ai";
import { z } from "zod";
import { executeBash } from "./bash.js";
import { executeRead } from "./read.js";
import { executeWrite } from "./write.js";
import { executeEdit } from "./edit.js";
import { executeGlob } from "./glob.js";
import { executeGrep } from "./grep.js";
import { executeWidget } from "./widget.js";
import { executePieChart, executeBarChart } from "./charts.js";
import { spawnTask, getTask } from "../tasks.js";
import { listAgentTypes } from "../subagents.js";
import type { HandoffPacket } from "../tasks.js";

export const agentTools = {
  Bash: tool({
    description:
      "Execute a shell command and return stdout/stderr. Use for system commands, git, npm, etc.",
    inputSchema: z.object({
      command: z.string().describe("The shell command to execute"),
      timeout: z
        .number()
        .optional()
        .describe("Timeout in milliseconds (default 120s, max 120s)"),
    }),
    execute: async ({ command, timeout }) => executeBash({ command, timeout }),
  }),

  Read: tool({
    description:
      "Read a file from the filesystem. Returns the file content with line numbers.",
    inputSchema: z.object({
      file_path: z.string().describe("Absolute path to the file to read"),
      offset: z
        .number()
        .optional()
        .describe("Line number to start reading from (1-based)"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of lines to read (default 2000)"),
    }),
    execute: async ({ file_path, offset, limit }) =>
      executeRead({ file_path, offset, limit }),
  }),

  Write: tool({
    description:
      "Write content to a file. Creates parent directories if needed. Overwrites existing files.",
    inputSchema: z.object({
      file_path: z.string().describe("Absolute path to the file to write"),
      content: z.string().describe("The content to write to the file"),
    }),
    execute: async ({ file_path, content }) =>
      executeWrite({ file_path, content }),
  }),

  Edit: tool({
    description:
      "Search and replace text in a file. The old_string must match exactly one location unless replace_all is true.",
    inputSchema: z.object({
      file_path: z.string().describe("Absolute path to the file to edit"),
      old_string: z.string().describe("The exact text to find and replace"),
      new_string: z.string().describe("The replacement text"),
      replace_all: z
        .boolean()
        .optional()
        .describe("Replace all occurrences (default false)"),
    }),
    execute: async ({ file_path, old_string, new_string, replace_all }) =>
      executeEdit({ file_path, old_string, new_string, replace_all }),
  }),

  Glob: tool({
    description:
      "Find files matching a glob pattern. Returns file paths sorted by modification time.",
    inputSchema: z.object({
      pattern: z
        .string()
        .describe('Glob pattern to match (e.g. "**/*.ts", "src/**/*.js")'),
      path: z
        .string()
        .optional()
        .describe("Directory to search in (defaults to cwd)"),
    }),
    execute: async ({ pattern, path }) => executeGlob({ pattern, path }),
  }),

  Grep: tool({
    description:
      "Search file contents for a regex pattern. Returns matching file paths by default.",
    inputSchema: z.object({
      pattern: z.string().describe("Regex pattern to search for"),
      path: z
        .string()
        .optional()
        .describe("File or directory to search in (defaults to cwd)"),
      glob: z
        .string()
        .optional()
        .describe("Glob pattern to filter files (e.g. '*.ts')"),
      output_mode: z
        .enum(["content", "files_with_matches", "count"])
        .optional()
        .describe('Output mode (default "files_with_matches")'),
    }),
    execute: async ({ pattern, path, glob, output_mode }) =>
      executeGrep({ pattern, path, glob, output_mode }),
  }),

  widgetRenderer: tool({
    description:
      "Render interactive HTML/CSS/JS content as a widget. Use for charts, interactive demos, data visualizations, forms, or any rich content. The HTML should be a complete document with inline styles and scripts.",
    inputSchema: z.object({
      html: z.string().describe("Complete HTML document to render"),
      title: z.string().optional().describe("Widget title"),
    }),
    execute: async ({ html, title }) => executeWidget({ html, title }),
  }),

  pieChart: tool({
    description:
      "Generate an interactive pie chart widget. Returns HTML with an inline SVG pie chart.",
    inputSchema: z.object({
      title: z.string().describe("Chart title"),
      data: z
        .array(
          z.object({
            label: z.string(),
            value: z.number(),
            color: z.string().optional(),
          }),
        )
        .describe("Chart data"),
    }),
    execute: async ({ title, data }) => executePieChart({ title, data }),
  }),

  barChart: tool({
    description:
      "Generate an interactive bar chart widget. Returns HTML with an inline SVG bar chart.",
    inputSchema: z.object({
      title: z.string().describe("Chart title"),
      data: z
        .array(
          z.object({
            label: z.string(),
            value: z.number(),
            color: z.string().optional(),
          }),
        )
        .describe("Chart data"),
    }),
    execute: async ({ title, data }) => executeBarChart({ title, data }),
  }),
};

const handoffSchema = z
  .object({
    goal: z.string().describe("Why this agent is being called — the ultimate objective"),
    deliverable: z.string().describe("The exact output this agent must return"),
    constraints: z
      .array(z.string())
      .describe("Hard constraints: deadlines, tech restrictions, absolute rules"),
    context: z
      .array(z.string())
      .optional()
      .describe("Background info the agent needs before acting"),
    writeBack: z
      .enum(["summary", "artifact", "decision", "patch"])
      .describe("How to format the result"),
  })
  .optional();

export const taskTools = {
  Task: tool({
    description: [
      "Spawn a background specialist agent to work on a task autonomously.",
      "Returns a task ID you can use with TaskOutput to check progress.",
      "",
      "SPECIALIST AGENTS (use agent_id):",
      "  product-manager — requirements, roadmapping, scope control",
      "  designer        — UX/UI specs, component design, interaction states",
      "  developer       — implementation, bug fixing, code verification",
      "  researcher      — codebase recon, external research, decision support",
      "  operator        — environment setup, configuration, dependency management",
      "",
      "GENERAL AGENTS (use type):",
      "  coder, explore, plan, general-purpose, tomu-operator",
    ].join("\n"),
    inputSchema: z.object({
      agent_id: z
        .string()
        .optional()
        .describe(
          "Specialist agent ID: product-manager, designer, developer, researcher, operator",
        ),
      type: z
        .string()
        .optional()
        .describe(
          "Legacy agent type: coder, explore, plan, general-purpose (used when agent_id is not provided)",
        ),
      prompt: z.string().describe("Task description / instructions for the agent"),
      handoff: handoffSchema.describe(
        "Structured handoff packet for specialist delegation. Strongly recommended when using agent_id.",
      ),
      mission_id: z
        .string()
        .optional()
        .describe("Mission ID to attach this run to (for chaining agents within one mission)"),
      parent_run_id: z
        .string()
        .optional()
        .describe("Run ID of the delegating agent (enables handoff tracking)"),
    }),
    execute: async ({ agent_id, type, prompt, handoff, mission_id, parent_run_id }) => {
      const effectiveType = agent_id ?? type;
      if (!effectiveType) {
        return "Error: Either agent_id or type must be provided";
      }

      const validTypes = listAgentTypes();
      if (!validTypes.includes(effectiveType)) {
        return `Error: Invalid agent "${effectiveType}". Valid options: ${validTypes.join(", ")}`;
      }

      try {
        const id = spawnTask({
          agent_id: effectiveType,
          prompt,
          handoff: handoff as HandoffPacket | undefined,
          mission_id,
          parent_run_id,
        });
        const agentLabel = agent_id ? `specialist:${agent_id}` : `type:${type}`;
        return JSON.stringify({ task_id: id, agent: agentLabel, status: "running" });
      } catch (e) {
        return `Error spawning task: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  }),

  TaskOutput: tool({
    description:
      "Check the status and result of a background agent task. Returns the current status (running/completed/failed) and the result if completed.",
    inputSchema: z.object({
      task_id: z.string().describe("The task ID returned by the Task tool"),
    }),
    execute: async ({ task_id }) => {
      const task = getTask(task_id);
      if (!task) {
        return `Error: Task "${task_id}" not found`;
      }
      if (task.status === "running") {
        return JSON.stringify({
          task_id,
          status: "running",
          agent: task.agent_name,
          started_at: task.startedAt,
        });
      }
      if (task.status === "failed") {
        return JSON.stringify({
          task_id,
          status: "failed",
          agent: task.agent_name,
          error: task.error,
        });
      }
      return JSON.stringify({
        task_id,
        status: "completed",
        agent: task.agent_name,
        mission_id: task.mission_id,
        result: task.result,
      });
    },
  }),
};

export { redactSecrets } from "./redact.js";
