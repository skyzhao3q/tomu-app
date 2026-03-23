import { Router, type Router as RouterType } from "express";
import {
  listPlugins,
  installPlugin,
  uninstallPlugin,
  getPluginSettings,
  setPluginSettings,
} from "../plugins.js";

const router: RouterType = Router();

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// List installed plugins
router.get("/plugins", (_req, res) => {
  const plugins = listPlugins();
  res.json(plugins);
});

// Install plugin from local directory
router.post("/plugins", (req, res) => {
  const { source } = req.body as { source?: string };
  if (!source) {
    res.status(400).json({ error: "source is required" });
    return;
  }

  try {
    const plugin = installPlugin(source);
    res.status(201).json(plugin);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(400).json({ error: message });
  }
});

// Uninstall plugin
router.delete("/plugins/:name", (req, res) => {
  const removed = uninstallPlugin(req.params.name);
  if (!removed) {
    res.status(404).json({ error: "Plugin not found" });
    return;
  }
  res.status(204).end();
});

// Get plugin settings
router.get("/plugins/:name/settings", (req, res) => {
  const settings = getPluginSettings(req.params.name);
  res.json(settings);
});

// Update plugin settings
router.put("/plugins/:name/settings", (req, res) => {
  const settings = req.body as Record<string, unknown>;
  setPluginSettings(req.params.name, settings);
  res.json(settings);
});

export default router;
