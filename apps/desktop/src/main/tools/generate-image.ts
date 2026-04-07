import { tool } from "ai";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Provider } from "@tomu/core";
import { decrypt } from "../crypto.js";
import { getConfigDir } from "../db.js";

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
  return readProviders().find((p) => p.type === "gemini" && p.enabled && p.api_key);
}


const MODEL_PRIORITY = [
  "nano-banana-2",
  "nano-banana-pro",
  "nano-banana",
  "gemini-3-pro-image",
  "gemini-2.5-flash-image",
  "gemini-2.0-flash",
];

interface GeminiModel {
  name: string;
  supportedGenerationMethods?: string[];
}

async function fetchBestImageModel(provider: Provider): Promise<string | null> {
  const apiKey = provider.api_key ? decrypt(provider.api_key) : "";
  const baseUrl = provider.base_url || "https://generativelanguage.googleapis.com";
  const res = await fetch(`${baseUrl}/v1beta/models?key=${apiKey}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { models?: GeminiModel[] };
  const ids = (data.models ?? [])
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
  for (const priority of MODEL_PRIORITY) {
    const match = ids.find((id) => id.includes(priority));
    if (match) return match;
  }
  return ids[0] ?? null;
}

function extractModelShortId(fullName: string): string {
  return fullName.startsWith("models/") ? fullName.slice(7) : fullName;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGenerateImageTool(_threadId?: string) {
  return {
    GenerateImage: tool({
      description:
        "Generate an AI image from a text prompt and display it in the conversation as a photo card. Always use this tool instead of Bash when the user asks to generate or create an image.",
      inputSchema: z.object({
        prompt: z.string().describe("Text description of the image to generate"),
        model: z.string().optional().describe("Gemini model ID (auto-selected if not specified)"),
      }),
      execute: async ({ prompt, model }) => {
        const provider = getEnabledGeminiProvider();
        if (!provider) {
          return JSON.stringify({ error: "No Gemini provider configured. Add a Gemini provider with an API key in Settings." });
        }

        const apiKey = provider.api_key ? decrypt(provider.api_key) : "";
        const baseUrl = provider.base_url || "https://generativelanguage.googleapis.com";

        let modelId: string;
        if (model) {
          modelId = model.startsWith("models/") ? model : `models/${model}`;
        } else {
          const best = await fetchBestImageModel(provider);
          if (!best) {
            return JSON.stringify({ error: "No image-capable Gemini model found." });
          }
          modelId = best;
        }

        const shortModelId = extractModelShortId(modelId);
        const apiUrl = `${baseUrl}/v1beta/models/${shortModelId}:generateContent?key=${apiKey}`;

        const body = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        };

        let genRes: Response;
        try {
          genRes = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } catch (e) {
          return JSON.stringify({ error: `Network error: ${e instanceof Error ? e.message : String(e)}` });
        }

        if (!genRes.ok) {
          const errText = await genRes.text().catch(() => genRes.statusText);
          return JSON.stringify({ error: `Gemini API error: ${errText}` });
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
        let imageData: { mimeType: string; data: string } | null = null;

        for (const part of responseParts) {
          if (part.inlineData) {
            imageData = part.inlineData;
            break;
          }
        }

        if (!imageData) {
          return JSON.stringify({ error: "Gemini returned no image data." });
        }

        const { mimeType, data } = imageData;
        const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";

        const imagesDir = path.join(getConfigDir(), "generated-images");
        fs.mkdirSync(imagesDir, { recursive: true });
        const filename = `tomu-gen-${Date.now()}.${ext}`;
        const filePath = path.join(imagesDir, filename);
        fs.writeFileSync(filePath, Buffer.from(data, "base64"));

        return JSON.stringify({
          success: true,
          imageUrl: `/api/generated-images/${filename}`,
          prompt,
          description: `Image "${prompt}" generated successfully.`,
        });
      },
    }),
  };
}
