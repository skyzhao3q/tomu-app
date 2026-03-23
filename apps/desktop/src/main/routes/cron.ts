import { Router, type Router as RouterType } from "express";
import * as crypto from "node:crypto";
import { sqlite } from "../db.js";

const router: RouterType = Router();

// Ensure tables exist (created at startup via db.ts exec, but also safe here)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS cron_jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    schedule TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cron_history (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    run_at TEXT NOT NULL,
    status TEXT NOT NULL,
    output TEXT
  );
`);

interface CronJob {
  id: string;
  name: string;
  type: string;
  schedule: string;
  enabled: number;
  created_at: string;
}

interface CronHistory {
  id: string;
  job_id: string;
  run_at: string;
  status: string;
  output: string | null;
}

router.get("/cron", (_req, res) => {
  const jobs = sqlite.prepare("SELECT * FROM cron_jobs ORDER BY created_at DESC").all() as CronJob[];
  res.json(jobs.map((j) => ({ ...j, enabled: j.enabled === 1 })));
});

router.post("/cron", (req, res) => {
  const { name, type, schedule } = req.body as { name?: string; type?: string; schedule?: string };
  if (!name || !type || !schedule) {
    res.status(400).json({ error: "name, type, and schedule are required" });
    return;
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  sqlite.prepare("INSERT INTO cron_jobs (id, name, type, schedule, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)")
    .run(id, name, type, schedule, now);
  res.status(201).json({ id, name });
});

router.delete("/cron/:id", (req, res) => {
  const result = sqlite.prepare("DELETE FROM cron_jobs WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Cron job not found" });
    return;
  }
  res.json({});
});

router.post("/cron/:id/run", (req, res) => {
  const job = sqlite.prepare("SELECT * FROM cron_jobs WHERE id = ?").get(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Cron job not found" });
    return;
  }
  const histId = crypto.randomUUID();
  sqlite.prepare("INSERT INTO cron_history (id, job_id, run_at, status, output) VALUES (?, ?, ?, ?, ?)")
    .run(histId, req.params.id, new Date().toISOString(), "success", null);
  res.json({});
});

router.post("/cron/:id/enable", (req, res) => {
  const result = sqlite.prepare("UPDATE cron_jobs SET enabled = 1 WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Cron job not found" });
    return;
  }
  res.json({});
});

router.post("/cron/:id/disable", (req, res) => {
  const result = sqlite.prepare("UPDATE cron_jobs SET enabled = 0 WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "Cron job not found" });
    return;
  }
  res.json({});
});

router.get("/cron/:id/history", (req, res) => {
  const rows = sqlite.prepare("SELECT * FROM cron_history WHERE job_id = ? ORDER BY run_at DESC").all(req.params.id) as CronHistory[];
  res.json(rows);
});

export default router;
