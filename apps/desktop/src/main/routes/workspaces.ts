import { Router, type Router as RouterType } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import { getConfigDir } from "../db.js";

const router: RouterType = Router();

interface Workspace {
  id: string;
  name: string;
  path: string;
}

function getWorkspacesDir(): string {
  return path.join(getConfigDir(), "workspaces");
}

function readWorkspaces(): Workspace[] {
  const dir = getWorkspacesDir();
  fs.mkdirSync(dir, { recursive: true });
  const indexPath = path.join(dir, "index.json");
  try {
    const raw = fs.readFileSync(indexPath, "utf-8");
    return JSON.parse(raw) as Workspace[];
  } catch {
    // Return a default workspace
    const defaults: Workspace[] = [{ id: "default", name: "default", path: path.join(dir, "default") }];
    fs.writeFileSync(indexPath, JSON.stringify(defaults, null, 2), "utf-8");
    return defaults;
  }
}

function writeWorkspaces(workspaces: Workspace[]): void {
  const indexPath = path.join(getWorkspacesDir(), "index.json");
  fs.writeFileSync(indexPath, JSON.stringify(workspaces, null, 2), "utf-8");
}

router.get("/workspaces", (_req, res) => {
  res.json(readWorkspaces());
});

router.put("/workspaces/:id", (req, res) => {
  const { path: newPath } = req.body as { path?: string };
  if (!newPath) {
    res.status(400).json({ error: "path is required" });
    return;
  }
  const workspaces = readWorkspaces();
  const idx = workspaces.findIndex((w) => w.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: "Workspace not found" });
    return;
  }
  workspaces[idx].path = newPath;
  writeWorkspaces(workspaces);
  res.json({});
});

export default router;
