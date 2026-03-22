import { Router, type Router as RouterType } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { ProviderSchema, type Provider, type Model } from "@tomu/core";
import { encrypt, decrypt, maskApiKey } from "../crypto.js";
import { getConfigDir } from "../db.js";

const router: RouterType = Router();

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

interface ProviderStore {
  providers: Provider[];
}

function getStorePath(): string {
  return path.join(getConfigDir(), "providers.json");
}

function readProviders(): Provider[] {
  try {
    const raw = fs.readFileSync(getStorePath(), "utf-8");
    const store = JSON.parse(raw) as ProviderStore;
    return store.providers;
  } catch {
    return [];
  }
}

function writeProviders(providers: Provider[]): void {
  const store: ProviderStore = { providers };
  fs.writeFileSync(getStorePath(), JSON.stringify(store, null, 2), "utf-8");
}

function maskProvider(p: Provider): Provider {
  return {
    ...p,
    api_key: p.api_key ? maskApiKey(decrypt(p.api_key)) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get("/providers", (_req, res) => {
  const providers = readProviders().map(maskProvider);
  res.json(providers);
});

router.post("/providers", (req, res) => {
  // Relax validation: allow empty models array and optional fields
  const body = { ...req.body, id: crypto.randomUUID(), models: [] };
  const result = ProviderSchema.safeParse(body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const provider = result.data;
  if (provider.api_key) {
    provider.api_key = encrypt(provider.api_key);
  }

  const providers = readProviders();
  providers.push(provider);
  writeProviders(providers);

  res.status(201).json(maskProvider(provider));
});

router.put("/providers/:id", (req, res) => {
  const providers = readProviders();
  const idx = providers.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }

  const existing = providers[idx];
  const updated = { ...existing, ...req.body, id: existing.id };

  // Re-encrypt key if it changed (unmasked key provided)
  if (req.body.api_key && !req.body.api_key.includes("...")) {
    updated.api_key = encrypt(req.body.api_key);
  } else {
    updated.api_key = existing.api_key;
  }

  providers[idx] = updated;
  writeProviders(providers);
  res.json(maskProvider(updated));
});

router.delete("/providers/:id", (req, res) => {
  const providers = readProviders();
  const idx = providers.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }
  providers.splice(idx, 1);
  writeProviders(providers);
  res.status(204).end();
});

router.post("/providers/:id/test", async (req, res) => {
  const providers = readProviders();
  const provider = providers.find((p) => p.id === req.params.id);
  if (!provider) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }

  const apiKey = provider.api_key ? decrypt(provider.api_key) : "";

  try {
    switch (provider.type) {
      case "openai":
      case "openrouter":
      case "custom": {
        const baseUrl = provider.base_url || "https://api.openai.com/v1";
        const resp = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        break;
      }
      case "anthropic": {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        // 200 or 400 (invalid request but valid key) are both OK
        if (resp.status === 401 || resp.status === 403) {
          throw new Error("Invalid API key");
        }
        break;
      }
      case "ollama": {
        const baseUrl = provider.base_url || "http://localhost:11434";
        const resp = await fetch(`${baseUrl}/api/tags`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        break;
      }
      case "gemini": {
        const baseUrl = provider.base_url || "https://generativelanguage.googleapis.com/v1beta";
        const resp = await fetch(`${baseUrl}/models?key=${apiKey}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        break;
      }
    }
    res.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.json({ success: false, error: message });
  }
});

router.post("/providers/:id/models/fetch", async (req, res) => {
  const providers = readProviders();
  const provider = providers.find((p) => p.id === req.params.id);
  if (!provider) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }

  const apiKey = provider.api_key ? decrypt(provider.api_key) : "";

  try {
    let models: Model[] = [];

    switch (provider.type) {
      case "openai":
      case "openrouter":
      case "custom": {
        const baseUrl = provider.base_url || "https://api.openai.com/v1";
        const resp = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as { data: Array<{ id: string }> };
        models = data.data.map((m) => ({
          id: m.id,
          name: m.id,
          provider_id: provider.id,
          context_window: 128000,
          supports_tools: true,
          supports_vision: false,
        }));
        break;
      }
      case "anthropic": {
        models = [
          "claude-opus-4-20250514",
          "claude-sonnet-4-20250514",
          "claude-haiku-4-20250414",
        ].map((id) => ({
          id,
          name: id,
          provider_id: provider.id,
          context_window: 200000,
          supports_tools: true,
          supports_vision: true,
        }));
        break;
      }
      case "ollama": {
        const baseUrl = provider.base_url || "http://localhost:11434";
        const resp = await fetch(`${baseUrl}/api/tags`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as { models: Array<{ name: string }> };
        models = data.models.map((m) => ({
          id: m.name,
          name: m.name,
          provider_id: provider.id,
          context_window: 8192,
          supports_tools: false,
          supports_vision: false,
        }));
        break;
      }
      case "gemini": {
        const baseUrl = provider.base_url || "https://generativelanguage.googleapis.com/v1beta";
        const resp = await fetch(`${baseUrl}/models?key=${apiKey}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as { models: Array<{ name: string; displayName: string }> };
        models = data.models.map((m) => ({
          id: m.name,
          name: m.displayName,
          provider_id: provider.id,
          context_window: 128000,
          supports_tools: true,
          supports_vision: true,
        }));
        break;
      }
    }

    // Save fetched models to provider
    provider.models = models;
    const idx = providers.findIndex((p) => p.id === provider.id);
    providers[idx] = provider;
    writeProviders(providers);

    res.json(models);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
