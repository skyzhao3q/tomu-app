import { Router, type Router as RouterType } from "express";
import { ConfigSchema } from "@tomu/core";
import { getConfig, saveConfig } from "../db.js";

const router: RouterType = Router();

router.get("/settings", (_req, res) => {
  const config = getConfig();
  res.json(config);
});

router.put("/settings", (req, res) => {
  const result = ConfigSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }
  saveConfig(result.data);
  res.json(result.data);
});

export default router;
