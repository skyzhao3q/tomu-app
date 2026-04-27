import { Router, type Router as RouterType } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { getConfigDir } from "../db.js";
import type { Request, Response } from "express";

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

router.get("/generated-images/:filename", (req: Request, res: Response) => {
  const rawFilename = req.params.filename;
  const filename = Array.isArray(rawFilename) ? rawFilename[0] : rawFilename;
  // Prevent path traversal
  if (filename.includes("/") || filename.includes("..")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }
  const filePath = path.join(getConfigDir(), "generated-images", filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const imgData = fs.readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.end(imgData);
});

export default router;
