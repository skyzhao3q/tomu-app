import { tool } from "ai";
import { z } from "zod";
import { executeBash } from "./bash.js";
import { executeRead } from "./read.js";
import { executeWrite } from "./write.js";
import { executeEdit } from "./edit.js";
import { executeGlob } from "./glob.js";
import { executeGrep } from "./grep.js";
import { spawnTask, getTask } from "../tasks.js";
import { listAgentTypes } from "../subagents.js";

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
};

export const taskTools = {
  Task: tool({
    description:
      "Spawn a background sub-agent to work on a task autonomously. Returns a task ID you can use with TaskOutput to check progress. Agent types: coder (write/fix code), explore (research codebase), plan (create plans), general-purpose (any task).",
    inputSchema: z.object({
      type: z
        .string()
        .describe(
          "The sub-agent type: coder, explore, plan, general-purpose, statusline-setup, tomu-guide, tomu-operator",
        ),
      prompt: z
        .string()
        .describe("The task description / instructions for the sub-agent"),
    }),
    execute: async ({ type, prompt }) => {
      const validTypes = listAgentTypes();
      if (!validTypes.includes(type)) {
        return `Error: Invalid agent type "${type}". Valid types: ${validTypes.join(", ")}`;
      }
      try {
        const id = spawnTask(type, prompt);
        return `Task spawned with id: ${id}`;
      } catch (e) {
        return `Error spawning task: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  }),

  TaskOutput: tool({
    description:
      "Check the status and result of a background sub-agent task. Returns the current status (running/completed/failed) and the result if completed.",
    inputSchema: z.object({
      task_id: z.string().describe("The task ID returned by the Task tool"),
    }),
    execute: async ({ task_id }) => {
      const task = getTask(task_id);
      if (!task) {
        return `Error: Task "${task_id}" not found`;
      }
      if (task.status === "running") {
        return `Task ${task_id} is still running (started at ${task.startedAt})`;
      }
      if (task.status === "failed") {
        return `Task ${task_id} failed: ${task.error}`;
      }
      return `Task ${task_id} completed:\n\n${task.result}`;
    },
  }),
};

export { redactSecrets } from "./redact.js";
