import { Router, type Router as RouterType } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import { getConfigDir } from "../db.js";
import type { Message } from "@tomu/core";

const router: RouterType = Router();

function getSnapshotsDir(): string {
  return path.join(getConfigDir(), "workspaces", "default", ".tomu-snapshots");
}

router.delete("/messages/:chatId/:messageId", (req, res) => {
  const { chatId, messageId } = req.params;
  const historyPath = path.join(getSnapshotsDir(), chatId, "history.json");
  try {
    const raw = fs.readFileSync(historyPath, "utf-8");
    const data = JSON.parse(raw) as { messages: Message[] };
    const before = data.messages.length;
    data.messages = data.messages.filter((m) => (m as Message & { id?: string }).id !== messageId);
    if (data.messages.length === before) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    fs.writeFileSync(historyPath, JSON.stringify(data, null, 2), "utf-8");
    res.json({});
  } catch {
    res.status(404).json({ error: "Thread not found" });
  }
});

export default router;
