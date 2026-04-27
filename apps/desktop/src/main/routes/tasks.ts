import { Router, type Router as RouterType } from "express";
import {
  spawnTask,
  getTask,
  listTasks,
  deleteTask,
  getMission,
  getMissionsByThread,
  getRunsByMission,
  getHandoffsByMission,
} from "../tasks.js";
import { listAgentTypes } from "../subagents.js";
import type { HandoffPacket } from "../tasks.js";

const router: RouterType = Router();

// ---------------------------------------------------------------------------
// Tasks (legacy sub-agent API)
// ---------------------------------------------------------------------------

// Spawn a new sub-agent task
router.post("/tasks", (req, res) => {
  const { subagent_type, agent_id, type: rawType, prompt, handoff, mission_id, parent_run_id } =
    req.body as {
      subagent_type?: string;
      agent_id?: string;
      type?: string;
      prompt?: string;
      handoff?: HandoffPacket;
      mission_id?: string;
      parent_run_id?: string;
    };
  const effectiveType = agent_id ?? subagent_type ?? rawType;

  if (!effectiveType || !prompt) {
    res.status(400).json({ error: "agent_id (or type) and prompt are required" });
    return;
  }

  const validTypes = listAgentTypes();
  if (!validTypes.includes(effectiveType)) {
    res.status(400).json({ error: `Invalid agent type. Valid types: ${validTypes.join(", ")}` });
    return;
  }

  try {
    const id = spawnTask({ agent_id: effectiveType, prompt, handoff, mission_id, parent_run_id });
    res.json({ id, status: "running" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to spawn task";
    res.status(500).json({ error: message });
  }
});

// List all tasks
router.get("/tasks", (_req, res) => {
  res.json(listTasks());
});

// Get a specific task
router.get("/tasks/:id", (req, res) => {
  const task = getTask(req.params.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(task);
});

// Delete/cancel a task
router.delete("/tasks/:id", (req, res) => {
  const deleted = deleteTask(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

// Get missions for a thread
router.get("/missions", (req, res) => {
  const { thread_id } = req.query as { thread_id?: string };
  if (!thread_id) {
    res.status(400).json({ error: "thread_id query param is required" });
    return;
  }
  res.json(getMissionsByThread(thread_id));
});

// Get a specific mission with its runs and handoffs
router.get("/missions/:id", (req, res) => {
  const mission = getMission(req.params.id);
  if (!mission) {
    res.status(404).json({ error: "Mission not found" });
    return;
  }
  const runs = getRunsByMission(mission.id);
  const handoffs = getHandoffsByMission(mission.id);
  res.json({ mission, runs, handoffs });
});

export default router;
