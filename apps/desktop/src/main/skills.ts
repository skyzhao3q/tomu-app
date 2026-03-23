import * as fs from "node:fs";
import * as path from "node:path";
import matter from "gray-matter";
import type { Skill, SkillManifest } from "@tomu/core";
import { getConfigDir } from "./db.js";

// ---------------------------------------------------------------------------
// Skills loader — reads SKILL.md files from ~/.config/tomu/skills/
// ---------------------------------------------------------------------------

function getSkillsDir(): string {
  return path.join(getConfigDir(), "skills");
}

export function loadAllSkills(): Skill[] {
  const skillsDir = getSkillsDir();
  if (!fs.existsSync(skillsDir)) return [];

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const skills: Skill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillPath)) continue;

    try {
      const raw = fs.readFileSync(skillPath, "utf-8");
      const parsed = matter(raw);

      const manifest: SkillManifest = {
        name: String(parsed.data.name || entry.name),
        description: String(parsed.data.description || ""),
        "allowed-tools": Array.isArray(parsed.data["allowed-tools"])
          ? parsed.data["allowed-tools"].map(String)
          : [],
      };

      skills.push({
        id: entry.name,
        manifest,
        instructions: parsed.content.trim(),
      });
    } catch {
      // Skip malformed skill files
    }
  }

  return skills;
}

export function loadSkillById(id: string): Skill | null {
  const skillPath = path.join(getSkillsDir(), id, "SKILL.md");
  if (!fs.existsSync(skillPath)) return null;

  try {
    const raw = fs.readFileSync(skillPath, "utf-8");
    const parsed = matter(raw);

    const manifest: SkillManifest = {
      name: String(parsed.data.name || id),
      description: String(parsed.data.description || ""),
      "allowed-tools": Array.isArray(parsed.data["allowed-tools"])
        ? parsed.data["allowed-tools"].map(String)
        : [],
    };

    return { id, manifest, instructions: parsed.content.trim() };
  } catch {
    return null;
  }
}

export function deleteSkill(id: string): boolean {
  const skillDir = path.join(getSkillsDir(), id);
  if (!fs.existsSync(skillDir)) return false;
  fs.rmSync(skillDir, { recursive: true, force: true });
  return true;
}
