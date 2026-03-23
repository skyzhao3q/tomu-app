#!/usr/bin/env tsx
import { Command } from "commander";
import { registerStatus } from "./commands/status.js";
import { registerConfig } from "./commands/config.js";
import { registerProvider } from "./commands/provider.js";
import { registerChat } from "./commands/chat.js";
import { registerMemory } from "./commands/memory.js";
import { registerSkill } from "./commands/skill.js";
import { registerSoul } from "./commands/soul.js";
import { registerPeople } from "./commands/people.js";
import { registerTask } from "./commands/task.js";
import { registerUsage } from "./commands/usage.js";
import { registerMcp } from "./commands/mcp.js";
import { registerPlugin } from "./commands/plugin.js";
import { registerExport } from "./commands/export.js";
import { registerThread } from "./commands/thread.js";
import { registerModel } from "./commands/model.js";
import { registerVersion } from "./commands/version.js";
import { registerVoices } from "./commands/voices.js";
import { registerImage } from "./commands/image.js";
import { registerHeartbeat } from "./commands/heartbeat.js";
import { registerCron } from "./commands/cron.js";
import { registerWorkspace } from "./commands/workspace.js";
import { registerUpdate } from "./commands/update.js";
import { registerDm } from "./commands/dm.js";
import { registerMsg } from "./commands/msg.js";
import { registerSing } from "./commands/sing.js";
import { registerEmotion } from "./commands/emotion.js";
import { registerBrowser } from "./commands/browser.js";
import { ApiError, ConnectionError } from "./lib/errors.js";

function wrapAction(fn: (...args: unknown[]) => Promise<void>) {
  return async (...args: unknown[]) => {
    try {
      await fn(...args);
    } catch (e) {
      if (e instanceof ConnectionError) {
        console.error(`❌ ${e.message}`);
        process.exit(1);
      }
      if (e instanceof ApiError) {
        console.error(`❌ Error ${e.status}: ${e.message}`);
        process.exit(1);
      }
      throw e;
    }
  };
}

function wrapCommands(cmd: Command): void {
  // Wrap action on this command
  const cmdInternal = cmd as unknown as { _actionHandler?: (...args: unknown[]) => Promise<void> };
  if (cmdInternal._actionHandler) {
    cmdInternal._actionHandler = wrapAction(cmdInternal._actionHandler);
  }
  // Recurse into subcommands
  for (const sub of cmd.commands) {
    wrapCommands(sub);
  }
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name("tomu")
    .description("Tomu CLI — Terminal interface for Tomu AI agent")
    .version("0.0.0");

  registerStatus(program);
  registerConfig(program);
  registerProvider(program);
  registerChat(program);
  registerMemory(program);
  registerSkill(program);
  registerSoul(program);
  registerPeople(program);
  registerTask(program);
  registerUsage(program);
  registerMcp(program);
  registerPlugin(program);
  registerExport(program);
  registerThread(program);
  registerModel(program);
  registerVersion(program);
  registerVoices(program);
  registerImage(program);
  registerHeartbeat(program);
  registerCron(program);
  registerWorkspace(program);
  registerUpdate(program);
  registerDm(program);
  registerMsg(program);
  registerSing(program);
  registerEmotion(program);
  registerBrowser(program);

  // Wrap all command actions with error handling
  wrapCommands(program);

  return program;
}

// Run CLI when executed directly
const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("/tomu");

if (isDirectRun) {
  const program = createProgram();
  program.parse(process.argv);
}
