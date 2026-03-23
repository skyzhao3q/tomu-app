import { Router, type Router as RouterType } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import { getConfigDir } from "../db.js";

const router: RouterType = Router();

interface EmotionState {
  mood: string;
  energy: number;
  valence: number;
  notes?: string;
}

interface EmotionContext {
  chatId: string;
  mood: string;
  energy?: number;
  notes?: string;
}

interface EmotionStore {
  base: EmotionState;
  contexts: Record<string, EmotionContext>;
}

const DEFAULT_STATE: EmotionState = { mood: "neutral", energy: 0.5, valence: 0.5 };

function getStorePath(): string {
  return path.join(getConfigDir(), "emotion.json");
}

function readStore(): EmotionStore {
  try {
    const raw = fs.readFileSync(getStorePath(), "utf-8");
    return JSON.parse(raw) as EmotionStore;
  } catch {
    return { base: { ...DEFAULT_STATE }, contexts: {} };
  }
}

function writeStore(store: EmotionStore): void {
  fs.writeFileSync(getStorePath(), JSON.stringify(store, null, 2), "utf-8");
}

router.get("/emotion", (_req, res) => {
  const store = readStore();
  res.json(store.base);
});

router.get("/emotion/:chatId", (req, res) => {
  const store = readStore();
  const ctx = store.contexts[req.params.chatId];
  if (ctx) {
    res.json(ctx);
  } else {
    res.json({ ...store.base, chatId: req.params.chatId });
  }
});

router.post("/emotion/base", (req, res) => {
  const { mood, energy, valence, notes } = req.body as {
    mood?: string; energy?: number; valence?: number; notes?: string;
  };
  if (!mood) {
    res.status(400).json({ error: "mood is required" });
    return;
  }
  const store = readStore();
  store.base = { mood, energy: energy ?? store.base.energy, valence: valence ?? store.base.valence, notes };
  writeStore(store);
  res.json({});
});

router.post("/emotion/context", (req, res) => {
  const { chatId, mood, energy, notes } = req.body as {
    chatId?: string; mood?: string; energy?: number; notes?: string;
  };
  if (!chatId || !mood) {
    res.status(400).json({ error: "chatId and mood are required" });
    return;
  }
  const store = readStore();
  store.contexts[chatId] = { chatId, mood, energy, notes };
  writeStore(store);
  res.json({});
});

export default router;
