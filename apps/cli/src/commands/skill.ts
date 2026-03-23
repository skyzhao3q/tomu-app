import type { Command } from "commander";
import { execSync } from "child_process";
import { join } from "path";
import { existsSync, rmSync } from "fs";
import { apiFetch } from "../api.js";
import { formatJson, formatTable } from "../lib/formatter.js";
import { getPackageRunner } from "../lib/package-runner.js";

const SKILLS_DIR = join(process.env.HOME || "~", ".config", "tomu", "skills");

export function registerSkill(program: Command): void {
  const skill = program.command("skill").description("Manage skills");

  skill
    .command("list")
    .description("List installed skills")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const data = await apiFetch<
        Array<{ id: string; name: string; enabled: boolean }>
      >("GET", "/skills");

      if (opts.json) {
        console.log(formatJson(data));
        return;
      }

      if (data.length === 0) {
        console.log("No skills installed.");
        return;
      }

      console.log(
        formatTable(
          data.map((s) => ({ ...s, enabled: s.enabled ? "yes" : "no" })),
          [
            { key: "id", label: "ID" },
            { key: "name", label: "Name" },
            { key: "enabled", label: "Enabled" },
          ],
        ),
      );
    });

  skill
    .command("toggle <id>")
    .description("Toggle skill enabled state")
    .action(async (id: string) => {
      const data = await apiFetch<{ id: string; name: string; enabled: boolean }>(
        "PUT",
        `/skills/${id}/toggle`,
      );
      console.log(
        `✅ Skill "${data.name}" is now ${data.enabled ? "enabled" : "disabled"}.`,
      );
    });

  skill
    .command("install <source>")
    .description("Install skill from git URL or skills.sh (owner/repo@skill)")
    .action((source: string) => {
      // skills.sh format: owner/repo@skill or owner/repo
      const isSkillsFormat = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(@[a-zA-Z0-9_-]+)?$/.test(source);

      if (isSkillsFormat) {
        const runner = getPackageRunner();
        console.log(`📥 Installing skill ${source} via skills.sh...`);
        try {
          execSync(`${runner} skills add ${source}`, { stdio: "inherit" });
          console.log("✅ Skill installed successfully.");
        } catch {
          // Fall back to git clone treating it as a GitHub URL
          const gitUrl = `https://github.com/${source.split("@")[0]}.git`;
          console.log(`📥 Falling back to git clone from ${gitUrl}...`);
          try {
            const repoName = source.split("/")[1].split("@")[0];
            execSync(
              `git clone --depth 1 ${gitUrl} ${join(SKILLS_DIR, repoName)}`,
              { stdio: "inherit" },
            );
            console.log("✅ Skill installed successfully.");
          } catch {
            console.error("❌ Installation failed.");
            process.exit(1);
          }
        }
        return;
      }

      // Regular git URL
      const repoName = source.split("/").pop()?.replace(".git", "") ?? "skill";
      console.log(`📥 Installing skill from ${source}...`);
      try {
        execSync(`git clone --depth 1 ${source} ${join(SKILLS_DIR, repoName)}`, {
          stdio: "inherit",
        });
        console.log("✅ Skill installed successfully.");
      } catch {
        console.error("❌ Installation failed.");
        process.exit(1);
      }
    });

  skill
    .command("uninstall <name>")
    .description("Uninstall a skill (removes local directory and API entry)")
    .action(async (name: string) => {
      // Try local directory removal first
      const localPath = join(SKILLS_DIR, name);
      if (existsSync(localPath)) {
        rmSync(localPath, { recursive: true, force: true });
      }

      // Also remove from API
      try {
        await apiFetch("DELETE", `/skills/${name}`);
      } catch {
        // ignore if not found in API
      }

      console.log(`✅ Skill ${name} uninstalled.`);
    });

  skill
    .command("update")
    .description("Update all skills via skills.sh")
    .action(() => {
      const runner = getPackageRunner();
      console.log("🔄 Updating skills...");
      try {
        execSync(`${runner} skills update`, { stdio: "inherit" });
        console.log("✅ Skills updated.");
      } catch {
        console.error("❌ Update failed.");
        process.exit(1);
      }
    });
}
