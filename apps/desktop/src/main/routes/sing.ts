import { Router, type Router as RouterType } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { getConfigDir } from "../db.js";

const router: RouterType = Router();

interface SingConfig {
  apiKey?: string;
}

function getConfigPath(): string {
  return path.join(getConfigDir(), "sing.json");
}

function readConfig(): SingConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf-8");
    return JSON.parse(raw) as SingConfig;
  } catch {
    return {};
  }
}

router.post("/sing/generate", (req, res) => {
  const { description } = req.body as { description?: string; style?: string };
  if (!description) {
    res.status(400).json({ error: "description is required" });
    return;
  }
  const config = readConfig();
  if (!config.apiKey) {
    res.status(503).json({ error: "PiAPI key not configured. Run: tomu sing config <key>" });
    return;
  }
  // Stub response — real implementation would call PiAPI
  const id = crypto.randomUUID();
  res.json({ id, url: `https://example.com/songs/${id}.mp3` });
});

router.post("/sing/config", (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };
  if (!apiKey) {
    res.status(400).json({ error: "apiKey is required" });
    return;
  }
  fs.writeFileSync(getConfigPath(), JSON.stringify({ apiKey }, null, 2), "utf-8");
  res.json({});
});

export default router;
