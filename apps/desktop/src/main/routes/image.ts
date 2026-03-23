import { Router, type Router as RouterType } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { getConfigDir } from "../db.js";

const router: RouterType = Router();

const IMAGE_MODELS = [
  { id: "dall-e-3", name: "DALL-E 3", provider: "openai" },
  { id: "dall-e-2", name: "DALL-E 2", provider: "openai" },
];

interface ImageConfig {
  apiKey?: string;
}

function getImageConfig(): ImageConfig {
  try {
    const raw = fs.readFileSync(path.join(getConfigDir(), "image.json"), "utf-8");
    return JSON.parse(raw) as ImageConfig;
  } catch {
    return {};
  }
}

router.get("/image/models", (_req, res) => {
  res.json(IMAGE_MODELS);
});

router.post("/image/generate", (req, res) => {
  const { prompt, model } = req.body as { prompt?: string; model?: string; reference?: string };
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }
  const config = getImageConfig();
  if (!config.apiKey) {
    res.status(503).json({ error: "Image API key not configured. Run: tomu image config <key>" });
    return;
  }
  // Stub response — real implementation would call OpenAI/image provider
  const id = crypto.randomUUID();
  res.json({ id, url: `https://example.com/generated/${id}.png`, model: model ?? "dall-e-3", prompt });
});

router.post("/image/edit", (req, res) => {
  const { prompt } = req.body as { prompt?: string; imageUrl?: string };
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }
  const config = getImageConfig();
  if (!config.apiKey) {
    res.status(503).json({ error: "Image API key not configured. Run: tomu image config <key>" });
    return;
  }
  const id = crypto.randomUUID();
  res.json({ id, url: `https://example.com/edited/${id}.png`, prompt });
});

export default router;
