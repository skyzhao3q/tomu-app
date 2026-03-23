import type { Command } from "commander";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { openInEditor } from "../lib/editor.js";

const CONFIG_DIR = join(process.env.HOME || "~", ".config", "tomu");

const SOUL_TEMPLATE = `# SOUL.md — AI Personality
# Describe the AI's personality, tone, and behavior here.
`;

const USER_TEMPLATE = `# USER.md — User Profile
# Describe yourself so the AI can personalize responses.
`;

const EVOLVED_TRAITS_HEADER = "## Evolved Traits";
const MAX_TRAITS = 15;

function getSoulPath(): string {
  return join(CONFIG_DIR, "SOUL.md");
}

function ensureSoulFile(): void {
  const path = getSoulPath();
  if (!existsSync(path)) {
    writeFileSync(path, SOUL_TEMPLATE, "utf-8");
  }
}

export function registerSoul(program: Command): void {
  const soul = program
    .command("soul")
    .description("Manage AI personality file (SOUL.md)");

  // Default action: show contents (like `soul show`)
  soul.action(() => {
    ensureSoulFile();
    const content = readFileSync(getSoulPath(), "utf-8");
    console.log(content);
  });

  soul
    .command("show")
    .description("Show SOUL.md contents")
    .action(() => {
      ensureSoulFile();
      const content = readFileSync(getSoulPath(), "utf-8");
      console.log(content);
    });

  soul
    .command("edit")
    .description("Open SOUL.md in $EDITOR")
    .action(() => {
      openInEditor(getSoulPath(), SOUL_TEMPLATE);
    });

  soul
    .command("set <content>")
    .description("Set SOUL.md content")
    .action((content: string) => {
      writeFileSync(getSoulPath(), content + "\n", "utf-8");
      console.log("✅ SOUL.md updated.");
    });

  soul
    .command("append-trait <description>")
    .description("Append a trait to the Evolved Traits section (max 15)")
    .action((description: string) => {
      ensureSoulFile();
      let content = readFileSync(getSoulPath(), "utf-8");

      const headerIndex = content.indexOf(EVOLVED_TRAITS_HEADER);
      if (headerIndex === -1) {
        // Append the section
        content = content.trimEnd() + `\n\n${EVOLVED_TRAITS_HEADER}\n- ${description}\n`;
      } else {
        // Find the section and parse existing traits
        const afterHeader = content.slice(headerIndex + EVOLVED_TRAITS_HEADER.length);
        const traitLines = afterHeader
          .split("\n")
          .filter((l) => l.startsWith("- "));

        traitLines.push(`- ${description}`);

        // Keep only last MAX_TRAITS
        const kept = traitLines.slice(-MAX_TRAITS);

        // Rebuild: everything before section + section + rest (after the last trait line)
        const before = content.slice(0, headerIndex);
        content = before + EVOLVED_TRAITS_HEADER + "\n" + kept.join("\n") + "\n";
      }

      writeFileSync(getSoulPath(), content, "utf-8");
      console.log(`✅ Trait added to SOUL.md.`);
    });

  program
    .command("user")
    .description("Edit user profile file (USER.md)")
    .action(() => {
      openInEditor(join(CONFIG_DIR, "USER.md"), USER_TEMPLATE);
    });
}
