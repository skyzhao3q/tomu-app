import { Router, type Router as RouterType } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import { getConfigDir } from "../db.js";

const router: RouterType = Router();

interface HeartbeatConfig {
  enabled: boolean;
  interval: number;
  patrol: boolean;
}

const DEFAULT_CONFIG: HeartbeatConfig = { enabled: false, interval: 30, patrol: false };

function getConfigPath(): string {
  return path.join(getConfigDir(), "heartbeat.json");
}

function readConfig(): HeartbeatConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf-8");
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<HeartbeatConfig>) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(cfg: HeartbeatConfig): void {
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), "utf-8");
}

router.get("/heartbeat", (_req, res) => {
  const cfg = readConfig();
  res.json({ enabled: cfg.enabled, interval: cfg.interval, status: cfg.enabled ? "running" : "stopped" });
});

router.get("/heartbeat/config", (_req, res) => {
  const cfg = readConfig();
  res.json({ interval: cfg.interval, patrol: cfg.patrol });
});

router.post("/heartbeat/enable", (_req, res) => {
  const cfg = readConfig();
  writeConfig({ ...cfg, enabled: true });
  res.json({});
});

router.post("/heartbeat/disable", (_req, res) => {
  const cfg = readConfig();
  writeConfig({ ...cfg, enabled: false });
  res.json({});
});

router.post("/heartbeat/interval", (req, res) => {
  const { interval } = req.body as { interval?: number };
  if (!interval || interval < 1) {
    res.status(400).json({ error: "interval must be a positive number" });
    return;
  }
  const cfg = readConfig();
  writeConfig({ ...cfg, interval });
  res.json({});
});

router.post("/heartbeat/patrol", (req, res) => {
  const { action } = req.body as { action?: string };
  const patrol = action === "enable";
  const cfg = readConfig();
  writeConfig({ ...cfg, patrol });
  res.json({ patrol });
});

export default router;
