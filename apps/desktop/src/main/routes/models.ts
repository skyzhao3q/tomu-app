import { Router, type Router as RouterType } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import { getConfigDir } from "../db.js";

const router: RouterType = Router();

interface ProviderStore {
  providers: Array<{
    id: string;
    name: string;
    type: string;
    models?: Array<{ id: string; name?: string }>;
  }>;
}

router.get("/models", (_req, res) => {
  const storePath = path.join(getConfigDir(), "providers.json");
  let models: Array<{ id: string; name: string; provider: string }> = [];
  try {
    const raw = fs.readFileSync(storePath, "utf-8");
    const store = JSON.parse(raw) as ProviderStore;
    for (const provider of store.providers) {
      if (provider.models) {
        for (const m of provider.models) {
          models.push({ id: m.id, name: m.name ?? m.id, provider: provider.id });
        }
      }
    }
  } catch {
    // No providers configured
  }
  res.json(models);
});

export default router;
