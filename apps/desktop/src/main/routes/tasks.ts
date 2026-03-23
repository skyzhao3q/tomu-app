import { Router, type Router as RouterType } from "express";
import {
  spawnTask,
  getTask,
  listTasks,
  deleteTask,
} from "../tasks.js";
import { listAgentTypes } from "../subagents.js";

const router: RouterType = Router();

// Spawn a new sub-agent task
router.post("/tasks", (req, res) => {
  const { subagent_type, type: rawType, prompt } = req.body as {
    subagent_type?: string;
    type?: string;
    prompt?: string;
  };
  const type = subagent_type || rawType;

  if (!type || !prompt) {
    res.status(400).json({ error: "type and prompt are required" });
    return;
  }

  const validTypes = listAgentTypes();
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `Invalid agent type. Valid types: ${validTypes.join(", ")}` });
    return;
  }

  try {
    const id = spawnTask(type, prompt);
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

export default router;
