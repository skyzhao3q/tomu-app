import { Router, type Router as RouterType } from "express";
import type { AgentProfile } from "@tomu/core";
import {
  listAgentProfiles,
  getAgentProfile,
  createAgentProfile,
  updateAgentProfile,
  deleteAgentProfile,
  resetAgentProfile,
  getAgentsGlobalConfig,
  setAgentsGlobalConfig,
} from "../agents.js";

const router: RouterType = Router();

// ---------------------------------------------------------------------------
// GET /settings/agents — full config: global toggles + all profiles
// ---------------------------------------------------------------------------

router.get("/settings/agents", (_req, res) => {
  const { enabled, allowSubagentDelegation } = getAgentsGlobalConfig();
  const profiles = listAgentProfiles();
  res.json({ enabled, allowSubagentDelegation, profiles });
});

// ---------------------------------------------------------------------------
// PUT /settings/agents — update global toggles
// ---------------------------------------------------------------------------

router.put("/settings/agents", (req, res) => {
  const { enabled, allowSubagentDelegation } = req.body as {
    enabled?: boolean;
    allowSubagentDelegation?: boolean;
  };
  setAgentsGlobalConfig({ enabled, allowSubagentDelegation });
  const profiles = listAgentProfiles();
  const cfg = getAgentsGlobalConfig();
  res.json({ ...cfg, profiles });
});

// ---------------------------------------------------------------------------
// POST /settings/agents/profiles — create a custom agent (builtIn forced false)
// ---------------------------------------------------------------------------

router.post("/settings/agents/profiles", (req, res) => {
  const data = req.body as Omit<AgentProfile, "builtIn">;
  if (!data.id || !data.name) {
    res.status(400).json({ error: "id and name are required" });
    return;
  }
  // Validate ID format
  if (!/^[a-z0-9-]+$/.test(data.id)) {
    res.status(400).json({ error: "id must contain only lowercase letters, numbers, and hyphens" });
    return;
  }
  if (getAgentProfile(data.id)) {
    res.status(409).json({ error: `Agent with id '${data.id}' already exists` });
    return;
  }
  try {
    const profile = createAgentProfile(data);
    res.status(201).json(profile);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create agent";
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// PUT /settings/agents/profiles/:id — update a profile
// ---------------------------------------------------------------------------

router.put("/settings/agents/profiles/:id", (req, res) => {
  const { id } = req.params;
  const patch = req.body as Partial<AgentProfile>;
  try {
    const updated = updateAgentProfile(id, patch);
    res.json(updated);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    const message = e instanceof Error ? e.message : "Failed to update agent";
    res.status(status).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /settings/agents/profiles/:id — delete a custom agent
// ---------------------------------------------------------------------------

router.delete("/settings/agents/profiles/:id", (req, res) => {
  const { id } = req.params;
  try {
    const deleted = deleteAgentProfile(id);
    if (!deleted) {
      res.status(404).json({ error: "Agent not found" });
      return;
    }
    res.status(204).end();
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    const message = e instanceof Error ? e.message : "Failed to delete agent";
    res.status(status).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// POST /settings/agents/profiles/:id/reset — reset built-in prompt
// ---------------------------------------------------------------------------

router.post("/settings/agents/profiles/:id/reset", (req, res) => {
  const { id } = req.params;
  try {
    const profile = resetAgentProfile(id);
    res.json(profile);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    const message = e instanceof Error ? e.message : "Failed to reset agent";
    res.status(status).json({ error: message });
  }
});

export default router;
