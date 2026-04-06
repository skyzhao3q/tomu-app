import { Router, type Router as RouterType } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import { getConfigDir } from "../db.js";
import { loadAllSkills, loadSkillById, deleteSkill } from "../skills.js";

const router: RouterType = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSkillsConfigPath(): string {
  return path.join(getConfigDir(), "skills-config.json");
}

interface SkillsConfig {
  disabled: string[];
}

function readSkillsConfig(): SkillsConfig {
  try {
    const raw = fs.readFileSync(getSkillsConfigPath(), "utf-8");
    return JSON.parse(raw) as SkillsConfig;
  } catch {
    return { disabled: [] };
  }
}

function writeSkillsConfig(config: SkillsConfig): void {
  fs.writeFileSync(getSkillsConfigPath(), JSON.stringify(config, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// List all installed skills
router.get("/skills", (_req, res) => {
  const skills = loadAllSkills();
  const config = readSkillsConfig();
  const result = skills.map((s) => ({
    id: s.id,
    manifest: s.manifest,
    enabled: !config.disabled.includes(s.id),
  }));
  res.json(result);
});

// Get full skill with instructions
router.get("/skills/:id", (req, res) => {
  const skill = loadSkillById(req.params.id);
  if (!skill) {
    res.status(404).json({ error: "Skill not found" });
    return;
  }
  const config = readSkillsConfig();
  res.json({ ...skill, enabled: !config.disabled.includes(skill.id) });
});

// Delete (uninstall) a skill
router.delete("/skills/:id", (req, res) => {
  const removed = deleteSkill(req.params.id);
  if (!removed) {
    res.status(404).json({ error: "Skill not found" });
    return;
  }
  res.status(204).end();
});

// Install from GitHub URL (stub)
router.post("/skills/install", (req, res) => {
  const { url, id } = req.body as { url?: string; id?: string };
  if (!url || !id) {
    res.status(400).json({ error: "url and id are required" });
    return;
  }

  const skillDir = path.join(getConfigDir(), "skills", id);
  fs.mkdirSync(skillDir, { recursive: true });

  // Stub: create a placeholder SKILL.md
  const placeholder = `---
name: ${id}
description: Installed from ${url}
allowed-tools: []
---

# ${id}

Installed from ${url}. Replace this with actual skill content.
`;
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), placeholder, "utf-8");

  res.status(201).json({ id, installed: true, source: url });
});

// Toggle enable/disable
router.put("/skills/:id/toggle", (req, res) => {
  const skill = loadSkillById(req.params.id);
  if (!skill) {
    res.status(404).json({ error: "Skill not found" });
    return;
  }

  const config = readSkillsConfig();
  const idx = config.disabled.indexOf(req.params.id);
  if (idx >= 0) {
    config.disabled.splice(idx, 1);
  } else {
    config.disabled.push(req.params.id);
  }
  writeSkillsConfig(config);

  res.json({ id: req.params.id, enabled: idx >= 0 });
});

router.get("/skills/search", (req, res) => {
  const q = (req.query.q as string ?? "").toLowerCase();
  const skills = loadAllSkills();
  const results = q
    ? skills.filter((s) => s.manifest.name.toLowerCase().includes(q) || (s.manifest.description ?? "").toLowerCase().includes(q))
    : skills;
  res.json(results);
});


export default router;
