import { Router, type Router as RouterType } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { Provider } from "@tomu/core";
import { decrypt } from "../crypto.js";
import { getConfigDir } from "../db.js";

const router: RouterType = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readProviders(): Provider[] {
  try {
    const raw = fs.readFileSync(
      path.join(getConfigDir(), "providers.json"),
      "utf-8",
    );
    const store = JSON.parse(raw) as { providers: Provider[] };
    return store.providers;
  } catch {
    return [];
  }
}

function getEnabledGeminiProvider(): Provider | undefined {
  const providers = readProviders();
  return providers.find((p) => p.type === "gemini" && p.enabled && p.api_key);
}

interface GeminiModel {
  name: string;
  supportedGenerationMethods?: string[];
}

async function fetchGeminiImageModelIds(provider: Provider): Promise<string[]> {
  const apiKey = provider.api_key ? decrypt(provider.api_key) : "";
  const baseUrl = provider.base_url || "https://generativelanguage.googleapis.com";
  const url = `${baseUrl}/v1beta/models?key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch Gemini models: ${res.statusText}`);
  }

  const data = (await res.json()) as { models?: GeminiModel[] };
  const models = data.models ?? [];

  return models
    .filter((m) => {
      const methods = m.supportedGenerationMethods ?? [];
      const name = m.name ?? "";
      return (
        methods.includes("generateContent") &&
        (name.includes("image") || name.includes("nano-banana")) &&
        !name.includes("imagen")
      );
    })
    .map((m) => m.name);
}

const MODEL_PRIORITY = [
  "nano-banana-2",
  "nano-banana-pro",
  "nano-banana",
  "gemini-3-pro-image",
  "gemini-2.5-flash-image",
  "gemini-2.0-flash",
];

function pickBestImageModel(modelIds: string[]): string | null {
  for (const priority of MODEL_PRIORITY) {
    const match = modelIds.find((id) => id.includes(priority));
    if (match) return match;
  }
  // Fallback: return first available
  return modelIds[0] ?? null;
}

function extractModelShortId(fullName: string): string {
  // "models/gemini-2.0-flash-exp-image-generation" → "gemini-2.0-flash-exp-image-generation"
  return fullName.startsWith("models/") ? fullName.slice(7) : fullName;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get("/image/models", async (_req, res) => {
  const provider = getEnabledGeminiProvider();
  if (!provider) {
    res.json([]);
    return;
  }

  try {
    const modelIds = await fetchGeminiImageModelIds(provider);
    const bestId = pickBestImageModel(modelIds);

    const models = modelIds.map((id) => ({
      id: extractModelShortId(id),
      name: extractModelShortId(id),
      provider: "gemini",
      best: id === bestId,
    }));

    res.json(models);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Failed to fetch models" });
  }
});

router.post("/image/generate", async (req, res) => {
  const { prompt, model, reference } = req.body as {
    prompt?: string;
    model?: string;
    reference?: string;
  };

  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const provider = getEnabledGeminiProvider();
  if (!provider) {
    res.status(503).json({ error: "No Gemini provider configured. Add a Gemini provider with an API key." });
    return;
  }

  const apiKey = provider.api_key ? decrypt(provider.api_key) : "";
  const baseUrl = provider.base_url || "https://generativelanguage.googleapis.com";

  try {
    let modelId: string;
    if (model) {
      modelId = model.startsWith("models/") ? model : `models/${model}`;
    } else {
      const modelIds = await fetchGeminiImageModelIds(provider);
      const best = pickBestImageModel(modelIds);
      if (!best) {
        res.status(503).json({ error: "No image-capable Gemini model found." });
        return;
      }
      modelId = best;
    }

    // Build parts — prepend reference image if provided
    const parts: unknown[] = [];
    if (reference) {
      try {
        if (reference.startsWith("data:")) {
          const mimeMatch = reference.match(/^data:([^;]+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
          const b64 = reference.replace(/^data:[^;]+;base64,/, "");
          parts.push({ inlineData: { mimeType, data: b64 } });
        } else if (fs.existsSync(reference)) {
          const imgData = fs.readFileSync(reference);
          const ext = path.extname(reference).toLowerCase().replace(".", "");
          const mimeType = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";
          parts.push({ inlineData: { mimeType, data: imgData.toString("base64") } });
        }
      } catch {
        // Ignore reference errors — proceed without it
      }
    }
    parts.push({ text: prompt });

    const shortModelId = extractModelShortId(modelId);
    const apiUrl = `${baseUrl}/v1beta/models/${shortModelId}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ parts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    };

    const genRes = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!genRes.ok) {
      const errText = await genRes.text().catch(() => genRes.statusText);
      res.status(502).json({ error: `Gemini API error: ${errText}` });
      return;
    }

    const genData = (await genRes.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            inlineData?: { mimeType: string; data: string };
          }>;
        };
      }>;
    };

    const responseParts = genData.candidates?.[0]?.content?.parts ?? [];
    let savedPath: string | null = null;

    for (const part of responseParts) {
      if (part.inlineData) {
        const { mimeType, data } = part.inlineData;
        const ext = mimeType.includes("png") ? "png" : "jpg";
        const timestamp = Date.now();
        const filePath = path.join("/tmp", `tomu-gen-${timestamp}.${ext}`);
        fs.writeFileSync(filePath, Buffer.from(data, "base64"));
        savedPath = filePath;
        break;
      }
    }

    if (!savedPath) {
      res.status(502).json({ error: "Gemini returned no image data." });
      return;
    }

    const id = crypto.randomUUID();
    res.json({ id, path: savedPath, model: shortModelId, prompt });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Image generation failed" });
  }
});

router.post("/image/edit", async (req, res) => {
  const { prompt, imageUrl, filePath: inputFilePath } = req.body as {
    prompt?: string;
    imageUrl?: string;
    filePath?: string;
  };

  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  const provider = getEnabledGeminiProvider();
  if (!provider) {
    res.status(503).json({ error: "No Gemini provider configured." });
    return;
  }

  const apiKey = provider.api_key ? decrypt(provider.api_key) : "";
  const baseUrl = provider.base_url || "https://generativelanguage.googleapis.com";

  try {
    const modelIds = await fetchGeminiImageModelIds(provider);
    const best = pickBestImageModel(modelIds);
    if (!best) {
      res.status(503).json({ error: "No image-capable Gemini model found." });
      return;
    }
    const shortModelId = extractModelShortId(best);

    const parts: unknown[] = [];

    // Load input image
    const inputSrc = inputFilePath || imageUrl;
    if (inputSrc) {
      try {
        if (inputSrc.startsWith("data:")) {
          const mimeMatch = inputSrc.match(/^data:([^;]+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
          const b64 = inputSrc.replace(/^data:[^;]+;base64,/, "");
          parts.push({ inlineData: { mimeType, data: b64 } });
        } else if (fs.existsSync(inputSrc)) {
          const imgData = fs.readFileSync(inputSrc);
          const ext = path.extname(inputSrc).toLowerCase().replace(".", "");
          const mimeType = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";
          parts.push({ inlineData: { mimeType, data: imgData.toString("base64") } });
        }
      } catch {
        // proceed without input image
      }
    }
    parts.push({ text: prompt });

    const apiUrl = `${baseUrl}/v1beta/models/${shortModelId}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    };

    const genRes = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!genRes.ok) {
      const errText = await genRes.text().catch(() => genRes.statusText);
      res.status(502).json({ error: `Gemini API error: ${errText}` });
      return;
    }

    const genData = (await genRes.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            inlineData?: { mimeType: string; data: string };
          }>;
        };
      }>;
    };

    const responseParts = genData.candidates?.[0]?.content?.parts ?? [];
    let savedPath: string | null = null;

    for (const part of responseParts) {
      if (part.inlineData) {
        const { mimeType, data } = part.inlineData;
        const ext = mimeType.includes("png") ? "png" : "jpg";
        const timestamp = Date.now();
        const filePath = path.join("/tmp", `tomu-edit-${timestamp}.${ext}`);
        fs.writeFileSync(filePath, Buffer.from(data, "base64"));
        savedPath = filePath;
        break;
      }
    }

    if (!savedPath) {
      res.status(502).json({ error: "Gemini returned no image data." });
      return;
    }

    const id = crypto.randomUUID();
    res.json({ id, path: savedPath, model: shortModelId, prompt });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Image edit failed" });
  }
});

export default router;
